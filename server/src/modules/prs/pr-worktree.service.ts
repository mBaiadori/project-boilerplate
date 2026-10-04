import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { PROJECTS_DIR } from '../../config/constants.js';
import { loadConfig } from '../../config/storage.js';
import { executeGitCommand } from '../../utils/git.js';
import { encryptFileToEnc } from '../../utils/crypto.js';
import { vaultEngineService } from '../vault/vault-engine.service.js';

export class PRWorktreeService {
  private getRepoDir(repoName?: string): string {
    const cfg = loadConfig();
    const activeRepoName = repoName || cfg.active_repo?.name || 'local';
    return path.join(PROJECTS_DIR, activeRepoName);
  }

  getWorktreeDir(repoName: string, prId: number | string): string {
    const repoDir = this.getRepoDir(repoName);
    return path.join(repoDir, '.git', 'context-pr-worktrees', String(prId));
  }

  async ensurePRWorktree(
    repoName: string,
    pr: { id: number | string; branch: string }
  ): Promise<string> {
    const repoDir = this.getRepoDir(repoName);
    const branch = pr.branch;
    if (!branch) {
      throw new Error(`PR #${pr.id} não possui uma branch associada.`);
    }

    // Try to fetch latest branch from origin remote if available
    const cfg = loadConfig();
    if (cfg.authenticated && cfg.token && cfg.active_repo?.full_name && !cfg.active_repo?.is_local) {
      try {
        await executeGitCommand(`git fetch origin "${branch}:refs/remotes/origin/${branch}"`, repoDir);
      } catch {}
    }

    const wtDir = this.getWorktreeDir(repoName, pr.id);
    const wtParent = path.dirname(wtDir);
    fs.mkdirSync(wtParent, { recursive: true });

    if (!fs.existsSync(wtDir)) {
      // First ensure the branch exists locally or create from remote
      const branchCheck = await executeGitCommand(`git rev-parse --verify "${branch}"`, repoDir);
      if (!branchCheck.success) {
        // Try creating local branch tracking origin
        await executeGitCommand(`git branch "${branch}" "origin/${branch}"`, repoDir).catch(() => {});
      }

      const addRes = await executeGitCommand(
        `git worktree add --force "${wtDir}" "${branch}"`,
        repoDir
      );
      if (!addRes.success && !fs.existsSync(wtDir)) {
        throw new Error(`Falha ao inicializar worktree para PR #${pr.id} na branch '${branch}': ${addRes.stderr}`);
      }
    } else {
      // If worktree directory exists, checkout the branch and fast-forward if remote exists
      await executeGitCommand(`git -C "${wtDir}" checkout "${branch}"`, repoDir).catch(() => {});
      await executeGitCommand(`git -C "${wtDir}" merge --ff-only "origin/${branch}"`, repoDir).catch(() => {});
    }

    return wtDir;
  }

  async removePRWorktree(repoName: string, prId: number | string): Promise<void> {
    const repoDir = this.getRepoDir(repoName);
    const wtDir = this.getWorktreeDir(repoName, prId);
    if (fs.existsSync(wtDir)) {
      try {
        await executeGitCommand(`git worktree remove --force "${wtDir}"`, repoDir);
      } catch {
        try {
          fs.rmSync(wtDir, { recursive: true, force: true });
        } catch {}
      }
    }
    await executeGitCommand(`git worktree prune`, repoDir).catch(() => {});
  }

  async writeEncryptedAtWorktree(
    wtDir: string,
    relPlainPath: string,
    content: string,
    login: string,
    repoName: string
  ): Promise<{ relEncPath: string; isEncrypted: boolean }> {
    const cleanPath = relPlainPath.replace(/\\/g, '/').replace(/^\/+/, '');

    // Public root documents are kept as plaintext
    if (
      cleanPath === 'README.md' ||
      cleanPath === 'CHANGELOG.md' ||
      cleanPath.startsWith('docs/public/')
    ) {
      const fullPath = path.join(wtDir, cleanPath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content, 'utf-8');
      return { relEncPath: cleanPath, isEncrypted: false };
    }

    // Determine compartment / department
    const folderParts = cleanPath.split('/');
    const department = folderParts.length > 1 ? folderParts[0] : 'default';
    const level = department === 'executive' ? 0 : department === 'finance' || department === 'legal' ? 1 : 2;

    let unlockedDEKs = vaultEngineService.getUnlockedDEKs(repoName, login);
    let dek = unlockedDEKs[department] || unlockedDEKs['default'];
    if (!dek) {
      dek = crypto.randomBytes(32);
      vaultEngineService.setCompartmentDEK(repoName, department, dek, [login]);
      unlockedDEKs = vaultEngineService.getUnlockedDEKs(repoName, login);
    }

    // Encrypt directly to .enc envelope
    const encContent = encryptFileToEnc(content, dek, {
      department,
      title: path.basename(cleanPath, '.md'),
    });

    const relEncPath = `${cleanPath}.enc`;
    const fullEncPath = path.join(wtDir, relEncPath);
    fs.mkdirSync(path.dirname(fullEncPath), { recursive: true });
    fs.writeFileSync(fullEncPath, encContent, 'utf-8');

    // Remove plain file if present in worktree to avoid accidental commit
    const fullPlainPath = path.join(wtDir, cleanPath);
    if (fs.existsSync(fullPlainPath)) {
      try {
        fs.unlinkSync(fullPlainPath);
      } catch {}
    }

    return { relEncPath, isEncrypted: true };
  }

  async commitAndPushWorktree(
    wtDir: string,
    branch: string,
    commitMsg: string,
    authorLogin: string,
    repoName: string
  ): Promise<{ commitHash: string }> {
    const repoDir = this.getRepoDir(repoName);
    const cleanAuthor = authorLogin.startsWith('@') ? authorLogin.slice(1) : authorLogin;
    const authorParam = `${cleanAuthor} <${cleanAuthor}@context-os.local>`;

    await executeGitCommand(`git -C "${wtDir}" add -A`, repoDir);
    const commitRes = await executeGitCommand(
      `git -C "${wtDir}" commit -m "${commitMsg.replace(/"/g, '\\"')}" --author="${authorParam}"`,
      repoDir
    );

    if (!commitRes.success && !commitRes.stderr.includes('nothing to commit')) {
      throw new Error(`Falha ao registrar commit no PR: ${commitRes.stderr || commitRes.stdout}`);
    }

    const hashRes = await executeGitCommand(`git -C "${wtDir}" rev-parse HEAD`, repoDir);
    const commitHash = (hashRes.stdout || '').trim();

    // Push to origin if authenticated remote
    const cfg = loadConfig();
    if (cfg.authenticated && cfg.token && cfg.active_repo?.full_name && !cfg.active_repo?.is_local) {
      try {
        await executeGitCommand(`git -C "${wtDir}" push origin "${branch}"`, repoDir);
      } catch (pushErr) {
        console.warn(`[PRWorktree] Aviso ao sincronizar branch '${branch}' com o GitHub remoto:`, pushErr);
      }
    }

    return { commitHash };
  }
}

export const prWorktreeService = new PRWorktreeService();
