import type { ApiResponse } from './client';

export interface NotificationChannelEmailConfig {
  enabled?: boolean;
  provider?: 'resend' | 'sendgrid' | 'smtp';
  sender_address?: string;
  sender_name?: string;
}

export interface NotificationChannelWebhookConfig {
  enabled?: boolean;
  url?: string;
}

export interface NotificationProjectEvents {
  on_quorum_requested?: boolean;
  on_quorum_approved?: boolean;
  on_compliance_violation?: boolean;
  on_clearance_changed?: boolean;
}

export interface NotificationProjectConfigData {
  enabled?: boolean;
  cooldown_minutes?: number;
  channels?: {
    email?: NotificationChannelEmailConfig;
    webhook?: NotificationChannelWebhookConfig;
  };
  events?: NotificationProjectEvents;
}

export interface NotificationReviewerInfo {
  id: string;
  name: string;
  handle?: string;
  email?: string;
  role?: string;
  tier?: string;
  notify_channels?: string[];
  notify_events?: string[];
}

export interface NotificationConfigResponse {
  success: boolean;
  config: NotificationProjectConfigData;
  reviewers: NotificationReviewerInfo[];
  vaultStatus: {
    hasEmailKey: boolean;
    hasSmtpConfig: boolean;
    hasWebhookSecret: boolean;
  };
  error?: string;
}

export const notificationsApi = {
  /**
   * Obtém as configurações de notificações e o status de chaves no Vault
   */
  async getConfig(repo?: string): Promise<ApiResponse<NotificationConfigResponse>> {
    const res = await fetch(`/api/notifications/config${repo ? `?repo=${encodeURIComponent(repo)}` : ''}`);
    return { ok: res.ok, data: await res.json() };
  },

  /**
   * Salva as configurações de notificações no .project.config.json do projeto
   */
  async saveConfig(
    repo: string | undefined,
    notifications: NotificationProjectConfigData
  ): Promise<ApiResponse<{ success: boolean; message: string; config?: NotificationProjectConfigData; error?: string }>> {
    const res = await fetch('/api/notifications/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo, notifications }),
    });
    return { ok: res.ok, data: await res.json() };
  },

  /**
   * Dispara um teste de notificação para validar conectividade e chaves do cofre
   */
  async sendTestNotification(
    repo?: string,
    email?: string
  ): Promise<ApiResponse<{ success: boolean; message: string; details?: any; error?: string }>> {
    const res = await fetch('/api/notifications/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo, email }),
    });
    return { ok: res.ok, data: await res.json() };
  },

  /**
   * Armazena com segurança uma chave de API ou segredo no cofre nativo do SO
   */
  async saveVaultKey(
    keyType: 'email_key' | 'webhook_secret' | 'smtp_config',
    value: string
  ): Promise<ApiResponse<{ success: boolean; message: string; error?: string }>> {
    const res = await fetch('/api/notifications/vault-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyType, value }),
    });
    return { ok: res.ok, data: await res.json() };
  },

  /**
   * Remove uma chave do cofre nativo do SO
   */
  async deleteVaultKey(
    keyType: 'email_key' | 'webhook_secret' | 'smtp_config'
  ): Promise<ApiResponse<{ success: boolean; message: string; error?: string }>> {
    const res = await fetch(`/api/notifications/vault-key?keyType=${encodeURIComponent(keyType)}`, {
      method: 'DELETE',
    });
    return { ok: res.ok, data: await res.json() };
  },
};
