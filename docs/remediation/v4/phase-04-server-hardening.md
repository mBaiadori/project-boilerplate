# Fase 4 — Endurecimento do servidor e persistência (S6, C13)

**Objetivo:** cabeçalhos de segurança, limite de requisições, erros sem vazamento e escrita atômica de estado.
**Resolve:** S6 (servidor), persistência, `crypto.ts` síncrono, logger.
**Esforço:** médio. **Pré-requisitos:** Fase 2 (hook de auth estável).
Arquivos: [app.ts](../../../server/src/app.ts) (handler de erro L126-149), `server/package.json`, `server/src/utils/atomic-write.ts`, [crypto.ts](../../../server/src/utils/crypto.ts), `workspace_changes.json` e `docs-metadata.service.ts`, `events.service.ts`.

## Passos

### 4.1 RED — testes (`app.hardening.test.ts`)
- Resposta de qualquer rota contém `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY` e `Content-Security-Policy` com `default-src 'self'`.
- 200 requisições em 10 s a `/api/session/bootstrap` e a rotas de aprovação → 429 após o limite.
- Erro 400/404/500 vindo de serviço com `stderr` do git contendo `/Users/x/...` → resposta sem caminho absoluto e com `requestId`.
- Query string com `?api_key=` não aparece no log (capturar o stream do logger).
- Escrita concorrente (20 `saveX()` paralelos) em cada JSON de estado nunca deixa arquivo inválido.

### 4.2 Implementação
- **`@fastify/helmet`** com CSP compatível com a SPA (Vite gera `script` próprio; sem `unsafe-inline` em `script-src`; `style-src 'self' 'unsafe-inline'` só se inevitável e documentado). Em dev, relaxar apenas `connect-src` para o Vite.
- **`@fastify/rate-limit`**: global 300/min por IP local; bootstrap e aprovação 5/min; IA e clone mais baixo.
- **Handler global de erro (S6/C13):** para qualquer `statusCode < 500` devolver `error.message` só se o erro for do tipo `AppError` (novo, com mensagem segura); caso contrário mensagem genérica + `requestId`. Aplicar a mascaração de caminhos a **todas** as respostas, não só 500. Criar `redactPaths(text)` central (`/Users/`, `/home/`, `C:\`, `node_modules`, tmp).
- **Migração de `err.message` (169 pontos):** guard `err_message_in_reply` com baseline atual, só pode descer; trocar primeiro as rotas de Git/Repos/Skills.
- **Logger:** produção usa `pino` com `redact: ['req.headers.authorization','req.headers.cookie','req.headers["x-contextos-token"]','req.query.api_key']` e `serializers.req` sem query string. Substituir `console.*` (124) por `app.log`/logger do módulo; guard `console_server` com baseline.
- **Persistência atômica:** `tool-approvals.json`, `workspace_changes.json`, metadados `.docs.metadata.json`, templates → `writeJsonAtomic`. Serializar escritas por arquivo com fila (mutex simples) para não competir com `chokidar`.
- **`crypto.ts`:** trocar `execFileSync` por `execFile` assíncrono (ou `safeStorage` do Electron quando disponível, já usado em `desktop/src/main/index.ts`).
- **SSE:** manter `maxClients = 30`; adicionar heartbeat e limite por IP/token; fechar clientes ao rotacionar token.
**Verifica:** `cd server && npx tsc --noEmit && npm test && node ../scripts/guards.mjs`.

### 4.3 Dependências
- `npm i @fastify/helmet @fastify/rate-limit` no servidor; `npm audit --omit=dev` continua 0.

## Gate de saída
- [ ] Testes de 4.1 verdes.
- [ ] `grep -rn "writeFileSync" server/src/modules` só em arquivos que não são estado (documentar exceções).
- [ ] Guards `err_message_in_reply` e `console_server` criados e verdes, com baseline menor que 169/124.
- [ ] Sem `execFileSync` em `crypto.ts`.
- [ ] Cabeçalhos presentes em `curl -I http://localhost:4100/`.
