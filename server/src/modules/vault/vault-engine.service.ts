import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PROJECTS_DIR } from '../../config/constants.js';
import { loadConfig } from '../../config/storage.js';
import { vaultService } from './vault.service.js';
import {
  generateX25519KeyPair,
  generateEd25519KeyPair,
  signKeymapPayload,
  verifyKeymapSignature,
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
  denied_paths?: string[];
  status: 'active' | 'pending';
  registered_at?: string;
}

export interface KeymapConfig {
  version: number;
  updated_at: string;
  signer?: string;
  signature?: string;
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

export interface VaultFolderSummary {
  id: string;
  name: string;
  folder: string;
  color: string;
  icon?: string;
  default_level: number;
  fileCount: number;
  authorizedMembers: string[];
  hasAccess: boolean;
}

export interface MyVaultAccessSummary {
  login: string;
  fingerprint: string;
  publicKey: string;
  status: 'active' | 'pending' | 'unregistered';
  isOwner: boolean;
  folders: VaultFolderSummary[];
}

export class VaultEngineService {
  // Cache estritamente em memória RAM para DEKs descriptografadas na sessão ativa
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

  private getProjectConfig(repoName?: string): any {
    const repoDir = this.getRepoDir(repoName);
    const cfgPath = path.join(repoDir, '.project.config.json');
    if (fs.existsSync(cfgPath)) {
      try {
        return JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
      } catch {}
    }
    return {};
  }

  /**
   * Obtém lista dinâmica de pastas seguras/rotas a partir do config do projeto ou das pastas reais do workspace
   */
  getVaultFolders(repoName?: string): Array<{ id: string; name: string; folder: string; color: string; icon?: string; default_level: number }> {
    const pConfig = this.getProjectConfig(repoName);
    if (Array.isArray(pConfig.departments) && pConfig.departments.length > 0) {
      return pConfig.departments;
    }

    // Varre pastas reais do diretório do repositório para descobrir rotas dinâmicas
    const repoDir = this.getRepoDir(repoName);
    if (fs.existsSync(repoDir)) {
      try {
        const entries = fs.readdirSync(repoDir, { withFileTypes: true });
        const dynamicFolders: Array<{ id: string; name: string; folder: string; color: string; icon?: string; default_level: number }> = [];
        const colors = ['#6366f1', '#10b981', '#a855f7', '#ec4899', '#f59e0b', '#06b6d4', '#3b82f6'];
        let colorIdx = 0;

        for (const entry of entries) {
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            const folderName = entry.name;
            dynamicFolders.push({
              id: folderName.toLowerCase(),
              name: folderName.charAt(0).toUpperCase() + folderName.slice(1),
              folder: folderName,
              color: colors[colorIdx % colors.length],
              default_level: 1,
              icon: 'folder',
            });
            colorIdx++;
          }
        }

        // Também varre docs/ se existir
        const docsDir = path.join(repoDir, 'docs');
        if (fs.existsSync(docsDir)) {
          const docEntries = fs.readdirSync(docsDir, { withFileTypes: true });
          for (const dEntry of docEntries) {
            if (dEntry.isDirectory() && !dEntry.name.startsWith('.')) {
              const fullPath = `docs/${dEntry.name}`;
              if (!dynamicFolders.some((f) => f.folder === fullPath || f.id === dEntry.name.toLowerCase())) {
                dynamicFolders.push({
                  id: dEntry.name.toLowerCase(),
                  name: dEntry.name.charAt(0).toUpperCase() + dEntry.name.slice(1),
                  folder: fullPath,
                  color: colors[colorIdx % colors.length],
                  default_level: 1,
                  icon: 'folder_open',
                });
                colorIdx++;
              }
            }
          }
        }

        if (dynamicFolders.length > 0) {
          return dynamicFolders;
        }
      } catch (err) {
        console.warn(`[VaultEngine] Erro ao varrer pastas de ${repoName}:`, err);
      }
    }

