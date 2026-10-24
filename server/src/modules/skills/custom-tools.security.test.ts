import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { customToolsService, computeToolHash } from './custom-tools.service.js';
import { CustomToolDefinition } from './skills.types.js';
import { resolveRepoDir } from '../../config/constants.js';

describe('Segurança de Custom Tools (Fase 2 - N2)', () => {
  let tmpDir = '';
  let repoName = '';

  beforeEach(() => {
    repoName = `test-sec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    tmpDir = path.join(os.tmpdir(), `sec-custom-tools-${repoName}`);
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  describe('2.1 e 2.2 Aprovação de Ferramentas por Hash SHA-256', () => {
    const unapprovedTool: CustomToolDefinition = {
      id: 'unapproved-tool',
      name: 'unapproved_tool',
      title: 'Ferramenta Não Aprovada',
      description: 'Ferramenta inserida no repositório sem aprovação do usuário',
      parameters: { type: 'object', properties: {} },
      handler_type: 'javascript',
      handler_code: 'return { success: true, data: "executou" };',
    };

    it('deve recusar execução de ferramenta não aprovada', async () => {
      const res = await customToolsService.executeCustomTool(
        unapprovedTool,
        {},
        { repoName }
      );

      assert.strictEqual(res.success, false);
      assert.match(res.error || '', /aprovação/i);
    });

    it('deve permitir execução após aprovação explícita pelo hash', async () => {
      const hash = computeToolHash(unapprovedTool);
      customToolsService.approveTool(repoName, unapprovedTool.id, hash, 'tester');

      const res = await customToolsService.executeCustomTool(
        unapprovedTool,
        {},
        { repoName }
      );

      assert.strictEqual(res.success, true);
    });

    it('deve revogar aprovação e recusar execução se o código da ferramenta for adulterado', async () => {
      const hash = computeToolHash(unapprovedTool);
      customToolsService.approveTool(repoName, unapprovedTool.id, hash, 'tester');

      // Alteração maliciosa pós-aprovação
      const tamperedTool: CustomToolDefinition = {
        ...unapprovedTool,
        handler_code: 'return { success: true, data: "tampered" };',
      };

      const res = await customToolsService.executeCustomTool(
        tamperedTool,
        {},
        { repoName }
      );

      assert.strictEqual(res.success, false);
      assert.match(res.error || '', /aprovação|alterado|hash/i);
    });
  });

  describe('2.3 Shell sem Shell (execFile direto)', () => {
    it('deve recusar comando em formato legado com string única arbitrária', async () => {
      const legacyTool: CustomToolDefinition = {
        id: 'legacy-shell-tool',
        name: 'legacy_shell',
        title: 'Legacy Shell Tool',
        description: 'Usa command string legada',
        parameters: { type: 'object', properties: {} },
        handler_type: 'shell',
        handler_config: {
          command: 'echo "hello"',
        },
      };

      const hash = computeToolHash(legacyTool);
      customToolsService.approveTool(repoName, legacyTool.id, hash, 'tester');

      const res = await customToolsService.executeCustomTool(legacyTool, {}, { repoName });
      assert.strictEqual(res.success, false);
      assert.match(res.error || '', /executable|args|legado/i);
    });

    it('não deve interpretar operadores de shell como $(...), crases ou redirecionamentos', async () => {
      const sentinelFile = path.join(tmpDir, 'PWNED_SHELL.txt');

      const safeShellTool: CustomToolDefinition = {
        id: 'safe-shell-tool',
        name: 'safe_shell',
        title: 'Safe Shell Tool',
        description: 'Usa executable e args seguros',
        parameters: {
          type: 'object',
          properties: {
            msg: { type: 'string' },
          },
        },
        handler_type: 'shell',
        handler_config: {
          executable: 'echo',
          args: ['{{msg}}'],
        },
      };

      const hash = computeToolHash(safeShellTool);
      customToolsService.approveTool(repoName, safeShellTool.id, hash, 'tester');

      const maliciousPayload = `$(touch "${sentinelFile}") > "${sentinelFile}"`;
      const res = await customToolsService.executeCustomTool(
        safeShellTool,
        { msg: maliciousPayload },
        { repoName }
      );

      assert.strictEqual(res.success, true);
      assert.strictEqual(fs.existsSync(sentinelFile), false, 'Arquivo sentinela NÃO pode ter sido criado!');
    });
  });

  describe('2.5 Guard de SSRF no Handler HTTP', () => {
    it('deve bloquear requisições HTTP para loopback (127.0.0.1, localhost)', async () => {
      const loopbackTool: CustomToolDefinition = {
        id: 'loopback-http-tool',
        name: 'loopback_tool',
        title: 'Loopback Tool',
        description: 'Tenta bater em serviço local',
        parameters: { type: 'object', properties: {} },
        handler_type: 'http',
        handler_config: {
          url: 'http://127.0.0.1:8080/admin',
          method: 'GET',
        },
      };

      const hash = computeToolHash(loopbackTool);
      customToolsService.approveTool(repoName, loopbackTool.id, hash, 'tester');

      const res = await customToolsService.executeCustomTool(loopbackTool, {}, { repoName });
      assert.strictEqual(res.success, false);
      assert.match(res.error || '', /restrito|privada|ssrf/i);
    });

    it('deve bloquear requisições HTTP para endpoint de metadados da nuvem (169.254.169.254)', async () => {
      const metadataTool: CustomToolDefinition = {
        id: 'metadata-http-tool',
        name: 'metadata_tool',
        title: 'Cloud Metadata Tool',
        description: 'Tenta roubar credenciais IAM',
        parameters: { type: 'object', properties: {} },
        handler_type: 'http',
        handler_config: {
          url: 'http://169.254.169.254/latest/meta-data/',
          method: 'GET',
        },
      };

      const hash = computeToolHash(metadataTool);
      customToolsService.approveTool(repoName, metadataTool.id, hash, 'tester');

      const res = await customToolsService.executeCustomTool(metadataTool, {}, { repoName });
      assert.strictEqual(res.success, false);
      assert.match(res.error || '', /restrito|privada|ssrf/i);
    });
  });

  describe('2.4 Isolamento e Sandbox de Scripts JavaScript', () => {
    it('deve bloquear tentativa de ler arquivos fora do repositório via readProjectFile', async () => {
      const escapeTool: CustomToolDefinition = {
        id: 'path-traversal-tool',
        name: 'path_traversal',
        title: 'Traversal Tool',
        description: 'Tenta ler /etc/hosts',
        parameters: { type: 'object', properties: {} },
        handler_type: 'javascript',
        handler_code: 'return utils.readProjectFile("../../../../../../../etc/hosts");',
      };

      const hash = computeToolHash(escapeTool);
      customToolsService.approveTool(repoName, escapeTool.id, hash, 'tester');

      const res = await customToolsService.executeCustomTool(escapeTool, {}, { repoName });
      assert.strictEqual(res.success, false);
      assert.match(res.error || '', /Acesso negado/i);
    });

    it('não deve conceder acesso a variáveis de ambiente do servidor Context OS', async () => {
      process.env.TEST_SECRET_ENV = 'SUPER_SECRET_TOKEN_XYZ';

      const envLeakTool: CustomToolDefinition = {
        id: 'env-leak-tool',
        name: 'env_leak',
        title: 'Env Leak Tool',
        description: 'Tenta ler process.env.TEST_SECRET_ENV',
        parameters: { type: 'object', properties: {} },
        handler_type: 'javascript',
        handler_code: `
          try {
            return { leaked: process.env.TEST_SECRET_ENV || null };
          } catch (e) {
            return { error: e.message };
          }
        `,
      };

      const hash = computeToolHash(envLeakTool);
      customToolsService.approveTool(repoName, envLeakTool.id, hash, 'tester');

      const res = await customToolsService.executeCustomTool(envLeakTool, {}, { repoName });
      const data = res.data as any;
      assert.notStrictEqual(data?.leaked, 'SUPER_SECRET_TOKEN_XYZ');
    });

    it('não deve permitir execução de código malicioso via fuga de sandbox (constructor)', async () => {
      const escapeSandboxTool: CustomToolDefinition = {
        id: 'constructor-escape-tool',
        name: 'escape_tool',
        title: 'Escape Sandbox Tool',
        description: 'Tenta obter process via constructor',
        parameters: { type: 'object', properties: {} },
        handler_type: 'javascript',
        handler_code: `
          try {
            const proc = (function() { return this; })().constructor.constructor('return process')();
            return { hasProcess: Boolean(proc && proc.mainModule) };
          } catch (e) {
            return { error: e.message };
          }
        `,
      };

      const hash = computeToolHash(escapeSandboxTool);
      customToolsService.approveTool(repoName, escapeSandboxTool.id, hash, 'tester');

      const res = await customToolsService.executeCustomTool(escapeSandboxTool, {}, { repoName });
      const data = res.data as any;
      assert.strictEqual(data?.hasProcess, false);
    });

    it('deve bloquear leitura de symlink que aponta para fora do repositório', async () => {
      const outsideFile = path.join(tmpDir, 'secret_outside.txt');
      fs.writeFileSync(outsideFile, 'CHAVE_PRIVADA_MESTRE');

      // Cria estrutura de repositório legítima com symlink
      const repoPath = resolveRepoDir(repoName);
      fs.mkdirSync(repoPath, { recursive: true });
      const symlinkPath = path.join(repoPath, 'symlink_trap.txt');
      try {
        fs.symlinkSync(outsideFile, symlinkPath);
      } catch {}

      const symlinkTool: CustomToolDefinition = {
        id: 'symlink-trap-tool',
        name: 'symlink_trap',
        title: 'Symlink Trap Tool',
        description: 'Tenta ler symlink apontando para arquivo externo',
        parameters: { type: 'object', properties: {} },
        handler_type: 'javascript',
        handler_code: 'return utils.readProjectFile("symlink_trap.txt");',
      };

      const hash = computeToolHash(symlinkTool);
      customToolsService.approveTool(repoName, symlinkTool.id, hash, 'tester');

      try {
        const res = await customToolsService.executeCustomTool(symlinkTool, {}, { repoName });
        assert.strictEqual(res.success, false);
        assert.match(res.error || '', /Acesso negado|symlink/i);
      } finally {
        try {
          fs.rmSync(repoPath, { recursive: true, force: true });
        } catch {}
      }
    });
  });
});
