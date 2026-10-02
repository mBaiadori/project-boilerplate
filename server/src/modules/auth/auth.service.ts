import { loadConfig, saveConfig } from '../../config/storage.js';
import { callGitHubAPI } from '../../utils/git.js';

export class AuthService {
  async authenticateWithToken(token: string, provider: 'github' | 'forgejo' = 'github', providerUrl?: string) {
    if (!token || typeof token !== 'string') {
      throw new Error(`Token do ${provider === 'forgejo' ? 'Forgejo' : 'GitHub'} é obrigatório.`);
    }

    let customBase = provider === 'forgejo'
      ? (providerUrl?.trim() || 'http://localhost:3000/api/v1')
      : undefined;

    if (customBase) {
      customBase = customBase.replace(/\/+$/, '');
      if (!customBase.endsWith('/api/v1')) {
        customBase = `${customBase}/api/v1`;
      }
    }

    const { statusCode, data: user } = await callGitHubAPI('/user', token.trim(), 'GET', null, customBase);
    if (statusCode !== 200 || !user || !user.login) {
      if (statusCode === 401) {
        throw new Error(`Token do ${provider === 'forgejo' ? 'Forgejo' : 'GitHub'} inválido ou expirado (401 Unauthorized).`);
      }
      if (statusCode === 403) {
        throw new Error(
          provider === 'forgejo'
            ? 'Token do Forgejo sem permissão de acesso (403 Forbidden). Ao gerar o Personal Access Token no Forgejo, certifique-se de selecionar os escopos "user", "repo" e "organization" (ou "all").'
            : 'Token do GitHub sem permissão (403 Forbidden). Certifique-se de que o token possui permissões de repo e user.'
        );
      }
      if (statusCode === 404) {
        throw new Error(`Endpoint da API não encontrado (404). Verifique a URL do servidor: ${customBase}`);
      }
      const msg = user?.message ? `: ${user.message}` : '';
      throw new Error(`Falha na autenticação com ${provider === 'forgejo' ? 'Forgejo' : 'GitHub'} (${statusCode})${msg}.`);
    }

    const { data: orgs } = await callGitHubAPI('/user/orgs', token, 'GET', null, customBase);
    const orgList = Array.isArray(orgs) ? orgs : [];

    const cfg = loadConfig();
    cfg.authenticated = true;
    cfg.token = token;
    cfg.git_provider = provider;
    if (provider === 'forgejo') {
      cfg.git_provider_url = customBase;
    } else {
      delete cfg.git_provider_url;
    }
    cfg.user = {
      login: user.login,
      name: user.name || user.login,
      avatar_url: user.avatar_url,
      html_url: user.html_url,
      email: user.email,
    };
    cfg.orgs = orgList.map((o: any) => ({
      login: o.login,
      avatar_url: o.avatar_url,
      description: o.description,
    }));

    saveConfig(cfg);
    return {
      authenticated: true,
      user: cfg.user,
      orgs: cfg.orgs,
      git_provider: cfg.git_provider,
      git_provider_url: cfg.git_provider_url,
    };
  }

  logout() {
    const cfg = loadConfig();
    cfg.authenticated = false;
    cfg.token = '';
    cfg.user = null;
    cfg.orgs = [];
    cfg.active_repo = null;
    saveConfig(cfg);
    return { success: true };
  }

  getStatus() {
    const cfg = loadConfig();
    const activeRepo = cfg.active_repo;
    const repoName = activeRepo?.name || 'local';
    const pendingChanges = cfg.workspace_changes?.[repoName] || [];

    return {
      authenticated: Boolean(cfg.authenticated && cfg.token),
      user: cfg.user,
      active_repo: activeRepo,
      git_provider: cfg.git_provider || 'forgejo',
      git_provider_url: cfg.git_provider_url || 'http://localhost:3000/api/v1',
      pending_changes_count: pendingChanges.length,
      ai_settings: {
        provider: cfg.ai_settings?.provider || 'gemini',
        model: cfg.ai_settings?.model || 'gemini-3.5-flash',
        has_key: Boolean(cfg.ai_settings?.api_key || process.env.GEMINI_API_KEY),
        custom_endpoint: cfg.ai_settings?.custom_endpoint || 'http://localhost:11434/v1',
      },
    };
  }
}

export const authService = new AuthService();
