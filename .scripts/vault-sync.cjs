#!/usr/bin/env node
/**
 * Context OS - Vault Sync CLI & Git Hook Script
 * 
 * Script autônomo sem dependências externas (utiliza apenas APIs nativas do Node.js).
 * Funções:
 * 1. Git Hook Pre-Commit: Criptografa .md alterados para .enc antes de comitar no terminal.
 * 2. CI/CD Deploy Pipeline: Descriptografa arquivos protegidos usando CONTEXT_VAULT_DEPLOY_KEY.
 * 3. Instalação e verificação de integridade dos hooks do repositório.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execSync } = require('node:child_process');

const REPO_ROOT = process.cwd();
const GIT_DIR = path.join(REPO_ROOT, '.git');
const CACHE_FILE = path.join(GIT_DIR, 'context-vault-cache.json');
const KEYMAP_FILE = path.join(REPO_ROOT, '.keymap.json');

// Carrega ou inicializa cache local
function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    }
  } catch {}
  return { version: 1, lastSync: new Date().toISOString(), files: {} };
}

function saveCache(cache) {
  try {
    if (!fs.existsSync(GIT_DIR)) return;
    cache.lastSync = new Date().toISOString();
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[VaultSync] Aviso ao gravar cache local:', err.message);
  }
}

// Criptografia AES-256-GCM nativa
function encryptAES256GCM(plaintext, keyBuffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(plaintext, 'utf-8')),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: encrypted.toString('base64'),
  };
}

function decryptAES256GCM(ciphertextBase64, ivBase64, authTagBase64, keyBuffer) {
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  const ciphertext = Buffer.from(ciphertextBase64, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf-8');
}

function buildEncEnvelope(payloadObj) {
  const b64 = Buffer.from(JSON.stringify(payloadObj)).toString('base64');
  return `-----BEGIN CONTEXT ENCRYPTED PAYLOAD-----\n${b64}\n-----END CONTEXT ENCRYPTED PAYLOAD-----\n`;
}

function parseEncEnvelope(content) {
  const begin = '-----BEGIN CONTEXT ENCRYPTED PAYLOAD-----';
  const end = '-----END CONTEXT ENCRYPTED PAYLOAD-----';
  const bIdx = content.indexOf(begin);
  const eIdx = content.indexOf(end);
  if (bIdx === -1 || eIdx === -1 || bIdx >= eIdx) return null;
  const chunk = content.slice(bIdx + begin.length, eIdx).trim();
  try {
    return JSON.parse(Buffer.from(chunk, 'base64').toString('utf-8'));
  } catch {
    return null;
  }
}

// SHA-256 helper
function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

// Instalação do Hook Pre-Commit do Git
function installHooks() {
  const hooksDir = path.join(GIT_DIR, 'hooks');
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }

  const hookPath = path.join(hooksDir, 'pre-commit');
  const hookContent = `#!/usr/bin/env sh
# Context OS Vault Sync Hook
if [ -f ".scripts/vault-sync.cjs" ]; then
  node .scripts/vault-sync.cjs --pre-commit
fi
`;

  fs.writeFileSync(hookPath, hookContent, { mode: 0o755 });
  console.log('✅ Hook de pre-commit do Context OS instalado com sucesso em .git/hooks/pre-commit');
}

// Descriptografia completa para CI/CD e Pipelines de Deploy
function decryptAllForDeploy(deployKeyInput) {
  if (!deployKeyInput) {
    console.error('❌ Erro: Deploy Key não fornecida. Passe via --key ou variável CONTEXT_VAULT_DEPLOY_KEY.');
    process.exit(1);
  }

  let keys = {};
  try {
    // Pode ser JSON com mapa de DEKs ou uma chave raw em base64
    if (deployKeyInput.trim().startsWith('{')) {
      const parsed = JSON.parse(deployKeyInput);
      for (const [k, v] of Object.entries(parsed)) {
        keys[k] = Buffer.from(v, 'base64');
      }
    } else {
      keys['default'] = Buffer.from(deployKeyInput.trim(), 'base64');
    }
  } catch (err) {
    console.error('❌ Formato de chave de deploy inválido:', err.message);
    process.exit(1);
  }

  console.log('🔓 [VaultSync Deploy] Iniciando descriptografia segura para pipeline de build...');

  let decryptedCount = 0;

  function scanAndDecrypt(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.name === '.git' || ent.name === 'node_modules') continue;
      const fullPath = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        scanAndDecrypt(fullPath);
      } else if (ent.isFile() && ent.name.endsWith('.md.enc')) {
        const plainPath = fullPath.slice(0, -4); // remove .enc -> .md
        const encText = fs.readFileSync(fullPath, 'utf-8');
        const envelope = parseEncEnvelope(encText);
        if (!envelope) continue;

        const dept = envelope.department || 'default';
        const key = keys[dept] || keys[String(envelope.security_level)] || keys['default'];

        if (!key) {
          console.warn(`⚠️ Chave ausente para ${path.relative(REPO_ROOT, fullPath)} (Dept: ${dept})`);
          continue;
        }

        try {
          const plainText = decryptAES256GCM(envelope.payload, envelope.iv, envelope.authTag, key);
          fs.writeFileSync(plainPath, plainText, 'utf-8');
          decryptedCount++;
          console.log(`  ✓ Descriptografado: ${path.relative(REPO_ROOT, plainPath)}`);
        } catch (err) {
          console.error(`  ✗ Falha ao descriptografar ${path.relative(REPO_ROOT, fullPath)}:`, err.message);
        }
      }
    }
  }

  scanAndDecrypt(REPO_ROOT);
  console.log(`✨ [VaultSync Deploy] Concluído: ${decryptedCount} documentos descriptografados para o build.`);
}

const SESSION_FILE = path.join(GIT_DIR, 'context-vault-session.json');

function loadSessionDEKs() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
      const keys = {};
      for (const [k, v] of Object.entries(parsed)) {
        keys[k] = Buffer.from(v, 'base64');
      }
      return keys;
    }
  } catch {}
  return {};
}

// Execução no Pre-Commit
function handlePreCommit() {
  const cache = loadCache();
  const sessionDEKs = loadSessionDEKs();
  let modifiedEncCount = 0;

  function scanAndEncrypt(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.name === '.git' || ent.name === 'node_modules' || ent.name.startsWith('.')) continue;
      const fullPath = path.join(dir, ent.name);

      if (ent.isDirectory()) {
        scanAndEncrypt(fullPath);
      } else if (ent.isFile() && ent.name.endsWith('.md')) {
        const encPath = `${fullPath}.enc`;
        // Verifica se este arquivo possui correspondente .enc ou está no cache
        const relPath = path.relative(REPO_ROOT, fullPath).replace(/\\/g, '/');
        const cached = cache.files[relPath];

        if (!fs.existsSync(encPath) && !cached) {
          // Arquivo Markdown comum/público sem envelope .enc
          continue;
        }

        const plainText = fs.readFileSync(fullPath, 'utf-8');
        const plainHash = sha256(plainText);

        if (cached && cached.plainSha256 === plainHash && fs.existsSync(encPath)) {
          // Inalterado! Pula
          continue;
        }

        console.log(`🔒 [VaultSync Hook] Detectada modificação em ${relPath}. Atualizando .enc...`);

        const folderParts = relPath.split('/');
        const dept = folderParts.length > 1 ? folderParts[0] : 'default';
        const level = dept === 'executive' ? 0 : dept === 'finance' || dept === 'legal' ? 1 : 2;
        const dek = sessionDEKs[dept] || sessionDEKs['default'];

        if (dek) {
          const encRes = encryptAES256GCM(plainText, dek);
          const payloadObj = {
            alg: 'AES-256-GCM',
            iv: encRes.iv,
            authTag: encRes.authTag,
            payload: encRes.ciphertext,
            security_level: level,
            security_level_id: String(level),
            department: dept,
            title: path.basename(relPath, '.md'),
          };
          const encPayload = buildEncEnvelope(payloadObj);
          fs.writeFileSync(encPath, encPayload, 'utf-8');

          cache.files[relPath] = {
            encSha256: sha256(encPayload),
            plainSha256: plainHash,
            mtime: fs.statSync(fullPath).mtimeMs,
            department: dept,
            level,
            lastSyncedAt: new Date().toISOString(),
          };
        }

        try {
          execSync(`git add "${relPath}.enc"`, { cwd: REPO_ROOT });
          modifiedEncCount++;
        } catch {}
      }
    }
  }

  try {
    scanAndEncrypt(REPO_ROOT);
    saveCache(cache);
    if (modifiedEncCount > 0) {
      console.log(`🛡️ [VaultSync Hook] ${modifiedEncCount} arquivos confidenciais cifrados e adicionados ao stage do Git.`);
    }
  } catch (err) {
    console.warn('[VaultSync Hook] Aviso durante varredura:', err.message);
  }
}

// CLI Argument Routing
const args = process.argv.slice(2);
if (args.includes('--install-hooks')) {
  installHooks();
} else if (args.includes('--pre-commit')) {
  handlePreCommit();
} else if (args.includes('--decrypt-all')) {
  let keyVal = process.env.CONTEXT_VAULT_DEPLOY_KEY;
  const keyIdx = args.indexOf('--key');
  if (keyIdx !== -1 && args[keyIdx + 1]) {
    keyVal = args[keyIdx + 1];
  } else {
    const keyArg = args.find((a) => a.startsWith('--key='));
    if (keyArg) {
      keyVal = keyArg.slice('--key='.length);
    }
  }
  decryptAllForDeploy(keyVal);
} else {
  console.log(`Context OS Vault Sync Utility
Uso:
  node .scripts/vault-sync.cjs --install-hooks
  node .scripts/vault-sync.cjs --pre-commit
  node .scripts/vault-sync.cjs --decrypt-all --key=<chave-deploy>
`);
}
