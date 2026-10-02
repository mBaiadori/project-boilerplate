import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import assert from 'node:assert';

const TMP_DIR = path.join(process.cwd(), 'projects', 'test-real-git-vault-e2e');

console.log('🚀 Iniciando Teste End-to-End Real do Git, Hooks e CI/CD...');

// 1. Limpeza e Inicialização de Repositório Git Real
if (fs.existsSync(TMP_DIR)) {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
}
fs.mkdirSync(TMP_DIR, { recursive: true });

function run(cmd, cwd = TMP_DIR) {
  return execSync(cmd, { cwd, encoding: 'utf-8' }).trim();
}

console.log('1️⃣ Inicializando repositório Git local e pastas...');
run('git init');
run('git config user.name "E2E Tester"');
run('git config user.email "tester@context-os.local"');

fs.mkdirSync(path.join(TMP_DIR, 'engineering'), { recursive: true });
fs.mkdirSync(path.join(TMP_DIR, 'finance'), { recursive: true });
fs.mkdirSync(path.join(TMP_DIR, 'docs', 'public'), { recursive: true });

// Cria .gitignore com as regras do cofre
const gitignoreContent = `# Context OS Vault
.git/context-vault-cache.json
engineering/*.md
finance/*.md
legal/*.md
executive/*.md
!docs/public/**/*.md
!README.md
`;
fs.writeFileSync(path.join(TMP_DIR, '.gitignore'), gitignoreContent, 'utf-8');
fs.writeFileSync(path.join(TMP_DIR, 'README.md'), '# Repositório de Teste E2E\n', 'utf-8');
fs.writeFileSync(path.join(TMP_DIR, 'docs', 'public', 'sobre.md'), '# Sobre Público\nAcesso livre.', 'utf-8');

run('git add .gitignore README.md docs/public/sobre.md');
run('git commit -m "chore: initial commit com docs publicos"');

// 2. Copia e Instala o Script de Hook do Vault
fs.mkdirSync(path.join(TMP_DIR, '.scripts'), { recursive: true });
const rootScript = path.join(process.cwd(), '.scripts', 'vault-sync.cjs');
fs.copyFileSync(rootScript, path.join(TMP_DIR, '.scripts', 'vault-sync.cjs'));

console.log('2️⃣ Instalando hook pre-commit do Git...');
run('node .scripts/vault-sync.cjs --install-hooks');
assert.strictEqual(fs.existsSync(path.join(TMP_DIR, '.git', 'hooks', 'pre-commit')), true);

// 3. Cria documento confidencial em texto puro
console.log('3️⃣ Criando documento confidencial em engineering/arquitetura-core.md...');
const plainFilePath = path.join(TMP_DIR, 'engineering', 'arquitetura-core.md');
const secretText = '# Especificação Confidencial\n\nChave de API Mestra: sk-live-secret-key-9999\n';
fs.writeFileSync(plainFilePath, secretText, 'utf-8');

// Gera uma DEK de teste para engineering
const crypto = await import('node:crypto');
const dekEng = crypto.randomBytes(32);
const dekEngBase64 = dekEng.toString('base64');

// Criptografa o arquivo gerando o .enc correspondente
const iv = crypto.randomBytes(12);
const cipher = crypto.createCipheriv('aes-256-gcm', dekEng, iv);
const ciphertext = Buffer.concat([cipher.update(Buffer.from(secretText, 'utf-8')), cipher.final()]);
const authTag = cipher.getAuthTag();

const encEnvelope = `-----BEGIN CONTEXT ENCRYPTED PAYLOAD-----
${Buffer.from(JSON.stringify({
  alg: 'AES-256-GCM',
  iv: iv.toString('base64'),
  authTag: authTag.toString('base64'),
  payload: ciphertext.toString('base64'),
  department: 'engineering',
  security_level: 2,
})).toString('base64')}
-----END CONTEXT ENCRYPTED PAYLOAD-----
`;

const encFilePath = path.join(TMP_DIR, 'engineering', 'arquitetura-core.md.enc');
fs.writeFileSync(encFilePath, encEnvelope, 'utf-8');

// 4. Executa 'git add' e 'git commit' no terminal
console.log('4️⃣ Executando git commit para testar o hook pre-commit...');
run('git add .');
const commitOutput = run('git commit -m "feat(engineering): adiciona especificacao protegida"');
console.log('   Resultado do Commit:\n   ' + commitOutput.split('\n')[0]);

// 5. Validação Estrita do que entrou no Git
console.log('5️⃣ Validando integridade do histórico do Git...');
const gitShow = run('git show --stat HEAD');
console.log('   Arquivos no Commit:\n   ' + gitShow.split('\n').filter(l => l.includes('|')).join('\n   '));

// O arquivo .enc DEVE estar no commit
assert.ok(gitShow.includes('arquitetura-core.md.enc'), 'O arquivo .enc DEVE estar versionado no Git!');

// O arquivo .md de texto puro NUNCA deve estar no commit
assert.ok(!gitShow.includes('engineering/arquitetura-core.md '), 'O arquivo .md em texto puro NUNCA deve estar no Git!');

// O arquivo físico .md em texto puro DEVE permanecer intacto no disco local!
assert.strictEqual(fs.existsSync(plainFilePath), true, 'O arquivo .md local deve existir para uso da IA!');
const localPlainContent = fs.readFileSync(plainFilePath, 'utf-8');
assert.strictEqual(localPlainContent, secretText, 'Conteúdo local deve ser exatamente o texto puro digitado!');

// 6. Simulação de CI/CD (GitHub Actions)
console.log('6️⃣ Testando descriptografia do pipeline de build (CI/CD)...');
// Simula o runner do GitHub Actions: apaga o .md local
fs.unlinkSync(plainFilePath);
assert.strictEqual(fs.existsSync(plainFilePath), false);

// Executa descriptografia do deploy passando a deploy key
const deployKeyPayload = JSON.stringify({ engineering: dekEngBase64 });
const deployOutput = run(`node .scripts/vault-sync.cjs --decrypt-all --key='${deployKeyPayload}'`);
console.log('   Saída do Deploy Runner: ' + deployOutput.split('\n').pop());

// Verifica que o arquivo .md foi restaurado no runner
assert.strictEqual(fs.existsSync(plainFilePath), true);
const restoredText = fs.readFileSync(plainFilePath, 'utf-8');
assert.strictEqual(restoredText, secretText, 'Texto restaurado no build deve ser idêntico ao original!');

// 7. Limpeza do ambiente de teste
fs.rmSync(TMP_DIR, { recursive: true, force: true });

console.log('\n🎉 TODOS OS TESTES END-TO-END DO GIT, HOOKS E CI/CD PASSARAM COM SUCESSO ABSOLUTO!');
