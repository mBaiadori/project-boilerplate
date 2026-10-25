import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runIsolatedScript } from './script-runner.js';
import { customToolsService, computeToolHash } from './custom-tools.service.js';
import { buildApp } from '../../app.js';
import { getSessionToken } from '../../security/session.js';

describe('Fase 1 (S3, S4, B4): Custom Tools Sandbox Escape Prevention & Strict Approvals', () => {
  let tmpRepoDir: string;
  let app: any;

  beforeEach(async () => {
    tmpRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'custom-tools-test-'));
    app = await buildApp();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    try {
      fs.rmSync(tmpRepoDir, { recursive: true, force: true });
    } catch {}
  });

  test('1.1.1: Buffer.constructor.constructor("return process")() não deve retornar o objeto process do host', async () => {
    let escapedProcess: any = null;
    let didThrow = false;
    try {
      escapedProcess = await runIsolatedScript({
        code: `
          const proc = Buffer.constructor.constructor('return process')();
          return proc ? proc.pid : null;
        `,
        args: {},
        context: { repoName: 'test-repo' },
        safeRepoDir: tmpRepoDir,
        timeoutMs: 3000,
      });
    } catch (err) {
      didThrow = true;
    }

    assert.ok(
      didThrow || escapedProcess === null || escapedProcess === undefined,
      `VIOLAÇÃO S3: O sandbox permitiu escape de process via Buffer.constructor.constructor (pid obtido: ${escapedProcess})`
    );
  });

  test('1.1.2: (async()=>{}).constructor("return process")() deve ser bloqueado por codeGeneration={strings:false}', async () => {
    let didThrow = false;
    try {
      await runIsolatedScript({
        code: `
          const fn = (async()=>{}).constructor('return process');
          return fn() ? fn().pid : null;
        `,
        args: {},
        context: { repoName: 'test-repo' },
        safeRepoDir: tmpRepoDir,
        timeoutMs: 3000,
      });
    } catch (err: any) {
      didThrow = true;
      assert.ok(
        err.message.includes('disallowed') ||
        err.message.includes('Code generation') ||
        err.message.includes('not a function') ||
        err.message.includes('Acesso negado'),
        `Mensagem esperada de bloqueio de code generation: ${err.message}`
      );
    }

    assert.strictEqual(didThrow, true, 'VIOLAÇÃO S3: (async()=>{}).constructor compilou string em runtime');
  });

  test('1.1.3: Tentativa de rede via fetch deve falhar ou ser bloqueada', async () => {
    let didThrow = false;
    try {
      await runIsolatedScript({
        code: `
          if (typeof fetch === 'function') {
            await fetch('http://127.0.0.1:54321');
          } else {
            throw new Error('fetch is not defined');
          }
          return 'connected';
        `,
        args: {},
        context: { repoName: 'test-repo' },
        safeRepoDir: tmpRepoDir,
        timeoutMs: 3000,
      });
    } catch (err: any) {
      didThrow = true;
    }

    assert.strictEqual(didThrow, true, 'VIOLAÇÃO S3: fetch não deve estar acessível dentro do sandbox');
  });

  test('1.1.4: Escrita através de pasta pai que é symlink para fora deve ser rejeitada (B4)', async () => {
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'outside-target-'));
    const symlinkDir = path.join(tmpRepoDir, 'symlink-folder');
    fs.symlinkSync(outsideDir, symlinkDir, 'dir');

    let didThrow = false;
    try {
      await runIsolatedScript({
        code: `
          utils.writeProjectFile('symlink-folder/evil.txt', 'pwned');
          return true;
        `,
        args: {},
        context: { repoName: 'test-repo' },
        safeRepoDir: tmpRepoDir,
        timeoutMs: 3000,
      });
    } catch (err: any) {
      didThrow = true;
      assert.ok(
        err.message.includes('symlink') ||
        err.message.includes('fora do diretório') ||
        err.message.includes('negado') ||
        err.message.includes('restricted') ||
        err.message.includes('ERR_ACCESS_DENIED'),
        `Erro esperado de symlink escape: ${err.message}`
      );
    } finally {
      try {
        fs.rmSync(outsideDir, { recursive: true, force: true });
      } catch {}
    }

    assert.strictEqual(didThrow, true, 'VIOLAÇÃO B4: Escrita permitida através de symlink para fora do repositório');
  });

  test('1.1.5: Rota de aprovação deve exigir cabeçalho X-ContextOS-Confirm e registrar identidade real do usuário (S4)', async () => {
    const dummyTool = {
      name: 'secure_sample_tool',
      description: 'Uma ferramenta segura de teste',
      handler_type: 'javascript' as const,
      handler_code: 'return 42;',
    };

    const saved = customToolsService.saveCustomTool(tmpRepoDir, dummyTool);
    const tool = saved.tool;
    const currentHash = computeToolHash(tool);
    const token = getSessionToken();

    // 1. Tenta aprovar sem o cabeçalho X-ContextOS-Confirm -> Deve responder 409 Conflict
    const resNoHeader = await app.inject({
      method: 'POST',
      url: `/api/aicenter/custom-tools/${tool.id}/approve`,
      headers: {
        host: '127.0.0.1:4100',
        'x-contextos-token': token,
      },
      payload: {
        repo: tmpRepoDir,
      },
    });

    assert.strictEqual(
      resNoHeader.statusCode,
      409,
      'VIOLAÇÃO S4: Rota de aprovação permitiu aprovação sem o cabeçalho X-ContextOS-Confirm'
    );

    // 2. Tenta aprovar com hash divergente -> Deve responder 403 ou 409
    const resWrongHash = await app.inject({
      method: 'POST',
      url: `/api/aicenter/custom-tools/${tool.id}/approve`,
      headers: {
        host: '127.0.0.1:4100',
        'x-contextos-token': token,
        'x-contextos-confirm': 'invalid-hash-12345',
      },
      payload: {
        repo: tmpRepoDir,
      },
    });

    assert.ok(
      resWrongHash.statusCode === 403 || resWrongHash.statusCode === 409,
      'VIOLAÇÃO S4: Rota de aprovação aceitou confirmação com hash divergente ou sem desafio'
    );

    // 3. Solicita desafio de aprovação e aprova com headers válidos -> Deve responder 200 e gravar identidade real
    const challengeRes = await app.inject({
      method: 'POST',
      url: `/api/aicenter/custom-tools/${tool.id}/request-approval`,
      headers: {
        host: '127.0.0.1:4100',
        'x-contextos-token': token,
      },
      payload: {
        repo: tmpRepoDir,
      },
    });
    assert.strictEqual(challengeRes.statusCode, 200);
    const { challenge_id } = JSON.parse(challengeRes.payload);

    const resSuccess = await app.inject({
      method: 'POST',
      url: `/api/aicenter/custom-tools/${tool.id}/approve`,
      headers: {
        host: '127.0.0.1:4100',
        'x-contextos-token': token,
        'x-contextos-confirm': currentHash,
        'x-contextos-challenge': challenge_id,
      },
      payload: {
        repo: tmpRepoDir,
      },
    });

    assert.strictEqual(resSuccess.statusCode, 200);

    const approvalStatus = customToolsService.isToolApproved(tmpRepoDir, tool);
    assert.strictEqual(approvalStatus.approved, true);

    const approvals = (customToolsService as any).loadApprovals();
    const records = Object.values(approvals) as any[];
    const approvalRecord = records.find((r) => r.hash === currentHash);
    assert.ok(approvalRecord, 'Registro de aprovação deve existir em loadApprovals()');
    assert.ok(
      approvalRecord.approved_by !== 'user',
      `VIOLAÇÃO S4: approved_by gravou literal 'user' em vez da identidade real: ${approvalRecord.approved_by}`
    );
  });
});
