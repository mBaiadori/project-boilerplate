import fs from 'node:fs';
import path from 'node:path';
import { PROJECTS_DIR } from '../../config/constants.js';
import { loadConfig, clearWorkspaceChanges } from '../../config/storage.js';
import { workspaceService } from '../workspace/workspace.service.js';
import {
  ensureGitRepo,
  getGitStatus,
  getGitLog,
  getGitBranches,
  commitChanges,
  createAndCheckoutBranch,
  syncGit,
  getGitBlame,
  getGitDiff,
  getFileGitLog,
  getFileContentAtCommit,
  getFileBlameDetails,
  executeGitCommand,
  getWhatsNewSummary,
  getWhatsNewFileDiff,
} from '../../utils/git.js';

export class GitService {
  private getRepoDir(repoName?: string): string {
    const cfg = loadConfig();
    const activeRepoName = repoName || cfg.active_repo?.name || 'local';
    return path.join(PROJECTS_DIR, activeRepoName);
  }

  async ensureActiveRepoGit(repoNameParam?: string) {
    const cfg = loadConfig();
    const repoName = repoNameParam || cfg.active_repo?.name || 'local';
    const repoDir = this.getRepoDir(repoName);
    const repoObj = cfg.repos?.find((r: any) => r.name === repoName) || (cfg.active_repo?.name === repoName ? cfg.active_repo : undefined);
    const isLocal = Boolean(repoObj?.is_local) || repoName === 'local' || repoName === 'default' || repoName === '_default';
    let remoteUrl = isLocal ? undefined : repoObj?.html_url;
    if (!remoteUrl && !isLocal && cfg.token && (repoObj?.owner?.login || cfg.user?.login)) {
      const owner = repoObj?.owner?.login || cfg.user?.login;
      remoteUrl = `https://github.com/${owner}/${repoName}.git`;
    }
    const token = isLocal ? undefined : cfg.token;
    const res = await ensureGitRepo(repoDir, cfg.user, remoteUrl, token, repoName, !isLocal);
    return res;
  }

  async getStatus(repoNameParam?: string) {
    const cfg = loadConfig();
    const repoName = repoNameParam || cfg.active_repo?.name || 'local';
    await this.ensureActiveRepoGit(repoName);
    const repoDir = this.getRepoDir(repoName);
    const status = await getGitStatus(repoDir);
    const repoObj = cfg.repos?.find((r: any) => r.name === repoName) || (cfg.active_repo?.name === repoName ? cfg.active_repo : { name: repoName, full_name: repoName, is_local: true });

    return {
      repo_name: repoName,
      active_repo: repoObj,
      ...status,
    };
  }

  async getDiff(filePath?: string, repoNameParam?: string) {
    const cfg = loadConfig();
    const repoName = repoNameParam || cfg.active_repo?.name || 'local';
    await this.ensureActiveRepoGit(repoName);
    const repoDir = this.getRepoDir(repoName);
    return await getGitDiff(repoDir, filePath);
  }

  async getLog(limit: number = 20, repoNameParam?: string) {
    const cfg = loadConfig();
    const repoName = repoNameParam || cfg.active_repo?.name || 'local';
    await this.ensureActiveRepoGit(repoName);
    const repoDir = this.getRepoDir(repoName);
    const commits = await getGitLog(repoDir, limit);

    return {
      repo_name: repoName,
      commits,
    };
  }

  async getFileHistory(filePath: string, limit: number = 30, repoNameParam?: string) {
    const cfg = loadConfig();
    const repoName = repoNameParam || cfg.active_repo?.name || 'local';
    await this.ensureActiveRepoGit(repoName);
    const repoDir = this.getRepoDir(repoName);
    const commits = await getFileGitLog(repoDir, filePath, limit);

    return {
      repo_name: repoName,
      file_path: filePath,
      commits,
    };
  }

  async getFileVersion(filePath: string, commitHash: string, repoNameParam?: string) {
    const cfg = loadConfig();
    const repoName = repoNameParam || cfg.active_repo?.name || 'local';
    await this.ensureActiveRepoGit(repoName);
    const repoDir = this.getRepoDir(repoName);
    return await getFileContentAtCommit(repoDir, filePath, commitHash);
  }

  async getBranches(repoNameParam?: string) {
    const cfg = loadConfig();
    const repoName = repoNameParam || cfg.active_repo?.name || 'local';
    await this.ensureActiveRepoGit(repoName);
    const repoDir = this.getRepoDir(repoName);
    return await getGitBranches(repoDir);
  }

  async switchOrCreateBranch(branchName: string, repoNameParam?: string) {
    const cfg = loadConfig();
    const repoName = repoNameParam || cfg.active_repo?.name || 'local';
    await this.ensureActiveRepoGit(repoName);
    const repoDir = this.getRepoDir(repoName);
    const res = await createAndCheckoutBranch(repoDir, branchName);
    workspaceService.invalidateTreeCache(repoName);
    return res;
  }

  async commit(message: string, files?: string[], _userLogin?: string, repo?: string) {
    const cfg = loadConfig();
    const repoName = repo || cfg.active_repo?.name || 'local';
    await this.ensureActiveRepoGit(repoName);
    const repoDir = this.getRepoDir(repoName);

    // Executa commit diretamente com os arquivos em texto plano
    const res = await commitChanges(repoDir, message, files);
    workspaceService.invalidateTreeCache(repoName);
    return res;
  }

  async sync(branch?: string, repoNameParam?: string) {
    const cfg = loadConfig();
    const repoName = repoNameParam || cfg.active_repo?.name || 'local';
    await this.ensureActiveRepoGit(repoName);
    const repoDir = this.getRepoDir(repoName);
    const repoObj = cfg.repos?.find((r: any) => r.name === repoName) || (cfg.active_repo?.name === repoName ? cfg.active_repo : undefined);
    const targetBranch = branch || repoObj?.default_branch || 'main';

    // Executa sync direto (pull + push)
    const result = await syncGit(repoDir, 'origin', targetBranch);
    workspaceService.invalidateTreeCache(repoName);

    // Reconcilia e limpa alterações se o git status estiver limpo
    try {
      const status = await getGitStatus(repoDir);
      if (status.isClean && (!status.files || status.files.length === 0)) {
        clearWorkspaceChanges(repoName);
      }
    } catch {}

    return result;
  }

  async getBlame(filePath: string, repoNameParam?: string) {
    const cfg = loadConfig();
    const repoName = repoNameParam || cfg.active_repo?.name || 'local';
    await this.ensureActiveRepoGit(repoName);
    const repoDir = this.getRepoDir(repoName);
    return await getFileBlameDetails(repoDir, filePath);
  }

  async getWhatsNew(lastSeenHash?: string, repoNameParam?: string) {
    const cfg = loadConfig();
    const repoName = repoNameParam || cfg.active_repo?.name || 'local';
    await this.ensureActiveRepoGit(repoName);
    const repoDir = this.getRepoDir(repoName);
    return await getWhatsNewSummary(repoDir, lastSeenHash);
  }

  async getWhatsNewDiff(filePath: string, lastSeenHash?: string, repoNameParam?: string) {
    const cfg = loadConfig();
    const repoName = repoNameParam || cfg.active_repo?.name || 'local';
    await this.ensureActiveRepoGit(repoName);
    const repoDir = this.getRepoDir(repoName);
    return await getWhatsNewFileDiff(repoDir, filePath, lastSeenHash);
  }

  async getGitVersion() {
    const res = await executeGitCommand('git --version', process.cwd());
    return {
      version: res.stdout || 'Git não encontrado',
      installed: res.success,
    };
  }
}

export const gitService = new GitService();
