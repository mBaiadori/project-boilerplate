import fs from 'node:fs';
import path from 'node:path';
import { PROJECTS_DIR } from '../../config/constants.js';
import { loadConfig, clearWorkspaceChanges } from '../../config/storage.js';
import { workspaceService } from '../workspace/workspace.service.js';
import { vaultEngineService } from '../vault/vault-engine.service.js';
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

  async ensureActiveRepoGit() {
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || 'local';
    const repoDir = this.getRepoDir(repoName);
    const isLocal = Boolean(cfg.active_repo?.is_local) || repoName === 'local' || repoName === 'default' || repoName === '_default';
    let remoteUrl = isLocal ? undefined : cfg.active_repo?.html_url;
    if (!remoteUrl && !isLocal && cfg.token && cfg.user?.login) {
      remoteUrl = `https://github.com/${cfg.user.login}/${repoName}.git`;
    }
    const token = isLocal ? undefined : cfg.token;
    const res = await ensureGitRepo(repoDir, cfg.user, remoteUrl, token, repoName, !isLocal);
    // Sincroniza cofre transparente no repositório ativo
    try {
      await vaultEngineService.syncLocalWorkspaceFromGit(repoName, cfg.user?.login);
    } catch (err: any) {
      console.warn('[GitService] Aviso ao sincronizar cofre local:', err?.message || err);
    }
    return res;
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

  async getDiff(filePath?: string) {
    await this.ensureActiveRepoGit();
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || 'local';
    const repoDir = this.getRepoDir(repoName);
    return await getGitDiff(repoDir, filePath);
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

  async getFileHistory(filePath: string, limit: number = 30) {
    await this.ensureActiveRepoGit();
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || 'local';
    const repoDir = this.getRepoDir(repoName);
    const commits = await getFileGitLog(repoDir, filePath, limit);

    return {
      repo_name: repoName,
      file_path: filePath,
      commits,
    };
  }

  async getFileVersion(filePath: string, commitHash: string) {
    await this.ensureActiveRepoGit();
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || 'local';
    const repoDir = this.getRepoDir(repoName);
    return await getFileContentAtCommit(repoDir, filePath, commitHash);
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
    const res = await createAndCheckoutBranch(repoDir, branchName);
    try {
      await vaultEngineService.syncLocalWorkspaceFromGit(repoName, cfg.user?.login);
    } catch {}
    workspaceService.invalidateTreeCache(repoName);
    return res;
  }

  async commit(message: string, files?: string[], userLogin?: string, repo?: string) {
    await this.ensureActiveRepoGit();
    const cfg = loadConfig();
    const repoName = repo || cfg.active_repo?.name || 'local';
    const repoDir = this.getRepoDir(repoName);
    const login = userLogin || cfg.user?.login;

    // 1. Cifra automaticamente quaisquer .md protegidos modificados para seus respectivos .enc
    let targetFiles = files;
    try {
      const stagingRes = await vaultEngineService.prepareGitStaging(repoName, files, login);
      if (files && files.length > 0) {
        targetFiles = files.map((f) => {
          const encPath = `${f}.enc`;
          if (f.endsWith('.md') && (stagingRes.modifiedEncFiles.includes(encPath) || fs.existsSync(path.join(repoDir, encPath)))) {
            return encPath;
          }
          return f;
        });
        for (const enc of stagingRes.modifiedEncFiles) {
          if (!targetFiles.includes(enc)) {
            targetFiles.push(enc);
          }
        }
      }
    } catch (err: any) {
      console.warn('[GitService] Aviso ao preparar staging do cofre:', err?.message || err);
    }

    // 2. Executa commit no Git
    const res = await commitChanges(repoDir, message, targetFiles);
    workspaceService.invalidateTreeCache(repoName);
    return res;
  }

  async sync(branch?: string) {
    await this.ensureActiveRepoGit();
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || 'local';
    const repoDir = this.getRepoDir(repoName);
    const targetBranch = branch || cfg.active_repo?.default_branch || 'main';

    // 1. Cifra alterações pendentes locais antes de enviar
    try {
      await vaultEngineService.prepareGitStaging(repoName, undefined, cfg.user?.login);
    } catch {}

    // 2. Executa sync (pull + push)
    const result = await syncGit(repoDir, 'origin', targetBranch);

    // 3. Descriptografa novos arquivos protegidos recebidos do Git
    try {
      await vaultEngineService.syncLocalWorkspaceFromGit(repoName, cfg.user?.login);
    } catch {}

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

  async getBlame(filePath: string) {
    await this.ensureActiveRepoGit();
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || 'local';
    const repoDir = this.getRepoDir(repoName);
    return await getFileBlameDetails(repoDir, filePath);
  }

  async getWhatsNew(lastSeenHash?: string) {
    await this.ensureActiveRepoGit();
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || 'local';
    const repoDir = this.getRepoDir(repoName);
    return await getWhatsNewSummary(repoDir, lastSeenHash);
  }

  async getWhatsNewDiff(filePath: string, lastSeenHash?: string) {
    await this.ensureActiveRepoGit();
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || 'local';
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
