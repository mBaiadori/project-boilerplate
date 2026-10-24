# 🎯 Roadmap de Refatoração & Padronização Frontend (Context OS)

Este documento estabelece o plano mestre para eliminação de estilos inline (`style={{ ... }}`), centralização de estilos em tokens Material Design 3 e consolidação do ecossistema de componentes reutilizáveis em `frontend/src/components/ui/`.

---

## 📊 Diagnóstico Atual
- **Total de estilos inline identificados:** `2.108` ocorrências em `frontend/src/`.
- **Top 5 arquivos mais afetados:**
  1. `AICenterSubView.tsx` (247 inlines)
  2. `SettingsSubView.tsx` (154 inlines)
  3. `VersionsSubView.tsx` (149 inlines)
  4. `GitModal.tsx` (137 inlines)
  5. `RawInspectorSidebar.tsx` (135 inlines) & `AICopilotPanel.tsx` (133 inlines)

---

## 🗺️ As 4 Fases do Plano

### 🔹 Fase 1: Primitivas de Layout & Utilitários de CSS (Base Arquitetural) ✅ CONCLUÍDA
- **Objetivo:** Fornecer aos desenvolvedores e agentes os blocos de construção estruturais para que nunca mais precisem escrever `display: flex`, `gap`, `padding` ou cores hexadecimais inline.
- **Entregáveis Concluídos:**
  1. **Componentes de Layout em `src/components/ui/Layout.tsx`:**
     - `<PageContainer>`, `<PageHeader>`, `<PageBody>`, `<Stack>`, `<Row>`, `<Grid>`, `<Toolbar>`, `<Section>`, `<Divider>`.
  2. **Classes Utilitárias em `src/styles/ui-primitives.css`:**
     - Layout, tipografia, sidebar drawers, diff viewers, filter chips e code viewers.
  3. **Exportação Centralizada** em `src/components/ui/index.ts` e `src/components/common/index.ts` (`DiffViewer`, `ColorDotPicker`, `TaxonomyChipEditor`).

---

### 🔹 Fase 2: Refatoração dos Maiores Ofensores de Inlines 🚀 EM ANDAMENTO
- **Objetivo:** Substituir sistematicamente os estilos inline nos componentes críticos pelas novas primitivas e componentes funcionais.
- **Status das Etapas:**
  - **Etapa 2.1:** `SettingsSubView.tsx` ✅ **CONCLUÍDA** (154 inlines eliminados, tamanho reduzido de 3.023 para 1.480 linhas).
  - **Etapa 2.2:** `RawInspectorSidebar.tsx` & `HistorySidebar.tsx` ✅ **CONCLUÍDA** (224 inlines eliminados, encapsulamento com `RawCodeViewer` e `ui-sidebar-drawer`).
  - **Etapa 2.3:** `VersionsSubView.tsx` & `PRsSubView.tsx` ✅ **CONCLUÍDA** (228 inlines eliminados, encapsulamento com `DiffViewer`, `Card`, `Badge` e `Tabs`).
  - **Etapa 2.4:** `AICopilotPanel.tsx` & `RagSearchModal.tsx` ⏳ (Próxima)
  - **Etapa 2.5:** `AICenterSubView.tsx` ⏳ (Próxima)

---

### 🔹 Fase 3: Regra de Governança no Workspace (`.agents/rules/`) ✅ CONCLUÍDA
- **Objetivo:** Garantir que novos códigos e alterações respeitem as diretrizes de design system e nunca reintroduzam inlines.
- **Entregáveis Concluídos:**
  - Atualização do arquivo [`.agents/rules/ui-design-standards.md`](file:///Users/MarcosBaiadori/Desktop/project-boilerplate/.agents/rules/ui-design-standards.md) com proibição estrita de estilos inline e matriz funcional de componentes obrigatória.

---

### 🔹 Fase 4: Validação, Limpeza de CSS Legado & Build Final
- **Objetivo:** Assegurar integridade total da aplicação.
- **Entregáveis:**
  - Limpeza de classes legadas concorrentes em `dashboard.css`.
  - Execução de `npm run build` para garantir 0 erros de TypeScript e bundling.
  - Verificação de responsividade e contraste em tema claro e escuro.

---

## 📌 Matriz de Decisão: Função $\rightarrow$ Componente

| O que você precisa fazer? | Componente / Classe Obrigatória |
| :--- | :--- |
| Criar uma tela/view com cabeçalho e corpo | `<PageContainer>` + `<PageHeader>` + `<PageBody>` |
| Barra de pesquisa e botões no topo | `<Toolbar left={...} right={...} />` |
| Lista de cards em grade | `<Grid minItemWidth={280}>` |
| Agrupar itens verticalmente | `<Stack gap="md">` |
| Agrupar itens lado a lado | `<Row align="center" gap="sm">` |
| Bloco com título e borda | `<Card>` ou `<Section title="...">` |
| Botão de ação ou ícone | `<Button variant="...">` / `<IconButton>` |
| Campo de texto ou busca | `<Input>` / `<SearchInput>` / `<FormField>` |
| Badge de status / tag | `<Badge>` / `<Chip>` / `<FilterChips>` |
| Navegação por abas | `<Tabs>` |
| Estado vazio | `<EmptyState>` |
| Indicador de carregamento | `<Spinner>` |