    return [];
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
        const parsed = JSON.parse(raw);
        if (!parsed.members) parsed.members = {};
        if (!parsed.slots) parsed.slots = {};
        return parsed;
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
   * Salva o .keymap.json no repositório com assinatura digital Ed25519 opcional
   */
  saveKeymap(repoName: string | undefined, keymap: KeymapConfig, signerLogin?: string): void {
    const repoDir = this.getRepoDir(repoName);
    const keymapPath = this.getKeymapPath(repoDir);
    keymap.updated_at = new Date().toISOString();

    const activeSigner = signerLogin || loadConfig().user?.login || 'local_admin';
    const signerPrivKey = vaultService.getSecret(`context_os_ed25519_priv_${activeSigner.toLowerCase()}`);
    if (signerPrivKey) {
      const payloadToSign = {
        version: keymap.version,
        updated_at: keymap.updated_at,
        members: keymap.members,
        slots: keymap.slots,
      };
      keymap.signer = activeSigner;
      keymap.signature = signKeymapPayload(payloadToSign, signerPrivKey);
    }

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
    const cleanLogin = (userLogin || 'local_user').toLowerCase().replace(/^@/, '');
    const privateKeySecretKey = `context_os_x25519_priv_${cleanLogin}`;
    const publicKeySecretKey = `context_os_x25519_pub_${cleanLogin}`;

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

    // Gera novo par de chaves assimétricas X25519
    const newKp = generateX25519KeyPair();
    vaultService.setSecret(privateKeySecretKey, newKp.privateKeyPem);
    vaultService.setSecret(publicKeySecretKey, newKp.publicKeyPem);

    // Gera também par Ed25519 para assinatura do admin
    const edKp = generateEd25519KeyPair();
    vaultService.setSecret(`context_os_ed25519_priv_${cleanLogin}`, edKp.privateKeyPem);
    vaultService.setSecret(`context_os_ed25519_pub_${cleanLogin}`, edKp.publicKeyPem);

    return newKp;
  }

  /**
   * Registra a chave pública do usuário no .keymap.json do repositório
   */
  registerUserPublicKey(
    repoName: string,
    login: string,
    profile: {
      level?: number;
      departments?: string[];
      allowed_paths?: string[];
      denied_paths?: string[];
      status?: 'active' | 'pending';
    } = {}
  ): KeymapMember {
    const cleanLogin = login.trim().replace(/^@/, '');
    const kp = this.getOrCreateUserKeyPair(cleanLogin);
    const keymap = this.getKeymap(repoName);

    const existing = keymap.members[cleanLogin];

    const member: KeymapMember = {
      login: cleanLogin,
      public_key: kp.publicKeyPem,
      fingerprint: kp.fingerprint,
      level: profile.level ?? existing?.level ?? 2,
      departments: profile.departments || existing?.departments || ['engineering'],
      allowed_paths: profile.allowed_paths || existing?.allowed_paths,
      denied_paths: profile.denied_paths || existing?.denied_paths,
      status: profile.status || existing?.status || 'active',
      registered_at: existing?.registered_at || new Date().toISOString(),
    };

    keymap.members[cleanLogin] = member;
    this.saveKeymap(repoName, keymap);
    return member;
  }

  /**
   * Desbloqueia e retorna todas as DEKs disponíveis para o usuário no repositório ativo
   * Armazena EXCLUSIVAMENTE em memória RAM (memoryDEKCache).
   */
  getUnlockedDEKs(repoName?: string, userLogin?: string): Record<string, Buffer> {
    const cfg = loadConfig();
    const activeRepoName = repoName || cfg.active_repo?.name || 'local';
    const login = (userLogin || cfg.user?.login || 'marcosbaiadori').toLowerCase().replace(/^@/, '');

    let repoCache = this.memoryDEKCache.get(activeRepoName);
    if (!repoCache) {
      repoCache = new Map();
      this.memoryDEKCache.set(activeRepoName, repoCache);
    }

    const deks: Record<string, Buffer> = {};
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

    // Copia também quaisquer DEKs já mantidas em memória
    for (const [k, v] of repoCache.entries()) {
      deks[k] = v;
    }

    return deks;
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
  }

