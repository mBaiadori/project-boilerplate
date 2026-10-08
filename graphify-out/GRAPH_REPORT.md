# Graph Report - project-boilerplate  (2026-10-08)

## Corpus Check
- 249 files · ~266,355 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: .css 9, (none) 2)

## Summary
- 2026 nodes · 5749 edges · 93 communities (74 shown, 19 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0d415825`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- aicenter.service.ts
- useWorkspace
- ai.service.ts
- lucide-react
- useAuth
- customToolsService
- Chip.tsx
- saveConfig
- translationsService
- types/index.ts
- loadConfig
- desktop/package.json
- server/package.json
- properties
- frontend/package.json
- app.ts
- governanceService
- properties
- prs.service.ts
- NotionEditorEngine
- scripts
- properties
- dependencies
- git.ts
- i18n/index.ts
- ContextSidebar.tsx
- rag.service.ts
- Layout.tsx
- compile-bytecode.js
- templates.service.ts
- workspaceService
- storage.ts
- DictionaryTerm
- Card.tsx
- docsMetadataService
- FileTree.tsx
- compilerOptions
- scripts
- VisualMarkdownDiff.tsx
- react
- prsService
- compilerOptions
- AIContext.tsx
- TestProjectConfigEngine
- SlashMenuEngine
- Button.tsx
- compilerOptions
- BubbleMenuEngine
- governance.service.ts
- NotionTable
- 3. Standard Component Archetypes
- compilerOptions
- WorkbenchCanvas.tsx
- DraftStoreService
- devDependencies
- CsvEditor.tsx
- .handleSlashCommand
- notion-editor-engine.ts
- SettingsSubView.tsx
- ChatMemoryStore
- properties
- properties
- test_ai_memory_engine.py
- devDependencies
- StatCard.tsx
- Regra Arquitetural: Taxonomias Dinâmicas e Uso Obrigatório de Cores do `.project.config.json`
- vite.config.ts
- anyOf
- Regra Arquitetural: Zero Hardcoded Data & Configuração Dinâmica
- ContextSelectorModal.tsx
- prWorktreeService
- properties
- .oxlintrc.json
- frontmatter.ts
- TestAuditEngine
- TestWorkspaceGraph
- TestScaffoldEngine
- scripts
- SlashMenu.tsx
- main/index.ts
- dependencies
- project.config.schema.json
- governance_rules
- TestPRAutoMerge
- Diretrizes Obrigatórias do Workspace para Agentes de IA (Context OS)
- React + TypeScript + Vite
- reviewers
- BubbleMenu.tsx
- NotionEditor.tsx
- frontend/tsconfig.json
- ui-design-standards.md

## God Nodes (most connected - your core abstractions)
1. `loadConfig()` - 169 edges
2. `react` - 105 edges
3. `useWorkspace()` - 96 edges
4. `Button()` - 95 edges
5. `NotionEditorEngine` - 82 edges
6. `lucide-react` - 65 edges
7. `Modal()` - 50 edges
8. `Badge()` - 49 edges
9. `API` - 47 edges
10. `Input` - 46 edges

## Surprising Connections (you probably didn't know these)
- `O que fazer:` --references--> `useWorkspace()`  [INFERRED]
  .agents/rules/project-taxonomy-and-colors.md → frontend/src/context/WorkspaceContext.tsx
- `1. Proibição de Listas Fixas (Zero Hardcoded Taxonomies)` --references--> `ADR`  [INFERRED]
  .agents/rules/project-taxonomy-and-colors.md → frontend/src/types/index.ts
- `DocxViewer()` --calls--> `useWorkspace()`  [EXTRACTED]
  frontend/src/components/editor/viewers/DocxViewer.tsx → frontend/src/context/WorkspaceContext.tsx
- `ExcelViewer()` --calls--> `useWorkspace()`  [EXTRACTED]
  frontend/src/components/editor/viewers/ExcelViewer.tsx → frontend/src/context/WorkspaceContext.tsx
- `ImageViewer()` --calls--> `useWorkspace()`  [EXTRACTED]
  frontend/src/components/editor/viewers/ImageViewer.tsx → frontend/src/context/WorkspaceContext.tsx

## Import Cycles
- None detected.

## Communities (93 total, 19 thin omitted)

### Community 0 - "aicenter.service.ts"
Cohesion: 0.11
Nodes (14): BASE_DIR, aiCenterService, eccSeedAgents, eccSeedMcpTemplates, ECC_SEED_SKILLS, getSafeRepo(), skillsService, AgentDefinition (+6 more)

### Community 1 - "useWorkspace"
Cohesion: 0.09
Nodes (56): AgentApprovalCard(), AgentApprovalCardProps, AICopilotPanel(), AICopilotPanelProps, HistorySidebar(), PromptSidebar(), PromptSidebarProps, RagSearchModal() (+48 more)

### Community 2 - "ai.service.ts"
Cohesion: 0.05
Nodes (33): @google/generative-ai, openai, aiRoutes(), AIExecutionResult, aiService, AIServiceCallOptions, ChatMessage, RawTurnMetrics (+25 more)

### Community 3 - "lucide-react"
Cohesion: 0.09
Nodes (49): DocActionBarProps, FrontmatterHeader(), AccessGovernanceManager(), AddAccountModal(), AddAccountModalProps, DetailedModelItem, PROVIDERS, CloneRepoModal() (+41 more)

### Community 4 - "useAuth"
Cohesion: 0.12
Nodes (30): AdminAuthRoute(), App(), CollaboratorAuthRoute(), OrgRepoRedirect(), ProtectedRoute(), RepoRedirect(), AccountSwitcherMenu(), LanguageSwitcher() (+22 more)

### Community 5 - "customToolsService"
Cohesion: 0.12
Nodes (13): nativeTools, AgentTool, ToolExecutionContext, ToolParameterProperty, ToolParametersSchema, ToolResult, convertPropToGeminiSchema(), toolRegistry (+5 more)

### Community 6 - "Chip.tsx"
Cohesion: 0.14
Nodes (11): BadgeProps, BadgeSize, BadgeVariant, ChipProps, ChipSize, ChipVariant, FilterChipItem, FilterChipsProps (+3 more)

### Community 7 - "saveConfig"
Cohesion: 0.13
Nodes (10): saveConfig(), authService, RFC-8628, RepoDiagnosis, RepoDiagnosisCheckItem, RepoInitializePayload, reposService, applyBranchProtection() (+2 more)

### Community 8 - "translationsService"
Cohesion: 0.10
Nodes (13): AiContextualProvider, BaseTranslationProvider, MaskedMarkdown, PlaceholderItem, LightweightLocalProvider, translationProviderManager, DocumentTranslationItem, ITranslationProvider (+5 more)

### Community 9 - "types/index.ts"
Cohesion: 0.04
Nodes (69): DocumentHistoryDrawerProps, DocxViewer(), DocxViewerProps, ExcelViewer(), ExcelViewerProps, ImageViewer(), ImageViewerProps, PdfViewer() (+61 more)

### Community 10 - "loadConfig"
Cohesion: 0.14
Nodes (5): loadConfig(), gitService, prConflictsService, settingsService, systemService

### Community 11 - "desktop/package.json"
Cohesion: 0.14
Nodes (13): author, description, @napi-rs/keyring, tsx, @types/node, typescript, license, main (+5 more)

### Community 12 - "server/package.json"
Cohesion: 0.05
Nodes (39): @anthropic-ai/sdk, @fastify/cors, @fastify/sensible, @fastify/static, pino-pretty, dependencies, ajv, ajv-formats (+31 more)

### Community 13 - "properties"
Cohesion: 0.05
Nodes (39): additionalProperties, items, type, type, type, type, type, type (+31 more)

### Community 14 - "frontend/package.json"
Cohesion: 0.07
Nodes (35): diff, @types/diff, @types/node, typescript, name, private, type, version (+27 more)

### Community 15 - "app.ts"
Cohesion: 0.08
Nodes (27): chokidar, fastify, buildApp(), loadCanonicalTutorials(), resolveUiDistDir(), UI_DIR, UI_DIST_DIR, authRoutes() (+19 more)

### Community 16 - "governanceService"
Cohesion: 0.09
Nodes (19): governanceService, BranchProtectionConfig, BranchProtectionStatus, CollaboratorInfo, CreateOrgTeamPayload, DepartmentConfig, EffectiveUserPermission, GitHubPermission (+11 more)

### Community 17 - "properties"
Cohesion: 0.06
Nodes (37): items, type, type, type, type, items, additionalProperties, properties (+29 more)

### Community 18 - "prs.service.ts"
Cohesion: 0.19
Nodes (15): loadRepoWorkspaceChanges(), PRApprovalAudit, DocumentMetadataItem, extractFrontmatterMeta(), TreeNode, computeDiff(), DiffResult, getGitStatus() (+7 more)

### Community 20 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build:ts, compile:bytecode, dev, package:all, package:linux, package:mac, package:win

### Community 21 - "properties"
Cohesion: 0.06
Nodes (33): type, type, type, type, type, type, items, additionalProperties (+25 more)

### Community 22 - "dependencies"
Cohesion: 0.06
Nodes (33): dependencies, @codemirror/lang-cpp, @codemirror/lang-css, @codemirror/lang-html, @codemirror/lang-java, @codemirror/lang-javascript, @codemirror/lang-json, @codemirror/lang-php (+25 more)

### Community 23 - "git.ts"
Cohesion: 0.16
Nodes (30): checkRemoteGitUpdates(), commitChanges(), createAndCheckoutBranch(), ensureGitIgnore(), ensureGitRepo(), execAsync, executeGitCommand(), getActiveBearerToken() (+22 more)

### Community 24 - "i18n/index.ts"
Cohesion: 0.08
Nodes (18): LanguageSwitcherProps, AppNamespace, DEFAULT_LANGUAGE, FALLBACK_LANGUAGE, LANGUAGE_STORAGE_KEY, LanguageOption, NAMESPACES, SUPPORTED_LANGUAGES (+10 more)

### Community 25 - "ContextSidebar.tsx"
Cohesion: 0.36
Nodes (10): collapseFilesToReferences(), processNode(), ContextSidebar(), ContextSidebarProps, expandReferencesToFiles(), findNodeByPath(), getAllDirPaths(), getAllFilePaths() (+2 more)

### Community 26 - "rag.service.ts"
Cohesion: 0.17
Nodes (10): ragIndexer, tokenizeText(), IndexCache, ragService, RagChunk, RagDiskStorage, RagFileManifestItem, RagSearchOptions (+2 more)

### Community 27 - "Layout.tsx"
Cohesion: 0.08
Nodes (16): Box, DividerProps, GridProps, PageBodyProps, PageContainerProps, PanelProps, RowProps, SectionProps (+8 more)

### Community 28 - "compile-bytecode.js"
Cohesion: 0.29
Nodes (3): __dirname, __filename, bytenode

### Community 29 - "templates.service.ts"
Cohesion: 0.22
Nodes (13): getCommunityTemplatesPath(), getProjectTemplatesPath(), loadCommunityTemplates(), loadProjectTemplates(), loadProjectTemplatesMetadata(), ProjectTemplate, sanitizeTemplateItem(), saveCommunityTemplates() (+5 more)

### Community 30 - "workspaceService"
Cohesion: 0.32
Nodes (3): recordChange(), extractDocLinksFromMarkdown(), workspaceService

### Community 31 - "storage.ts"
Cohesion: 0.06
Nodes (51): ajv, ajv-formats, CanonicalTemplate, CanonicalTutorial, CONFIG_PATH, DEFAULT_GLOBAL_SYSTEM_PROMPT, DEFAULT_PROJECT_ABOUT_PROMPT, DEFAULT_TEMPLATE_CREATOR_PROMPT (+43 more)

### Community 32 - "DictionaryTerm"
Cohesion: 0.20
Nodes (13): AddDictionaryTermModalProps, LinkSynonymModalProps, DictionaryTerm, buildMatchEntries(), decorateHtmlWithTerms(), escapeHtml(), escapeRegex(), findDictionaryTerm() (+5 more)

### Community 33 - "Card.tsx"
Cohesion: 0.29
Nodes (6): CardContentProps, CardFooterProps, CardHeaderProps, CardPadding, CardProps, CardVariant

### Community 34 - "docsMetadataService"
Cohesion: 0.24
Nodes (4): docsMetadataService, extractDocTitleFromMarkdown(), generateDocId(), updateFrontmatterInMarkdown()

### Community 36 - "FileTree.tsx"
Cohesion: 0.16
Nodes (18): DraggedItem, filesToScannedList(), FileTree(), FileTreeProps, getCollapsedStorageKey(), getScrollStorageKey(), getSelectedFolderStorageKey(), InlineCreatingState (+10 more)

### Community 37 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 38 - "scripts"
Cohesion: 0.11
Nodes (18): name, private, scripts, build, build:frontend, build:server, desktop:build, desktop:dev (+10 more)

### Community 39 - "VisualMarkdownDiff.tsx"
Cohesion: 0.18
Nodes (13): VisualMarkdownDiff(), VisualMarkdownDiffProps, EditorGitWatcherState, useEditorGitWatcher(), UseEditorGitWatcherOptions, ClientDiffResult, computeClientDiff(), computeLineDiff() (+5 more)

### Community 40 - "react"
Cohesion: 0.09
Nodes (18): GitModal(), GitModalProps, TabType, WhatsNewFilterType, AlertBannerProps, AlertType, FormFieldProps, IconButtonProps (+10 more)

### Community 42 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 43 - "AIContext.tsx"
Cohesion: 0.10
Nodes (32): formatRelativeTime(), HistorySidebarProps, RawCodeViewer(), RawCodeViewerProps, RawInspectorSidebar(), RawInspectorSidebarProps, TelemetrySidebar, TemplatePickerModalProps (+24 more)

### Community 45 - "SlashMenuEngine"
Cohesion: 0.23
Nodes (3): escapeHtml(), SlashCommand, SlashMenuEngine

### Community 46 - "Button.tsx"
Cohesion: 0.33
Nodes (4): ButtonGroupProps, ButtonProps, ButtonSize, ButtonVariant

### Community 47 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution, outDir, resolveJsonModule (+7 more)

### Community 49 - "governance.service.ts"
Cohesion: 0.10
Nodes (13): EphemeralAIToken, ephemeralTokens, DEFAULT_DEPARTMENTS, SecretScanResult, SecretScanViolation, prSecurityService, VAULT_KEYS, VaultKey (+5 more)

### Community 51 - "3. Standard Component Archetypes"
Cohesion: 0.15
Nodes (12): 1. Buttons, 1. Core Principles, 2. Cards & Containers, 2. Color System & Design Tokens (CSS), 3. Navigation, 3. Standard Component Archetypes, 4. Typography Scale (Google Material Design 3 Type Scale), 5. Responsive Design & Window Size Classes (Google M3) (+4 more)

### Community 52 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, rootDir, skipLibCheck (+4 more)

### Community 53 - "WorkbenchCanvas.tsx"
Cohesion: 0.22
Nodes (15): GenericFileViewer(), GenericFileViewerProps, CodeMirrorEditor, CsvEditor, DocxViewer, ExcelViewer, GenericFileViewer, ImageViewer (+7 more)

### Community 54 - "DraftStoreService"
Cohesion: 0.27
Nodes (3): DocDraft, DraftStore, DraftStoreService

### Community 56 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, oxlint, @types/diff, @types/js-yaml, @types/marked, @types/node, @types/react, @types/react-dom (+3 more)

### Community 57 - "CsvEditor.tsx"
Cohesion: 0.50
Nodes (4): CodeMirrorEditor(), CsvEditor(), CsvEditorProps, papaparse

### Community 59 - "notion-editor-engine.ts"
Cohesion: 0.24
Nodes (10): FragmentStatusInfo, calculateSimilarity(), createRangeFromNodeAndOffsets(), createTextFragmentFromSelection(), findTextFragmentInElement(), formatTextFragmentUrl(), levenshteinDistance(), normalizeForSearch() (+2 more)

### Community 60 - "SettingsSubView.tsx"
Cohesion: 0.07
Nodes (49): ColorDotPicker(), ColorDotPickerProps, RAINBOW_28_HUES, DiffViewer(), DiffViewerProps, SelectDropdown(), SelectDropdownProps, SelectOption (+41 more)

### Community 61 - "ChatMemoryStore"
Cohesion: 0.27
Nodes (3): ChatMemoryStore, ChatMemoryStoreService, ChatSessionRecord

### Community 62 - "properties"
Cohesion: 0.18
Nodes (11): type, type, type, properties, architecture_pattern, description, lead, repository_url (+3 more)

### Community 63 - "properties"
Cohesion: 0.18
Nodes (11): type, type, properties, type, handle, id, name, role (+3 more)

### Community 65 - "devDependencies"
Cohesion: 0.33
Nodes (6): devDependencies, electron, electron-builder, tsx, @types/node, typescript

### Community 67 - "Regra Arquitetural: Taxonomias Dinâmicas e Uso Obrigatório de Cores do `.project.config.json`"
Cohesion: 0.25
Nodes (7): 1. Proibição de Listas Fixas (Zero Hardcoded Taxonomies), 2. Uso Obrigatório das Cores Configuradas nas Chips / Badges, 3. Checklist Obrigatório para Agentes & PRs, O que fazer:, Regra Arquitetural: Taxonomias Dinâmicas e Uso Obrigatório de Cores do `.project.config.json`, Regras Visuais para Chips / Badges:, ADR

### Community 69 - "anyOf"
Cohesion: 0.25
Nodes (8): items, anyOf, statuses, tags, items, type, items, type

### Community 70 - "Regra Arquitetural: Zero Hardcoded Data & Configuração Dinâmica"
Cohesion: 0.29
Nodes (6): 1. Princípio Fundamental (Zero Hardcoding), 2. Padrão Universal: Sugestão $\rightarrow$ Customização $\rightarrow$ Persistência, 3. Checklist de Implementação de Novos Campos / Listas, 4. Validação de Identificadores (Slugs) & Prevenção de Conflitos, 5. Padrão Global de Ícones & Componente `IconPicker`, Regra Arquitetural: Zero Hardcoded Data & Configuração Dinâmica

### Community 72 - "ContextSelectorModal.tsx"
Cohesion: 0.44
Nodes (8): collapseFilesToReferences(), processNode(), ContextSelectorModal(), ContextSelectorModalProps, expandReferencesToFiles(), findNodeByPath(), getFilesUnderNode(), IndeterminateCheckbox()

### Community 74 - "properties"
Cohesion: 0.29
Nodes (7): type, type, type, properties, ai_template_prompt, categories, project

### Community 75 - ".oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 76 - "frontmatter.ts"
Cohesion: 0.32
Nodes (7): FrontmatterHeaderProps, createDefaultMetadata(), DocumentMetadata, ParsedDocument, parseFrontmatter(), stripFrontmatter(), js-yaml

### Community 80 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, preview

### Community 81 - "SlashMenu.tsx"
Cohesion: 0.40
Nodes (3): SLASH_COMMANDS, SlashCommandItem, SlashMenuProps

### Community 82 - "main/index.ts"
Cohesion: 0.20
Nodes (5): __dirname, __filename, findAvailablePort(), startEmbeddedServer(), electron

### Community 83 - "dependencies"
Cohesion: 0.50
Nodes (4): dependencies, bytenode, electron-updater, @napi-rs/keyring

### Community 84 - "project.config.schema.json"
Cohesion: 0.40
Nodes (4): additionalProperties, $schema, title, type

### Community 85 - "governance_rules"
Cohesion: 0.40
Nodes (5): properties, type, type, governance_rules, min_approvals_default

### Community 87 - "Diretrizes Obrigatórias do Workspace para Agentes de IA (Context OS)"
Cohesion: 0.50
Nodes (3): 1. Regra de Taxonomias Dinâmicas & Cores do `.project.config.json`, 2. Design System & Tokens, Diretrizes Obrigatórias do Workspace para Agentes de IA (Context OS)

### Community 88 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + TypeScript + Vite

### Community 89 - "reviewers"
Cohesion: 0.50
Nodes (4): type, reviewers, items, type

### Community 91 - "NotionEditor.tsx"
Cohesion: 0.11
Nodes (26): DictionaryPopover(), DictionaryPopoverProps, DocConnectivityBar(), DocConnectivityBarProps, getTagStyle(), TAG_PALETTES, DocumentHistoryDrawer(), LanguageSelectorDropdown() (+18 more)

## Knowledge Gaps
- **570 isolated node(s):** `name`, `version`, `description`, `type`, `main` (+565 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 684 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `useWorkspace`, `lucide-react`, `useAuth`, `Chip.tsx`, `types/index.ts`, `frontend/package.json`, `i18n/index.ts`, `ContextSidebar.tsx`, `Layout.tsx`, `Card.tsx`, `FileTree.tsx`, `VisualMarkdownDiff.tsx`, `AIContext.tsx`, `Button.tsx`, `WorkbenchCanvas.tsx`, `CsvEditor.tsx`, `SettingsSubView.tsx`, `StatCard.tsx`, `ContextSelectorModal.tsx`, `SlashMenu.tsx`, `BubbleMenu.tsx`, `NotionEditor.tsx`?**
  _High betweenness centrality (0.160) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _570 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `aicenter.service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11014492753623188 - nodes in this community are weakly interconnected._
- **Why does `loadConfig()` connect `loadConfig` to `aicenter.service.ts`, `ai.service.ts`, `customToolsService`, `saveConfig`, `translationsService`, `prWorktreeService`, `prsService`, `app.ts`, `governanceService`, `governance.service.ts`, `prs.service.ts`, `git.ts`, `templates.service.ts`, `workspaceService`, `storage.ts`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **Should `useWorkspace` be split into smaller, more focused modules?**
  _Cohesion score 0.09322678843226788 - nodes in this community are weakly interconnected._
- **Why does `marked` connect `VisualMarkdownDiff.tsx` to `useWorkspace`, `SettingsSubView.tsx`, `frontend/package.json`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **Should `ai.service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.054901960784313725 - nodes in this community are weakly interconnected._