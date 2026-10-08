import path from 'node:path';
import { PROJECTS_DIR, resolveRepoDir } from '../../config/constants.js';
import { loadConfig } from '../../config/storage.js';
import { executeGitCommand } from '../../utils/git.js';
import { mergePlaintext3Way } from '../../utils/crypto.js';
import { prSecurityService } from './pr-security.service.js';
import { prWorktreeService } from './pr-worktree.service.js';

export interface MergeabilityResult {
  mergeable: boolean;
  behind_by: number;
  ahead_by: number;
  conflicts: Array<{ path: string; is_encrypted: boolean }>;
}

export class PRConflictsService {
  private getRepoDir(repoName?: string): string {
    const cfg = loadConfig();
    const activeRepoName = repoName || cfg.active_repo?.name || 'local';
    const effectiveOwner = cfg.active_repo?.name === activeRepoName ? cfg.active_repo?.owner : undefined;
    return resolveRepoDir(activeRepoName, effectiveOwner);
  }

  async getMergeability(
    repoName: string,
    pr: { id: number | string; branch: string; target_branch?: string }
  ): Promise<MergeabilityResult> {
    const repoDir = this.getRepoDir(repoName);
    const branch = pr.branch;
    const targetBranch = pr.target_branch || 'main';

    if (!branch) {
      return { mergeable: true, behind_by: 0, ahead_by: 0, conflicts: [] };
    }

    // Check commits behind / ahead
    let behind_by = 0;
    let ahead_by = 0;
    const countBehind = await executeGitCommand(
      `git rev-list --count "${branch}..${targetBranch}"`,
      repoDir
    );
    if (countBehind.success && countBehind.stdout) {
      behind_by = parseInt(countBehind.stdout.trim(), 10) || 0;
    }

    const countAhead = await executeGitCommand(
      `git rev-list --count "${targetBranch}..${branch}"`,
      repoDir
    );
    if (countAhead.success && countAhead.stdout) {
      ahead_by = parseInt(countAhead.stdout.trim(), 10) || 0;
    }

    // Run merge-tree to test if clean merge is possible
    const conflicts: Array<{ path: string; is_encrypted: boolean }> = [];
    const mergeTreeRes = await executeGitCommand(
      `git merge-tree --write-tree --name-only "${targetBranch}" "${branch}"`,
      repoDir
    );

    if (!mergeTreeRes.success || mergeTreeRes.stderr.includes('CONFLICT') || mergeTreeRes.stdout.includes('CONFLICT')) {
      const output = `${mergeTreeRes.stdout}\n${mergeTreeRes.stderr}`;
      const conflictLines = output
        .split('\n')
        .filter((l) => l.includes('CONFLICT') || l.startsWith('Auto-merging') || l.includes('file'))
        .map((l) => {
          const match = l.match(/in (.*)$/) || l.match(/Auto-merging (.*)$/);
          return match ? match[1].trim() : null;
        })
        .filter(Boolean) as string[];

      const uniqueConflictPaths = Array.from(new Set(conflictLines));
      for (const p of uniqueConflictPaths) {
        conflicts.push({
          path: p,
          is_encrypted: false,
        });
      }
    }

    return {
      mergeable: conflicts.length === 0,
      behind_by,
      ahead_by,
      conflicts,
    };
  }