  /**
   * Concede acesso a uma ou mais pastas/compartimentos para um membro
   */
  grantFolderAccess(repoName: string, targetLogin: string, folderIds: string[]): boolean {
    const cleanLogin = targetLogin.trim().replace(/^@/, '');
    const keymap = this.getKeymap(repoName);
    const member = keymap.members[cleanLogin];
    if (!member || !member.public_key) {
      throw new Error(`Membro @${cleanLogin} não possui chave pública registrada no repositório.`);
    }

    const deks = this.getUnlockedDEKs(repoName);

    for (const folderId of folderIds) {
      let dek = deks[folderId];
      if (!dek) {
        // Se ainda não há DEK para esta pasta, cria uma nova
        dek = crypto.randomBytes(32);
        this.setCompartmentDEK(repoName, folderId, dek, [cleanLogin]);
      } else {
        const slot = sealDEKForPublicKey(dek, member.public_key);
        if (!keymap.slots[cleanLogin]) keymap.slots[cleanLogin] = {};
        keymap.slots[cleanLogin][folderId] = slot;
      }

      if (!member.departments.includes(folderId) && !member.departments.includes('*')) {
        member.departments.push(folderId);
      }
    }

    this.saveKeymap(repoName, keymap);
    return true;
  }

  /**
   * Revoga acesso a uma pasta específica e rotaciona a DEK
   */
  revokeFolderAccess(repoName: string, targetLogin: string, folderIds: string[]): boolean {
    const cleanLogin = targetLogin.trim().replace(/^@/, '');
    const keymap = this.getKeymap(repoName);
    const member = keymap.members[cleanLogin];

    for (const folderId of folderIds) {
      if (keymap.slots[cleanLogin]) {
        delete keymap.slots[cleanLogin][folderId];
      }
      if (member) {
        member.departments = member.departments.filter((d) => d !== folderId);
      }
      // Rotaciona a DEK da pasta para invalidar a chave antiga em posse do membro revogado
      this.rotateCompartmentDEK(repoName, folderId, [cleanLogin]);
    }

    this.saveKeymap(repoName, keymap);
    return true;
  }

  /**
   * Rotaciona a DEK de um compartimento, recifra todos os arquivos .md.enc e re-sela para os membros ativos remanescentes
   */
  rotateCompartmentDEK(repoName: string, compartmentId: string, excludedLogins: string[] = []): Buffer {
    const repoDir = this.getRepoDir(repoName);
    const keymap = this.getKeymap(repoName);
    const newDek = crypto.randomBytes(32);

    // 1. Atualiza o cache em memória
    let repoCache = this.memoryDEKCache.get(repoName);
    if (!repoCache) {
      repoCache = new Map();
      this.memoryDEKCache.set(repoName, repoCache);
    }
    repoCache.set(compartmentId, newDek);

    // 2. Remove slots antigos deste compartimento
    const excludedSet = new Set(excludedLogins.map((l) => l.toLowerCase().replace(/^@/, '')));
    for (const [login, userSlots] of Object.entries(keymap.slots)) {
      if (excludedSet.has(login.toLowerCase())) {
        delete userSlots[compartmentId];
      }
    }

    // 3. Re-sela a nova DEK para todos os membros ativos autorizados
    for (const [login, member] of Object.entries(keymap.members)) {
      if (member.status !== 'active' || excludedSet.has(login.toLowerCase())) continue;
      if (
        member.departments.includes('*') ||
        member.departments.includes(compartmentId) ||
        member.level === 0
      ) {
        const slot = sealDEKForPublicKey(newDek, member.public_key);
        if (!keymap.slots[login]) keymap.slots[login] = {};
        keymap.slots[login][compartmentId] = slot;
      }
    }

    this.saveKeymap(repoName, keymap);

    // 4. Recifra todos os arquivos .md.enc pertencentes a esse compartimento
    const cache = this.getCache(repoName);
    const folderDir = path.join(repoDir, compartmentId);

    if (fs.existsSync(folderDir)) {
      const scanAndReEncrypt = (dir: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const ent of entries) {
          const fullPath = path.join(dir, ent.name);
          if (ent.isDirectory()) {
            scanAndReEncrypt(fullPath);
          } else if (ent.isFile() && ent.name.endsWith('.md')) {
            const relPath = path.relative(repoDir, fullPath).replace(/\\/g, '/');
            const encPath = `${fullPath}.enc`;
            const plainContent = fs.readFileSync(fullPath, 'utf-8');
            const encContent = encryptFileToEnc(plainContent, newDek, {
              department: compartmentId,
              title: path.basename(relPath, '.md'),
            });
            fs.writeFileSync(encPath, encContent, 'utf-8');

            const plainSha = crypto.createHash('sha256').update(plainContent).digest('hex');
            const encSha = crypto.createHash('sha256').update(encContent).digest('hex');

            cache.files[relPath] = {
              encSha256: encSha,
              plainSha256: plainSha,
              mtime: fs.statSync(fullPath).mtimeMs,
              department: compartmentId,
              lastSyncedAt: new Date().toISOString(),
            };
          }
        }
      };
      scanAndReEncrypt(folderDir);
      this.saveCache(repoName, cache);
    }

