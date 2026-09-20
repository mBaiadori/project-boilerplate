import path from 'node:path';
import { PROJECTS_DIR } from '../../config/constants.js';
import { loadConfig } from '../../config/storage.js';
import {
  ensureGitRepo,
  getGitStatus,
  getGitLog,
  getGitBranches,
  commitChanges,
  createAndCheckoutBranch,
  syncGit,
  getGitBlame,
  executeGitCommand,
} from '../../utils/git.js';

export class GitService {
  private getRepoDir(repoName?: string): string {
    const cfg = loadConfig();
    const activeRepoName = repoName || cfg.active_repo?.name || 'local';
    return path.join(PROJECTS_DIR, activeRepoName);
  }

  async ensureActiveRepoGit() {
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || 'local';
    const repoDir = this.getRepoDir(repoName);
    const remoteUrl = cfg.active_repo?.html_url;
    const token = cfg.token;
    return await ensureGitRepo(repoDir, cfg.user, remoteUrl, token);
  }

  async getStatus() {
    await this.ensureActiveRepoGit();
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || 'local';
    const repoDir = this.getRepoDir(repoName);
    const status = await getGitStatus(repoDir);

    return {
      repo_name: repoName,
      active_repo: cfg.active_repo,
      ...status,
    };
  }

  async getLog(limit: number = 20) {
    await this.ensureActiveRepoGit();
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || 'local';
    const repoDir = this.getRepoDir(repoName);
    const commits = await getGitLog(repoDir, limit);

    return {
      repo_name: repoName,
      commits,
    };
  }

  async getBranches() {
    await this.ensureActiveRepoGit();
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || 'local';
    const repoDir = this.getRepoDir(repoName);
    return await getGitBranches(repoDir);
  }

  async switchOrCreateBranch(branchName: string) {
    await this.ensureActiveRepoGit();
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || 'local';
    const repoDir = this.getRepoDir(repoName);
    return await createAndCheckoutBranch(repoDir, branchName);
  }

  async commit(message: string, files?: string[]) {
    await this.ensureActiveRepoGit();
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || 'local';
    const repoDir = this.getRepoDir(repoName);
    return await commitChanges(repoDir, message, files);
  }

  async sync(branch?: string) {
    await this.ensureActiveRepoGit();
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || 'local';
    const repoDir = this.getRepoDir(repoName);
    const targetBranch = branch || cfg.active_repo?.default_branch || 'main';
    return await syncGit(repoDir, 'origin', targetBranch);
  }

  async getBlame(filePath: string) {
    await this.ensureActiveRepoGit();
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || 'local';
    const repoDir = this.getRepoDir(repoName);
    return await getGitBlame(repoDir, filePath);
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
