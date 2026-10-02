import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PROJECTS_DIR } from '../../config/constants.js';
import { loadConfig } from '../../config/storage.js';
import { vaultService } from './vault.service.js';
import {
  generateX25519KeyPair,
  sealDEKForPublicKey,
  openDEKWithPrivateKey,
  encryptFileToEnc,
  decryptEncFile,
  mergePlaintext3Way,
  parseEncryptedEnvelope,
  canAccessDocument,
  type UserKeyPair,
  type SealedDEKSlot,
  type MergePlaintextResult,
} from '../../utils/crypto.js';

export interface KeymapMember {
  login: string;
  public_key: string; // SPKI PEM
  fingerprint: string;
  level: number;
  departments: string[];
  allowed_paths?: string[];
  status: 'active' | 'pending';
}

export interface KeymapConfig {
  version: number;
  updated_at: string;
  members: Record<string, KeymapMember>;
  slots: Record<string, Record<string, SealedDEKSlot>>; // login -> compartment -> slot
}

export interface VaultCacheEntry {
  encSha256: string;
  plainSha256: string;
  mtime: number;
  department?: string;
  level?: number;
  lastSyncedAt: string;
}

export interface VaultCacheData {
  version: number;
  lastSync: string;
  files: Record<string, VaultCacheEntry>;
}

export class VaultEngineService {
  // Cache em memória para DEKs já descriptografadas na sessão ativa
  private memoryDEKCache = new Map<string, Map<string, Buffer>>(); // repoName -> compartment -> Buffer

  private getRepoDir(repoName?: string): string {
    const cfg = loadConfig();
    const activeRepoName = repoName || cfg.active_repo?.name || 'local';
    return path.join(PROJECTS_DIR, activeRepoName);
  }

  private getKeymapPath(repoDir: string): string {
    return path.join(repoDir, '.keymap.json');
  }

  private getCachePath(repoDir: string): string {
    const gitDir = path.join(repoDir, '.git');
    if (!fs.existsSync(gitDir)) {
      try { fs.mkdirSync(gitDir, { recursive: true }); } catch {}
    }
    return path.join(gitDir, 'context-vault-cache.json');
  }

  /**
   * Carrega o .keymap.json do repositório
   */
  getKeymap(repoName?: string): KeymapConfig {
    const repoDir = this.getRepoDir(repoName);
    const keymapPath = this.getKeymapPath(repoDir);

    if (fs.existsSync(keymapPath)) {
      try {
        const raw = fs.readFileSync(keymapPath, 'utf-8');
        return JSON.parse(raw);
      } catch (err: any) {
        console.warn(`[VaultEngine] Erro ao ler .keymap.json em ${repoName}:`, err.message);
      }
    }

    return {
      version: 1,
      updated_at: new Date().toISOString(),
      members: {},
      slots: {},
    };
  }

  /**
   * Salva o .keymap.json no repositório
   */
  saveKeymap(repoName: string | undefined, keymap: KeymapConfig): void {
    const repoDir = this.getRepoDir(repoName);
    const keymapPath = this.getKeymapPath(repoDir);
    keymap.updated_at = new Date().toISOString();
    fs.writeFileSync(keymapPath, JSON.stringify(keymap, null, 2), 'utf-8');
  }

  /**
   * Carrega o cache local de hashes SHA-256
   */
  getCache(repoName?: string): VaultCacheData {
    const repoDir = this.getRepoDir(repoName);
    const cachePath = this.getCachePath(repoDir);

    if (fs.existsSync(cachePath)) {
      try {
        const raw = fs.readFileSync(cachePath, 'utf-8');
        return JSON.parse(raw);
      } catch {}
    }

    return {
      version: 1,
      lastSync: new Date().toISOString(),
      files: {},
    };
  }

  /**
   * Grava o cache local de hashes SHA-256
   */
  saveCache(repoName: string | undefined, cache: VaultCacheData): void {
    const repoDir = this.getRepoDir(repoName);
    const cachePath = this.getCachePath(repoDir);
    cache.lastSync = new Date().toISOString();
    try {
      fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf-8');
    } catch {}
  }

