# Fase 2 — Sessão, cookie e CORS (S1 resíduos, C2, C12)

**Objetivo:** o token só chega a quem o app quer, expira de verdade e não vaza para outros serviços em `localhost`.
**Resolve:** S1 (resíduos), C2, C12, `parseCookies`, erro de CORS virando 500.
**Esforço:** médio. **Pré-requisitos:** Fase 0.
Arquivos: [app.ts](../../../server/src/app.ts) (CORS L53-78, hook L81-123, bootstrap L159-191), [session.ts](../../../server/src/security/session.ts), `app.security.test.ts`, `desktop/src/main/index.ts`, `desktop/src/preload/index.ts`, `frontend/src/services` (cliente HTTP).

## Contexto
Já resolvido na v4: Host ausente rejeitado, bootstrap exige mesma origem/Vite/desktop. Restam:
- Cookie `ctxos_session` sem `Max-Age`; cookies **não** isolam por porta, então o navegador o envia a qualquer app em `localhost`.
- Token em `~/.context-os/session-token` nunca rotaciona; mensagens falam em "expirada" (C2).
- Requisições sem `Origin` passam no bootstrap (qualquer processo local do usuário).
- `cb(new Error(...))` do CORS vira 500.
- `/health` e `/api/health` duplicados (C12); `parseCookies` perde valores com `=`.

## Passos

### 2.1 RED — testes (`app.security.test.ts`, estender)
- Bootstrap com `Origin: http://localhost:3000` → 403; `Origin: http://localhost:<porta do app>` → 200.
- Resposta do bootstrap **não** contém `Set-Cookie` persistente (ou contém `Max-Age` ≤ 8 h, conforme escolha em 2.2).
- Token expirado (relógio simulado) → 401 com mensagem "sessão expirada"; token novo funciona.
- Origin não permitida em rota normal → 403 JSON, **não** 500.
- Cookie `a=b=c` é lido como `b=c`.
- `GET /health` e `GET /api/health` respondem; só um deles listado na allowlist.

### 2.2 Implementação
- **Token em memória por boot:** gerar ao iniciar, TTL de 12 h com renovação deslizante; guardar em disco só se o desktop precisar (arquivo `0600`), apagando no encerramento. `isValidSessionToken` devolve motivo (`missing|invalid|expired`) para a mensagem coerente (C2).
- **Remover cookie** como forma de autenticação padrão: SPA usa `X-ContextOS-Token` guardado em memória (não `localStorage`). Se for mantido por conveniência do SSE (`EventSource` não envia header), use cookie com `Path=/api`, `HttpOnly`, `SameSite=Strict`, `Max-Age=28800` e **nome com prefixo** `__Host-` apenas se servir via HTTPS; documente a limitação em `localhost`.
- **Desktop:** entregar o token por `preload`/IPC e **desligar o bootstrap** quando `CONTEXT_OS_DESKTOP=1`. O Electron main define o header via `session.webRequest.onBeforeSendHeaders`.
- Bootstrap sem `Origin`: exigir também `Sec-Fetch-Site` ∈ {`same-origin`,`none`} quando presente; sem os dois cabeçalhos, só aceitar com `User-Agent` do Electron ou flag de dev. Documente que isso não impede processos locais maliciosos do mesmo usuário (modelo de ameaça, Fase 7).
- CORS: trocar `cb(new Error(...))` por `cb(null, false)` e responder 403 via `onRequest`; restringir portas a `[PORT, VITE_PORT]` vindas de config, não "qualquer porta".
- Unificar health: manter `/api/health` (público) e redirecionar `/health`.
- `parseCookies`: usar `indexOf('=')`.
**Verifica:** `cd server && npx tsx --test --test-timeout=60000 src/security/*.test.ts`.

### 2.3 Frontend
- Cliente HTTP renova o token ao receber 401 `expired` (uma tentativa) e mostra aviso de sessão.
- Revisar `EventSource`/SSE: precisa autenticar sem cookie persistente (token em query só para SSE, de uso único e curto, ou `fetch` streaming com header).

## Gate de saída
- [ ] Testes de 2.1 verdes.
- [ ] Nenhum cookie persistente sem `Max-Age`; token expira (teste com relógio).
- [ ] Desktop funciona sem chamar `/api/session/bootstrap`.
- [ ] Origin externa recebe 403, não 500.
- [ ] `grep -n "/health" server/src/app.ts` mostra uma só rota canônica.
