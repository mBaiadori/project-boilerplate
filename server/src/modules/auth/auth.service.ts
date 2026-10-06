import { loadConfig, saveConfig } from '../../config/storage.js';
import { callGitHubAPI } from '../../utils/git.js';

export class AuthService {
  async authenticateWithToken(token: string) {
    if (!token || typeof token !== 'string') {
      throw new Error('Token do GitHub é obrigatório.');
    }

    const { statusCode, data: user } = await callGitHubAPI('/user', token.trim(), 'GET');
    if (statusCode !== 200 || !user || !user.login) {
      if (statusCode === 401) {
        throw new Error('Token do GitHub inválido ou expirado (401 Unauthorized).');
      }
      if (statusCode === 403) {
        throw new Error(
          'Token do GitHub sem permissão (403 Forbidden). Certifique-se de que o token possui permissões de repo e user.'
        );
      }
      const msg = user?.message ? `: ${user.message}` : '';
      throw new Error(`Falha na autenticação com GitHub (${statusCode})${msg}.`);
    }

    const { data: orgs } = await callGitHubAPI('/user/orgs', token, 'GET');
    const orgList = Array.isArray(orgs) ? orgs : [];

    const cfg = loadConfig();
    cfg.authenticated = true;
    cfg.token = token;
    cfg.git_provider = 'github';
    delete cfg.git_provider_url;
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

    const accountId = `github:${user.login}`;

    const savedAccount = {
      id: accountId,
      user: {
        login: user.login,
        name: user.name || user.login,
        avatar_url: user.avatar_url,
        html_url: user.html_url,
        email: user.email,
      },
      token: token.trim(),
      git_provider: 'github' as const,
      orgs: orgList.map((o: any) => ({
        login: o.login,
        avatar_url: o.avatar_url,
        description: o.description,
      })),
      last_active: new Date().toISOString(),
    };

    if (!Array.isArray(cfg.accounts)) {
      cfg.accounts = [];
    }

    const existingIdx = cfg.accounts.findIndex((a) => a.id === accountId);
    if (existingIdx >= 0) {
      cfg.accounts[existingIdx] = savedAccount;
    } else {
      cfg.accounts.push(savedAccount);
    }

    saveConfig(cfg);
    return {
      authenticated: true,
      user: cfg.user,
      orgs: cfg.orgs,
      git_provider: cfg.git_provider,
      accounts: this.getAccounts(),
    };
  }

  getAccounts() {
    const cfg = loadConfig();
    const currentId = cfg.user?.login ? `github:${cfg.user.login}` : null;

    const list = Array.isArray(cfg.accounts) ? cfg.accounts : [];
    return list.map((acc) => ({
      id: acc.id,
      user: acc.user,
      git_provider: acc.git_provider,
      orgs: acc.orgs,
      is_active: acc.id === currentId,
      last_active: acc.last_active,
    }));
  }

  async switchAccount(accountId: string) {
    const cfg = loadConfig();
    const list = Array.isArray(cfg.accounts) ? cfg.accounts : [];
    const target = list.find((a) => a.id === accountId);

    if (!target) {
      throw new Error(`Conta não encontrada no sistema: ${accountId}`);
    }

    cfg.authenticated = true;
    cfg.token = target.token;
    cfg.git_provider = target.git_provider || 'github';
    delete cfg.git_provider_url;
    cfg.user = target.user;
    cfg.orgs = target.orgs || [];
    target.last_active = new Date().toISOString();

    // Reset active repo so new account views its own repositories
    cfg.active_repo = null;

    saveConfig(cfg);

    return {
      success: true,
      authenticated: true,
      user: cfg.user,
      git_provider: cfg.git_provider,
      accounts: this.getAccounts(),
    };
  }

  removeAccount(accountId: string) {
    const cfg = loadConfig();
    if (!Array.isArray(cfg.accounts)) {
      cfg.accounts = [];
    }

    cfg.accounts = cfg.accounts.filter((a) => a.id !== accountId);

    const currentId = cfg.user?.login ? `github:${cfg.user.login}` : null;

    if (currentId === accountId) {
      if (cfg.accounts.length > 0) {
        const next = cfg.accounts[0];
        cfg.authenticated = true;
        cfg.token = next.token;
        cfg.git_provider = next.git_provider;
        delete cfg.git_provider_url;
        cfg.user = next.user;
        cfg.orgs = next.orgs || [];
        cfg.active_repo = null;
      } else {
        cfg.authenticated = false;
        cfg.token = '';
        cfg.user = null;
        cfg.orgs = [];
        cfg.active_repo = null;
      }
    }

    saveConfig(cfg);
    return {
      success: true,
      accounts: this.getAccounts(),
      user: cfg.user,
      authenticated: cfg.authenticated,
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
      git_provider: cfg.git_provider || 'github',
      accounts: this.getAccounts(),
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
