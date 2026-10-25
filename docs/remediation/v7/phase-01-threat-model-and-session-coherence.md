# Fase 01 — Sincronização do Threat Model e Coerência de Sessão

**Resolve:** Achado **S2** (Severidade Média / Integridade de Especificação).  
**Prioridade:** P0.  
**Esforço:** Pequeno.  
**Arquivos Principais:**
- `docs/THREAT_MODEL.md`
- `server/src/security/app.security.test.ts`
- `README.md` (seções de segurança)

---

## 1. Contexto e Diagnóstico

### 1.1 Incoerência de TTL na Documentação Canônica (S2.1)
O documento canônico [docs/THREAT_MODEL.md](../../THREAT_MODEL.md) ainda especifica:
> *"Cookies de Sessão: O cookie `ctxos_session` utiliza `Path=/api`, `HttpOnly`, `SameSite=Strict` e tempo de expiração de 8 horas (`Max-Age=28800`)."*

Contudo, na Fase 04 do plano v6, a constante canônica de sessão em [session.ts](file:///Users/MarcosBaiadori/Desktop/project-boilerplate/server/src/security/session.ts) foi definida como:
```typescript
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas
export const SESSION_TTL_SEC = SESSION_TTL_MS / 1000; // 43.200 segundos
```
E o cookie emitido em [app.ts](file:///Users/MarcosBaiadori/Desktop/project-boilerplate/server/src/app.ts) passou a utilizar `${SESSION_TTL_SEC}` (43.200s).

### 1.2 Asserção Frágil em Teste de Segurança (S2.2)
No arquivo [app.security.test.ts](file:///Users/MarcosBaiadori/Desktop/project-boilerplate/server/src/security/app.security.test.ts), o teste `2.2` verificava `Max-Age<=28800`. Com a mudança para 12 horas, essa asserção precisa validar estritamente a constante exportada `SESSION_TTL_SEC` (43200), garantindo alinhamento exato entre código, testes e documentação de conformidade.

---

## 2. Passos de Execução

### 2.1 Atualização de `THREAT_MODEL.md`
1. Atualizar a Seção 6.2 ("Proteção contra Ataques Baseados em Navegador"):
   - Atualizar tempo de expiração de 8 horas para **12 horas (`Max-Age=43200`)** com renovação deslizante (*sliding window*).
2. Atualizar diagramas ou notas sobre TTL em [README.md](../../README.md) se aplicável.

### 2.2 Sincronização de Testes Automatizados
1. Em `app.security.test.ts`, importar `SESSION_TTL_SEC` de `session.js`.
2. Validar que o cabeçalho `set-cookie` emitido contém exatamente `Max-Age=43200` (ou `Max-Age=${SESSION_TTL_SEC}`).

---

## 3. Critérios de Aceite e Verificação

1. `grep -rn "28800" docs/` não deve retornar referências obsoletas ao TTL de 8 horas.
2. `server/src/security/app.security.test.ts` passa com 100% de sucesso testando a coerência exata com `SESSION_TTL_SEC`.
3. `npm test` no servidor permanece verde.
