# Fase 04 — Coerência de Sessão, Limpeza de Rotas de Teste e Rate Limiting Expandido (M6, M7, M8)

**Objetivo:** Alinhar o tempo de vida (TTL) do cookie de sessão local com o backend, remover rotas de teste expostas no código do servidor em produção e implementar proteção contra esgotamento de recursos em endpoints computacionalmente custosos (IA, RAG e Git).  
**Resolve:** Achados **M6**, **M7** e **M8** (Severidade Média).  
**Prioridade:** P2.  
**Esforço:** Médio.  
**Arquivos Principais:**
- `server/src/app.ts`
- `server/src/security/session.ts`
- `server/src/security/rate-limit.ts`
- `server/src/security/app.security.test.ts`
- `server/src/security/app.hardening.test.ts`

---

## 1. Contexto e Diagnóstico

### 1.1 Incoerência de TTL no Cookie de Sessão (M6)
No arquivo `server/src/security/session.ts`, o TTL da sessão é definido como 12 horas (`12 * 60 * 60 * 1000 = 43.200.000 ms`).  
Porém, no endpoint de bootstrap em `server/src/app.ts`:
```typescript
reply.header(
  "Set-Cookie",
  `ctxos_session=${token}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=28800`
);
```
O valor `Max-Age=28800` equivale a **8 horas**. O cookie expira no navegador 4 horas antes de a sessão do servidor expirar, forçando deslogamentos prematuros ou comportamentos inconsistentes na interface web.

### 1.2 Rota de Teste em Código do Servidor (M8)
Em `server/src/app.ts`:
```typescript
if (process.env.NODE_ENV !== 'production') {
  app.get('/api/test-leak-error', async () => {
    throw new Error('Falha catastrófica em /Users/MarcosBaiadori/secrets/key.pem');
  });
}
```
Se a aplicação for iniciada sem que a variável de ambiente `NODE_ENV` esteja expressamente definida como `'production'` (como ao rodar scripts de inicialização padrão ou containers de teste), a rota de teste permanece acessível. Rotas de teste devem residir estritamente nos arquivos de suíte de testes (`.test.ts`), nunca no código-fonte principal do servidor.

### 1.3 Endpoints Críticos sem Rate Limiting (M7)
A dependência `@fastify/rate-limit` consta no `package.json`, mas não está sendo utilizada. O limitador customizado em memória cobre apenas `auth` e `custom tool execute`.  
Rotas pesadas e que consomem tokens ou recursos intensivos do host — como `/api/ai/chat`, `/api/ai/generate`, `/api/rag/search` e comandos de clone do Git — estão desprotegidas contra loops infinitos de requisição do frontend ou automações descontroladas.

---

## 2. Passos de Execução

### 2.1 Alinhamento do Cookie em `app.ts` e Constante Canônica
1. Exportar a constante de TTL em segundos em `session.ts`:
   ```typescript
   export const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas
   export const SESSION_TTL_SEC = SESSION_TTL_MS / 1000; // 43.200 segundos
   ```
2. Em `app.ts`, utilizar a constante para o cabeçalho `Set-Cookie`:
   ```typescript
   reply.header(
     "Set-Cookie",
     `ctxos_session=${token}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_SEC}`
   );
   ```

---

### 2.2 Remoção da Rota `/api/test-leak-error` de `app.ts`
1. Excluir a rota `/api/test-leak-error` de `server/src/app.ts`.
2. No arquivo de teste `server/src/security/app.hardening.test.ts`, registrar dinamicamente a rota na instância do Fastify antes de invocar `inject()`:
   ```typescript
   const app = await buildApp();
   app.get('/api/test-leak-error', async () => {
     throw new Error('Falha catastrófica em /Users/MarcosBaiadori/secrets/key.pem');
   });
   ```
   Dessa forma, os testes continuam garantindo a sanitização e redação de caminhos pelo error handler sem poluir a aplicação de produção.

---

### 2.3 Expansão do Rate Limiting para Endpoints Custosos
Em `server/src/security/rate-limit.ts` e `server/src/app.ts`:
1. Definir baldes apropriados para operações intensivas:
   - `aiRateLimiter`: 60 requisições / minuto para chamadas de IA.
   - `gitHeavyOpsRateLimiter`: 20 requisições / minuto para clones e pulls massivos.
   - `ragRateLimiter`: 60 requisições / minuto para indexação e consultas semânticas.
2. Aplicar as checagens no hook `onRequest` em `app.ts` para os caminhos `/api/ai/`, `/api/rag/` e rotas pesadas de sincronização do Git.

---

## 3. Gate de Saída

- [ ] Cookie emitido com `Max-Age=43200` verificado em teste unitário.
- [ ] Rota `/api/test-leak-error` ausente do código de produção e confirmada por teste de 404 em `app.security.test.ts`.
- [ ] Testes de rate limiting passando com retorno de status HTTP 429 e cabeçalho `Retry-After`.
- [ ] `npm run verify` executando com sucesso.