    return newDek;
  }

  /**
   * Revoga completamente um membro: remove do keymap, limpa slots e rotaciona as DEKs das pastas acessadas
   */
  revokeMember(repoName: string, login: string): { success: boolean; rotatedFolders: string[] } {
    const cleanLogin = login.trim().replace(/^@/, '');
    const keymap = this.getKeymap(repoName);
    const member = keymap.members[cleanLogin];
    const rotatedFolders: string[] = [];

    const userDepts = member?.departments || Object.keys(keymap.slots[cleanLogin] || {});

    // Remove do keymap
    delete keymap.members[cleanLogin];
    delete keymap.slots[cleanLogin];
    this.saveKeymap(repoName, keymap);

    // Rotaciona todas as pastas que o usuário tinha acesso
    const foldersToRotate = userDepts.includes('*')
      ? this.getVaultFolders(repoName).map((f) => f.id)
      : userDepts;

    for (const folderId of foldersToRotate) {
      if (folderId !== 'default' && folderId !== 'public') {
        this.rotateCompartmentDEK(repoName, folderId, [cleanLogin]);
        rotatedFolders.push(folderId);
      }
    }

    return { success: true, rotatedFolders };
  }

  /**
   * Retorna visão completa do estado de acesso a cofres para a interface do usuário
   */
  getMyAccessSummary(repoName?: string, userLogin?: string): MyVaultAccessSummary {
    const cfg = loadConfig();
    const activeRepoName = repoName || cfg.active_repo?.name || 'local';
    const login = (userLogin || cfg.user?.login || 'marcosbaiadori').toLowerCase().replace(/^@/, '');
    const repoDir = this.getRepoDir(activeRepoName);

    const kp = this.getOrCreateUserKeyPair(login);
    const keymap = this.getKeymap(activeRepoName);
    const member = keymap.members[login];
    const unlockedDEKs = this.getUnlockedDEKs(activeRepoName, login);
    const folders = this.getVaultFolders(activeRepoName);

    const pConfig = this.getProjectConfig(activeRepoName);
    const isOwner = member?.level === 0 || cfg.user?.login === login || !member;

    const folderSummaries: VaultFolderSummary[] = folders.map((f) => {
      const folderPath = path.join(repoDir, f.folder);
      let fileCount = 0;
      if (fs.existsSync(folderPath)) {
        try {
          const files = fs.readdirSync(folderPath);
          fileCount = files.filter((n) => n.endsWith('.md') || n.endsWith('.md.enc')).length;
        } catch {}
      }

      const authorizedMembers: string[] = [];
      for (const [mName, mSlots] of Object.entries(keymap.slots)) {
        if (mSlots[f.id] || mSlots[f.folder]) {
          authorizedMembers.push(mName);
        }
      }

      const hasAccess = Boolean(unlockedDEKs[f.id] || unlockedDEKs[f.folder] || isOwner);

      return {
        id: f.id,
        name: f.name,
        folder: f.folder,
        color: f.color,
        icon: f.icon,
        default_level: f.default_level,
        fileCount,
        authorizedMembers,
        hasAccess,
      };
    });

    return {
      login,
      fingerprint: kp.fingerprint,
      publicKey: kp.publicKeyPem,
      status: member ? member.status : 'unregistered',
      isOwner,
      folders: folderSummaries,
    };
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
    const login = (userLogin || cfg.user?.login || 'marcosbaiadori').toLowerCase().replace(/^@/, '');
    const repoDir = this.getRepoDir(activeRepoName);

    if (!fs.existsSync(repoDir)) {
      return { decryptedCount: 0, skippedCount: 0, omittedCount: 0 };
    }

    this.ensureGitIgnoreRules(repoDir, activeRepoName);
    this.ensurePreCommitHook(repoDir);

    const cache = this.getCache(activeRepoName);
    const keymap = this.getKeymap(activeRepoName);
    const userProfile = keymap.members[login] || {
      login,
      level: Object.keys(keymap.members).length === 0 ? 0 : 999,
      departments: Object.keys(keymap.members).length === 0 ? ['*'] : [],
      status: Object.keys(keymap.members).length === 0 ? 'active' : 'pending',
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
          const compartmentKey = parsed.header.department || 'default';
          const dek = unlockedDEKs[compartmentKey] || unlockedDEKs['default'];

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
    const login = (userLogin || (cfg.user?.login && keymap.members[cfg.user.login] ? cfg.user.login : activeMembers[0]) || 'marcosbaiadori').toLowerCase().replace(/^@/, '');
    let unlockedDEKs = this.getUnlockedDEKs(activeRepoName, login);

    const modifiedEncFiles: string[] = [];
    const configuredFolders = this.getVaultFolders(activeRepoName);
    const vaultFolderIds = new Set(configuredFolders.map((f) => f.folder.toLowerCase()));

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
      const matchedFolder = configuredFolders.find((f) => f.folder.toLowerCase() === department.toLowerCase());
      const level = matchedFolder ? matchedFolder.default_level : 2;

      // Obtém ou inicializa a DEK desse compartimento
      let dek = unlockedDEKs[department] || unlockedDEKs['default'];
      if (!dek) {
        // Se a pasta protegida já possui slots de outros membros no keymap e este usuário não tem acesso, BLOQUEIA (Evita S4)
        const hasExistingSlots = Object.values(keymap.slots).some((userSlot) => Boolean(userSlot[department]));
        if (hasExistingSlots && keymap.members[login]?.level !== 0 && cfg.user?.login !== login) {
          throw new Error(`Acesso negado: você não possui a chave criptográfica para cifrar arquivos na pasta '${department}'.`);
        }

        dek = crypto.randomBytes(32);
        this.setCompartmentDEK(activeRepoName, department, dek, [login]);
        unlockedDEKs = this.getUnlockedDEKs(activeRepoName, login);
      }

      // Criptografa para .enc
      const encContent = encryptFileToEnc(plainContent, dek, {
        department,
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
   * Garante as regras de segurança dinâmicas no .gitignore para isolar o texto plano confidencial
   */
  ensureGitIgnoreRules(repoDir: string, repoName?: string): void {
    const gitignorePath = path.join(repoDir, '.gitignore');
    let content = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf-8') : '';

    const folders = this.getVaultFolders(repoName);
    const dynamicFolderRules = folders.flatMap((f) => [
      `${f.folder}/*.md`,
      `${f.folder}/**/*.md`,
    ]);

    const requiredEntries = [
      '# Context OS Vault Transparent Plaintext & Cache',
      '.git/context-vault-cache.json',
      ...dynamicFolderRules,
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
