# Fase 01 — Correção de Defeitos de Execução React, Otimização de Estado Zustand e Limpeza de Dependências

**Resolve:** Achados **BUG-01** (Exceção de Temporal Dead Zone em `SkillsHubModal.tsx`), **BUG-03** (Desperdício de CPU por subscrição global de Zustand em `WorkspaceContext.tsx`) e **D1** (Tipagem de desenvolvimento `@types/papaparse` alocada em dependências de produção).  
**Prioridade:** P0.  
**Esforço:** Pequeno.  
**Arquivos Principais:**
- `frontend/src/components/modals/SkillsHubModal.tsx`
- `frontend/src/context/WorkspaceContext.tsx`
- `frontend/src/context/AIContext.tsx`
- `frontend/package.json`

---

## 1. Contexto e Diagnóstico

### 1.1 Temporal Dead Zone em `SkillsHubModal.tsx` (BUG-01)
No componente `SkillsHubModal.tsx`:
```tsx
useEffect(() => {
  if (isOpen) {
    loadData(); // <-- Invocação antes da linha 49
  }
}, [isOpen, activeRepo]);

const loadData = async () => { ... };
```
Como `loadData` é uma declaração `const`, ela não é inicializada no momento do hoisting (período Temporal Dead Zone). Dependendo da ordem de compilação ou renderização síncrona do efeito em React 19, o acesso a `loadData` lança uma exceção `ReferenceError: Cannot access 'loadData' before initialization`, travando a interface do modal.

### 1.2 Tempestade de Re-renderizações por Subscrições Globais de Zustand (BUG-03)
Em `WorkspaceContext.tsx`:
```tsx
const editor = useEditorStore();
const repo = useRepoStore();
const git = useGitStore();
const gov = useGovernanceStore();

useEffect(() => {
  repo.loadOrgs().catch(() => {});
}, [isAuthenticated, repo]);
```
Ao invocar `useRepoStore()`, `useEditorStore()`, etc. sem seletores específicos, o componente `WorkspaceProvider` subscreve a **todas** as alterações de propriedades de cada um dos stores. A cada caractere digitado no editor, a referência do objeto de estado é recriada, acionando o `useEffect` e disparando `repo.loadOrgs()` repetidamente em segundo plano.

### 1.3 `@types/papaparse` em Dependências de Produção (D1)
Em `frontend/package.json`, a entrada `@types/papaparse: ^5.5.2` está listada em `dependencies` em vez de `devDependencies`. Pacotes de tipos do TypeScript são consumidos exclusivamente durante a checagem de tipos estáticos (`tsc`), não devendo compor dependências de runtime.

---

## 2. Passos de Execução

### 2.1 Reordenação e Envolvimento com `useCallback` em `SkillsHubModal.tsx`
1. Mover a função `loadData` para antes do `useEffect`.
2. Envolver `loadData` com `useCallback([activeRepo])` e incluí-la de forma segura na lista de dependências do `useEffect`:
   ```tsx
   const loadData = useCallback(async () => {
     setLoading(true);
     try {
       const [hubRes, projRes] = await Promise.all([
         API.getSkillsHub(),
         API.getSkillsProject(activeRepo),
       ]);
       ...
     } finally {
       setLoading(false);
     }
   }, [activeRepo]);

   useEffect(() => {
     if (isOpen) {
       loadData();
     }
   }, [isOpen, loadData]);
   ```

### 2.2 Uso de Seletores Atômicos de Zustand em `WorkspaceContext.tsx`
1. Em `WorkspaceContext.tsx`, substituir as chamadas amplas por seletores refinados de ações e propriedades:
   ```tsx
   const loadOrgs = useRepoStore((s) => s.loadOrgs);

   useEffect(() => {
     if (isAuthenticated) {
       loadOrgs().catch(() => {});
     }
   }, [isAuthenticated, loadOrgs]);
   ```
2. Garantir que as propriedades expostas no `value` do `WorkspaceContext.Provider` sejam memorizadas via `useMemo`, prevenindo a re-renderização de toda a árvore da SPA a cada digitação do editor.

### 2.3 Realocação de `@types/papaparse` para `devDependencies`
1. Em `frontend/package.json`, mover `@types/papaparse` de `dependencies` para `devDependencies`.
2. Validar que `npm run build` e `npx tsc -p tsconfig.app.json --noEmit` continuam executando perfeitamente.

---

## 3. Critérios de Aceite e Verificação

1. **Linter e Compilador:** `npx oxlint` e `npx tsc -p tsconfig.app.json --noEmit` sem erros. O alerta de TDZ em `SkillsHubModal.tsx` deve desaparecer.
2. **Testes do Frontend:** `npm test` no frontend concluído com 100% dos testes aprovados.
3. **Build de Produção:** `npm run build` no frontend executado com sucesso.