  /**
   * Obtém ou inicializa o par de chaves X25519 do usuário no Keychain nativo do SO
   */
  getOrCreateUserKeyPair(userLogin: string): UserKeyPair {
    const privateKeySecretKey = `context_os_x25519_priv_${userLogin.toLowerCase()}`;
    const publicKeySecretKey = `context_os_x25519_pub_${userLogin.toLowerCase()}`;

    const existingPriv = vaultService.getSecret(privateKeySecretKey);
    const existingPub = vaultService.getSecret(publicKeySecretKey);

    if (existingPriv && existingPub) {
      const pubObj = crypto.createPublicKey(existingPub);
      const pubDer = pubObj.export({ type: 'spki', format: 'der' });
      const fingerprint = crypto.createHash('sha256').update(pubDer).digest('hex').slice(0, 16);
      return {
        publicKeyPem: existingPub,
        privateKeyPem: existingPriv,
        publicKeyBase64: pubDer.toString('base64'),
        fingerprint,
      };
    }

    // Gera novo par de chaves assimétricas
    const newKp = generateX25519KeyPair();
    vaultService.setSecret(privateKeySecretKey, newKp.privateKeyPem);
    vaultService.setSecret(publicKeySecretKey, newKp.publicKeyPem);

    return newKp;
  }

  /**
   * Registra a chave pública do usuário no .keymap.json do repositório
   */
  registerUserPublicKey(
    repoName: string,
    login: string,
    profile: { level: number; departments: string[]; allowed_paths?: string[] }
  ): KeymapMember {
    const kp = this.getOrCreateUserKeyPair(login);
    const keymap = this.getKeymap(repoName);

    const member: KeymapMember = {
      login,
      public_key: kp.publicKeyPem,
      fingerprint: kp.fingerprint,
      level: profile.level ?? 2,
      departments: profile.departments || ['engineering'],
      allowed_paths: profile.allowed_paths,
      status: 'active',
    };

    keymap.members[login] = member;
    this.saveKeymap(repoName, keymap);
    return member;
  }

  /**
   * Desbloqueia e retorna todas as DEKs disponíveis para o usuário no repositório ativo
   */
  getUnlockedDEKs(repoName?: string, userLogin?: string): Record<string, Buffer> {
    const cfg = loadConfig();
    const activeRepoName = repoName || cfg.active_repo?.name || 'local';
    const login = userLogin || cfg.user?.login || 'marcosbaiadori';

    let repoCache = this.memoryDEKCache.get(activeRepoName);
    if (!repoCache) {
      repoCache = new Map();
      this.memoryDEKCache.set(activeRepoName, repoCache);
    }

    const deks: Record<string, Buffer> = {};

    // 1. Tenta carregar do cache de sessão local do git se existir
    const sessionFile = path.join(this.getRepoDir(activeRepoName), '.git', 'context-vault-session.json');
    if (fs.existsSync(sessionFile)) {
      try {
        const raw = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
        for (const [dept, b64] of Object.entries(raw)) {
          if (typeof b64 === 'string') {
            const buf = Buffer.from(b64, 'base64');
            repoCache.set(dept, buf);
            deks[dept] = buf;
          }
        }
      } catch {}
    }

    const keymap = this.getKeymap(activeRepoName);
    const userSlots = keymap.slots[login] || {};
    let keyPair: UserKeyPair | null = null;

    for (const [compartmentId, slot] of Object.entries(userSlots)) {
      if (repoCache.has(compartmentId)) {
        deks[compartmentId] = repoCache.get(compartmentId)!;
        continue;
      }

      try {
        if (!keyPair) keyPair = this.getOrCreateUserKeyPair(login);
        const dek = openDEKWithPrivateKey(slot, keyPair.privateKeyPem);
        repoCache.set(compartmentId, dek);
        deks[compartmentId] = dek;
      } catch (err: any) {
        console.warn(`[VaultEngine] Não foi possível abrir slot '${compartmentId}' para ${login}:`, err.message);
      }
    }

    this.saveSessionDEKs(activeRepoName, deks);
    return deks;
  }

