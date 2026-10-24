# Fase 4 — Hardening geral do servidor (S6)

**Objetivo:** reduzir vazamento de informação, abuso de recursos e ruído de logs.
**Resolve:** S6 (rate limit, helmet/CSP, SSE, `err.message`, `console.*`, `execFileSync`), SSE sem limite.
**Esforço:** médio. **Pré-requisitos:** Fase 1.

## Passos

### 4.1 RED — testes
- 21ª requisição/min a `/api/auth/*` e a `/api/aicenter/tools/execute` → 429.
- Resposta 4xx de rota com erro interno contendo `/Users/...` ou `node_modules` → mensagem sanitizada.
- 11º cliente SSE simultâneo em `/api/events` → 429/503.
- Resposta da SPA inclui `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`.

### 4.2 Implementação
- `@fastify/rate-limit`: global generoso, restrito nas rotas sensíveis.
- `@fastify/helmet`: CSP compatível com o build do Vite (testar `npm run build` + abrir a app).
- `events.service.ts`: limite de clientes e heartbeat com limpeza de conexões mortas.
- Helper `httpError(status, publicMessage, cause)`; substituir `err.message` em respostas (169 pontos) por mensagem pública + `requestId`; detalhe só no log. Fazer por módulo, com guard `err_message_in_reply` em `guards.mjs` (baseline só desce).
- `console.*` (124) → `request.log`/logger pino com `redact` para `authorization`, `cookie`, `api_key`, `token`.
- `crypto.ts`: trocar `execFileSync` por `execFile` assíncrono e gravar em diretório 0o700.
- Shutdown: aguardar `app.close()` e escritas pendentes antes de `process.exit` (hoje 250 ms fixos).

**Verifica:** `cd server && npx tsc --noEmit && npm test && node ../scripts/guards.mjs`.

## Gate de saída
- [ ] Testes de 4.1 verdes.
- [ ] Guards `err_message_in_reply` e `console_server` com baseline menor que o atual (169 / 124).
- [ ] App continua carregando com CSP ativo (você valida).
- [ ] Logs de uma sessão real não contêm token nem `api_key`.
