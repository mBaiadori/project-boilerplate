# Fase 6 — Desacoplamento de Estado e Modularização do WorkspaceContext (ARCH-01)

**Objetivo:** Desmembrar o monólito `WorkspaceContext.tsx` (2.031 linhas, 50+ propriedades, 96 conexões ativas) em stores de domínio isoladas, eliminando renderizações globais desnecessárias e acelerando a responsividade do editor.  
**Resolve:** ARCH-01 (Acoplamento extremo e gargalo de renderização no React).  
**Prioridade:** P3.  
**Esforço:** Grande.  
**Arquivos Principais:**
- `frontend/src/context/WorkspaceContext.tsx`
- `frontend/src/stores/editorStore.ts` (Novo)
- `frontend/src/stores/repoStore.ts` (Novo)
- `frontend/src/stores/gitStore.ts` (Novo)
- `frontend/src/stores/governanceStore.ts` (Novo)
- `frontend/src/components/editor/NotionEditor.tsx`

---

## Contexto e Diagnóstico

O grafo de código do repositório (gerado via Graphify) identificou o `WorkspaceContext` como o segundo nó de maior acoplamento do sistema (atrás apenas do próprio `react`), com **96 arestas de dependência direta**.
- **O Gargalo:** Sempre que o usuário digita um caractere no `NotionEditor`, a função `setFileContent` atualiza o estado de `WorkspaceContext`. Como dezenas de componentes secundários (cabeçalhos, badges, contadores de pendências, barras laterais) consomem `useWorkspace()`, toda a árvore é reavaliada pelo React a cada pulso de digitação.
- **A Solução:** Padrão de Fachada com Stores Granulares. Em vez de quebrar de uma só vez as 96 chamadas, criaremos stores isoladas por domínio utilizando Zustand (ou seletores com `useSyncExternalStore`), mantendo o hook `useWorkspace()` como uma fachada unificada que apenas delega para as stores filhas durante a transição.

---

## Passos de Execução

### 6.1 Criação das Stores de Domínio

1. **`editorStore.ts`:**
   - Estado: `activeFile`, `activeDocRepo`, `fileContent`, `originalContent`, `fileMetadata`, `saveStatus`, `isSaving`, `isLoadingFile`.
   - Ações: `setFileContent`, `setSaveStatus`, `loadFile`, `reloadActiveFile`.
   - Ganho: A digitação no editor apenas re-renderiza o canvas e a barra de status de salvamento.

2. **`repoStore.ts`:**
   - Estado: `activeRepo`, `repos`, `activeOrg`, `orgs`, `tree`, `treesByRepo`.
   - Ações: `selectRepo`, `selectOrg`, `loadTree`, `loadRepos`.

3. **`gitStore.ts`:**
   - Estado: `gitStatus`, `gitLog`, `pendingChanges`, `systemPendingChanges`, `whatsNewSummary`, `hasRemoteUpdates`.
   - Ações: `refreshGitStatus`, `checkRemoteUpdates`, `markWhatsNewAsSeen`.

4. **`governanceStore.ts`:**
   - Estado: `projectMetaOptions`, `projectConfig`, `guardrailStatus`.
   - Ações: `loadProjectConfig`, `loadProjectMetadataOptions`.

---

### 6.2 Implementação da Fachada de Compatibilidade em `WorkspaceContext.tsx`
Refatorar `WorkspaceContext.tsx` para que o provedor não mantenha mais os 50 estados locais via `useState`, mas sim agregue os hooks das stores específicas:
```typescript
// frontend/src/context/WorkspaceContext.tsx (Versão Fachada)
export const useWorkspace = (): WorkspaceContextType => {
  const editor = useEditorStore();
  const repo = useRepoStore();
  const git = useGitStore();
  const gov = useGovernanceStore();

  return useMemo(() => ({
    ...editor,
    ...repo,
    ...git,
    ...gov,
  }), [editor, repo, git, gov]);
};
```

---

### 6.3 Migração Direta no `NotionEditor.tsx`
No componente de maior sensibilidade a performance [NotionEditor.tsx](file:///Users/MarcosBaiadori/Desktop/project-boilerplate/frontend/src/components/editor/NotionEditor.tsx), migrar o consumo para `useEditorStore`:
```typescript
// Em vez de consumir useWorkspace() completo:
const { fileContent, setFileContent, saveStatus } = useEditorStore((s) => ({
  fileContent: s.fileContent,
  setFileContent: s.setFileContent,
  saveStatus: s.saveStatus,
}));
```
Isso impede que eventos do Git, atualizações de árvore de arquivos ou notificações em segundo plano interfiram no ciclo de pintura e digitação do editor.

---

## Gate de Saída

- [ ] Digitação no editor não dispara renderizações em componentes de layout externos (validado via React Profiler).
- [ ] Todos os 96 componentes que consomem `useWorkspace()` continuam funcionando sem alterações imediatas de interface.
- [ ] `WorkspaceContext.tsx` reduz seu tamanho de 2.031 linhas para menos de 300 linhas de orquestração.
- [ ] `npm run verify` passa nos 6 estágios de verificação.
