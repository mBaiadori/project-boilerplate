# Fase 02: Engine, Provedores & Anti-Fadiga

## 1. Objetivo da Fase
Implementar o serviço central de notificações (`NotificationService`), o despachador multicanal (E-mail e Webhook), os templates de mensagens responsivas e o motor de controle de taxa e deduplicação (*anti-fatigue engine*).

---

## 2. Escopo de Arquivos Modificados/Criados

* `server/src/modules/notifications/notification.service.ts` (Serviço principal)
* `server/src/modules/notifications/providers/email.provider.ts` (Driver de e-mail: Resend / SMTP padrão)
* `server/src/modules/notifications/providers/webhook.provider.ts` (Driver HTTP para Discord/Slack/Teams)
* `server/src/modules/notifications/templates/email-templates.ts` (Templates limpos em HTML inline e texto puro)
* `server/src/modules/notifications/anti-fatigue.service.ts` (Gerenciador de cooldown e cache de deduplicação)

---

## 3. Especificação Detalhada

### 3.1. Motor Anti-Fadiga (`anti-fatigue.service.ts`)
* **Chave de Deduplicação:** `hash(`${repo}:${event}:${resourceId}:${recipient}`)`
* **Lógica:**
  1. Se uma notificação idêntica for disparada dentro do período de cooldown (padrão: 15 minutos), ela é descartada ou agrupada.
  2. Registra o timestamp da última notificação disparada por destinatário.
  3. Previne loops automáticos caso múltiplas atualizações aconteçam em sequência rápida.

### 3.2. Provedor de E-mail (`email.provider.ts`)
* Integração limpa usando HTTP `fetch` para serviços como **Resend** (dispensa SDKs pesados):
  ```typescript
  // Exemplo de chamada via API Key guardada no Vault
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: `${senderName} <${senderAddress}>`,
      to: [recipientEmail],
      subject: payload.subject,
      html: renderHtmlTemplate(payload)
    })
  });
  ```
* Fallback de log em desenvolvimento: se nenhuma chave for configurada, apenas registra no console `[NotificationService:MockEmail] Enviado para...`.

### 3.3. Template de E-mail Responsivo
* Design moderno, limpo, fundo neutro, tipografia legível e sem imagens pesadas externas.
* **Badge de Governança com a cor do status** (lida do `.project.config.json`).
* **Botão de Ação Destacado:** *"Visualizar no Context OS"* ou *"Assinar Quorum"*.
* Rodapé com aviso de desativação / contexto: *"Você recebeu este e-mail porque é um Reviewer com clearance de Governança no projeto X."*

---

## 4. Critérios de Aceite da Fase 2
- [ ] `NotificationService.dispatch()` respeita o cooldown configurado no `.project.config.json`.
- [ ] O envio via mock/fallback funciona perfeitamente sem quebrar a execução se a chave do Vault estiver ausente.
- [ ] O payload de Webhook é compatível com formatos padrão (Slack / Discord Embeds).
- [ ] Testes unitários cobrindo o motor de cooldown e a renderização de templates.
