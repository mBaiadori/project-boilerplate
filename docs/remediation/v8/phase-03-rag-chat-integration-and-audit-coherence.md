# Fase 03 — Conexão do RAG Semântico ao Chat, Unificação da Auditoria Criptográfica e Taxonomias Dinâmicas

**Resolve:** Achados **INC-02 / EVO-01** (RAG desconectado do chat de IA e sobrecarga de tokens no frontend), **INC-01** (Incoerência entre o `THREAT_MODEL.md` e os chamadores reais da cadeia de auditoria SHA-256) e **INC-03** (Violação da regra de taxonomias dinâmicas e cores em nós do explorador).  
**Prioridade:** P1.  
**Esforço:** Médio.  
**Arquivos Principais:**
- `server/src/modules/ai/ai.routes.ts`
- `server/src/modules/rag/rag.service.ts`
- `server/src/modules/prs/prs.service.ts`
- `server/src/modules/git/git.service.ts`
- `server/src/modules/audit/audit-chain.service.ts`
- `frontend/src/context/AIContext.tsx`
- `frontend/src/components/explorer/FileTreeNode.tsx`

---

## 1. Contexto e Diagnóstico

### 1.1 RAG Implementado com BM25 mas Desconectado do Chat de IA (INC-02 / EVO-01)
Em `server/src/modules/ai/ai.routes.ts`, `ragService` é importado na linha 8, mas não é invocado em nenhum momento nos endpoints `/api/chat` ou `/api/chat/stream`. Por outro lado, em `frontend/src/context/AIContext.tsx:482-535`, quando o usuário inclui uma pasta no contexto, o frontend faz dezenas de chamadas HTTP sequenciais via `API.getProjectFile(f)`, baixa os arquivos completos e envia tudo no corpo da requisição.
**Problema:** O Context OS possui um indexador semântico robusto baseado em BM25, TF-IDF e conformidade LGPD, mas ele fica ocioso durante o chat. O envio de arquivos inteiros pelo frontend consome dezenas de milhares de tokens desnecessários e adiciona mais de 10 segundos de latência à resposta.

### 1.2 Incoerência na Auditoria Criptográfica do `THREAT_MODEL.md` (INC-01)
O `THREAT_MODEL.md` documenta que aprovações de PR, envios Git (`git push`) e reversões (`rollback`) são registrados na cadeia SHA-256 encadeada (`audit-chain.jsonl`).
**Problema:** No código real, a função `recordAuditEvent` é invocada exclusivamente em `server/src/modules/ai/ai.service.ts:185`. Quando um usuário aprova um pull request em `prs.service.ts`, faz push em `git.service.ts` ou executa um rollback, a cadeia de blocos de auditoria não recebe o evento, quebrando a integridade de rastreabilidade prometida.

### 1.3 Classes e Cores Hardcoded em `FileTreeNode.tsx` (INC-03)
Em `frontend/src/components/explorer/FileTreeNode.tsx:317-322`:
```typescript
const dotClass =
  node.name.includes("kpi") || node.path.includes("kpi")
    ? "dot-t0"
    : node.name.includes("ideacao") || node.path.includes("ideacao")
      ? "dot-t1"
      : "dot-t2";
```
**Problema:** Violação direta da regra obrigatória do workspace (`.agents/AGENTS.md`), que proíbe categorizações estáticas e exige consumo dinâmico das cores (`color`) definidas em `.project.config.json` via `WorkspaceContext`.

---

## 2. Passos de Execução

### 2.1 Injeção Inteligente de Trechos RAG no Prompt do Chat
1. Em `server/src/modules/ai/ai.routes.ts`:
   - No processamento do `/api/chat` e `/api/chat/stream`, se o usuário não estiver em modo RAW e fizer uma consulta, invocar `ragService.buildContextPrompt(prompt, repoName, 3)`.
   - Concatenar o bloco de referências RAG recuperadas ao contexto do sistema ou ao briefing do agente.
2. Em `frontend/src/context/AIContext.tsx`:
   - Ao referenciar pastas inteiras, enviar apenas os identificadores das pastas ou deixar que o RAG no backend localize os chunks mais relevantes, evitando o download sequencial de dezenas de arquivos no navegador.

### 2.2 Unificação da Trilha de Auditoria Criptográfica
1. Em `server/src/modules/prs/prs.service.ts`:
   - Importar `recordAuditEvent` de `../audit/audit-chain.service.js`.
   - No método de aprovação (`approvePR`), merge (`mergePR`) e rejeição/fechamento (`closePR`), registrar um evento na cadeia com a ação correspondente, autor, hash do PR e timestamp.
2. Em `server/src/modules/git/git.service.ts`:
   - Registrar evento de auditoria ao concluir `sync`/`push` com sucesso.

### 2.3 Taxonomias Dinâmicas e Cores no FileTree
1. Em `frontend/src/components/explorer/FileTreeNode.tsx`:
   - Remover as regras estáticas baseadas em `"kpi"` e `"ideacao"`.
   - Recuperar os metadados do documento (`metaList`) e a cor configurada para sua categoria/tag no `.project.config.json`.
   - Aplicar a cor inline no dot visual (`backgroundColor: metaColor || 'var(--color-outline)'`).

---

## 3. Critérios de Aceite e Verificação

1. **Testes TDD RED:**
   - Criar teste em `server/src/modules/audit/audit-concurrency.test.ts` validando que aprovações de PR e merges geram blocos válidos na cadeia `audit-chain.jsonl`.
   - Criar teste em `server/src/modules/rag/rag.test.ts` comprovando que `buildContextPrompt` é consumido e injeta referências formatadas com score de relevância.
2. **Validação Global:** `bash scripts/verify.sh` retornando código de saída 0 com 100% de sucesso.
