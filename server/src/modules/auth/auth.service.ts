import { loadConfig, saveConfig } from '../../config/storage.js';
import { callGitHubAPI } from '../../utils/git.js';

export class AuthService {
  async authenticateWithToken(token: string) {
    if (!token || typeof token !== 'string') {
      throw new Error('Token do GitHub é obrigatório.');
    }

    const { statusCode, data: user } = await callGitHubAPI('/user', token);
    if (statusCode !== 200 || !user || !user.login) {
      throw new Error('Token do GitHub inválido ou sem permissão.');
    }

    const { data: orgs } = await callGitHubAPI('/user/orgs', token);
    const orgList = Array.isArray(orgs) ? orgs : [];

    const cfg = loadConfig();
    cfg.authenticated = true;
    cfg.token = token;
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
