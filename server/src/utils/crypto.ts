import crypto from 'node:crypto';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import type { SecretScanResult, SecretScanViolation } from '../modules/governance/governance.types.js';

export interface MergePlaintextResult {
  hasConflicts: boolean;
  mergedContent: string;
  conflictCount: number;
}

/**
 * Checks multidimensional access clearance for a collaborator against a document's security metadata.
 * Evaluates:
 * 1. Root / Wildcard bypass (user.departments includes '*' or user.allowed_paths includes '*')
 * 2. Public clearance (doc.department is 'public' | 'general' | empty)
 * 3. Horizontal Compartment / Department clearance (user.departments includes doc.department)
 * 4. Path/Route check (if user has allowed_paths configured and doc has a path)
 */
export function canAccessDocument(
  user: {
    departments?: string[];
    allowed_paths?: string[];
    denied_paths?: string[];
    isOwner?: boolean;
    role?: string;
  },
  doc: { department?: string; path?: string }
): boolean {
  // 1. Root or owner bypass
  if (user.isOwner || user.role === 'owner') {
    return true;
  }

  // 2. Denied Paths check: Explicit deny ALWAYS overrides allow & wildcards
  if (Array.isArray(user.denied_paths) && user.denied_paths.length > 0 && doc.path) {
    const cleanDocPath = doc.path.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
    const isExplicitlyDenied = user.denied_paths.some((pattern) => {
      if (!pattern) return false;
      const cleanPattern = pattern
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .replace(/\/\*+$/, '')
        .toLowerCase();
      return cleanDocPath === cleanPattern || cleanDocPath.startsWith(cleanPattern + '/');
    });
    if (isExplicitlyDenied) {
      return false;
    }
  }

  // 3. Wildcard bypass in departments or allowed_paths
  if (
    (Array.isArray(user.departments) && user.departments.includes('*')) ||
    (Array.isArray(user.allowed_paths) && user.allowed_paths.includes('*'))
  ) {
    return true;
  }

  // 4. Compartment / Department check
  if (doc.department && doc.department !== 'general' && doc.department !== 'public') {
    if (!Array.isArray(user.departments) || !user.departments.includes(doc.department)) {
      return false;
    }
  }

  // 5. Path/Route check: if user has allowed_paths configured and doc has a path
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

  return true;
}

/**
 * Secret Scanner for Pre-Commit and Pre-PR checks (detects API keys, private keys, AWS tokens, etc.).
 */
export function scanContentForSecrets(content: string, filePath: string): SecretScanResult {
  const violations: SecretScanViolation[] = [];

  if (!content || typeof content !== 'string') {
    return { hasSecrets: false, violations };
  }

  // Ignore internal system memory, caches and git metadata
  const cleanPath = (filePath || '').replace(/\\/g, '/');
  if (
    cleanPath.includes('.spec-memory') ||
    cleanPath.includes('.git') ||
    cleanPath.endsWith('.json') ||
    cleanPath.includes('.keymap') ||
    cleanPath.includes('node_modules')
  ) {
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

  return {
    hasSecrets: violations.length > 0,
    violations,
  };
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
