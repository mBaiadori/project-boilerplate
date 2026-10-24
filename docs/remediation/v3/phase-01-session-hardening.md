# Fase 1 — Endurecer sessão e superfície da API (S1, S5)

**Objetivo:** só o frontend/Electron legítimo obtém o token; nenhum app local em outra porta consegue lê-lo; rotas de teste não existem em produção.
**Resolve:** S1, S5, C2 (mensagem "expirada"), C3 (comentário de Host).
**Esforço:** médio. **Pré-requisitos:** Fase 0.
Arquivos: [app.ts](../../server/src/app.ts), [session.ts](../../server/src/security/session.ts), [app.security.test.ts](../../server/src/security/app.security.test.ts), `desktop/src`.

## Decisões a confirmar com você

1. **Bootstrap na web:** proposta = exigir `Origin` igual à origem do próprio servidor (porta incluída) **ou** `Sec-Fetch-Site: same-origin`. Sem `Origin` (curl) → recusar; automação usa o arquivo `~/.context-os/session-token`.
2. **Bootstrap no desktop:** proposta = desligar o endpoint e entregar o token por IPC/preload. Alternativa: manter, mas só com `Origin: app://`.
3. **Vida do token:** proposta = novo token por boot e TTL de 12 h com renovação silenciosa. Alternativa: manter persistência e só renomear a mensagem de erro.

## Passos

### 1.1 RED — testes (`app.security.test.ts`)

- `GET /api/session/bootstrap` com `Origin: http://localhost:3000` (porta diferente da do app) → 403.
- Idem com `Origin: http://127.0.0.1:9999` → 403.
- Idem sem `Origin` e sem `Sec-Fetch-Site` → 403.
- `Host` ausente → 400/403 (HTTP/1.1 exige Host).
- Token do boot anterior após reinício (se decisão 3 = rotacionar) → 401.
- Com `NODE_ENV=production`, `GET /api/test-leak-error` → 404.
  **Verifica:** hoje os testes falham.

### 1.2 Implementação

- `session.ts`: `isValidHostHeader` retorna `false` sem Host; remover o comentário "via IPC".
- `app.ts`: guarda de `Origin` no bootstrap; `Set-Cookie` com `Secure` quando houver HTTPS e `Path=/api`.
- `app.ts`: registrar `/api/test-leak-error` só quando `NODE_ENV === 'test'` (ou mover para o próprio teste via `app.register` local).
- Token: rotação por boot e TTL conforme decisão 3; mensagem de erro coerente (C2).
- Desktop: entregar token via preload e remover dependência do bootstrap (decisão 2).

### 1.3 Integração

- `frontend/src/services/api/client.ts`: tratar 401 com uma nova chamada a bootstrap, uma vez, sem loop.
- README: como obter o token para `curl`.
  **Verifica:** `cd server && npx tsc --noEmit && npm test`; abrir app web e desktop (você valida); `curl` sem token → 401.

## Gate de saída

- [ ] Testes de 1.1 verdes.
- [ ] `grep -n "test-leak-error" server/src/app.ts` só dentro de condição de teste.
- [ ] App web e desktop carregam e o SSE conecta.
- [ ] README documenta o token de automação.
