# Fase 02 — Rate Limiting para Operações Pesadas de Git e Streaming de IA

**Resolve:** Achado **S3** (Severidade Média / Proteção contra Negação de Serviço Local).  
**Prioridade:** P1.  
**Esforço:** Médio.  
**Arquivos Principais:**
- `server/src/security/rate-limit.ts`
- `server/src/app.ts`
- `server/src/security/app.hardening.test.ts`
- `server/src/security/app.security.test.ts`

---

## 1. Contexto e Diagnóstico

### 1.1 Exposição de Endpoints Volumosos do Git (S3.1)
Operações como clonagem de repositórios remotos (`/api/repos/clone`), sincronização pesada (`/api/git/push`, `/api/git/pull`) e operações de compressão de histórico consomem alta largura de banda e tempo considerável de CPU.
Atualmente, o hook `onRequest` em `server/src/app.ts` aplica rate limiting apenas em:
- `/api/auth/`
- `/api/skills/custom/execute`
- `/api/ai/`
- `/api/rag/`

Endpoints como `/api/repos/clone` e `/api/git/push` estão desprotegidos.

### 1.2 Streaming de Chat SSE Desprotegido (S3.2)
A rota `/api/chat/stream` mantém conexões HTTP abertas prolongadas (Server-Sent Events) enquanto o LLM ou processo do agente emite tokens. Múltiplas conexões paralelas disparadas por scripts ou loops do frontend podem esgotar descritores de arquivo ou a cota de provedores externos.

---

## 2. Passos de Execução

### 2.1 Expansão das Instâncias de Rate Limiter
1. Em `server/src/security/rate-limit.ts`, instanciar limitadores dedicados:
   ```typescript
   export const gitHeavyOpsRateLimiter = new RateLimiter(15, 60000); // 15 operações pesadas Git/min
   export const aiStreamRateLimiter = new RateLimiter(30, 60000);     // 30 conexões de stream SSE/min
   ```

### 2.2 Aplicação Centralizada no Hook `onRequest` em `app.ts`
1. Proteger rotas de Git que executam clones ou network requests:
   - Rotas que começam com `/api/repos/clone` ou requisições POST para `/api/git/push`, `/api/git/pull`, `/api/git/sync`.
2. Proteger a rota `/api/chat/stream` com `aiStreamRateLimiter`.
3. Retornar status HTTP `429 Too Many Requests` com cabeçalho `Retry-After` estruturado quando o limite for excedido.

---

## 3. Critérios de Aceite e Verificação

1. **Teste TDD RED:** Adicionar testes em `app.hardening.test.ts` que disparam rajadas de requisições para `/api/repos/clone` e `/api/chat/stream` verificando se o limite retorna HTTP 429.
2. **Teste TDD GREEN:** Todos os testes passam sem exceção.
3. Não há regressão em nenhuma suíte de teste existente.
