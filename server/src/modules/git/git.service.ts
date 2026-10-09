import fs from 'node:fs';
import path from 'node:path';
import { PROJECTS_DIR, resolveRepoDir } from '../../config/constants.js';
import { loadConfig, clearWorkspaceChanges } from '../../config/storage.js';
import { workspaceService } from '../workspace/workspace.service.js';
import { eventsService } from '../events/events.service.js';
import { parseRepoRef, resolveRepoDirPath, RepoRef } from '../../utils/repo-ref.js';
import {
  cloneGitRepo,
  pullGitRepo,
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
  checkRemoteGitUpdates,
  isGitRepo,
} from '../../utils/git.js';

export class GitService {
  private getRepoDir(repoName?: string, ownerParam?: string): string {
    const cfg = loadConfig();
    const activeRepoName = repoName || cfg.active_repo?.name || 'local';
    const effectiveOwner =
      ownerParam ||
      (cfg.active_repo?.name === activeRepoName ? cfg.active_repo?.owner : undefined);
    return resolveRepoDir(activeRepoName, effectiveOwner);
  }

  async clone(payload: { repo: string; owner?: string; remote_url?: string }) {
    const cfg = loadConfig();
    const ref = parseRepoRef(payload.repo, payload.owner || cfg.active_repo?.owner || cfg.user?.login);
    if (!ref) {
      throw new Error(`Identificador de repositório inválido para clone: ${payload.repo}`);
    }

    const repoDir = resolveRepoDirPath(ref);
    let remoteUrl = payload.remote_url;
    if (!remoteUrl) {
      remoteUrl = `https://github.com/${ref.owner}/${ref.repo}.git`;
    }

    const res = await cloneGitRepo(repoDir, remoteUrl, cfg.token, cfg.user, (p) => {
      eventsService.broadcast('repo_progress', {
        repo: ref.repo,
        owner: ref.owner,
        ...p,
      });
    });
    if (res.success) {
      workspaceService.invalidateTreeCache(ref.repo);
      eventsService.broadcast('repo_progress', {
        repo: ref.repo,
        owner: ref.owner,
        stage: 'Concluído',
        percent: 100,
      });
    }
    return {
      ...res,
      repo_dir: repoDir,
      owner: ref.owner,
      repo: ref.repo,
      is_cloned_locally: res.success,
    };
  }

  async pull(repoNameParam?: string, branch?: string, ownerParam?: string) {
    const cfg = loadConfig();
    const repoName = repoNameParam || cfg.active_repo?.name || 'local';
    const repoDir = this.getRepoDir(repoName, ownerParam);
    const res = await pullGitRepo(repoDir, branch, cfg.token, (p) => {
      eventsService.broadcast('repo_progress', {
        repo: repoName,
        owner: ownerParam,
        ...p,
      });
    });
    if (res.success) {
      workspaceService.invalidateTreeCache(repoName);
      eventsService.broadcast('repo_progress', {
        repo: repoName,
        owner: ownerParam,
        stage: 'Concluído',
        percent: 100,
      });
    }
    return res;
  }

  async checkRemote(repoNameParam?: string, branch?: string, ownerParam?: string) {
    const cfg = loadConfig();
    const repoName = repoNameParam || cfg.active_repo?.name || 'local';
    const repoDir = this.getRepoDir(repoName, ownerParam);
    if (!(await isGitRepo(repoDir))) {
      return { hasUpdates: false, isCloned: false };
    }
    return await checkRemoteGitUpdates(repoDir, branch);
  }

  async getStatus(repoNameParam?: string, ownerParam?: string) {
    const cfg = loadConfig();
    const repoName = repoNameParam || cfg.active_repo?.name || 'local';
    const repoDir = this.getRepoDir(repoName, ownerParam);
    const repoObj =
      cfg.repos?.find((r: any) => r.name === repoName) ||
      (cfg.active_repo?.name === repoName
        ? cfg.active_repo
        : { name: repoName, full_name: repoName, is_local: true });

    if (!(await isGitRepo(repoDir))) {
      return {
        repo_name: repoName,
        active_repo: repoObj,
        isRepo: false,
        isCloned: false,
        branch: 'none',
        ahead: 0,
        behind: 0,
        isClean: true,
        files: [],
        systemFiles: [],
      };
    }

    const status = await getGitStatus(repoDir);
    return {
      repo_name: repoName,
      active_repo: repoObj,
      isCloned: true,
      ...status,
    };
  }

  async getDiff(filePath?: string, repoNameParam?: string, ownerParam?: string) {
    const cfg = loadConfig();
    const repoName = repoNameParam || cfg.active_repo?.name || 'local';
    const repoDir = this.getRepoDir(repoName, ownerParam);
    if (!(await isGitRepo(repoDir))) {
      return { diff: '', isClean: true };
    }
    return await getGitDiff(repoDir, filePath);
  }

