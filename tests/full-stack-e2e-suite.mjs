/**
 * Suíte de Testes End-to-End Automatizada (Sem Browser)
 * 
 * Simula exatamente o comportamento da interface do usuário chamando os endpoints
 * HTTP do backend (como os componentes React fazem) e validando no sistema de
 * arquivos e no Git real se as regras de segurança foram cumpridas à risca:
 * 
 * 1. Registro descentralizado de chave X25519 (.keymap.json)
 * 2. Criação de documento confidencial vs documento público
 * 3. Commit automático com geração de .enc e isolamento de plaintext no Git
 * 4. Inspeção do Git Log (garantir zero vazamento de texto claro no histórico)
 * 5. Pull e descriptografia transparente sob demanda
 * 6. Omissão de arquivos não autorizados do disco local
 * 7. Execução do Hook Pre-Commit (.scripts/vault-sync.cjs)
 * 8. Pipeline de Deploy CI/CD (--decrypt-all)
 * 9. Resolução de Conflitos de Merge de 3 Vias
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const BASE_URL = 'http://localhost:4100';

async function api(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function runTests() {
  const gitInitRes = await api('/api/git/status');
  const REPO_NAME = gitInitRes.data.repo_name || 'enurse';
  const REPO_DIR = path.resolve(process.cwd(), 'projects', REPO_NAME);

  console.log('================================================================');
  console.log('🧪 INICIANDO SUÍTE COMPLETA DE TESTES E2E VIA ENDPOINTS & GIT REAL');
  console.log(`📡 Backend URL: ${BASE_URL} | Repositório Ativo: ${REPO_NAME} (${REPO_DIR})`);
  console.log('================================================================\n');

  // Setup: Garante diretórios essenciais no repositório de teste
  fs.mkdirSync(path.join(REPO_DIR, 'engineering'), { recursive: true });
  fs.mkdirSync(path.join(REPO_DIR, 'finance'), { recursive: true });
  fs.mkdirSync(path.join(REPO_DIR, 'docs', 'public'), { recursive: true });

  // --------------------------------------------------------------------------
  // TESTE 1: Registro de Chave X25519 Descentralizada (.keymap.json)
  // --------------------------------------------------------------------------
  console.log('🔹 [1/9] Registrando Chave Pública X25519 via endpoint /api/governance/keymap/register...');
  const regRes = await api('/api/governance/keymap/register', {
    method: 'POST',
    body: JSON.stringify({
      user: 'marcosbaiadori',
      level: 0,
      departments: ['*'],
      allowed_paths: ['*'],
      repo: REPO_NAME,
    }),
  });

  assert.strictEqual(regRes.ok, true, 'Registro de chave deve responder 200 OK');
  assert.ok(regRes.data.member.public_key.includes('BEGIN PUBLIC KEY'), 'Deve conter chave pública SPKI');
  assert.strictEqual(regRes.data.member.fingerprint.length, 16, 'Deve gerar fingerprint de 16 caracteres hex');

  // Verifica se o arquivo .keymap.json foi fisicamente gravado no disco
  const keymapDiskPath = path.join(REPO_DIR, '.keymap.json');
  assert.strictEqual(fs.existsSync(keymapDiskPath), true, 'O arquivo .keymap.json deve existir no disco');
  const keymapOnDisk = JSON.parse(fs.readFileSync(keymapDiskPath, 'utf-8'));
  assert.ok(keymapOnDisk.members['marcosbaiadori'], 'Membro marcosbaiadori deve estar gravado no .keymap.json');
  console.log(`   ✅ Chave X25519 registrada no .keymap.json com Fingerprint: ${regRes.data.member.fingerprint}\n`);

  // --------------------------------------------------------------------------
  // TESTE 2: Salvando Documento Confidencial vs Documento Público no Editor
  // --------------------------------------------------------------------------
  console.log('🔹 [2/9] Salvando documentos via endpoint /api/project/save...');
  
  const runId = Date.now();
  // 2.1. Documento Confidencial de Engenharia
  const secretContent = `# Arquitetura de Pagamentos Confidencial (${runId})\n\nChave Mestra AWS: AKIAIOSFODNN7EXAMPLE\nDatabase: postgresql://admin:secret@db.internal:5432`;
  const saveConfRes = await api('/api/workspace/save', {
    method: 'POST',
    body: JSON.stringify({
      path: 'engineering/arquitetura-pagamentos.md',
      content: secretContent,
      meta: { level: 2, department: 'engineering', title: 'Arquitetura Pagamentos' },
      repo: REPO_NAME,
    }),
  });
  assert.strictEqual(saveConfRes.ok, true, 'Salvar documento confidencial deve retornar 200');

  // 2.2. Documento Público
  const publicContent = `# Guia Aberto de Contribuição (${runId})\n\nEste documento é 100% público e legível.`;
  const savePubRes = await api('/api/workspace/save', {
    method: 'POST',
    body: JSON.stringify({
      path: 'docs/public/guia-aberto.md',
      content: publicContent,
      meta: { level: 999, department: 'public', title: 'Guia Aberto' },
      repo: REPO_NAME,
    }),
  });
  assert.strictEqual(savePubRes.ok, true, 'Salvar documento público deve retornar 200');

  // Verifica texto no disco local
  const plainConfPath = path.join(REPO_DIR, 'engineering', 'arquitetura-pagamentos.md');
  const plainPubPath = path.join(REPO_DIR, 'docs', 'public', 'guia-aberto.md');
  assert.strictEqual(fs.existsSync(plainConfPath), true, 'Arquivo confidencial .md deve existir no disco local');
  assert.strictEqual(fs.readFileSync(plainConfPath, 'utf-8'), secretContent, 'Conteúdo local deve ser plaintext puro');
  assert.strictEqual(fs.existsSync(plainPubPath), true, 'Arquivo público .md deve existir no disco local');
  console.log('   ✅ Arquivos criados no disco local em texto plano (IA pode ler diretamente)\n');

  // --------------------------------------------------------------------------
  // TESTE 3: Commit Git com Criptografia Automática no Ciclo de Vida
  // --------------------------------------------------------------------------
  console.log('🔹 [3/9] Executando commit via endpoint /api/git/commit...');
  const commitRes = await api('/api/git/commit', {
    method: 'POST',
    body: JSON.stringify({
      message: 'feat: adiciona specs confidenciais e guia publico',
      files: ['engineering/arquitetura-pagamentos.md', 'docs/public/guia-aberto.md'],
      repo: REPO_NAME,
      user: 'marcosbaiadori',
    }),
  });
  assert.strictEqual(commitRes.ok, true, 'Endpoint de commit deve responder com sucesso');
  console.log(`   Resultado: ${commitRes.data.message || 'Commit executado'}`);

  // --------------------------------------------------------------------------
  // TESTE 4: Inspeção Estrita do Git (Validando que NÃO houve vazamento)
  // --------------------------------------------------------------------------
  console.log('🔹 [4/9] Inspecionando Git Log e Working Tree Real...');
  
  // 4.1. O arquivo .enc deve existir no disco
  const encFilePath = path.join(REPO_DIR, 'engineering', 'arquitetura-pagamentos.md.enc');
  assert.strictEqual(fs.existsSync(encFilePath), true, 'O arquivo .enc correspondente DEVE ter sido gerado');
  const encContent = fs.readFileSync(encFilePath, 'utf-8');
  assert.ok(encContent.includes('BEGIN CONTEXT ENCRYPTED PAYLOAD'), 'Deve ser envelope criptografado');
  assert.ok(!encContent.includes('AKIAIOSFODNN7EXAMPLE'), 'O segredo NUNCA deve aparecer no .enc em texto claro');

  // 4.2. Documento público NÃO deve ter gerado .enc
  assert.strictEqual(fs.existsSync(path.join(REPO_DIR, 'docs', 'public', 'guia-aberto.md.enc')), false, 'Doc público NÃO deve ter .enc');

  // 4.3. Verifica o que o Git realmente comitou
  const lastCommitDiff = execSync('git show --stat HEAD', { cwd: REPO_DIR, encoding: 'utf-8' });
  console.log('   Git Commit Summary:\n   ' + lastCommitDiff.split('\n').filter(l => l.includes('|')).join('\n   '));

  assert.ok(lastCommitDiff.includes('arquitetura-pagamentos.md.enc'), 'Git DEVE conter o arquivo .enc');
  assert.ok(!lastCommitDiff.includes('engineering/arquitetura-pagamentos.md '), 'Git NUNCA deve conter o .md confidencial em plaintext!');
  assert.ok(lastCommitDiff.includes('docs/public/guia-aberto.md'), 'Git DEVE conter o documento público em markdown normal');
  console.log('   ✅ Prova Git: Apenas .enc confidencial e .md público foram versionados. Zero vazamento!\n');

  // --------------------------------------------------------------------------
  // TESTE 5: Sincronização Sob Demanda (/api/governance/vault/sync)
  // --------------------------------------------------------------------------
  console.log('🔹 [5/9] Testando restauração transparente após pull (/api/governance/vault/sync)...');
  // Apaga o .md local para simular que acabamos de puxar um commit novo do Git
  fs.unlinkSync(plainConfPath);
  assert.strictEqual(fs.existsSync(plainConfPath), false, 'Arquivo local apagado temporariamente');

  const syncRes = await api('/api/governance/vault/sync', {
    method: 'POST',
    body: JSON.stringify({ repo: REPO_NAME, user: 'marcosbaiadori' }),
  });
  assert.strictEqual(syncRes.ok, true, 'Sync deve responder 200 OK');
  assert.ok(syncRes.data.decryptedCount >= 1, 'Deve ter descriptografado pelo menos 1 documento');

  // O arquivo local .md deve ter reaparecido com o conteúdo original
  assert.strictEqual(fs.existsSync(plainConfPath), true, 'O arquivo .md deve ter sido restaurado');
  const restoredText = fs.readFileSync(plainConfPath, 'utf-8');
  assert.strictEqual(restoredText, secretContent, 'Conteúdo restaurado deve ser idêntico ao original');
  console.log('   ✅ Arquivo confidencial restaurado em texto plano no disco com sucesso!\n');

  // --------------------------------------------------------------------------
  // TESTE 6: Omissão Seletiva para Usuários Sem Acesso
  // --------------------------------------------------------------------------
  console.log('🔹 [6/9] Testando omissão no disco para usuário sem permissão...');
  
  // Cria documento em finanças
  const finSecret = '# Balanço Financeiro Ultrassecreto\nLucro Q3: R$ 80.000.000,00';
  await api('/api/workspace/save', {
    method: 'POST',
    body: JSON.stringify({
      path: 'finance/dre-2026.md',
      content: finSecret,
      meta: { level: 1, department: 'finance', title: 'DRE 2026' },
      repo: REPO_NAME,
    }),
  });
  await api('/api/git/commit', {
    method: 'POST',
    body: JSON.stringify({
      message: 'feat(finance): adiciona balanco confidencial',
      files: ['finance/dre-2026.md'],
      repo: REPO_NAME,
      user: 'marcosbaiadori',
    }),
  });

  // Registra usuário junior_dev que só tem acesso a Engenharia (Level 2)
  await api('/api/governance/keymap/register', {
    method: 'POST',
    body: JSON.stringify({
      user: 'junior_dev',
      level: 2,
      departments: ['engineering'],
      repo: REPO_NAME,
    }),
  });

  // Executa sync como junior_dev
  const syncJunior = await api('/api/governance/vault/sync', {
    method: 'POST',
    body: JSON.stringify({ repo: REPO_NAME, user: 'junior_dev' }),
  });
  assert.strictEqual(syncJunior.ok, true);

  // O arquivo de finanças em texto plano NÃO deve existir no workspace de junior_dev!
  const finPlainPath = path.join(REPO_DIR, 'finance', 'dre-2026.md');
  assert.strictEqual(fs.existsSync(finPlainPath), false, 'Arquivo de finanças NÃO deve existir no disco local do junior_dev!');
  // Mas o arquivo cifrado .enc no Git permanece lá
  assert.strictEqual(fs.existsSync(path.join(REPO_DIR, 'finance', 'dre-2026.md.enc')), true, 'O .enc no Git permanece intacto');
  console.log('   ✅ Omissão seletiva validada: Arquivo inacessível não é criado no disco local.\n');

  // --------------------------------------------------------------------------
  // TESTE 7: Hook Pre-Commit do Terminal (.scripts/vault-sync.cjs)
  // --------------------------------------------------------------------------
  console.log('🔹 [7/9] Testando hook de terminal fora do app (.scripts/vault-sync.cjs --pre-commit)...');
  
  // Restaura o arquivo para Marcos
  await api('/api/governance/vault/sync', {
    method: 'POST',
    body: JSON.stringify({ repo: REPO_NAME, user: 'marcosbaiadori' }),
  });

  // Edita o arquivo pelo "terminal"
  const editedContent = secretContent + '\n\nNova linha adicionada via terminal externo.';
  fs.writeFileSync(plainConfPath, editedContent, 'utf-8');

  // Executa o script do hook pre-commit dentro do repositório
  const hookOutput = execSync(`node "${path.resolve(process.cwd(), '.scripts', 'vault-sync.cjs')}" --pre-commit`, { cwd: REPO_DIR, encoding: 'utf-8' });
  console.log('   Hook Output: ' + (hookOutput.trim() || 'Processado com sucesso'));

  // Confere que o .enc foi devidamente atualizado com a nova versão
  const encUpdated = fs.readFileSync(encFilePath, 'utf-8');
  assert.ok(encUpdated.includes('BEGIN CONTEXT ENCRYPTED PAYLOAD'));
  console.log('   ✅ Hook de terminal detectou alteração no .md e atualizou o .enc com sucesso.\n');

  // --------------------------------------------------------------------------
  // TESTE 8: Pipeline de Deploy CI/CD (.scripts/vault-sync.cjs --decrypt-all)
  // --------------------------------------------------------------------------
  console.log('🔹 [8/9] Testando descriptografia do pipeline de build (CI/CD)...');
  
  // Obtém status e chaves de compartimento
  const statusRes = await api('/api/governance/vault/status?repo=' + REPO_NAME);
  assert.strictEqual(statusRes.ok, true);
  console.log(`   Cofre Status: ${statusRes.data.cachedFilesCount} arquivos em cache, Compartimentos: [${statusRes.data.unlockedCompartments.join(', ')}]`);

  // Executa teste de deploy passando a flag --decrypt-all
  const deployKeyMap = {};
  // Usa o script para descriptografar uma cópia temporária
  const tmpBuildDir = path.join(process.cwd(), 'projects', 'tmp-build-runner');
  fs.mkdirSync(path.join(tmpBuildDir, 'engineering'), { recursive: true });
  fs.copyFileSync(encFilePath, path.join(tmpBuildDir, 'engineering', 'arquitetura-pagamentos.md.enc'));

  // Lê a DEK diretamente do cofre
  const { vaultEngineService } = await import('../server/dist/modules/vault/vault-engine.service.js');
  const deks = vaultEngineService.getUnlockedDEKs(REPO_NAME, 'marcosbaiadori');
  for (const [dept, buf] of Object.entries(deks)) {
    deployKeyMap[dept] = buf.toString('base64');
  }
  const sessionPath = path.join(REPO_DIR, '.git', 'context-vault-session.json');
  if (fs.existsSync(sessionPath)) {
    Object.assign(deployKeyMap, JSON.parse(fs.readFileSync(sessionPath, 'utf-8')));
  }

  const deployCmd = `node "${path.resolve(process.cwd(), '.scripts', 'vault-sync.cjs')}" --decrypt-all --key='${JSON.stringify(deployKeyMap)}'`;
  const deployOut = execSync(deployCmd, { cwd: tmpBuildDir, encoding: 'utf-8' });
  console.log('   Deploy Runner Output: ' + deployOut.trim().split('\n').pop());

  const buildRestored = path.join(tmpBuildDir, 'engineering', 'arquitetura-pagamentos.md');
  assert.strictEqual(fs.existsSync(buildRestored), true, 'Arquivo .md deve ser gerado no runner de build');
  assert.ok(fs.readFileSync(buildRestored, 'utf-8').includes('Nova linha adicionada via terminal'));
  fs.rmSync(tmpBuildDir, { recursive: true, force: true });
  console.log('   ✅ Pipeline de deploy CI/CD validado com descriptografia no runner.\n');

  // --------------------------------------------------------------------------
  // TESTE 9: Resolução de Conflitos de Merge de 3 Vias
  // --------------------------------------------------------------------------
  console.log('🔹 [9/9] Testando algoritmo de 3-way merge em texto plano...');
  const { mergePlaintext3Way } = await import('../server/dist/utils/crypto.js');

  // Cenário 9.1: Fusão limpa (linhas não conflitantes)
  const base = 'Linha 1: Introdução\nLinha 2: Meio\nLinha 3: Conclusão\n';
  const ours = 'Linha 1: Introdução Alterada por Alice\nLinha 2: Meio\nLinha 3: Conclusão\n';
  const theirs = 'Linha 1: Introdução\nLinha 2: Meio\nLinha 3: Conclusão Atualizada por Bob\n';

  const cleanMerge = mergePlaintext3Way(base, ours, theirs);
  assert.strictEqual(cleanMerge.hasConflicts, false);
  assert.ok(cleanMerge.mergedContent.includes('Alterada por Alice'));
  assert.ok(cleanMerge.mergedContent.includes('Atualizada por Bob'));

  // Cenário 9.2: Colisão na mesma linha (gera marcadores legíveis em português para o modal)
  const conflictBase = 'Configuração do Servidor:\nporta=3000\n';
  const conflictOurs = 'Configuração do Servidor:\nporta=4100\n';
  const conflictTheirs = 'Configuração do Servidor:\nporta=8080\n';

  const conflictMerge = mergePlaintext3Way(conflictBase, conflictOurs, conflictTheirs, {
    ours: 'Sua Versão (Local)',
    theirs: 'Versão Remota (Git)',
  });
  assert.strictEqual(conflictMerge.hasConflicts, true);
  assert.ok(conflictMerge.mergedContent.includes('<<<<<<< Sua Versão (Local)'));
  assert.ok(conflictMerge.mergedContent.includes('porta=4100'));
  assert.ok(conflictMerge.mergedContent.includes('======='));
  assert.ok(conflictMerge.mergedContent.includes('porta=8080'));
  assert.ok(conflictMerge.mergedContent.includes('>>>>>>> Versão Remota (Git)'));
  console.log('   ✅ 3-Way Merge testado: Fusões automáticas sem conflito e marcadores legíveis para o modal.\n');

  // Limpeza de arquivos de teste
  try {
    fs.unlinkSync(plainConfPath);
    fs.unlinkSync(encFilePath);
    fs.unlinkSync(plainPubPath);
    if (fs.existsSync(finPlainPath)) fs.unlinkSync(finPlainPath);
    const finEnc = path.join(REPO_DIR, 'finance', 'dre-2026.md.enc');
    if (fs.existsSync(finEnc)) fs.unlinkSync(finEnc);
  } catch {}

  console.log('================================================================');
  console.log('🎉 TODOS OS 9 CENÁRIOS E2E PASSARAM COM SUCESSO ABSOLUTO!');
  console.log('   - O Git só contém arquivos cifrados (.enc) e docs públicos.');
  console.log('   - O disco local só possui arquivos que o usuário pode ver.');
  console.log('   - Hooks de terminal e CI/CD funcionam independentemente.');
  console.log('   - Conflitos de merge são tratados limpos em texto plano.');
  console.log('================================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ FALHA NO TESTE E2E:', err);
  process.exit(1);
});
