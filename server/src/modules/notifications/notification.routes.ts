import type { FastifyInstance } from 'fastify';
import { notificationService } from './notification.service.js';
import { governanceService } from '../governance/governance.service.js';
import { vaultService, VAULT_KEYS } from '../vault/vault.service.js';
import type { NotificationProjectConfig } from './notification.types.js';

export async function notificationRoutes(fastify: FastifyInstance) {
  // 1. Obter configuração e status do Vault
  fastify.get('/api/notifications/config', async (request, reply) => {
    try {
      const query = request.query as { repo?: string };
      const { config, reviewers } = notificationService.getNotificationConfig(query.repo);

      const vaultStatus = {
        hasEmailKey: vaultService.hasSecret(VAULT_KEYS.NOTIFICATION_EMAIL_KEY),
        hasSmtpConfig: vaultService.hasSecret(VAULT_KEYS.NOTIFICATION_SMTP_CONFIG),
        hasWebhookSecret: vaultService.hasSecret(VAULT_KEYS.NOTIFICATION_WEBHOOK_SECRET),
      };

      return reply.send({
        success: true,
        config,
        reviewers,
        vaultStatus,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ success: false, error: msg });
    }
  });

  // 2. Salvar configuração no .project.config.json
  fastify.post('/api/notifications/config', async (request, reply) => {
    try {
      const body = request.body as {
        repo?: string;
        notifications: NotificationProjectConfig;
      };

      if (!body.notifications || typeof body.notifications !== 'object') {
        return reply.status(400).send({ success: false, error: 'Configuração de notificações inválida.' });
      }

      const repoName = body.repo || 'local';
      const pConfig = governanceService.readProjectConfig(repoName);
      if (!pConfig.governance_rules) {
        pConfig.governance_rules = { min_approvals_default: 2 };
      }

      pConfig.governance_rules.notifications = body.notifications;
      governanceService.writeProjectConfig(repoName, pConfig);

      return reply.send({
        success: true,
        message: 'Configuração de notificações atualizada com sucesso.',
        config: body.notifications,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ success: false, error: msg });
    }
  });

  // 3. Enviar notificação de teste
  fastify.post('/api/notifications/test', async (request, reply) => {
    try {
      const body = (request.body || {}) as { repo?: string; email?: string };
      const result = await notificationService.sendTestNotification(body.repo, body.email);
      return reply.send(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ success: false, error: msg });
    }
  });

  // 4. Salvar segredo no cofre nativo do SO (Vault)
  fastify.post('/api/notifications/vault-key', async (request, reply) => {
    try {
      const body = request.body as {
        keyType: 'email_key' | 'webhook_secret' | 'smtp_config';
        value: string;
      };

      if (!body.keyType || typeof body.value !== 'string') {
        return reply.status(400).send({ success: false, error: 'Parâmetros keyType e value são obrigatórios.' });
      }

      let vaultKey: string;
      if (body.keyType === 'email_key') vaultKey = VAULT_KEYS.NOTIFICATION_EMAIL_KEY;
      else if (body.keyType === 'webhook_secret') vaultKey = VAULT_KEYS.NOTIFICATION_WEBHOOK_SECRET;
      else if (body.keyType === 'smtp_config') vaultKey = VAULT_KEYS.NOTIFICATION_SMTP_CONFIG;
      else {
        return reply.status(400).send({ success: false, error: 'Tipo de chave inválido.' });
      }

      vaultService.setSecret(vaultKey, body.value);
      return reply.send({
        success: true,
        message: `Chave '${body.keyType}' armazenada com segurança no cofre do sistema operacional.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ success: false, error: msg });
    }
  });

  // 5. Deletar segredo do cofre nativo do SO (Vault)
  fastify.delete('/api/notifications/vault-key', async (request, reply) => {
    try {
      const query = request.query as { keyType: 'email_key' | 'webhook_secret' | 'smtp_config' };
      if (!query.keyType) {
        return reply.status(400).send({ success: false, error: 'Parâmetro keyType é obrigatório.' });
      }

      let vaultKey: string;
      if (query.keyType === 'email_key') vaultKey = VAULT_KEYS.NOTIFICATION_EMAIL_KEY;
      else if (query.keyType === 'webhook_secret') vaultKey = VAULT_KEYS.NOTIFICATION_WEBHOOK_SECRET;
      else if (query.keyType === 'smtp_config') vaultKey = VAULT_KEYS.NOTIFICATION_SMTP_CONFIG;
      else {
        return reply.status(400).send({ success: false, error: 'Tipo de chave inválido.' });
      }

      vaultService.deleteSecret(vaultKey);
      return reply.send({
        success: true,
        message: `Chave '${query.keyType}' removida com sucesso do cofre.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ success: false, error: msg });
    }
  });
}
