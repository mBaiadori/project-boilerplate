import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { vaultEngineService } from './vault-engine.service.js';
import { PROJECTS_DIR } from '../../config/constants.js';
import {
  generateX25519KeyPair,
  generateDEK,
  encryptFileToEnc,
  decryptEncFile,
  mergePlaintext3Way,
  isEncryptedEnvelope,
} from '../../utils/crypto.js';

describe('E2E: Ciclo Completo de Criptografia Transparente no Git & CI/CD', () => {
  const TEST_REPO = 'e2e-vault-lifecycle-repo';
  const repoDir = path.join(PROJECTS_DIR, TEST_REPO);

  before(() => {
    fs.mkdirSync(path.join(repoDir, '.git'), { recursive: true });
    fs.mkdirSync(path.join(repoDir, 'engineering'), { recursive: true });
    fs.mkdirSync(path.join(repoDir, 'finance'), { recursive: true });
    fs.mkdirSync(path.join(repoDir, 'docs', 'public'), { recursive: true });
  });

  after(() => {
    try {
      fs.rmSync(repoDir, { recursive: true, force: true });
    } catch {}
  });

  it('Cenário 1: Cadastro de Membros e Identidades X25519 Descentralizadas', () => {
    const alice = vaultEngineService.registerUserPublicKey(TEST_REPO, 'alice_eng', {
      level: 2,
      departments: ['engineering'],
    });

    const bob = vaultEngineService.registerUserPublicKey(TEST_REPO, 'bob_cfo', {
      level: 1,
      departments: ['finance'],
    });

    assert.strictEqual(alice.login, 'alice_eng');
    assert.strictEqual(bob.login, 'bob_cfo');

    const keymap = vaultEngineService.getKeymap(TEST_REPO);
    assert.ok(keymap.members['alice_eng'].public_key);
    assert.ok(keymap.members['bob_cfo'].public_key);
  });

  it('Cenário 2: Delegação de DEKs por Compartimento no .keymap.json', () => {
    const dekEng = generateDEK();
    const dekFin = generateDEK();

    // Alice tem acesso a Engenharia; Bob tem acesso a Finanças
    vaultEngineService.setCompartmentDEK(TEST_REPO, 'engineering', dekEng, ['alice_eng']);
    vaultEngineService.setCompartmentDEK(TEST_REPO, 'finance', dekFin, ['bob_cfo']);

    const keymap = vaultEngineService.getKeymap(TEST_REPO);
    assert.ok(keymap.slots['alice_eng']['engineering']);
    assert.strictEqual(keymap.slots['alice_eng']['finance'], undefined); // Alice NÃO tem slot de finanças!
    assert.ok(keymap.slots['bob_cfo']['finance']);
  });

  it('Cenário 3: Edição Local em Texto Puro & Criptografia Automática para o Git', async () => {
    // Alice cria e edita spec técnica em texto puro
    const specPlainPath = path.join(repoDir, 'engineering', 'arquitetura.md');
    fs.writeFileSync(specPlainPath, '# Arquitetura Ultrassecreta\n\nComponente A se comunica com B via mTLS.', 'utf-8');

    // Também cria documento público em docs/public/
    const publicDocPath = path.join(repoDir, 'docs', 'public', 'guia.md');
    fs.writeFileSync(publicDocPath, '# Guia Público de Boas-Vindas\n\nTodos podem ler.', 'utf-8');

    // Executa prepareGitStaging
    const staging = await vaultEngineService.prepareGitStaging(TEST_REPO, undefined, 'alice_eng');

    // 1. Arquivo de engenharia deve ter sido cifrado para .enc
    assert.ok(staging.modifiedEncFiles.includes('engineering/arquitetura.md.enc'));
    const encPath = path.join(repoDir, 'engineering', 'arquitetura.md.enc');
    assert.strictEqual(fs.existsSync(encPath), true);

    const encContent = fs.readFileSync(encPath, 'utf-8');
    assert.ok(isEncryptedEnvelope(encContent));
    assert.ok(!encContent.includes('Ultrassecreta'));

    // 2. Documento público NUNCA deve ser cifrado para .enc
    assert.strictEqual(fs.existsSync(path.join(repoDir, 'docs', 'public', 'guia.md.enc')), false);
  });

  it('Cenário 4: Checkout/Pull por Usuário Sem Acesso Oculta o Arquivo Localmente', async () => {
    // Bob (CFO) cria balanço em finanças
    const drePlainPath = path.join(repoDir, 'finance', 'balanco-q3.md');
    fs.writeFileSync(drePlainPath, '# Balanço Q3\nLucro Líquido: R$ 50M', 'utf-8');
    await vaultEngineService.prepareGitStaging(TEST_REPO, ['finance/balanco-q3.md'], 'bob_cfo');

    // Agora simula o checkout/pull sendo executado por Alice (Engenheira)
    const syncResult = await vaultEngineService.syncLocalWorkspaceFromGit(TEST_REPO, 'alice_eng');

    // Balanço de finanças NÃO deve existir no disco local de Alice
    assert.strictEqual(fs.existsSync(drePlainPath), false);
    // Mas o arquivo de engenharia DEVE existir no disco de Alice
    assert.strictEqual(fs.existsSync(path.join(repoDir, 'engineering', 'arquitetura.md')), true);
    // E o arquivo cifrado .enc no Git permanece intacto
    assert.strictEqual(fs.existsSync(path.join(repoDir, 'finance', 'balanco-q3.md.enc')), true);
  });

  it('Cenário 5: Simulação de Pipeline de Deploy CI/CD (.scripts/vault-sync.cjs --decrypt-all)', () => {
    // Remove o arquivo de engenharia local para simular um runner limpo do GitHub Actions
    const plainPath = path.join(repoDir, 'engineering', 'arquitetura.md');
    if (fs.existsSync(plainPath)) fs.unlinkSync(plainPath);

    // Obtém a DEK de engenharia do cofre de Alice
    const deks = vaultEngineService.getUnlockedDEKs(TEST_REPO, 'alice_eng');
    const dekEng = deks['engineering'];
    assert.ok(dekEng);

    const deployKeyPayload = JSON.stringify({
      engineering: dekEng.toString('base64'),
    });

    // Executa o script de build passando a deploy key
    const scriptPath = path.resolve(process.cwd(), '../.scripts/vault-sync.cjs');
    const out = execSync(`node "${scriptPath}" --decrypt-all --key='${deployKeyPayload}'`, {
      cwd: repoDir,
      encoding: 'utf-8',
    });

    assert.ok(out.includes('Concluído'));
    // Verifica que o plain text foi gerado pelo runner para o build
    assert.strictEqual(fs.existsSync(plainPath), true);
    const restoredText = fs.readFileSync(plainPath, 'utf-8');
    assert.ok(restoredText.includes('Componente A se comunica com B via mTLS.'));
  });

  it('Cenário 6: Resolução de Conflitos de Merge de 3 Vias em Arquivo Cifrado', () => {
    const dek = generateDEK();
    const baseText = 'Seção 1: Intro\nSeção 2: Meio\nSeção 3: Fim\n';
    const aliceText = 'Seção 1: Intro expandida por Alice\nSeção 2: Meio\nSeção 3: Fim\n';
    const bobText = 'Seção 1: Intro\nSeção 2: Meio\nSeção 3: Fim revisado por Bob\n';

    // Ambos cifram seus arquivos independentemente (com IVs diferentes)
    const encAlice = encryptFileToEnc(aliceText, dek);
    const encBob = encryptFileToEnc(bobText, dek);

    assert.notStrictEqual(encAlice, encBob); // Ciphertexts completamente diferentes

    // O Merge Driver do Context OS decifra ambos e executa o 3-Way Merge
    const decAlice = decryptEncFile(encAlice, dek).content!;
    const decBob = decryptEncFile(encBob, dek).content!;

    const mergeRes = mergePlaintext3Way(baseText, decAlice, decBob);
    assert.strictEqual(mergeRes.hasConflicts, false);
    assert.ok(mergeRes.mergedContent.includes('Intro expandida por Alice'));
    assert.ok(mergeRes.mergedContent.includes('Fim revisado por Bob'));

    // Re-encripta o resultado mesclado
    const mergedEnc = encryptFileToEnc(mergeRes.mergedContent, dek);
    assert.ok(isEncryptedEnvelope(mergedEnc));
  });
});
