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

  /**
   * RFC 8628: Solicita o código do dispositivo (Device Authorization Grant)
   */
  async requestDeviceCode(customClientId?: string) {
    const cfg = loadConfig();
    const clientId = (
      customClientId ||
      process.env.GITHUB_CLIENT_ID ||
      (cfg as any).github_client_id ||
      'Iv1.b507a08c87ecfe98'
    ).trim();

    if (!clientId) {
      throw new Error(
        'Identificador da Aplicação (Client ID) do GitHub não configurado. Defina GITHUB_CLIENT_ID no ambiente ou na configuração.'
      );
    }

    try {
      const response = await fetch('https://github.com/login/device/code', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Context-OS-Spec-Driven',
        },
        body: JSON.stringify({
          client_id: clientId,
          scope: 'repo,read:org,admin:org,user,workflow',
        }),
      });

      const data = (await response.json()) as any;

      if (!response.ok || data.error) {
        const errorMsg =
          data.error_description ||
          data.error ||
          'Falha ao solicitar código de pareamento do dispositivo.';
        throw new Error(errorMsg);
      }

      return {
        success: true,
        device_code: data.device_code,
        user_code: data.user_code,
        verification_uri: data.verification_uri || 'https://github.com/login/device',
        expires_in: data.expires_in || 900,
        interval: data.interval || 5,
        client_id: clientId,
      };
    } catch (err: any) {
      console.error('[AuthService] Erro ao solicitar device code:', err);
      throw new Error(err.message || 'Erro de conexão com o servidor de autenticação.');
    }
  }

  /**
   * RFC 8628: Realiza polling do status de autorização do dispositivo
   */
  async pollDeviceToken(deviceCode: string, customClientId?: string) {
    if (!deviceCode || typeof deviceCode !== 'string') {
      throw new Error('Código do dispositivo (device_code) é obrigatório.');
    }

    const cfg = loadConfig();
    const clientId = (
      customClientId ||
      process.env.GITHUB_CLIENT_ID ||
      (cfg as any).github_client_id ||
      'Iv1.b507a08c87ecfe98'
    ).trim();

    try {
      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Context-OS-Spec-Driven',
        },
        body: JSON.stringify({
          client_id: clientId,
          device_code: deviceCode.trim(),
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
      });

      const data = (await response.json()) as any;

      if (data.error) {
        if (data.error === 'authorization_pending') {
          return {
            status: 'pending' as const,
            message: 'Aguardando autorização no navegador...',
          };
        }
        if (data.error === 'slow_down') {
          return {
            status: 'slow_down' as const,
            interval: data.interval || 10,
            message: 'Ajustando intervalo de verificação...',
          };
        }
        if (data.error === 'expired_token') {
          return {
            status: 'expired' as const,
            error: 'O código de conexão expirou. Por favor, solicite um novo código.',
          };
        }
        if (data.error === 'access_denied') {
          return {
            status: 'denied' as const,
            error: 'A autorização foi recusada pelo usuário.',
          };
        }
        return {
          status: 'error' as const,
          error: data.error_description || data.error || 'Erro durante a verificação de acesso.',
        };
      }

      if (data.access_token) {
        // Autentica o usuário com o token recebido (já sincroniza com o cofre nativo de senhas)
        const authResult = await this.authenticateWithToken(data.access_token);
        return {
          status: 'success' as const,
          authenticated: true,
          user: authResult.user,
          orgs: authResult.orgs,
          accounts: authResult.accounts,
          token_type: data.token_type || 'bearer',
        };
      }

      return {
        status: 'pending' as const,
        message: 'Aguardando confirmação...',
      };
    } catch (err: any) {
      console.error('[AuthService] Erro durante o polling do device token:', err);
      throw new Error(err.message || 'Erro ao consultar status da autorização.');
    }
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
