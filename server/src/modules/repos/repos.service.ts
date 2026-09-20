import fs from 'node:fs';
import path from 'node:path';
import { PROJECTS_DIR } from '../../config/constants.js';
import { loadConfig, saveConfig, ensureDefaultRepoFiles } from '../../config/storage.js';
import { callGitHubAPI, applyBranchProtection, ensureGitRepo } from '../../utils/git.js';

export class ReposService {
  async listRepos() {
    const cfg = loadConfig();
    const localRepos: any[] = [];

    // Local repositories in projects/
    if (fs.existsSync(PROJECTS_DIR)) {
      const items = fs.readdirSync(PROJECTS_DIR);
      for (const item of items) {
        const fullPath = path.join(PROJECTS_DIR, item);
        if (fs.statSync(fullPath).isDirectory() && !item.startsWith('.')) {
          localRepos.push({
            name: item,
            full_name: `local/${item}`,
            description: 'Repositório local de especificações',
            is_local: true,
            is_private: false,
            default_branch: 'main',
          });
        }
      }
    }

    if (!cfg.authenticated || !cfg.token) {
      return {
        authenticated: false,
        repos: localRepos,
        active_repo: cfg.active_repo,
      };
    }

    // GitHub repositories
    const { statusCode, data } = await callGitHubAPI('/user/repos?per_page=100&sort=updated', cfg.token);
    const remoteRepos = Array.isArray(data) ? data : [];

    const formattedRemote = remoteRepos.map((r: any) => ({
      name: r.name,
      full_name: r.full_name,
      html_url: r.html_url,
      description: r.description || '',
      is_private: r.private,
      default_branch: r.default_branch || 'main',
      is_local: false,
      owner: r.owner?.login,
    }));

    // Merge without duplicating names
    const repoNames = new Set(formattedRemote.map((r) => r.name));
    for (const lr of localRepos) {
      if (!repoNames.has(lr.name)) {
        formattedRemote.push(lr);
      }
    }

    return {
      authenticated: true,
      repos: formattedRemote,
      active_repo: cfg.active_repo,
    };
  }

  async selectRepo(repo: any) {
    if (!repo || !repo.name) {
      throw new Error('Repositório inválido.');
    }

    const cfg = loadConfig();
    cfg.active_repo = {
      name: repo.name,
      full_name: repo.full_name || repo.name,
      html_url: repo.html_url || '',
      description: repo.description || '',
      is_private: Boolean(repo.is_private),
      default_branch: repo.default_branch || 'main',
    };

    ensureDefaultRepoFiles(repo.name);
    const repoDir = path.join(PROJECTS_DIR, repo.name);
    await ensureGitRepo(repoDir, cfg.user, repo.html_url, cfg.token);
    saveConfig(cfg);

    return {
      success: true,
      active_repo: cfg.active_repo,
    };
  }

  async createRepo(payload: {
    name: string;
    owner?: string;
    description?: string;
    is_private?: boolean;
    enable_protection?: boolean;
    required_approvals?: number;
  }) {
    const repoName = payload.name.trim().toLowerCase().replace(/\s+/g, '-');
    if (!repoName) {
      throw new Error('Nome do repositório é obrigatório');
    }

    const cfg = loadConfig();
    const repoDir = path.join(PROJECTS_DIR, repoName);
    if (!cfg.authenticated || !cfg.token) {
      // Local fallback
      ensureDefaultRepoFiles(repoName);
      await ensureGitRepo(repoDir, cfg.user);
      cfg.active_repo = {
        name: repoName,
        full_name: `local/${repoName}`,
        description: payload.description || 'Repositório Local',
        is_private: false,
        default_branch: 'main',
      };
      saveConfig(cfg);
      return { success: true, message: `Repositório local '${repoName}' criado!`, repo: cfg.active_repo };
    }

    const owner = payload.owner?.trim() || cfg.user?.login;
    const isOrg = cfg.orgs?.some((o: any) => o.login.toLowerCase() === owner?.toLowerCase());
    const endpoint = isOrg ? `/orgs/${owner}/repos` : '/user/repos';

    const { statusCode, data: respData } = await callGitHubAPI(endpoint, cfg.token, 'POST', {
      name: repoName,
      description: payload.description || 'Repositório de Governança',
      private: payload.is_private ?? true,
      auto_init: true,
    });

    if (statusCode !== 200 && statusCode !== 201) {
      throw new Error(`Erro ao criar repositório no GitHub: ${respData.message || 'Falha na requisição'}`);
    }

    const ownerLogin = respData.owner?.login || owner;
    const repoFullName = respData.full_name || `${ownerLogin}/${repoName}`;
    const defaultBranch = respData.default_branch || 'main';

    let protectionStatus = 'Não solicitada';
    if (payload.enable_protection) {
      const pRes = await applyBranchProtection(repoFullName, defaultBranch, cfg.token, payload.required_approvals || 1);
      protectionStatus = pRes.statusCode === 200 || pRes.statusCode === 201 ? 'Ativada com sucesso' : `Aviso (${pRes.data?.message || 'Pendente'})`;
    }

    ensureDefaultRepoFiles(repoName);
    const remoteUrl = respData.html_url || `https://github.com/${repoFullName}`;
    await ensureGitRepo(repoDir, cfg.user, remoteUrl, cfg.token);

    cfg.active_repo = {
      name: repoName,
      full_name: repoFullName,
      html_url: remoteUrl,
      description: payload.description || '',
      is_private: payload.is_private ?? true,
      protection: protectionStatus,
      default_branch: defaultBranch,
    };
    saveConfig(cfg);

    return {
      success: true,
      message: `Repositório ${repoFullName} criado no GitHub!`,
      repo: cfg.active_repo,
    };
  }
}

export const reposService = new ReposService();