  private saveSessionDEKs(repoName: string, deks: Record<string, Buffer>): void {
    try {
      const repoDir = this.getRepoDir(repoName);
      const gitDir = path.join(repoDir, '.git');
      if (fs.existsSync(gitDir)) {
        const sessionFile = path.join(gitDir, 'context-vault-session.json');
        const serializable: Record<string, string> = {};
        for (const [k, v] of Object.entries(deks)) {
          serializable[k] = v.toString('base64');
        }
        fs.writeFileSync(sessionFile, JSON.stringify(serializable, null, 2), 'utf-8');
      }
    } catch {}
  }

  /**
   * Define/Salva uma DEK para um compartimento e cria os slots para membros autorizados
   */
  setCompartmentDEK(
    repoName: string,
    compartmentId: string,
    dek: Buffer,
    authorizedLogins?: string[]
  ): void {
    let repoCache = this.memoryDEKCache.get(repoName);
    if (!repoCache) {
      repoCache = new Map();
      this.memoryDEKCache.set(repoName, repoCache);
    }
    repoCache.set(compartmentId, dek);

    const keymap = this.getKeymap(repoName);
    const targetLogins = new Set<string>(authorizedLogins || []);

    // Se nenhum login específico foi passado ou além dos passados, inclui todos os membros com acesso ao compartimento
    for (const [login, member] of Object.entries(keymap.members)) {
      if (member.status !== 'active') continue;
      if (
        member.departments.includes('*') ||
        member.departments.includes(compartmentId) ||
        member.level === 0
      ) {
        targetLogins.add(login);
      }
    }

    for (const login of targetLogins) {
      const member = keymap.members[login];
      if (!member || !member.public_key) continue;

      const slot = sealDEKForPublicKey(dek, member.public_key);
      if (!keymap.slots[login]) {
        keymap.slots[login] = {};
      }
      keymap.slots[login][compartmentId] = slot;
    }

    this.saveKeymap(repoName, keymap);
    this.saveSessionDEKs(repoName, this.getUnlockedDEKs(repoName));
  }

