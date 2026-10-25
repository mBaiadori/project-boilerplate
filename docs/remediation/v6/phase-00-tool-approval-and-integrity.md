# Fase 00 — Eliminação de Bypass na Aprovação de Ferramentas e Integridade de Manifesto (A1)

**Objetivo:** Eliminar a vulnerabilidade de vazamento do hash de manifesto no endpoint de aprovação de ferramentas customizadas e implementar um fluxo de desafio de confirmação não-reutilizável com limite de tempo, garantindo que aprovações não possam ser forjadas por scripts automatizados ou XSS.  
**Resolve:** Achado **A1** (Severidade Alta).  
**Prioridade:** P0.  
**Esforço:** Médio.  
**Arquivos Principais:**
- `server/src/modules/skills/skills.routes.ts`
- `server/src/modules/skills/custom-tools.service.ts`
- `server/src/modules/skills/custom-tools.approval.test.ts` (Novo)
- `frontend/src/views/subviews/ai-center/components/CustomToolModal.tsx`

---

## 1. Contexto e Diagnóstico da Falha

No endpoint `POST /api/aicenter/custom-tools/:id/approve` em `server/src/modules/skills/skills.routes.ts`:

```typescript
// Código vulnerável atual:
if (!confirmHeader || confirmHeader !== currentHash) {
  return reply.status(409).send({
    error: 'Aprovação de ferramenta exige confirmação explícita via cabeçalho X-ContextOS-Confirm com o hash atual do manifesto.',
    required_hash: currentHash, // VAZAMENTO CRÍTICO!
    provided_hash: confirmHeader || null,
    tool_id: tool.id,
  });
}
```

### O que torna isso uma vulnerabilidade:
1. **Bypass Trivial em 2 Passos:** Qualquer script que tenha acesso à rede local ou código malicioso injetado via XSS pode enviar uma primeira requisição com `X-ContextOS-Confirm: dummy`, capturar o `required_hash` da resposta HTTP 409 e imediatamente reenviar a requisição com o cabeçalho correto, aprovando ferramentas arbitrárias com execução de código.
2. **Ausência de Desafio Unívoco / Nonce:** Não há validação de que a aprovação partiu de uma interação visual do usuário no frontend.
3. **Falsa Atribuição de Identidade:** O registro de auditoria assume `ui:${cfg.user.login}` sem verificar se houve clique explícito ou confirmação deliberada.

---

## 2. Passos de Execução

### 2.1 RED — Testes de Falha e Validação de Segurança
Criar `server/src/modules/skills/custom-tools.approval.test.ts`:
- **Teste 1:** Chamar `POST /api/aicenter/custom-tools/:id/approve` sem cabeçalho ou com hash incorreto deve retornar HTTP 409, mas **NÃO DEVE** conter os campos `required_hash` ou `provided_hash` no corpo JSON da resposta.
- **Teste 2:** Tentativa de aprovação direta sem um ticket de desafio gerado pela UI deve falhar com HTTP 403 Forbidden (`Desafio de confirmação ausente ou expirado`).
- **Teste 3:** Desafio emitido deve expirar em 60 segundos e permitir apenas um único consumo (proteção contra replay attack).
- **Teste 4:** Aprovação legítima com ticket válido e hash correto deve persistir a aprovação com sucesso e registrar a trilha no log de auditoria.

**Comando RED:**
```bash
cd server && npx tsx --test src/modules/skills/custom-tools.approval.test.ts
```

---

### 2.2 Implementação do Gerenciador de Desafios em `custom-tools.service.ts`
Adicionar um mecanismo seguro de desafio temporário em memória:

```typescript
interface ApprovalChallenge {
  toolId: string;
  expectedHash: string;
  expiresAt: number;
}

const activeChallenges = new Map<string, ApprovalChallenge>();

export function createApprovalChallenge(toolId: string, expectedHash: string): string {
  const challengeId = crypto.randomBytes(24).toString('hex');
  activeChallenges.set(challengeId, {
    toolId,
    expectedHash,
    expiresAt: Date.now() + 60_000, // 60 segundos de janela
  });
  return challengeId;
}

export function consumeApprovalChallenge(challengeId: string, toolId: string, providedHash: string): boolean {
  const challenge = activeChallenges.get(challengeId);
  if (!challenge) return false;
  
  // Limpeza imediata (single use)
  activeChallenges.delete(challengeId);

  if (Date.now() > challenge.expiresAt) return false;
  if (challenge.toolId !== toolId) return false;

  const bExpected = Buffer.from(challenge.expectedHash);
  const bProvided = Buffer.from(providedHash);
  if (bExpected.length !== bProvided.length) return false;

  return crypto.timingSafeEqual(bExpected, bProvided);
}
```

---

### 2.3 Refatoração das Rotas em `skills.routes.ts`

1. **Criar Rota de Emissão de Desafio:**
   `POST /api/aicenter/custom-tools/:id/request-approval`
   - Valida existência da ferramenta.
   - Gera um desafio associado ao hash atual do manifesto.
   - Retorna `{ challenge_id: string, expires_in_sec: 60 }` (sem expor o hash bruto).

2. **Refatorar Rota de Aprovação:**
   `POST /api/aicenter/custom-tools/:id/approve`
   - Exige o cabeçalho `X-ContextOS-Confirm: <hash>` e o cabeçalho `X-ContextOS-Challenge: <challenge_id>`.
   - Se o desafio for inválido ou o hash não coincidir, retorna HTTP 403 / 409 com mensagem genérica:
     ```json
     {
       "error": "Aprovação rejeitada: confirmação inválida, desafio expirado ou divergência no manifesto da ferramenta."
     }
     ```
   - **Remover terminantemente** qualquer vazamento de `required_hash` ou hashes parciais no payload de resposta.

---

### 2.4 Atualização no Frontend (`CustomToolModal.tsx`)
Ajustar o modal de ferramentas customizadas para seguir o novo fluxo em duas etapas:
1. Ao clicar em "Aprovar Ferramenta", o frontend solicita um ticket chamando `POST /api/aicenter/custom-tools/:id/request-approval`.
2. O frontend calcula o hash localmente ou utiliza o manifesto em tela com confirmação explícita do usuário em modal.
3. Dispara a aprovação final enviando os headers `X-ContextOS-Confirm` e `X-ContextOS-Challenge`.

---

## 3. Gate de Saída

- [ ] `custom-tools.approval.test.ts` passando com 100% de sucesso.
- [ ] Verificação estática confirmando ausência de `required_hash` em respostas da API de skills.
- [ ] `npm run verify` executando com sucesso.
