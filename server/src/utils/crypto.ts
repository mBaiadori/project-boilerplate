import crypto from 'node:crypto';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import type { DynamicSecurityLevel, LevelCanaryProbe, UserKeySlot, SecretScanResult, SecretScanViolation } from '../modules/governance/governance.types.js';

export interface EncryptedEnvelopeHeader {
  title?: string;
  security_level: number;
  security_level_id?: string;
  encrypted: true;
  algorithm: 'AES-256-GCM';
  key_id?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface EncryptedPayloadData {
  alg: 'AES-256-GCM';
  iv: string; // Base64
  authTag: string; // Base64
  payload: string; // Base64 ciphertext
  security_level?: number;
  level?: number;
  department?: string;
  key_id?: string;
  [key: string]: any;
}

export const CANARY_PLAINTEXT_PREFIX = 'CONTEXT_OS_VALID_CANARY_';
export const ENVELOPE_BEGIN_TAG = '-----BEGIN CONTEXT ENCRYPTED PAYLOAD-----';
export const ENVELOPE_END_TAG = '-----END CONTEXT ENCRYPTED PAYLOAD-----';

export const SECURITY_LEVELS = {
  LEVEL_0_ROOT: 0,
  LEVEL_1_STRATEGIC: 1,
  LEVEL_2_ENGINEERING: 2,
  LEVEL_3_OPERATIONAL: 3,
  PUBLIC: 999,
} as const;

// In-memory cache for derived PBKDF2 keys to guarantee sub-millisecond encryption/decryption
const derivedKeyCache = new Map<string, Buffer>();

/**
 * Derives a 256-bit AES symmetric key from a passphrase and salt using PBKDF2-SHA512.
 * Caches derived keys in memory to avoid repeating 100k hash rounds for the same session.
 */
export function deriveLevelKey(passphrase: string, salt: string = 'context-os-default-salt'): Buffer {
  const cacheKey = `${salt}:${passphrase}`;
  const cached = derivedKeyCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const derived = crypto.pbkdf2Sync(passphrase, salt, 100_000, 32, 'sha512');
  derivedKeyCache.set(cacheKey, derived);
  return derived;
}

/**
 * Checks if a user rank has clearance to access a document rank.
 * Reverse Hierarchy: Lower number means higher privilege (Rank 0 has access to everything).
 */
export function canAccessRank(userRank: number, docRank: number): boolean {
  if (docRank === 999 || isNaN(docRank)) {
    return true; // Public is open to everyone
  }
  if (isNaN(userRank)) {
    return false;
  }
  return userRank <= docRank;
}

export const canAccessLevel = canAccessRank;

/**
 * Checks multidimensional access clearance for a collaborator against a document's security metadata.
 * Evaluates:
 * 1. Root / Wildcard bypass (user.level === 0 or user.departments includes '*')
 * 2. Public clearance (doc.security_level === 999)
 * 3. Vertical Level clearance (user.level <= doc.security_level)
 * 4. Horizontal Department clearance (user.departments includes doc.department)
 */
export function canAccessDocument(
  user: { level?: number; security_level?: number; departments?: string[]; allowed_paths?: string[] },
  doc: { security_level?: number; level?: number; department?: string; path?: string }
): boolean {
  const userLevel =
    user.level !== undefined
      ? Number(user.level)
      : user.security_level !== undefined
      ? Number(user.security_level)
      : 999;
  const docLevel =
    doc.security_level !== undefined
      ? Number(doc.security_level)
      : doc.level !== undefined
      ? Number(doc.level)
      : 999;

  // 1. Root or wildcard bypass
  if (
    userLevel === 0 ||
    (Array.isArray(user.departments) && user.departments.includes('*')) ||
    (Array.isArray(user.allowed_paths) && user.allowed_paths.includes('*'))
  ) {
    return true;
  }

  // 2. Public documents are open to everyone
  if (docLevel === 999 || isNaN(docLevel)) {
    return true;
  }

  // 3. Vertical check: user must have level <= docLevel (lower number = higher clearance)
  if (isNaN(userLevel) || userLevel > docLevel) {
    return false;
  }

  // 4. Path/Route check: if user has allowed_paths configured and doc has a path
  if (Array.isArray(user.allowed_paths) && user.allowed_paths.length > 0 && doc.path) {
    const cleanDocPath = doc.path.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
    const hasPathAccess = user.allowed_paths.some((pattern) => {
      if (pattern === '*' || pattern === '/**') return true;
      const cleanPattern = pattern
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .replace(/\/\*+$/, '')
        .toLowerCase();
      return cleanDocPath === cleanPattern || cleanDocPath.startsWith(cleanPattern + '/');
    });
    if (!hasPathAccess) {
      return false;
    }
  }

  // 5. Horizontal check: department matching (retrocompatibilidade)
  if (doc.department && doc.department !== 'general' && doc.department !== 'public') {
    if (Array.isArray(user.departments) && user.departments.length > 0) {
      return user.departments.includes(doc.department);
    }
  }

  return true;
}

/**
 * Checks if raw file content is an encrypted Context OS envelope.
 */
export function isEncryptedEnvelope(content: string): boolean {
  if (!content || typeof content !== 'string') return false;
  return content.includes(ENVELOPE_BEGIN_TAG) && content.includes(ENVELOPE_END_TAG);
}

/**
 * Encrypts plaintext content into an AES-256-GCM payload.
 */
export function encryptAES256GCM(plaintext: string, key: Buffer): { iv: string; authTag: string; ciphertext: string } {
  const iv = crypto.randomBytes(12); // 96-bit standard GCM IV
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
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

/**
 * Decrypts an AES-256-GCM payload. Throws error if key or authTag is invalid.
 */
export function decryptAES256GCM(ciphertextBase64: string, ivBase64: string, authTagBase64: string, key: Buffer): string {
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  const ciphertext = Buffer.from(ciphertextBase64, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf-8');
}

/**
 * Generates a verification Canary probe for a security level.
 */
export function generateLevelCanary(levelId: string, levelKey: Buffer): LevelCanaryProbe {
  const probePlaintext = `${CANARY_PLAINTEXT_PREFIX}${levelId}`;
  const enc = encryptAES256GCM(probePlaintext, levelKey);
  return {
    level_id: levelId,
    iv: enc.iv,
    auth_tag: enc.authTag,
    probe_ciphertext: enc.ciphertext,
  };
}

/**
 * Verifies if a given key decrypts the Canary probe accurately.
 */
export function verifyLevelCanary(levelKey: Buffer, canary: LevelCanaryProbe): boolean {
  try {
    const decrypted = decryptAES256GCM(
      canary.probe_ciphertext,
      canary.iv,
      canary.auth_tag,
      levelKey
    );
    return decrypted === `${CANARY_PLAINTEXT_PREFIX}${canary.level_id}`;
  } catch {
    return false;
  }
}

/**
 * Creates a User Key Slot protecting a Level DEK with the user's individual passphrase.
 */
export function createUserKeySlot(
  user: string,
  userPassphrase: string,
  levelId: string,
  levelKey: Buffer,
  salt: string
): UserKeySlot {
  const userKey = deriveLevelKey(userPassphrase, `${salt}:${user}`);
  const enc = encryptAES256GCM(levelKey.toString('base64'), userKey);
  return {
    user,
    level_id: levelId,
    encrypted_dek: enc.ciphertext,
    iv: enc.iv,
    auth_tag: enc.authTag,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Unlocks a Level DEK from a User Key Slot using the user's individual passphrase.
 */
export function unlockUserKeySlot(
  user: string,
  userPassphrase: string,
  slot: UserKeySlot,
  salt: string
): { success: boolean; dek?: Buffer; error?: string } {
  try {
    const userKey = deriveLevelKey(userPassphrase, `${salt}:${user}`);
    const dekBase64 = decryptAES256GCM(
      slot.encrypted_dek,
      slot.iv,
      slot.auth_tag,
      userKey
    );
    const dek = Buffer.from(dekBase64, 'base64');
    return { success: true, dek };
  } catch (err: any) {
    return { success: false, error: 'Senha incorreta para o slot do usuário.' };
  }
}

/**
 * Encapsulates encrypted payload cleanly without markdown YAML frontmatter pollution.
 * All metadata resides in .docs.metadata.json.
 */
export function buildEncryptedEnvelope(
  header: EncryptedEnvelopeHeader,
  encryptedData: { iv: string; authTag: string; ciphertext: string }
): string {
  const payloadObj: EncryptedPayloadData = {
    alg: 'AES-256-GCM',
    iv: encryptedData.iv,
    authTag: encryptedData.authTag,
    payload: encryptedData.ciphertext,
    security_level: header.security_level,
    security_level_id: String(header.security_level),
    key_id: header.key_id,
    ...(header.department ? { department: header.department } : {}),
  };

  const payloadJsonBase64 = Buffer.from(JSON.stringify(payloadObj)).toString('base64');

  // Clean Markdown envelope: no YAML frontmatter required
  const lines: string[] = [
    ENVELOPE_BEGIN_TAG,
    payloadJsonBase64,
    ENVELOPE_END_TAG,
    '',
  ];

  return lines.join('\n');
}

/**
 * Parses encrypted payload from an envelope.
 * Fully backward-compatible with legacy envelopes containing YAML frontmatter.
 */
export function parseEncryptedEnvelope(fileContent: string): {
  header: EncryptedEnvelopeHeader | null;
  payloadData: EncryptedPayloadData | null;
  isEncrypted: boolean;
} {
  if (!isEncryptedEnvelope(fileContent)) {
    return { header: null, payloadData: null, isEncrypted: false };
  }

  let header: EncryptedEnvelopeHeader | null = null;
  const frontmatterMatch = fileContent.match(/^---\s*[\r\n]+([\s\S]*?)[\r\n]+---/);
  if (frontmatterMatch) {
    const rawYaml = frontmatterMatch[1];
    const parsed: any = {};
    for (const line of rawYaml.split('\n')) {
      const parts = line.split(':');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join(':').trim().replace(/^["']|["']$/g, '');
        if (key === 'security_level' || key === 'rank' || key === 'level') {
          parsed[key] = Number(val);
        } else if (key === 'encrypted') {
          parsed[key] = val === 'true';
        } else {
          parsed[key] = val;
        }
      }
    }
    header = parsed as EncryptedEnvelopeHeader;
  }

  const beginIdx = fileContent.indexOf(ENVELOPE_BEGIN_TAG);
  const endIdx = fileContent.indexOf(ENVELOPE_END_TAG);
  if (beginIdx === -1 || endIdx === -1 || beginIdx >= endIdx) {
    return { header, payloadData: null, isEncrypted: false };
  }

  const base64Chunk = fileContent
    .slice(beginIdx + ENVELOPE_BEGIN_TAG.length, endIdx)
    .trim();

  try {
    const jsonStr = Buffer.from(base64Chunk, 'base64').toString('utf-8');
    const payloadData = JSON.parse(jsonStr) as EncryptedPayloadData;

    if (!header) {
      header = {
        security_level: payloadData.security_level ?? (payloadData as any).level ?? 2,
        security_level_id: String(payloadData.security_level ?? 2),
        encrypted: true,
        algorithm: 'AES-256-GCM',
        key_id: payloadData.key_id,
        department: payloadData.department,
      };
    }

    return { header, payloadData, isEncrypted: true };
  } catch {
    return { header, payloadData: null, isEncrypted: false };
  }
}

/**
 * Encrypts a markdown document with a specific security level using its level key.
 */
export function encryptDocument(
  plaintext: string,
  levelRank: number,
  levelKey: Buffer,
  metadata?: Record<string, any>
): string {
  const encResult = encryptAES256GCM(plaintext, levelKey);
  const header: EncryptedEnvelopeHeader = {
    title: metadata?.title || 'Documento Confidencial',
    security_level: levelRank,
    security_level_id: metadata?.security_level_id || `level-${levelRank}`,
    encrypted: true,
    algorithm: 'AES-256-GCM',
    key_id: `sec-lvl-${levelRank}`,
    updated_at: new Date().toISOString(),
    ...(metadata || {}),
  };

  return buildEncryptedEnvelope(header, {
    iv: encResult.iv,
    authTag: encResult.authTag,
    ciphertext: encResult.ciphertext,
  });
}

/**
 * Decrypts a document from available unlocked keys.
 */
export function decryptDocument(
  fileContent: string,
  availableKeys: Record<string | number, Buffer>
): {
  success: boolean;
  content?: string;
  level: number;
  level_id?: string;
  error?: string;
} {
  const parsed = parseEncryptedEnvelope(fileContent);
  if (!parsed.isEncrypted || !parsed.payloadData) {
    return {
      success: true,
      content: fileContent,
      level: 999,
      level_id: 'public',
    };
  }

  const docLevel = parsed.header?.security_level ?? 3;
  const docLevelId = parsed.header?.security_level_id;

  // Try direct key by level_id or rank
  if (docLevelId && availableKeys[docLevelId]) {
    try {
      const text = decryptAES256GCM(
        parsed.payloadData.payload,
        parsed.payloadData.iv,
        parsed.payloadData.authTag,
        availableKeys[docLevelId]
      );
      return { success: true, content: text, level: docLevel, level_id: docLevelId };
    } catch {}
  }

  if (availableKeys[docLevel]) {
    try {
      const text = decryptAES256GCM(
        parsed.payloadData.payload,
        parsed.payloadData.iv,
        parsed.payloadData.authTag,
        availableKeys[docLevel]
      );
      return { success: true, content: text, level: docLevel, level_id: docLevelId };
    } catch {}
  }

  // Try all available keys in reverse hierarchy
  for (const [keyIdentifier, keyBuffer] of Object.entries(availableKeys)) {
    try {
      const text = decryptAES256GCM(
        parsed.payloadData.payload,
        parsed.payloadData.iv,
        parsed.payloadData.authTag,
        keyBuffer
      );
      return { success: true, content: text, level: docLevel, level_id: docLevelId };
    } catch {}
  }

  return {
    success: false,
    level: docLevel,
    level_id: docLevelId,
    error: `Acesso bloqueado: Este documento requer credencial de segurança Level ${docLevel}. A chave necessária não está desbloqueada na sessão.`,
  };
}

/**
 * Secret and Clearance Scanner for Pre-Commit and Pre-PR checks.
 */
export function scanContentForSecrets(content: string, filePath: string): SecretScanResult {
  const violations: SecretScanViolation[] = [];

  if (!content || typeof content !== 'string') {
    return { hasSecrets: false, violations };
  }

  // Check 1: GitHub Tokens
  if (/(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,255}/.test(content) || /github_pat_[A-Za-z0-9_]{50,255}/.test(content)) {
    violations.push({
      rule: 'GITHUB_PAT_DETECTED',
      file: filePath,
      message: 'Token de Acesso Pessoal do GitHub (PAT) detectado no arquivo.',
    });
  }

  // Check 2: OpenAI / Anthropic / Generic API Keys
  if (/sk-[A-Za-z0-9_-]{20,80}/.test(content) || /sk-ant-[A-Za-z0-9_-]{20,100}/.test(content)) {
    violations.push({
      rule: 'AI_API_KEY_DETECTED',
      file: filePath,
      message: 'Chave de API de IA (OpenAI / Anthropic) detectada em texto claro.',
    });
  }

  // Check 3: AWS Access Keys
  if (/(?:AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}/.test(content)) {
    violations.push({
      rule: 'AWS_CREDENTIAL_DETECTED',
      file: filePath,
      message: 'Chave de Acesso AWS detectada no arquivo.',
    });
  }

  // Check 4: Private RSA / SSH Keys
  if (/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/.test(content)) {
    violations.push({
      rule: 'PRIVATE_KEY_DETECTED',
      file: filePath,
      message: 'Chave Privada criptográfica (SSH/RSA) detectada em texto claro.',
    });
  }

  // Check 5: Confidential Security Level unencrypted in markdown
  const frontmatterMatch = content.match(/^---\s*[\r\n]+([\s\S]*?)[\r\n]+---/);
  if (frontmatterMatch && !isEncryptedEnvelope(content)) {
    const rawFm = frontmatterMatch[1];
    if (
      /security_level:\s*(?:0|1|2|"root"|"strategic"|"engineering")/i.test(rawFm) ||
      /level:\s*(?:0|1|2|"root"|"strategic"|"engineering")/i.test(rawFm)
    ) {
      violations.push({
        rule: 'UNENCRYPTED_CONFIDENTIAL_SPEC',
        file: filePath,
        message: 'Especificação confidencial (Level 0, 1 ou 2) está em texto plano sem o envelope criptográfico.',
      });
    }
  }

  return {
    hasSecrets: violations.length > 0,
    violations,
  };
}

/**
 * ============================================================================
 * CRIPTOGRAFIA ASSIMÉTRICA X25519 & SEALED DEK SLOTS (ZERO-API / ZERO-KNOWLEDGE)
 * ============================================================================
 */

export interface UserKeyPair {
  publicKeyPem: string;
  privateKeyPem: string;
  publicKeyBase64: string;
  fingerprint: string;
}

export interface SealedDEKSlot {
  ephemeral_public_key: string; // SPKI PEM
  salt: string; // Base64
  iv: string; // Base64
  auth_tag: string; // Base64
  ciphertext: string; // Base64 ciphertext of DEK
  created_at: string;
}

export interface MergePlaintextResult {
  hasConflicts: boolean;
  mergedContent: string;
  conflictCount: number;
}

/**
 * Gera um novo par de chaves assimétricas Curve25519 / X25519 para o usuário.
 * A chave privada deve ser salva no Keychain nativo (VaultService) e NUNCA ir para o Git.
 * A chave pública é compartilhada no .keymap.json do repositório.
 */
export function generateX25519KeyPair(): UserKeyPair {
  const kp = crypto.generateKeyPairSync('x25519');
  const publicKeyPem = kp.publicKey.export({ type: 'spki', format: 'pem' }) as string;
  const privateKeyPem = kp.privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
  const publicKeyDer = kp.publicKey.export({ type: 'spki', format: 'der' });
  const publicKeyBase64 = publicKeyDer.toString('base64');
  
  // Fingerprint SHA-256 curto (8 bytes hex) para exibição amigável
  const fingerprint = crypto.createHash('sha256').update(publicKeyDer).digest('hex').slice(0, 16);

  return {
    publicKeyPem,
    privateKeyPem,
    publicKeyBase64,
    fingerprint,
  };
}

/**
 * Gera uma chave simétrica aleatória de 256 bits (AES-256) para ser usada como DEK de compartimento.
 */
export function generateDEK(): Buffer {
  return crypto.randomBytes(32);
}

/**
 * Cifra uma DEK (Data Encryption Key) para a chave pública de um destinatário (ECIES sobre X25519).
 * Gera um par efêmero, calcula o segredo compartilhado (ECDH), deriva uma KEK via HKDF e cifra com AES-256-GCM.
 */
export function sealDEKForPublicKey(dek: Buffer | string, recipientPublicKeyPem: string): SealedDEKSlot {
  const dekBuffer = Buffer.isBuffer(dek) ? dek : Buffer.from(dek, 'base64');
  
  // 1. Gera par efêmero
  const ephemeral = crypto.generateKeyPairSync('x25519');
  const recipientKey = crypto.createPublicKey(recipientPublicKeyPem);

  // 2. ECDH entre efêmero e destinatário
  const sharedSecret = crypto.diffieHellman({
    privateKey: ephemeral.privateKey,
    publicKey: recipientKey,
  });

  // 3. HKDF para derivar KEK (Key Encryption Key)
  const salt = crypto.randomBytes(16);
  const kek = Buffer.from(
    crypto.hkdfSync('sha256', sharedSecret, salt, Buffer.from('context-os-vault-kek-v1'), 32)
  );

  // 4. Cifra a DEK com AES-256-GCM
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', kek, iv);
  const ciphertext = Buffer.concat([cipher.update(dekBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ephemeral_public_key: ephemeral.publicKey.export({ type: 'spki', format: 'pem' }) as string,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    auth_tag: authTag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    created_at: new Date().toISOString(),
  };
}

/**
 * Descriptografa uma DEK selada utilizando a chave privada X25519 do destinatário.
 */
export function openDEKWithPrivateKey(slot: SealedDEKSlot, recipientPrivateKeyPem: string): Buffer {
  const recipientPrivateKey = crypto.createPrivateKey(recipientPrivateKeyPem);
  const ephemeralKey = crypto.createPublicKey(slot.ephemeral_public_key);

  // 1. ECDH para reconstituir o segredo compartilhado
  const sharedSecret = crypto.diffieHellman({
    privateKey: recipientPrivateKey,
    publicKey: ephemeralKey,
  });

  // 2. HKDF com o mesmo salt para reconstituir a KEK
  const salt = Buffer.from(slot.salt, 'base64');
  const kek = Buffer.from(
    crypto.hkdfSync('sha256', sharedSecret, salt, Buffer.from('context-os-vault-kek-v1'), 32)
  );

  // 3. Decifra AES-256-GCM
  const iv = Buffer.from(slot.iv, 'base64');
  const authTag = Buffer.from(slot.auth_tag, 'base64');
  const ciphertext = Buffer.from(slot.ciphertext, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', kek, iv);
  decipher.setAuthTag(authTag);
  const dek = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  return dek;
}

/**
 * Criptografa conteúdo de arquivo em texto plano diretamente para o formato de envelope .enc do Context OS.
 */
export function encryptFileToEnc(
  plaintext: string,
  dek: Buffer,
  meta: { level?: number; department?: string; title?: string; key_id?: string } = {}
): string {
  const header: EncryptedEnvelopeHeader = {
    title: meta.title || 'Documento Protegido',
    security_level: meta.level ?? 2,
    security_level_id: String(meta.level ?? 2),
    encrypted: true,
    algorithm: 'AES-256-GCM',
    key_id: meta.key_id || (meta.department ? `dept-${meta.department}` : `lvl-${meta.level ?? 2}`),
    department: meta.department,
    updated_at: new Date().toISOString(),
  };

  const enc = encryptAES256GCM(plaintext, dek);
  return buildEncryptedEnvelope(header, enc);
}

/**
 * Descriptografa um arquivo .enc utilizando a DEK fornecida.
 */
export function decryptEncFile(
  encContent: string,
  dek: Buffer
): { success: boolean; content?: string; error?: string; header?: EncryptedEnvelopeHeader | null } {
  const parsed = parseEncryptedEnvelope(encContent);
  if (!parsed.isEncrypted || !parsed.payloadData) {
    return { success: false, error: 'Conteúdo não é um envelope criptográfico válido do Context OS.' };
  }

  try {
    const text = decryptAES256GCM(
      parsed.payloadData.payload,
      parsed.payloadData.iv,
      parsed.payloadData.authTag,
      dek
    );
    return { success: true, content: text, header: parsed.header };
  } catch (err: any) {
    return { success: false, error: 'Falha na autenticação/chave da descriptografia: ' + (err?.message || err) };
  }
}

/**
 * Executa um Merge de 3 Vias no texto plano (Base Ancestral vs Nossa Versão Local vs Versão Remota do Git).
 * Utiliza o algoritmo nativo `git merge-file` para garantir fusão perfeita linha a linha.
 * Se houver conflitos reais de linha, embute os marcadores legíveis em texto plano.
 */
export function mergePlaintext3Way(
  baseText: string,
  oursText: string,
  theirsText: string,
  labels: { ours?: string; base?: string; theirs?: string } = {}
): MergePlaintextResult {
  const tmpDir = os.tmpdir();
  const rand = crypto.randomBytes(6).toString('hex');
  const fBase = path.join(tmpDir, `ctx_base_${rand}.tmp`);
  const fOurs = path.join(tmpDir, `ctx_ours_${rand}.tmp`);
  const fTheirs = path.join(tmpDir, `ctx_theirs_${rand}.tmp`);

  const lblOurs = labels.ours || 'Sua Versão (Local)';
  const lblBase = labels.base || 'Versão Original (Base)';
  const lblTheirs = labels.theirs || 'Versão Remota (Git)';

  try {
    fs.writeFileSync(fBase, baseText, 'utf-8');
    fs.writeFileSync(fOurs, oursText, 'utf-8');
    fs.writeFileSync(fTheirs, theirsText, 'utf-8');

    // Executa git merge-file
    try {
      const mergedStdout = execSync(
        `git merge-file -p -L "${lblOurs}" -L "${lblBase}" -L "${lblTheirs}" "${fOurs}" "${fBase}" "${fTheirs}"`,
        { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
      );
      return {
        hasConflicts: false,
        mergedContent: mergedStdout,
        conflictCount: 0,
      };
    } catch (mergeErr: any) {
      // Se houver conflito, o git merge-file sai com código > 0 e o stdout contém os marcadores!
      const outputWithMarkers = mergeErr.stdout ? String(mergeErr.stdout) : '';
      const conflictMarkers = (outputWithMarkers.match(new RegExp(`<<<<<<< ${lblOurs}`, 'g')) || []).length;

      return {
        hasConflicts: true,
        mergedContent: outputWithMarkers,
        conflictCount: conflictMarkers || 1,
      };
    }
  } catch (err: any) {
    // Fallback se não conseguir rodar git merge-file: retorna a versão local e sinaliza
    return {
      hasConflicts: true,
      mergedContent: oursText,
      conflictCount: 1,
    };
  } finally {
    try { if (fs.existsSync(fBase)) fs.unlinkSync(fBase); } catch {}
    try { if (fs.existsSync(fOurs)) fs.unlinkSync(fOurs); } catch {}
    try { if (fs.existsSync(fTheirs)) fs.unlinkSync(fTheirs); } catch {}
  }
}