  /**
   * Sincronização Local a partir do Git (Chamado após Pull ou Checkout):
   * 1. Varre arquivos *.enc
   * 2. Se o usuário tem permissão e a DEK: descriptografa para .md local e atualiza cache
   * 3. Se o usuário NÃO tem permissão: remove qualquer resquício de .md local, mantendo o workspace limpo
   */
  async syncLocalWorkspaceFromGit(repoName?: string, userLogin?: string): Promise<{
    decryptedCount: number;
    skippedCount: number;
    omittedCount: number;
  }> {
    const cfg = loadConfig();
    const activeRepoName = repoName || cfg.active_repo?.name || 'local';
    const login = userLogin || cfg.user?.login || 'marcosbaiadori';
    const repoDir = this.getRepoDir(activeRepoName);

    if (!fs.existsSync(repoDir)) {
      return { decryptedCount: 0, skippedCount: 0, omittedCount: 0 };
    }

    this.ensureGitIgnoreRules(repoDir);
    this.ensurePreCommitHook(repoDir);

    const cache = this.getCache(activeRepoName);
    const keymap = this.getKeymap(activeRepoName);
    const userProfile = keymap.members[login] || {
      login,
      level: 0, // Root por padrão se for o dono local
      departments: ['*'],
      status: 'active',
    };

    const unlockedDEKs = this.getUnlockedDEKs(activeRepoName, login);

    let decryptedCount = 0;
    let skippedCount = 0;
    let omittedCount = 0;

    const scanAndProcess = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const ent of entries) {
        if (ent.name === '.git' || ent.name === 'node_modules' || ent.name === '.scripts') continue;
        const fullPath = path.join(dir, ent.name);

        if (ent.isDirectory()) {
          scanAndProcess(fullPath);
        } else if (ent.isFile() && ent.name.endsWith('.md.enc')) {
          const relEncPath = path.relative(repoDir, fullPath).replace(/\\/g, '/');
          const relPlainPath = relEncPath.slice(0, -4); // remove '.enc' -> '.md'
          const fullPlainPath = path.join(repoDir, relPlainPath);

          const encContent = fs.readFileSync(fullPath, 'utf-8');
          const encSha = crypto.createHash('sha256').update(encContent).digest('hex');
          const parsed = parseEncryptedEnvelope(encContent);

          if (!parsed.isEncrypted || !parsed.header) {
            continue;
          }

          const docMeta = {
            security_level: parsed.header.security_level,
            level: parsed.header.security_level,
            department: parsed.header.department,
            path: relPlainPath,
          };

          // Avalia se o usuário tem autorização
          const hasClearance = canAccessDocument(userProfile, docMeta);

          if (!hasClearance) {
            // Regra Aprovada: Omissão no disco local (remove se existir por engano)
            if (fs.existsSync(fullPlainPath)) {
              try { fs.unlinkSync(fullPlainPath); } catch {}
            }
            omittedCount++;
            continue;
          }

          // Se tem permissão, verifica a DEK correspondente
          const compartmentKey = parsed.header.department || `lvl-${parsed.header.security_level}`;
          const dek = unlockedDEKs[compartmentKey] || unlockedDEKs['default'] || unlockedDEKs[String(parsed.header.security_level)];

          // Se não temos a DEK ainda, não consegue abrir
          if (!dek) {
            omittedCount++;
            continue;
          }

          // Verifica se já está no cache com o mesmo hash do .enc
          const cached = cache.files[relPlainPath];
          if (cached && cached.encSha256 === encSha && fs.existsSync(fullPlainPath)) {
            skippedCount++;
            continue;
          }

          // Descriptografa e salva o .md local
          const decResult = decryptEncFile(encContent, dek);
          if (decResult.success && decResult.content !== undefined) {
            fs.mkdirSync(path.dirname(fullPlainPath), { recursive: true });
            fs.writeFileSync(fullPlainPath, decResult.content, 'utf-8');

            const plainSha = crypto.createHash('sha256').update(decResult.content).digest('hex');
            cache.files[relPlainPath] = {
              encSha256: encSha,
              plainSha256: plainSha,
              mtime: fs.statSync(fullPlainPath).mtimeMs,
              department: parsed.header.department,
              level: parsed.header.security_level,
              lastSyncedAt: new Date().toISOString(),
            };
            decryptedCount++;
          }
        }
      }
    };

    scanAndProcess(repoDir);
    this.saveCache(activeRepoName, cache);

    return { decryptedCount, skippedCount, omittedCount };
  }

  /**
   * Pre-Commit & Pre-Push Staging:
   * 1. Detecta arquivos .md locais que foram alterados pelo usuário ou pela IA
   * 2. Cifra apenas os modificados para o respectivo .enc
   * 3. Atualiza o cache local
   * 4. Retorna a lista dos .enc atualizados para o Git
   */
  async prepareGitStaging(
    repoName?: string,
    specificFiles?: string[],
    userLogin?: string
  ): Promise<{ modifiedEncFiles: string[] }> {
    const cfg = loadConfig();
    const activeRepoName = repoName || cfg.active_repo?.name || 'local';
    const repoDir = this.getRepoDir(activeRepoName);

    if (!fs.existsSync(repoDir)) {
      return { modifiedEncFiles: [] };
    }

    const cache = this.getCache(activeRepoName);
    const keymap = this.getKeymap(activeRepoName);
    const activeMembers = Object.keys(keymap.members);
    const login = userLogin || (cfg.user?.login && keymap.members[cfg.user.login] ? cfg.user.login : activeMembers[0]) || 'marcosbaiadori';
    let unlockedDEKs = this.getUnlockedDEKs(activeRepoName, login);

    const modifiedEncFiles: string[] = [];

    const filesToScan: string[] = [];
    if (specificFiles && specificFiles.length > 0) {
      filesToScan.push(...specificFiles);
    } else {
      const scanAllMd = (dir: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const ent of entries) {
          if (ent.name === '.git' || ent.name === 'node_modules' || ent.name === '.scripts') continue;
          const fullPath = path.join(dir, ent.name);
          if (ent.isDirectory()) {
            scanAllMd(fullPath);
          } else if (ent.isFile() && ent.name.endsWith('.md')) {
            filesToScan.push(path.relative(repoDir, fullPath).replace(/\\/g, '/'));
          }
        }
      };
      scanAllMd(repoDir);
    }

    for (const relPlainPath of filesToScan) {
      // Ignora markdowns públicos de primeiro escalão
      if (
        relPlainPath === 'README.md' ||
        relPlainPath === 'CHANGELOG.md' ||
        relPlainPath.startsWith('docs/public/')
      ) {
        continue;
      }

      const fullPlainPath = path.join(repoDir, relPlainPath);
      const relEncPath = `${relPlainPath}.enc`;
      const fullEncPath = path.join(repoDir, relEncPath);

      // Se o arquivo .md foi deletado pelo usuário, deleta o .enc correspondente
      if (!fs.existsSync(fullPlainPath)) {
        if (fs.existsSync(fullEncPath)) {
          fs.unlinkSync(fullEncPath);
          modifiedEncFiles.push(relEncPath);
        }
        delete cache.files[relPlainPath];
        continue;
      }

      const plainContent = fs.readFileSync(fullPlainPath, 'utf-8');
      const plainSha = crypto.createHash('sha256').update(plainContent).digest('hex');
      const stat = fs.statSync(fullPlainPath);

      const cached = cache.files[relPlainPath];

      // Se o arquivo não mudou e o .enc já existe, pula!
      if (cached && cached.plainSha256 === plainSha && fs.existsSync(fullEncPath)) {
        continue;
      }

      // Determina o departamento pela pasta (ex: finance/dre.md -> finance)
      const folderParts = relPlainPath.split('/');
      const department = folderParts.length > 1 ? folderParts[0] : 'default';
      const level = department === 'executive' ? 0 : department === 'finance' || department === 'legal' ? 1 : 2;

      // Obtém ou inicializa a DEK desse compartimento
      let dek = unlockedDEKs[department] || unlockedDEKs['default'];
      if (!dek) {
        dek = crypto.randomBytes(32);
        this.setCompartmentDEK(activeRepoName, department, dek, [login]);
        unlockedDEKs = this.getUnlockedDEKs(activeRepoName, login);
      }

      // Criptografa para .enc
      const encContent = encryptFileToEnc(plainContent, dek, {
        department,
        level,
        title: path.basename(relPlainPath, '.md'),
      });

      fs.mkdirSync(path.dirname(fullEncPath), { recursive: true });
      fs.writeFileSync(fullEncPath, encContent, 'utf-8');

      const encSha = crypto.createHash('sha256').update(encContent).digest('hex');

      cache.files[relPlainPath] = {
        encSha256: encSha,
        plainSha256: plainSha,
        mtime: stat.mtimeMs,
        department,
        level,
        lastSyncedAt: new Date().toISOString(),
      };

      modifiedEncFiles.push(relEncPath);
    }

    this.saveCache(activeRepoName, cache);
    return { modifiedEncFiles };
  }

  /**
   * Garante as regras de segurança no .gitignore para isolar o texto plano confidencial
   */
  ensureGitIgnoreRules(repoDir: string): void {
    const gitignorePath = path.join(repoDir, '.gitignore');
    let content = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf-8') : '';

    const requiredEntries = [
      '# Context OS Vault Transparent Plaintext & Cache',
      '.git/context-vault-cache.json',
      'engineering/*.md',
      'finance/*.md',
      'legal/*.md',
      'executive/*.md',
      '!docs/public/**/*.md',
      '!README.md',
    ];

    let modified = false;
    for (const entry of requiredEntries) {
      if (!content.includes(entry)) {
        content += (content.endsWith('\n') ? '' : '\n') + entry + '\n';
        modified = true;
      }
    }

    if (modified) {
      fs.writeFileSync(gitignorePath, content, 'utf-8');
    }
  }

  /**
   * Instala o hook de pre-commit do Git no repositório ativo
   */
  ensurePreCommitHook(repoDir: string): void {
    const hooksDir = path.join(repoDir, '.git', 'hooks');
    if (!fs.existsSync(hooksDir)) return;

    const hookFile = path.join(hooksDir, 'pre-commit');
    const hookScript = `#!/usr/bin/env sh
# Context OS Vault Sync Pre-Commit Hook
if [ -f ".scripts/vault-sync.cjs" ]; then
  node .scripts/vault-sync.cjs --pre-commit
fi
`;

    try {
      if (!fs.existsSync(hookFile)) {
        fs.writeFileSync(hookFile, hookScript, { mode: 0o755 });
      }
    } catch {}
  }
}

export const vaultEngineService = new VaultEngineService();