  async getConflictBundle(
    repoName: string,
    pr: { id: number | string; branch: string; target_branch?: string },
    filePath: string,
    userLogin?: string
  ) {
    const cfg = loadConfig();
    const login = userLogin || cfg.user?.login || 'marcosbaiadori';
    const repoDir = this.getRepoDir(repoName);
    const branch = pr.branch;
    const targetBranch = pr.target_branch || 'main';

    // Verify clearance
    const clearance = await prSecurityService.resolveDocClearance(repoName, login, filePath, branch);
    if (!clearance.allowed) {
      throw new Error(`Acesso negado: Você não possui autorização (clearance) para visualizar o documento restrito '${filePath}'.`);
    }

    // Find common merge-base ancestor
    const baseRes = await executeGitCommand(
      `git merge-base "${targetBranch}" "${branch}"`,
      repoDir
    );
    const mergeBaseHash = baseRes.success ? (baseRes.stdout || '').trim() : targetBranch;

    const baseText = await prSecurityService.readPlainAtRef(repoName, mergeBaseHash, filePath, login);
    const oursText = await prSecurityService.readPlainAtRef(repoName, branch, filePath, login);
    const theirsText = await prSecurityService.readPlainAtRef(repoName, targetBranch, filePath, login);

    const mergeResult = mergePlaintext3Way(baseText, oursText, theirsText, {
      ours: `Esta Proposta (${pr.branch})`,
      base: `Versão Base (${mergeBaseHash.slice(0, 7)})`,
      theirs: `Versão Oficial (${targetBranch})`,
    });

    return {
      filePath,
      base: baseText,
      ours: oursText,
      theirs: theirsText,
      merged: mergeResult.mergedContent,
      hasConflicts: mergeResult.hasConflicts,
      conflictCount: mergeResult.conflictCount,
    };
  }

  async resolveConflict(
    repoName: string,
    pr: { id: number | string; branch: string; target_branch?: string },
    filePath: string,
    resolvedContent: string,
    userLogin?: string
  ): Promise<{ commitHash: string }> {
    const cfg = loadConfig();
    const login = userLogin || cfg.user?.login || 'marcosbaiadori';

    // Verify clearance
    const clearance = await prSecurityService.resolveDocClearance(repoName, login, filePath, pr.branch);
    if (!clearance.allowed) {
      throw new Error(`Acesso negado para resolver conflito no documento restrito '${filePath}'.`);
    }

    const wtDir = await prWorktreeService.ensurePRWorktree(repoName, pr);

    // Write resolved plaintext directly
    await prWorktreeService.writePlainAtWorktree(wtDir, filePath, resolvedContent);

    const commitMsg = `fix(conflict): resolução de conflito em ${filePath} por ${login}`;
    const { commitHash } = await prWorktreeService.commitAndPushWorktree(
      wtDir,
      pr.branch,
      commitMsg,
      login,
      repoName
    );

    return { commitHash };
  }

  async updateFromBase(
    repoName: string,
    pr: { id: number | string; branch: string; target_branch?: string },
    userLogin?: string
  ): Promise<{ success: boolean; message: string; newCommitHash?: string }> {
    const cfg = loadConfig();
    const login = userLogin || cfg.user?.login || 'marcosbaiadori';
    const repoDir = this.getRepoDir(repoName);
    const targetBranch = pr.target_branch || 'main';

    const wtDir = await prWorktreeService.ensurePRWorktree(repoName, pr);

    // Fetch target branch
    if (cfg.authenticated && cfg.token && cfg.active_repo?.full_name && !cfg.active_repo?.is_local) {
      await executeGitCommand(`git fetch origin "${targetBranch}:refs/remotes/origin/${targetBranch}"`, repoDir).catch(() => {});
    }

    const mergeRes = await executeGitCommand(
      `git -C "${wtDir}" merge "${targetBranch}" -m "chore(sync): atualizar branch do PR #${pr.id} com a versão oficial (${targetBranch})"`,
      repoDir
    );

    if (!mergeRes.success && (mergeRes.stderr.includes('CONFLICT') || mergeRes.stdout.includes('CONFLICT'))) {
      // Abort merge in worktree
      await executeGitCommand(`git -C "${wtDir}" merge --abort`, repoDir).catch(() => {});
      throw new Error(`Existem conflitos entre a branch do PR e a branch '${targetBranch}'. Utilize a resolução de conflitos.`);
    }

    const hashRes = await executeGitCommand(`git -C "${wtDir}" rev-parse HEAD`, repoDir);
    const newCommitHash = (hashRes.stdout || '').trim();

    // Push updated branch
    if (cfg.authenticated && cfg.token && cfg.active_repo?.full_name && !cfg.active_repo?.is_local) {
      await executeGitCommand(`git -C "${wtDir}" push origin "${pr.branch}"`, repoDir).catch(() => {});
    }

    return {
      success: true,
      message: `Branch do PR #${pr.id} sincronizada com sucesso a partir de '${targetBranch}'.`,
      newCommitHash,
    };
  }
}

export const prConflictsService = new PRConflictsService();
