# Fase 03: Integração com Governança & PRs

## 1. Objetivo da Fase
Conectar o `NotificationService` aos pontos estratégicos do `GovernanceService` e do `PRsService`, disparando avisos quando um evento de governança relevante ocorrer.

---

## 2. Escopo de Arquivos Modificados

* `server/src/modules/governance/governance.service.ts` (Plugar nos métodos de quorum, colaboradores e proteção)
* `server/src/modules/prs/prs.service.ts` (Plugar na criação, revisão e aprovação de PRs de governança)
* `server/src/modules/governance/governance.routes.ts` (Endpoint para disparo manual ou teste de conectividade)

---

## 3. Especificação Detalhada

### 3.1. Gatilhos no `PRsService`
1. **Criação de PR com Quorum Pendente (`on_quorum_requested`):**
   * Ao criar um PR de governança ou marcar novos reviewers, o serviço busca a lista de `reviewers` no `.project.config.json` que tenham o tier necessário.
   * Dispara a notificação para cada reviewer elegível com o link direto para a revisão.
2. **Aprovação / Quorum Atingido (`on_quorum_approved`):**
   * Quando o último voto necessário é registrado e `quorumReached === true`, notifica o autor original do PR e dispara webhook para o canal da equipe.

### 3.2. Gatilhos no `GovernanceService`
1. **Violações de Compliance e Secrets (`on_compliance_violation`):**
   * Quando `scanContentForSecrets` encontra chaves críticas expostas ou quando alguém tenta alterar um arquivo restrito sem permissão, dispara alerta imediato para os administradores.
2. **Alteração de Clearance (`on_clearance_changed`):**
   * Quando `updateCollaboratorClearance` é executado, notifica o colaborador envolvido sobre o novo nível de acesso concedido.

### 3.3. Não-Bloqueio da Operação Principal
> [!IMPORTANT]
> O envio de notificações deve ser **assíncrono e não-bloqueante** (`setImmediate` ou `Promise.allSettled`). Se o provedor de e-mail estiver fora do ar ou oscilar, a operação de governança ou PR **nunca deve falhar ou travar** a resposta da API do Context OS.

---

## 4. Critérios de Aceite da Fase 3
- [ ] Criar um PR que exige aprovações dispara evento no `NotificationService`.
- [ ] Aprovar um PR até atingir quorum dispara evento de sucesso.
- [ ] Falhas na rede ou no provedor de e-mail não impedem o salvamento do PR ou a execução da governança.
- [ ] Logs de auditoria (`governance_audit_log`) registram se a notificação foi despachada com sucesso.
