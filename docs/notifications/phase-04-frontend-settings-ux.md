# Fase 04: Frontend UI, Configurações & Testes

## 1. Objetivo da Fase
Criar a interface visual para os administradores do projeto gerenciarem os canais de notificação, visualizarem quais reviewers recebem avisos, configurarem o cooldown e executarem testes de envio em tempo real.

---

## 2. Escopo de Arquivos Modificados/Criados

* `frontend/src/views/settings/subviews/NotificationSettingsSubView.tsx` (Nova subview de configurações)
* `frontend/src/services/api/notifications.api.ts` (Cliente de API para testar e atualizar configurações)
* `frontend/src/stores/governanceStore.ts` (Ações para salvar e carregar preferências de notificação)
* `server/src/modules/notifications/notification.routes.ts` (Rotas `/api/notifications/test` e `/api/notifications/config`)

---

## 3. Especificação Detalhada de UI/UX

### 3.1. Design System & Diretrizes do Workspace
* Seguir estritamente as diretrizes de **Material Design 3** e tokens de `design-tokens.css`.
* Usar ícones do **Google Material Symbols** (`notifications`, `mark_email_read`, `webhook`, `timer`, `verified_user`).
* **Taxonomias dinâmicas & Cores:** As pílulas (*chips*) de reviewers e status devem usar as cores definidas no `.project.config.json`.

### 3.2. Componentes da Tela
1. **Interruptor Geral (*Toggle Switch*):** Ativar/Desativar notificações do projeto.
2. **Cards de Canais:**
   * **E-mail:** Seletor de provedor (Resend, SendGrid, SMTP), remetente e status da chave no Vault (indicador verde se a chave está configurada no cofre, ou amarelo com botão *"Configurar chave no Vault"*).
   * **Webhook:** Campo de URL de webhook e seletor de formato (Discord / Slack).
3. **Matriz de Eventos (Checkboxes):**
   * ☑️ Solicitação de Quorum / Revisão
   * ☑️ Quorum Atingido / Aprovação
   * ☑️ Violação de Compliance e Segurança
   * ⬜ Mudança de Clearance / Convites
4. **Campo de Cooldown:** Slider ou input numérico para definir minutos de espera entre avisos semelhantes (ex: 15 min).
5. **Botão de Teste Interativo:**
   * Botão: `Enviar E-mail de Teste`
   * Toast / Feedback visual imediato com o retorno do backend: `✅ Notificação de teste enviada com sucesso para seu e-mail.`

---

## 4. Critérios de Aceite da Fase 4
- [ ] Interface integrada na tela de Configurações sem quebra de layout em modo claro e escuro.
- [ ] O botão de teste valida a chave do Vault e dispara uma notificação real ou mock com feedback claro.
- [ ] As alterações no formulário atualizam o `.project.config.json` via API de forma atômica e segura.
- [ ] Zero erros de linter ou TypeScript no build do frontend.
