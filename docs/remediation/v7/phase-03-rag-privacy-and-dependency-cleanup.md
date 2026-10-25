# Fase 03 — Privacidade LGPD em RAG e Limpeza de Dependências Inativas

**Resolve:** Achado **S4** (Severidade Média / Baixa).  
**Prioridade:** P1 / P2.  
**Esforço:** Pequeno.  
**Arquivos Principais:**
- `server/src/modules/rag/rag.service.ts`
- `server/src/modules/rag/rag.indexer.ts`
- `server/package.json`
- `server/src/security/phase07.privacy.test.ts`

---

## 1. Contexto e Diagnóstico

### 1.1 Consulta de Privacidade LGPD no RAG (S4.1)
O serviço de IA [ai.service.ts](file:///Users/MarcosBaiadori/Desktop/project-boilerplate/server/src/modules/ai/ai.service.ts) já invoca `checkAiPolicy` para impedir o envio de documentos com classificação `confidential` para provedores em nuvem.
No entanto, no pipeline do indexador semântico RAG ([rag.indexer.ts](file:///Users/MarcosBaiadori/Desktop/project-boilerplate/server/src/modules/rag/rag.indexer.ts) / [rag.service.ts](file:///Users/MarcosBaiadori/Desktop/project-boilerplate/server/src/modules/rag/rag.service.ts)), documentos confidenciais podem ser fragmentados e enviados para o serviço de geração de embeddings externos caso a política não seja checada antes da indexação.

### 1.2 Dependência `@fastify/rate-limit` Inativa (S4.2)
O arquivo `server/package.json` possui a dependência `@fastify/rate-limit`, mas o projeto adotou um rate limiter leve em memória (`server/src/security/rate-limit.ts`). Essa dependência constitui código morto no `node_modules` e superfície desnecessária em auditorias.

---

## 2. Passos de Execução

### 2.1 Integração de `checkAiPolicy` no Pipeline de Indexação RAG
1. Em `server/src/modules/rag/rag.service.ts` (ou `rag.indexer.ts`), antes de enviar pedaços de texto para a API de embeddings externa:
   - Checar se o documento em questão possui classificação `confidential` ou política `deny` via `checkAiPolicy`.
   - Se proibido, ignorar o arquivo na indexação externa e emitir log informativo de privacidade.

### 2.2 Desinstalação de `@fastify/rate-limit`
1. Remover `@fastify/rate-limit` de `server/package.json`.
2. Executar `npm install` em `server/` para sincronizar `package-lock.json`.
3. Validar com `npm audit --omit=dev`.

---

## 3. Critérios de Aceite e Verificação

1. **Teste TDD RED/GREEN:** Em `phase07.privacy.test.ts`, validar que documentos com classificação `confidential` são excluídos da indexação de embeddings externos.
2. `npm test` no servidor permanece 100% verde.
3. `npm run verify` executa sem erros em todos os 6 passos.
