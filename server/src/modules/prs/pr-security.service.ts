import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { PROJECTS_DIR } from '../../config/constants.js';
import { loadConfig } from '../../config/storage.js';
import { executeGitCommand } from '../../utils/git.js';
import {
  canAccessDocument,
  parseEncryptedEnvelope,
  decryptEncFile,
  type EncryptedEnvelopeHeader,
} from '../../utils/crypto.js';
import { vaultEngineService } from '../vault/vault-engine.service.js';

export interface DocClearanceResult {
  allowed: boolean;
  restricted: boolean;
  isEncrypted: boolean;
  level?: number;
  department?: string;
  header?: EncryptedEnvelopeHeader | null;
}

export class PRSecurityService {
  private getRepoDir(repoName?: string): string {
    const cfg = loadConfig();
    const activeRepoName = repoName || cfg.active_repo?.name || 'local';
    return path.join(PROJECTS_DIR, activeRepoName);
  }

  maskPath(filePath: string): string {
    if (!filePath) return 'documento-restrito';
    const ext = path.extname(filePath);
    const hash = crypto.createHash('sha256').update(filePath).digest('hex').slice(0, 8);
    const parts = filePath.split('/');
    const dir = parts.length > 1 ? `${parts[0]}/` : '';
    return `${dir}restrito-${hash}${ext || '.md'}`;
  }

  async resolveDocClearance(
    repoName: string,
    userLogin: string | undefined,
    relPlainPath: string,
    branchOrCommitRef?: string
  ): Promise<DocClearanceResult> {
    const cfg = loadConfig();
    const login = userLogin || cfg.user?.login || 'marcosbaiadori';
    const repoDir = this.getRepoDir(repoName);
    const cleanPath = relPlainPath.replace(/\\/g, '/').replace(/^\/+/, '');

    const keymap = vaultEngineService.getKeymap(repoName);
    const userProfile = keymap.members[login] || {
      login,
      level: 0,
      departments: ['*'],
      status: 'active',
    };

    // Public root files are always allowed
    if (
      cleanPath === 'README.md' ||
      cleanPath === 'CHANGELOG.md' ||
      cleanPath.startsWith('docs/public/')
    ) {
      return { allowed: true, restricted: false, isEncrypted: false };
    }

    const encRelPath = `${cleanPath}.enc`;

    // Try reading encrypted envelope from ref or disk
    let rawEncContent = '';
    if (branchOrCommitRef) {
      const showRes = await executeGitCommand(
        `git show "${branchOrCommitRef}:${encRelPath}"`,
        repoDir
      );
      if (showRes.success && showRes.stdout) {
        rawEncContent = showRes.stdout;
      } else {
        // Check if plain exists at ref
        const plainShow = await executeGitCommand(
          `git show "${branchOrCommitRef}:${cleanPath}"`,
          repoDir
        );
        if (plainShow.success && plainShow.stdout) {
          return { allowed: true, restricted: false, isEncrypted: false };
        }
      }
    } else {
      const fullEncPath = path.join(repoDir, encRelPath);
      if (fs.existsSync(fullEncPath)) {
        rawEncContent = fs.readFileSync(fullEncPath, 'utf-8');
      } else if (fs.existsSync(path.join(repoDir, cleanPath))) {
        return { allowed: true, restricted: false, isEncrypted: false };
      }
    }

    if (!rawEncContent) {
      // If neither enc nor plain found at ref, check department by folder path
      const folderParts = cleanPath.split('/');
      const department = folderParts.length > 1 ? folderParts[0] : 'default';
      const allowed = canAccessDocument(userProfile, {
        department,
        path: cleanPath,
      });
      return {
        allowed,
        restricted: !allowed,
        isEncrypted: true,
        department,
      };
    }

    const parsed = parseEncryptedEnvelope(rawEncContent);
    if (!parsed.isEncrypted || !parsed.header) {
      return { allowed: true, restricted: false, isEncrypted: false };
    }

    const docMeta = {
      security_level: parsed.header.security_level,
      level: parsed.header.security_level,
      department: parsed.header.department,
      path: cleanPath,
    };

    const hasClearance = canAccessDocument(userProfile, docMeta);
    if (!hasClearance) {
      return {
        allowed: false,
        restricted: true,
        isEncrypted: true,
        level: parsed.header.security_level,
        department: parsed.header.department,
        header: parsed.header,
      };
    }

    // Check if user DEK is available
    const unlockedDEKs = vaultEngineService.getUnlockedDEKs(repoName, login);
    const compartmentKey = parsed.header.department || `lvl-${parsed.header.security_level}`;
    const dek = unlockedDEKs[compartmentKey] || unlockedDEKs['default'] || unlockedDEKs[String(parsed.header.security_level)];

    return {
      allowed: !!dek,
      restricted: !dek,
      isEncrypted: true,
      level: parsed.header.security_level,
      department: parsed.header.department,
      header: parsed.header,
    };
  }

  async readPlainAtRef(
    repoName: string,
    ref: string,
    relPlainPath: string,
    userLogin?: string
  ): Promise<string> {
    if (!ref) return '';
    const cfg = loadConfig();
    const login = userLogin || cfg.user?.login || 'marcosbaiadori';
    const repoDir = this.getRepoDir(repoName);
    const cleanPath = relPlainPath.replace(/\\/g, '/').replace(/^\/+/, '');
    const encPath = `${cleanPath}.enc`;

    // 1. Try reading .enc at ref
    const encRes = await executeGitCommand(`git show "${ref}:${encPath}"`, repoDir);
    if (encRes.success && encRes.stdout) {
      const parsed = parseEncryptedEnvelope(encRes.stdout);
      if (parsed.isEncrypted && parsed.header) {
        const unlockedDEKs = vaultEngineService.getUnlockedDEKs(repoName, login);
        const compartmentKey = parsed.header.department || `lvl-${parsed.header.security_level}`;
        const dek = unlockedDEKs[compartmentKey] || unlockedDEKs['default'] || unlockedDEKs[String(parsed.header.security_level)];
        if (!dek) {
          throw new Error(`Acesso negado: Chave DEK para o compartimento '${compartmentKey}' não disponível.`);
        }
        const dec = decryptEncFile(encRes.stdout, dek);
        if (!dec.success || dec.content === undefined) {
          throw new Error(`Erro ao descriptografar arquivo '${cleanPath}': ${dec.error}`);
        }
        return dec.content;
      }
    }

    // 2. Try reading plaintext at ref
    const plainRes = await executeGitCommand(`git show "${ref}:${cleanPath}"`, repoDir);
    if (plainRes.success && plainRes.stdout !== undefined) {
      return plainRes.stdout;
    }

    return '';
  }
}

export const prSecurityService = new PRSecurityService();
