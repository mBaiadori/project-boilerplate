import fs from 'node:fs';
import path from 'node:path';
import { resolveRepoDir } from '../../config/constants.js';
import { loadConfig } from '../../config/storage.js';
import { executeGit } from '../../utils/git.js';
import { assertBranchName } from '../../utils/git-validate.js';

export class PRWorktreeService {
  private getRepoDir(repoName?: string): string {
    const cfg = loadConfig();
    const activeRepoName = repoName || cfg.active_repo?.name || 'local';
    const effectiveOwner = cfg.active_repo?.name === activeRepoName ? cfg.active_repo?.owner : undefined;
    return resolveRepoDir(activeRepoName, effectiveOwner);
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
    const branch = assertBranchName(pr.branch, `Branch do PR #${pr.id}`);

    // Try to fetch latest branch from origin remote if available
    const cfg = loadConfig();
    if (cfg.authenticated && cfg.token && cfg.active_repo?.full_name && !cfg.active_repo?.is_local) {
      try {
        await executeGit(['fetch', 'origin', `${branch}:refs/remotes/origin/${branch}`], repoDir);
      } catch {}
    }

    const wtDir = this.getWorktreeDir(repoName, pr.id);
    const wtParent = path.dirname(wtDir);
    fs.mkdirSync(wtParent, { recursive: true });

    if (!fs.existsSync(wtDir)) {
      // First ensure the branch exists locally or create from remote
      const branchCheck = await executeGit(['rev-parse', '--verify', branch], repoDir);
      if (!branchCheck.success) {
        // Try creating local branch tracking origin
        await executeGit(['branch', branch, `origin/${branch}`], repoDir).catch(() => {});
      }

      const addRes = await executeGit(
        ['worktree', 'add', '--force', wtDir, branch],
        repoDir
      );
      if (!addRes.success && !fs.existsSync(wtDir)) {
        throw new Error(`Falha ao inicializar worktree para PR #${pr.id} na branch '${branch}': ${addRes.stderr}`);
      }
    } else {
      // If worktree directory exists, checkout the branch and fast-forward if remote exists
      await executeGit(['-C', wtDir, 'checkout', branch], repoDir).catch(() => {});
      await executeGit(['-C', wtDir, 'merge', '--ff-only', `origin/${branch}`], repoDir).catch(() => {});
    }

    return wtDir;
  }

  async removePRWorktree(repoName: string, prId: number | string): Promise<void> {
    const repoDir = this.getRepoDir(repoName);
    const wtDir = this.getWorktreeDir(repoName, prId);
    if (fs.existsSync(wtDir)) {
      try {
        await executeGit(['worktree', 'remove', '--force', wtDir], repoDir);
      } catch {
        try {
          fs.rmSync(wtDir, { recursive: true, force: true });
        } catch {}
      }
    }
    await executeGit(['worktree', 'prune'], repoDir).catch(() => {});
  }

  async writePlainAtWorktree(
    wtDir: string,
    relPlainPath: string,
    content: string
  ): Promise<{ relPlainPath: string }> {
    const cleanPath = relPlainPath.replace(/\\/g, '/').replace(/^\/+/, '');
    const fullPath = path.join(wtDir, cleanPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');
    return { relPlainPath: cleanPath };
  }

  async commitAndPushWorktree(
    wtDir: string,
    branchName: string,
    commitMsg: string,
    authorLogin: string,
    repoName: string
  ): Promise<{ commitHash: string }> {
    const repoDir = this.getRepoDir(repoName);
    const branch = assertBranchName(branchName);
    const cleanAuthor = authorLogin.startsWith('@') ? authorLogin.slice(1) : authorLogin;
    const authorParam = `${cleanAuthor} <${cleanAuthor}@context-os.local>`;

    await executeGit(['-C', wtDir, 'add', '-A'], repoDir);
    const commitRes = await executeGit(
      ['-C', wtDir, 'commit', '-m', commitMsg, `--author=${authorParam}`],
      repoDir
    );

    if (!commitRes.success && !commitRes.stderr.includes('nothing to commit')) {
      throw new Error(`Falha ao registrar commit no PR: ${commitRes.stderr || commitRes.stdout}`);
    }

    const hashRes = await executeGit(['-C', wtDir, 'rev-parse', 'HEAD'], repoDir);
    const commitHash = (hashRes.stdout || '').trim();

    // Push to origin if authenticated remote
    const cfg = loadConfig();
    if (cfg.authenticated && cfg.token && cfg.active_repo?.full_name && !cfg.active_repo?.is_local) {
      try {
        await executeGit(['-C', wtDir, 'push', 'origin', branch], repoDir);
      } catch (pushErr) {
        console.warn(`[PRWorktree] Aviso ao sincronizar branch '${branch}' com o GitHub remoto:`, pushErr);
      }
    }

    return { commitHash };
  }
}

export const prWorktreeService = new PRWorktreeService();
