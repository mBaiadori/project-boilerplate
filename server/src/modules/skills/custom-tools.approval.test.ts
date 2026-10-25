import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { customToolsService, computeToolHash } from './custom-tools.service.js';
import { buildApp } from '../../app.js';
import { getSessionToken } from '../../security/session.js';

describe('Fase 00 (A1): Custom Tool Approval Integrity & Challenge-Response Flow', () => {
  let tmpRepoDir: string;
  let app: any;

  beforeEach(async () => {
    tmpRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tool-approval-test-'));
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

  test('0.1: Chamar request-approval deve retornar challenge_id e expiração sem vazar o hash', async () => {
    const { tool } = customToolsService.saveCustomTool(tmpRepoDir, {
      name: 'test_sec_tool',
      description: 'Ferramenta para validação de segurança',
      type: 'script',
      entrypoint: 'tool.js',
    } as any);

    const token = getSessionToken();

    const res = await app.inject({
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

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.challenge_id, 'Deve retornar challenge_id');
    assert.strictEqual(typeof body.challenge_id, 'string');
    assert.strictEqual(body.expires_in_sec, 60);
    assert.strictEqual(body.required_hash, undefined, 'NÃO deve expor required_hash no retorno');
    assert.strictEqual(body.expected_hash, undefined, 'NÃO deve expor expected_hash no retorno');
  });

  test('0.2: Tentativa de aprovação sem challenge ou com hash incorreto não deve vazar required_hash no 409/403', async () => {
    const { tool } = customToolsService.saveCustomTool(tmpRepoDir, {
      name: 'test_sec_tool_2',
      description: 'Ferramenta para validação sem vazamento',
      type: 'script',
      entrypoint: 'tool.js',
    } as any);

    const token = getSessionToken();

    // 1. Sem challenge
    const resNoChallenge = await app.inject({
      method: 'POST',
      url: `/api/aicenter/custom-tools/${tool.id}/approve`,
      headers: {
        host: '127.0.0.1:4100',
        'x-contextos-token': token,
        'x-contextos-confirm': 'random_hash_value',
      },
      payload: {
        repo: tmpRepoDir,
      },
    });

    assert.ok(
      resNoChallenge.statusCode === 403 || resNoChallenge.statusCode === 409,
      `Deveria rejeitar com 403 ou 409, recebeu ${resNoChallenge.statusCode}`
    );
    const bodyNoChallenge = JSON.parse(resNoChallenge.payload);
    assert.strictEqual(
      bodyNoChallenge.required_hash,
      undefined,
      'VIOLAÇÃO A1: endpoint vazou required_hash no payload de erro'
    );
    assert.strictEqual(
      bodyNoChallenge.provided_hash,
      undefined,
      'VIOLAÇÃO A1: endpoint vazou provided_hash no payload de erro'
    );
  });

  test('0.3: Fluxo legítimo em duas etapas (request-approval -> approve com challenge) deve aprovar e ser de uso único', async () => {
    const { tool } = customToolsService.saveCustomTool(tmpRepoDir, {
      name: 'test_sec_tool_3',
      description: 'Ferramenta para aprovação legítima com desafio',
      type: 'script',
      entrypoint: 'tool.js',
    } as any);

    const currentHash = computeToolHash(tool);
    const token = getSessionToken();

    // 1. Solicita desafio
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

    // 2. Aprova usando o challenge e hash correto
    const approveRes = await app.inject({
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

    assert.strictEqual(approveRes.statusCode, 200);
    const approveBody = JSON.parse(approveRes.payload);
    assert.strictEqual(approveBody.success, true);

    const isApproved = customToolsService.isToolApproved(tmpRepoDir, tool);
    assert.strictEqual(isApproved.approved, true);

    // 3. Replay attack: tentar reaproveitar o mesmo challenge_id deve falhar
    const replayRes = await app.inject({
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

    assert.ok(
      replayRes.statusCode === 403 || replayRes.statusCode === 409,
      'Replay attack com challenge já consumido deve ser bloqueado'
    );
  });
});
