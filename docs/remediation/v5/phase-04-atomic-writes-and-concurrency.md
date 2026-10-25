# Fase 4 — Atomicidade de Gravações, Concorrência de Auditoria e Timeouts Git (B7, C16, REL-01, REL-02)

**Objetivo:** Eliminar riscos de arquivos corrompidos ou truncados durante quedas de processo, proteger a cadeia de auditoria criptográfica contra corridas concorrentes assíncronas e garantir timeout determinístico em operações com progresso do Git.  
**Resolve:** B7 (Escritas JSON não atômicas em RAG e Dicionário), C16 (`saveWikiPage` sem `recordChange`), REL-01 (Condição de corrida concorrente na trilha de auditoria), REL-02 (Falta de timeout em `executeGitCommandWithProgress`).  
**Prioridade:** P2.  
**Esforço:** Médio.  
**Arquivos Principais:**
- `server/src/modules/rag/rag.indexer.ts`
- `server/src/modules/dictionary/dictionary.service.ts`
- `server/src/modules/wiki/wiki.service.ts`
- `server/src/modules/audit/audit-chain.service.ts`
- `server/src/utils/git-core.ts`
- `server/src/modules/audit/audit-concurrency.test.ts` (Novo)

---

## Contexto e Diagnóstico

1. **Risco de Corrupção em Falhas Abruptas (B7):** Em `rag.indexer.ts` e `dictionary.service.ts`, `fs.writeFileSync` gravava diretamente sobre o arquivo de destino. Caso o processo do servidor fosse interrompido no meio do I/O, o arquivo `.dictionary.json` ou `rag-index.json` era truncado a zero bytes.
2. **Wiki Desconectado dos Rascunhos (C16):** Em `wiki.service.ts`, `saveWikiPage` salvava a página no disco sem chamar `recordChange`. Com isso, alterações em notas e ADRs não geravam rascunhos visuais na barra de pendências da interface.
3. **Quebra Concorrente da Cadeia SHA-256 (REL-01):** Em `audit-chain.service.ts`, `recordAuditEvent` lê a última linha de `audit-chain.jsonl`, extrai o hash anterior e appenda a nova linha. Se duas chamadas simultâneas ocorrerem, ambas leem o mesmo `prevHash` e o mesmo `index`, quebrando a validação da cadeia em `verifyAuditChain`.
4. **Git Hang Sem Timeout (REL-02):** Em `git-core.ts`, `executeGitCommandWithProgress` utilizava `spawn("git", ...)` sem passar `timeout`, arriscando congelamento permanente em bloqueios de rede.

---

## Passos de Execução

### 4.1 RED — Teste de Gravação Concorrente na Cadeia de Auditoria
Criar teste em `server/src/modules/audit/audit-concurrency.test.ts`:
- Disparar 20 chamadas simultâneas com `Promise.all`:
  ```typescript
  await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      recordAuditEvent(tmpRepo, {
        eventType: 'CONCURRENT_TEST',
        user: `user_${i}`,
        payload: { item: i },
      })
    )
  );
  ```
- Executar `verifyAuditChain(tmpRepo)`:
  - Deve retornar `valid: true`.
  - `totalEntries` deve ser exatamente 20.
  - Nenhum índice repetido ou `brokenIndex` detectado.
- Antes da fila sequencial, este teste falha aleatoriamente devido a colisões de `prevHash`.

---

### 4.2 Mutex Sequencial em `audit-chain.service.ts`
Implementar fila encadeada de Promises para serializar escritas concorrentes no mesmo projeto:
```typescript
// server/src/modules/audit/audit-chain.service.ts
const writeQueues = new Map<string, Promise<unknown>>();

export async function recordAuditEvent(
  projectRootOrName: string,
  input: RecordAuditEventInput
): Promise<AuditRecord> {
  const key = projectRootOrName || 'local';
  const currentQueue = writeQueues.get(key) || Promise.resolve();

  const nextOperation = currentQueue.then(async () => {
    return internalRecordAuditEvent(projectRootOrName, input);
  });

  // Atualiza a fila segurando o encadeamento
  writeQueues.set(key, nextOperation.catch(() => {}));
  return nextOperation;
}
```

---

### 4.3 Migração para `writeJsonAtomic` e `writeTextAtomic`
1. Em `server/src/modules/rag/rag.indexer.ts`:
   ```typescript
   import { writeJsonAtomic } from '../../utils/atomic-write.js';
   // ...
   saveDiskIndex(repoName: string, data: RagDiskStorage): void {
     const indexPath = this.getDiskIndexPath(repoName);
     writeJsonAtomic(indexPath, data, 2);
   }
   ```
2. Em `server/src/modules/dictionary/dictionary.service.ts`:
   ```typescript
   writeJsonAtomic(dictPath, data, 2);
   ```
3. Em `server/src/modules/wiki/wiki.service.ts`:
   - Gravar notas com `writeTextAtomic(fullPath, finalContent)`.
   - Adicionar chamada de auditoria e rascunho:
     ```typescript
     recordChange(repoName, `.spec-memory/wiki/${cleanCat}/${cleanSlug}.md`, changeType, oldContent, finalContent);
     ```

---

### 4.4 Adição de Timeout em `executeGitCommandWithProgress`
Em `server/src/utils/git-core.ts`:
- Adicionar opção `timeoutMs?: number` (padrão: 60.000 ms).
- Instanciar `setTimeout` que emite `child.kill('SIGTERM')` e resolve com erro de timeout descritivo caso a execução exceda o tempo limite.

---

## Gate de Saída

- [ ] Suíte de concorrência `audit-concurrency.test.ts` passa com 20/20 gravações perfeitas e cadeia 100% íntegra.
- [ ] Gravação de dicionário e RAG comprovadamente geram arquivos atômicos temporários com `fsync`.
- [ ] Notas criadas no Wiki aparecem na lista de rascunhos pendentes do projeto.
- [ ] `npm test` do servidor verde.
