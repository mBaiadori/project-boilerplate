# Fase 5 — Performance, Code-Splitting e Otimização de Linter (PERF-01, PERF-02)

**Objetivo:** Reduzir o bundle JavaScript inicial do frontend através de lazy loading das 9 subviews do Dashboard e sanar os 198 alertas de pureza e re-renderização em cascata identificados pelo `oxlint`.  
**Resolve:** PERF-01 (Bundle principal com 1.63 MB e chunks pesados sem code-splitting), PERF-02 (Alertas de `Date.now()`, `Math.random()` e `setState` em efeitos no React).  
**Prioridade:** P2.  
**Esforço:** Médio.  
**Arquivos Principais:**
- `frontend/src/views/DashboardView.tsx`
- `frontend/src/context/AIContext.tsx`
- `frontend/src/components/layout/LoadingPane.tsx` (Novo ou componente existente)
- `frontend/package.json`

---

## Contexto e Diagnóstico

1. **Bundle Monolítico no Frontend (PERF-01):** Ao rodar `npm run build` no frontend, o Vite emite alertas de que múltiplos chunks excedem 500 kB (sendo o `index-*.js` com 1.63 MB, além de `elk` com 1.46 MB e `CodeMirrorEditor` com 987 kB). Todas as subviews eram importadas no topo de `DashboardView.tsx`, forçando o download imediato de diagramas Mermaid, visualizadores de documentos e editores pesados logo no primeiro acesso.
2. **Alertas de Linter (PERF-02):** A execução de `npm run lint` no frontend acusa 198 warnings gerados pelo `oxlint`, principalmente:
   - `react(purity)`: Chamadas a `Date.now()` e `Math.random()` para gerar IDs durante a renderização (fazendo o React Compiler pular otimizações).
   - `react(set-state-in-effect)`: Chamada direta de `setDocTemplateId` síncrono dentro de `useEffect` no `AIContext.tsx`.

---

## Passos de Execução

### 5.1 Implementação de Code-Splitting em `DashboardView.tsx`
1. Manter `EditorSubView` como import estático direto (pois é a visão principal mais acessada).
2. Converter as subviews secundárias para `React.lazy()`:
   ```typescript
   // frontend/src/views/DashboardView.tsx
   const VersionsSubView = React.lazy(() => import('./subviews/VersionsSubView').then(m => ({ default: m.VersionsSubView })));
   const WikiSubView = React.lazy(() => import('./subviews/WikiSubView').then(m => ({ default: m.WikiSubView })));
   const DictionarySubView = React.lazy(() => import('./subviews/DictionarySubView').then(m => ({ default: m.DictionarySubView })));
   const PRsSubView = React.lazy(() => import('./subviews/PRsSubView').then(m => ({ default: m.PRsSubView })));
   const TemplatesSubView = React.lazy(() => import('./subviews/TemplatesSubView').then(m => ({ default: m.TemplatesSubView })));
   const AICenterSubView = React.lazy(() => import('./subviews/AICenterSubView').then(m => ({ default: m.AICenterSubView })));
   const GovernanceMembersSubView = React.lazy(() => import('./subviews/GovernanceMembersSubView').then(m => ({ default: m.GovernanceMembersSubView })));
   const SettingsSubView = React.lazy(() => import('./subviews/SettingsSubView').then(m => ({ default: m.SettingsSubView })));
   ```
3. Envolver a renderização dinâmica em `<React.Suspense fallback={<SubviewLoadingIndicator />}>`.

---

### 5.2 Resolução de Alertas de Pureza no `AIContext.tsx`
1. Em `frontend/src/context/AIContext.tsx`:
   - Mover a geração de IDs únicos baseados em timestamp (`msg-ai-${Date.now()}`) exclusivamente para os handlers de ação e eventos, ou usar gerador estável `crypto.randomUUID()` em callbacks, nunca no corpo de renderização.
2. Ajustar o `useEffect` de template:
   - Em vez de chamar `setState` síncrono dentro de `useEffect`, derivar o valor diretamente ou utilizar o evento de troca de arquivo em `WorkspaceContext`.

---

### 5.3 Verificação de Redução de Bundle
Executar `npm run build` no frontend e verificar:
- O chunk principal `index-*.js` deve apresentar redução substancial de tamanho.
- As subviews são fatiadas em arquivos isolados em `dist/assets/`, carregados sob demanda apenas quando o usuário navegar pelas abas correspondentes.

---

## Gate de Saída

- [ ] `npm run build` no frontend gera chunks sob demanda para as subviews.
- [ ] Todas as subviews continuam abrindo normalmente sem flash visual quebrado.
- [ ] `npm run lint` no frontend reduz significativamente os alertas do `oxlint`.
- [ ] Testes do frontend (`npm test`) continuam 100% verdes.
