# Fase 01: Schemas, Vault & Contratos de Dados

## 1. Objetivo da Fase
Definir os contratos de tipos (TypeScript), estender o JSON Schema do `.project.config.json` e registrar as novas chaves de credenciais no `VaultService`, estabelecendo a base para o sistema de notificações.

---

## 2. Escopo de Arquivos Modificados/Criados

* `server/src/schemas/project.config.schema.json` (Adicionar bloco `notifications` e opções nos `reviewers`)
* `server/src/modules/vault/vault.service.ts` (Registrar novas `VAULT_KEYS` para e-mail e webhooks)
* `server/src/modules/notifications/notification.types.ts` (Novo arquivo com todas as interfaces e enums)
* `server/src/modules/notifications/notification.schema.ts` (Validações Zod / Fastify para requisições de teste e envio)

---

## 3. Especificação Detalhada

### 3.1. Extensão do `.project.config.schema.json`
Adicionar em `governance_rules.properties`:
```json
"notifications": {
  "type": "object",
  "properties": {
    "enabled": { "type": "boolean" },
    "cooldown_minutes": { "type": "number", "default": 15 },
    "channels": {
      "type": "object",
      "properties": {
        "email": {
          "type": "object",
          "properties": {
            "enabled": { "type": "boolean" },
            "provider": { "type": "string", "enum": ["resend", "smtp", "sendgrid"] },
            "sender_address": { "type": "string" },
            "sender_name": { "type": "string" }
          }
        },
        "webhook": {
          "type": "object",
          "properties": {
            "enabled": { "type": "boolean" },
            "url": { "type": "string" }
          }
        }
      }
    },
    "events": {
      "type": "object",
      "properties": {
        "on_quorum_requested": { "type": "boolean", "default": true },
        "on_quorum_approved": { "type": "boolean", "default": true },
        "on_compliance_violation": { "type": "boolean", "default": true },
        "on_clearance_changed": { "type": "boolean", "default": false }
      }
    }
  }
}
```

### 3.2. Chaves do `VaultService`
Adicionar ao enum `VAULT_KEYS` em `server/src/modules/vault/vault.service.ts`:
```typescript
export const VAULT_KEYS = {
  GITHUB_TOKEN: 'github_token',
  AI_API_KEY: 'ai_api_key',
  NOTIFICATION_EMAIL_KEY: 'notification_email_key',       // API Key (Resend / SendGrid)
  NOTIFICATION_SMTP_CONFIG: 'notification_smtp_config',   // JSON com host, port, user, pass
  NOTIFICATION_WEBHOOK_SECRET: 'notification_webhook_secret' // Segredo HMAC para assinatura de payload
} as const;
```

### 3.3. Contratos de Tipos (`notification.types.ts`)
* `NotificationEvent`: `'quorum_requested' | 'quorum_approved' | 'compliance_violation' | 'clearance_changed'`
* `NotificationPayload`: ID do PR/recurso, repositório, autor, mensagem, link de ação rápida (*deep link*) e metadados adicionais.
* `NotificationDispatchResult`: Status de envio por canal (sucesso, falha ou bloqueado por cooldown).

---

## 4. Critérios de Aceite da Fase 1
- [ ] Validação do JSON Schema passa sem erros para projetos com ou sem a chave `notifications`.
- [ ] `VaultService` lê e grava os novos segredos sem quebrar a retrocompatibilidade com segredos existentes.
- [ ] Testes unitários de validação de schema e tipos TypeScript compilam com zero warnings (`tsc --noEmit`).
