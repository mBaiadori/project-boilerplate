import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { vaultEngineService } from './vault-engine.service.js';
import { PROJECTS_DIR } from '../../config/constants.js';

describe('VaultEngineService - Sincronização Transparente & Gestão Zero-API', () => {
  const TEST_REPO = 'unit-test-vault-repo';
  const repoDir = path.join(PROJECTS_DIR, TEST_REPO);

  before(() => {
    fs.mkdirSync(path.join(repoDir, '.git'), { recursive: true });
    fs.mkdirSync(path.join(repoDir, 'engineering'), { recursive: true });
    fs.mkdirSync(path.join(repoDir, 'finance'), { recursive: true });
  });

  after(() => {
    try {
      fs.rmSync(repoDir, { recursive: true, force: true });
    } catch {}
  });

  it('Deve registrar usuário e chave pública no .keymap.json', () => {
    const member = vaultEngineService.registerUserPublicKey(TEST_REPO, 'marcos_test', {
      level: 0,
      departments: ['*'],
    });

    assert.strictEqual(member.login, 'marcos_test');
    assert.ok(member.public_key.includes('BEGIN PUBLIC KEY'));

    const keymap = vaultEngineService.getKeymap(TEST_REPO);
    assert.ok(keymap.members['marcos_test']);
    assert.strictEqual(keymap.members['marcos_test'].fingerprint, member.fingerprint);
  });

  it('Deve criptografar arquivo modificado para .enc no prepareGitStaging', async () => {
    const filePath = path.join(repoDir, 'engineering', 'spec-api.md');
    fs.writeFileSync(filePath, '# Especificação de API Secreta\n\nEndpoint: /api/v1/trade', 'utf-8');

    const result = await vaultEngineService.prepareGitStaging(TEST_REPO, ['engineering/spec-api.md'], 'marcos_test');
    assert.ok(result.modifiedEncFiles.includes('engineering/spec-api.md.enc'));

    const encPath = path.join(repoDir, 'engineering', 'spec-api.md.enc');
    assert.strictEqual(fs.existsSync(encPath), true);

    const encContent = fs.readFileSync(encPath, 'utf-8');
    assert.ok(!encContent.includes('/api/v1/trade'));
    assert.ok(encContent.includes('BEGIN CONTEXT ENCRYPTED PAYLOAD'));
  });

  it('Não deve re-criptografar arquivo inalterado (cache hit)', async () => {
    const result = await vaultEngineService.prepareGitStaging(TEST_REPO, ['engineering/spec-api.md'], 'marcos_test');
    assert.strictEqual(result.modifiedEncFiles.length, 0);
  });

  it('Deve sincronizar e descriptografar arquivos .enc no syncLocalWorkspaceFromGit', async () => {
    // Simula remoção do arquivo local (como em um git pull em máquina nova)
    const localPlain = path.join(repoDir, 'engineering', 'spec-api.md');
    fs.unlinkSync(localPlain);

    const syncRes = await vaultEngineService.syncLocalWorkspaceFromGit(TEST_REPO, 'marcos_test');
    assert.strictEqual(syncRes.decryptedCount, 1);
    assert.strictEqual(fs.existsSync(localPlain), true);

    const content = fs.readFileSync(localPlain, 'utf-8');
    assert.ok(content.includes('# Especificação de API Secreta'));
  });

  it('Deve omitir arquivos no disco local quando o usuário não tiver autorização', async () => {
    // Registra usuário comum com permissão apenas para Engenharia (Level 2)
    vaultEngineService.registerUserPublicKey(TEST_REPO, 'junior_dev', {
      level: 2,
      departments: ['engineering'],
    });

    // Cria documento em finanças
    const finPlain = path.join(repoDir, 'finance', 'dre-2026.md');
    fs.writeFileSync(finPlain, '# DRE Confidencial\nLucro: R$ 10M', 'utf-8');
    await vaultEngineService.prepareGitStaging(TEST_REPO, ['finance/dre-2026.md'], 'marcos_test');

    // Agora simula o sync sendo executado pelo junior_dev (sem acesso a finance)
    const syncResJunior = await vaultEngineService.syncLocalWorkspaceFromGit(TEST_REPO, 'junior_dev');
    assert.ok(syncResJunior.omittedCount >= 1);

    // O arquivo de texto puro NÃO deve existir no disco dele!
    assert.strictEqual(fs.existsSync(finPlain), false);
    // Mas o .enc no repositório permanece intacto
    assert.strictEqual(fs.existsSync(path.join(repoDir, 'finance', 'dre-2026.md.enc')), true);
  });

  it('Deve conceder acesso a pasta específica para membro e permitir sincronização', async () => {
    // Concede acesso de finance para junior_dev
    vaultEngineService.grantFolderAccess(TEST_REPO, 'junior_dev', ['finance']);
    const keymap = vaultEngineService.getKeymap(TEST_REPO);
    assert.ok(keymap.slots['junior_dev']?.['finance']);

    // Agora junior_dev deve conseguir sincronizar e abrir o arquivo
    const syncRes = await vaultEngineService.syncLocalWorkspaceFromGit(TEST_REPO, 'junior_dev');
    assert.strictEqual(syncRes.decryptedCount, 1);
    const finPlain = path.join(repoDir, 'finance', 'dre-2026.md');
    assert.strictEqual(fs.existsSync(finPlain), true);
  });

  it('Deve revogar membro, rotacionar DEK e bloquear acesso a novos arquivos', async () => {
    const revokeRes = vaultEngineService.revokeMember(TEST_REPO, 'junior_dev');
    assert.strictEqual(revokeRes.success, true);
    assert.ok(revokeRes.rotatedFolders.includes('finance'));

    const keymap = vaultEngineService.getKeymap(TEST_REPO);
    assert.strictEqual(keymap.members['junior_dev'], undefined);
    assert.strictEqual(keymap.slots['junior_dev'], undefined);

    // junior_dev agora não tem mais acesso a finance
    const syncRes = await vaultEngineService.syncLocalWorkspaceFromGit(TEST_REPO, 'junior_dev');
    assert.ok(syncRes.omittedCount >= 1);
    const finPlain = path.join(repoDir, 'finance', 'dre-2026.md');
    assert.strictEqual(fs.existsSync(finPlain), false);
  });

  it('Deve retornar resumo completo dos cofres em getMyAccessSummary', () => {
    const summary = vaultEngineService.getMyAccessSummary(TEST_REPO, 'marcos_test');
    assert.strictEqual(summary.login, 'marcos_test');
    assert.strictEqual(summary.isOwner, true);
    assert.ok(summary.folders.length >= 2);
    const engFolder = summary.folders.find((f) => f.id === 'engineering');
    assert.ok(engFolder);
    assert.strictEqual(engFolder.hasAccess, true);
  });
});