  async getLog(limit: number = 20, repoNameParam?: string, ownerParam?: string) {
    const cfg = loadConfig();
    const repoName = repoNameParam || cfg.active_repo?.name || 'local';
    const repoDir = this.getRepoDir(repoName, ownerParam);
    if (!(await isGitRepo(repoDir))) {
      return { repo_name: repoName, commits: [] };
    }
    const commits = await getGitLog(repoDir, limit);
    return { repo_name: repoName, commits };
  }

  async getFileHistory(filePath: string, limit: number = 30, repoNameParam?: string, ownerParam?: string) {
    const cfg = loadConfig();
    const repoName = repoNameParam || cfg.active_repo?.name || 'local';
    const repoDir = this.getRepoDir(repoName, ownerParam);
    if (!(await isGitRepo(repoDir))) {
      return { repo_name: repoName, file_path: filePath, commits: [] };
    }
    const commits = await getFileGitLog(repoDir, filePath, limit);
    return { repo_name: repoName, file_path: filePath, commits };
  }

  async getFileVersion(filePath: string, commitHash: string, repoNameParam?: string, ownerParam?: string) {
    const cfg = loadConfig();
    const repoName = repoNameParam || cfg.active_repo?.name || 'local';
    const repoDir = this.getRepoDir(repoName, ownerParam);
    if (!(await isGitRepo(repoDir))) {
      return { content: '' };
    }
    return await getFileContentAtCommit(repoDir, filePath, commitHash);
  }

  async getBranches(repoNameParam?: string, ownerParam?: string) {
    const cfg = loadConfig();
    const repoName = repoNameParam || cfg.active_repo?.name || 'local';
    const repoDir = this.getRepoDir(repoName, ownerParam);
    if (!(await isGitRepo(repoDir))) {
      return { current: 'main', branches: ['main'] };
    }
    return await getGitBranches(repoDir);
  }

  async switchOrCreateBranch(branchName: string, repoNameParam?: string, ownerParam?: string) {
    const cfg = loadConfig();
    const repoName = repoNameParam || cfg.active_repo?.name || 'local';
    const repoDir = this.getRepoDir(repoName, ownerParam);
    if (!(await isGitRepo(repoDir))) {
      throw new Error(`Repositório ${repoName} não está clonado localmente.`);
    }
    const res = await createAndCheckoutBranch(repoDir, branchName);
    workspaceService.invalidateTreeCache(repoName);
    return res;
  }

  async commit(message: string, files?: string[], _userLogin?: string, repo?: string, ownerParam?: string) {
    const cfg = loadConfig();
    const repoName = repo || cfg.active_repo?.name || 'local';
    const repoDir = this.getRepoDir(repoName, ownerParam);
    if (!(await isGitRepo(repoDir))) {
      throw new Error(`Repositório ${repoName} não está clonado localmente.`);
    }

    const res = await commitChanges(repoDir, message, files);
    workspaceService.invalidateTreeCache(repoName);
    return res;
  }

  async sync(branch?: string, repoNameParam?: string, ownerParam?: string) {
    const cfg = loadConfig();
    const repoName = repoNameParam || cfg.active_repo?.name || 'local';
    const repoDir = this.getRepoDir(repoName, ownerParam);
    if (!(await isGitRepo(repoDir))) {
      throw new Error(`Repositório ${repoName} não está clonado localmente.`);
    }

    const repoObj =
      cfg.repos?.find((r: any) => r.name === repoName) ||
      (cfg.active_repo?.name === repoName ? cfg.active_repo : undefined);
    const targetBranch = branch || repoObj?.default_branch || 'main';

    const result = await syncGit(repoDir, 'origin', targetBranch);
    workspaceService.invalidateTreeCache(repoName);

    try {
      const status = await getGitStatus(repoDir);
      if (status.isClean && (!status.files || status.files.length === 0)) {
        clearWorkspaceChanges(repoName);
      }
    } catch {}

    return result;
  }

  async getBlame(filePath: string, repoNameParam?: string, ownerParam?: string) {
    const cfg = loadConfig();
    const repoName = repoNameParam || cfg.active_repo?.name || 'local';
    const repoDir = this.getRepoDir(repoName, ownerParam);
    if (!(await isGitRepo(repoDir))) {
      return { lines: [] };
    }
    return await getFileBlameDetails(repoDir, filePath);
  }

  async getWhatsNew(lastSeenHash?: string, repoNameParam?: string, ownerParam?: string) {
    const cfg = loadConfig();
    const repoName = repoNameParam || cfg.active_repo?.name || 'local';
    const repoDir = this.getRepoDir(repoName, ownerParam);
    if (!(await isGitRepo(repoDir))) {
      return { hasNewUpdates: false, files: [] };
    }
    return await getWhatsNewSummary(repoDir, lastSeenHash);
  }

  async getWhatsNewDiff(filePath: string, lastSeenHash?: string, repoNameParam?: string, ownerParam?: string) {
    const cfg = loadConfig();
    const repoName = repoNameParam || cfg.active_repo?.name || 'local';
    const repoDir = this.getRepoDir(repoName, ownerParam);
    if (!(await isGitRepo(repoDir))) {
      return { diff: '' };
    }
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
