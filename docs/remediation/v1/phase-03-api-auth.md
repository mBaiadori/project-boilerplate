# Fase 3 — Autenticação local da API (N3)

**Objetivo:** só o frontend/Electron do próprio usuário consegue chamar a API; DNS rebinding e processos locais arbitrários deixam de funcionar.
**Resolve:** N3, SSE sem auth, parte de N7 (rate limit em auth).
**Esforço:** médio. **Pré-requisitos:** Fase 0.

## Decisões a confirmar com você
1. **Transporte do token:** proposta = cookie `ctxos_session` (`HttpOnly`, `SameSite=Strict`) emitido pelo próprio servidor ao servir o frontend e aceito também no header `X-ContextOS-Token`. Cookie porque o `EventSource` do SSE não manda headers.
2. **Desenvolvimento (Vite :5173):** proxy do Vite repassa `/api` para o servidor; o primeiro `GET /api/session/bootstrap` (mesma origem pelo proxy) define o cookie.
3. **Electron:** o processo main gera/recebe o token e o injeta com `session.webRequest.onBeforeSendHeaders` para `http://127.0.0.1:<porta>/*`.
4. **cURL/automação:** exige o token (arquivo `~/.context-os/session-token` com permissão 600). Isso encerra o "sem Origin = permitido".

## Passos

### 3.1 RED — testes (`app.security.test.ts`, usando `buildApp()` + `inject`)
- Requisição sem token a qualquer rota `/api/*` (exceto bootstrap/health) → 401.
- Token errado → 401; token correto → 200.
- `Host: evil.example.com` com token válido → 403 (anti-rebinding).
- `Origin: https://evil.example` → bloqueado (mantém o comportamento atual).
- SSE `/api/events` sem cookie → 401.
- 20 tentativas em `/api/auth/token` em 1 minuto → 429.
- Teste de cobertura de rotas: percorrer `app.printRoutes`/`onRoute` e garantir que **toda** rota está protegida, salvo uma allowlist explícita.
**Verifica:** hoje os testes falham.

### 3.2 Implementação
- `server/src/security/session.ts`: gerar token `crypto.randomBytes(32)`; comparar com `timingSafeEqual`.
- Hook global `onRequest`: valida `Host` (`localhost`, `127.0.0.1`, `[::1]` + porta) e depois o token. Allowlist: `/api/session/bootstrap`, `/api/health`, arquivos estáticos do frontend.
- Registrar `@fastify/rate-limit` (global generoso; restrito em `/api/auth/*`, `/api/aicenter/tools/execute`).
- Opcional: `@fastify/helmet` com CSP compatível com o frontend (testar com o build).
- Remover `allowedHeaders: Authorization` se não for mais usado; manter CORS restrito.

### 3.3 Integração
- Frontend: `services/api/client.ts` com `credentials: 'include'`; tratar 401 recarregando a sessão.
- Electron (`desktop/src/main/index.ts`): injeção do token (decisão 3).
- Script `dev`: documentar o proxy.
**Verifica:** `npm run verify`; subir `npm run dev` e abrir a app (você valida visualmente que carrega); `curl http://127.0.0.1:4100/api/auth/status` sem token → 401; com token → 200.

## Gate de saída
- [ ] `app.security.test.ts` verde, incluindo o teste de "todas as rotas protegidas".
- [ ] `npm run verify` verde.
- [ ] Manual: app web e app desktop funcionam; SSE conecta; `curl` sem token falha.
- [ ] Documentado no README como obter o token para automação.
