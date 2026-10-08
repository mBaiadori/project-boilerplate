# Graph Report - project-boilerplate  (2026-10-08)

## Corpus Check
- 248 files · ~264,133 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: .css 9, (none) 2)

## Summary
- 2024 nodes · 5737 edges · 89 communities (71 shown, 18 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `49f4c9e8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- aicenter.service.ts
- useWorkspace
- ai.routes.ts
- react
- ReposView.tsx
- storage.ts
- Chip.tsx
- SettingsSubView.tsx
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
- scripts
- NotionEditorEngine
- customToolsService
- properties
- dependencies
- git.ts
- i18n/index.ts
- RagSearchModal.tsx
- rag.indexer.ts
- Layout.tsx
- compile-bytecode.js
- templates.service.ts
- workspaceService
- constants.ts
- notion-editor-engine.ts
- devDependencies
- docsMetadataService
- dependencies
- compilerOptions
- scripts
- NotionEditor.tsx
- Spinner.tsx
- prsService
- compilerOptions
- StatCard.tsx
- TestProjectConfigEngine
- SlashMenuEngine
- events.service.ts
- compilerOptions
- BubbleMenuEngine
- NotionTable
- 3. Standard Component Archetypes
- compilerOptions
- WorkbenchCanvas.tsx
- DraftStoreService
- devDependencies
- ContextSidebar.tsx
- .handleSlashCommand
- .scrollToFragment
- TemplatesSubView.tsx
- ChatMemoryStore
- properties
- properties
- test_ai_memory_engine.py
- Regra Arquitetural: Taxonomias Dinâmicas e Uso Obrigatório de Cores do `.project.config.json`
- ai.service.ts
- anyOf
- Regra Arquitetural: Zero Hardcoded Data & Configuração Dinâmica
- prWorktreeService
- properties
- .oxlintrc.json
- TestAuditEngine
- TestWorkspaceGraph
- TestScaffoldEngine
- scripts
- SlashMenu.tsx
- main/index.ts
- prSecurityService
- project.config.schema.json
- governance_rules
- TestPRAutoMerge
- Diretrizes Obrigatórias do Workspace para Agentes de IA (Context OS)
- React + TypeScript + Vite
- reviewers
- BubbleMenu.tsx
- frontend/tsconfig.json
- ui-design-standards.md
- dependencies
- Button.tsx

## God Nodes (most connected - your core abstractions)
1. `loadConfig()` - 169 edges
2. `react` - 104 edges
3. `Button()` - 95 edges
4. `useWorkspace()` - 94 edges
5. `NotionEditorEngine` - 82 edges
6. `lucide-react` - 64 edges
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

## Communities (89 total, 18 thin omitted)

### Community 0 - "aicenter.service.ts"
Cohesion: 0.11
Nodes (14): BASE_DIR, aiCenterService, eccSeedAgents, eccSeedMcpTemplates, ECC_SEED_SKILLS, getSafeRepo(), skillsService, AgentDefinition (+6 more)

### Community 1 - "useWorkspace"
Cohesion: 0.08
Nodes (59): SelectDropdown(), AgentApprovalCard(), AgentApprovalCardProps, AICopilotPanel(), AICopilotPanelProps, formatRelativeTime(), HistorySidebar(), HistorySidebarProps (+51 more)

### Community 2 - "ai.routes.ts"
Cohesion: 0.07
Nodes (23): aiService, contextPointerService, ActiveProcessSession, AntigravityAdapter, ActiveProcessSession, ClaudeCodeAdapter, DirectApiProvider, IAgentProvider (+15 more)

### Community 3 - "react"
Cohesion: 0.08
Nodes (61): DocActionBar(), DocActionBarProps, AccessGovernanceManager(), AddAccountModal(), AddAccountModalProps, AddDictionaryTermModal(), DetailedModelItem, PROVIDERS (+53 more)

### Community 4 - "ReposView.tsx"
Cohesion: 0.08
Nodes (47): AdminAuthRoute(), App(), CollaboratorAuthRoute(), OrgRepoRedirect(), ProtectedRoute(), RepoRedirect(), AccountSwitcherMenu(), DraggedItem (+39 more)

### Community 5 - "storage.ts"
Cohesion: 0.07
Nodes (27): ajv, ajv-formats, CONFIG_PATH, DEFAULT_PROJECT_ABOUT_PROMPT, AppConfig, BINARY_EXTENSIONS, ensureDefaultRepoFiles(), getSSOTDefaultDir() (+19 more)

### Community 6 - "Chip.tsx"
Cohesion: 0.14
Nodes (11): BadgeProps, BadgeSize, BadgeVariant, ChipProps, ChipSize, ChipVariant, FilterChipItem, FilterChipsProps (+3 more)

### Community 7 - "SettingsSubView.tsx"
Cohesion: 0.08
Nodes (32): ColorDotPickerProps, RAINBOW_28_HUES, DiffViewer(), DiffViewerProps, SelectDropdownProps, SelectOption, GitModal(), GitModalProps (+24 more)

### Community 8 - "translationsService"
Cohesion: 0.10
Nodes (13): AiContextualProvider, BaseTranslationProvider, MaskedMarkdown, PlaceholderItem, LightweightLocalProvider, translationProviderManager, DocumentTranslationItem, ITranslationProvider (+5 more)

### Community 9 - "types/index.ts"
Cohesion: 0.04
Nodes (77): ColorDotPicker(), TaxonomyChipEditor(), TaxonomyChipEditorProps, DocumentHistoryDrawerProps, CsvEditor(), CsvEditorProps, DocxViewer(), DocxViewerProps (+69 more)

### Community 10 - "loadConfig"
Cohesion: 0.08
Nodes (14): loadConfig(), saveConfig(), authService, gitService, prConflictsService, RepoDiagnosis, RepoDiagnosisCheckItem, RepoInitializePayload (+6 more)

### Community 11 - "desktop/package.json"
Cohesion: 0.14
Nodes (13): author, description, @napi-rs/keyring, tsx, @types/node, typescript, license, main (+5 more)

### Community 12 - "server/package.json"
Cohesion: 0.08
Nodes (25): @fastify/cors, @fastify/sensible, @fastify/static, openai, pino-pretty, devDependencies, tsx, @types/diff (+17 more)

### Community 13 - "properties"
Cohesion: 0.05
Nodes (39): additionalProperties, items, type, type, type, type, type, type (+31 more)

### Community 14 - "frontend/package.json"
Cohesion: 0.06
Nodes (37): diff, @types/diff, @types/node, typescript, name, private, type, version (+29 more)

### Community 15 - "app.ts"
Cohesion: 0.13
Nodes (21): fastify, buildApp(), loadCanonicalTutorials(), resolveUiDistDir(), aiRoutes(), authRoutes(), dictionaryRoutes(), eventsRoutes() (+13 more)

### Community 16 - "governanceService"
Cohesion: 0.09
Nodes (23): EphemeralAIToken, ephemeralTokens, governanceService, BranchProtectionConfig, BranchProtectionStatus, CollaboratorInfo, CreateOrgTeamPayload, DEFAULT_DEPARTMENTS (+15 more)

### Community 17 - "properties"
Cohesion: 0.06
Nodes (37): items, type, type, type, type, items, additionalProperties, properties (+29 more)

### Community 18 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build:ts, compile:bytecode, dev, package:all, package:linux, package:mac, package:win

### Community 20 - "customToolsService"
Cohesion: 0.12
Nodes (13): nativeTools, AgentTool, ToolExecutionContext, ToolParameterProperty, ToolParametersSchema, ToolResult, convertPropToGeminiSchema(), toolRegistry (+5 more)

### Community 21 - "properties"
Cohesion: 0.06
Nodes (33): type, type, type, type, type, type, items, additionalProperties (+25 more)

### Community 22 - "dependencies"
Cohesion: 0.06
Nodes (33): dependencies, @codemirror/lang-cpp, @codemirror/lang-css, @codemirror/lang-html, @codemirror/lang-java, @codemirror/lang-javascript, @codemirror/lang-json, @codemirror/lang-php (+25 more)

### Community 23 - "git.ts"
Cohesion: 0.14
Nodes (32): RFC-8628, checkRemoteGitUpdates(), commitChanges(), createAndCheckoutBranch(), ensureGitIgnore(), ensureGitRepo(), execAsync, executeGitCommand() (+24 more)

### Community 24 - "i18n/index.ts"
Cohesion: 0.11
Nodes (15): LanguageSwitcherProps, AppNamespace, DEFAULT_LANGUAGE, FALLBACK_LANGUAGE, LANGUAGE_STORAGE_KEY, LanguageOption, NAMESPACES, SUPPORTED_LANGUAGES (+7 more)

### Community 25 - "RagSearchModal.tsx"
Cohesion: 0.36
Nodes (4): RagSearchResult, ragService, RagStats, react-dom

### Community 26 - "rag.indexer.ts"
Cohesion: 0.17
Nodes (11): ragIndexer, STOPWORDS, tokenizeText(), IndexCache, ragService, RagChunk, RagDiskStorage, RagFileManifestItem (+3 more)

### Community 27 - "Layout.tsx"
Cohesion: 0.08
Nodes (16): Box, DividerProps, GridProps, PageBodyProps, PageContainerProps, PanelProps, RowProps, SectionProps (+8 more)

### Community 28 - "compile-bytecode.js"
Cohesion: 0.29
Nodes (3): __dirname, __filename, bytenode

### Community 29 - "templates.service.ts"
Cohesion: 0.27
Nodes (10): getCommunityTemplatesPath(), loadCommunityTemplates(), loadProjectTemplates(), ProjectTemplate, sanitizeTemplateItem(), saveCommunityTemplates(), saveProjectTemplates(), generateTemplateSlug() (+2 more)

### Community 30 - "workspaceService"
Cohesion: 0.22
Nodes (9): getRepoWorkspaceChangesPath(), loadRepoWorkspaceChanges(), recordChange(), saveRepoWorkspaceChanges(), DocumentMetadataItem, extractDocLinksFromMarkdown(), workspaceService, isPathHidden() (+1 more)

### Community 31 - "constants.ts"
Cohesion: 0.06
Nodes (40): CanonicalTemplate, CanonicalTutorial, DEFAULT_TEMPLATE_CREATOR_PROMPT, __dirname, DOCS_DIR, __filename, FRONTEND_DIR, getProjectTemplatesPath() (+32 more)

### Community 32 - "notion-editor-engine.ts"
Cohesion: 0.16
Nodes (16): DictionaryPopoverData, FragmentStatusInfo, AddDictionaryTermModalProps, LinkSynonymModalProps, DictionaryTerm, buildMatchEntries(), decorateHtmlWithTerms(), escapeHtml() (+8 more)

### Community 33 - "devDependencies"
Cohesion: 0.33
Nodes (6): devDependencies, electron, electron-builder, tsx, @types/node, typescript

### Community 34 - "docsMetadataService"
Cohesion: 0.25
Nodes (3): docsMetadataService, extractDocTitleFromMarkdown(), generateDocId()

### Community 36 - "dependencies"
Cohesion: 0.50
Nodes (4): dependencies, bytenode, electron-updater, @napi-rs/keyring

### Community 37 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 38 - "scripts"
Cohesion: 0.11
Nodes (18): name, private, scripts, build, build:frontend, build:server, desktop:build, desktop:dev (+10 more)

### Community 39 - "NotionEditor.tsx"
Cohesion: 0.07
Nodes (39): DocConnectivityBar(), DocConnectivityBarProps, getTagStyle(), TAG_PALETTES, DocumentHistoryDrawer(), FrontmatterHeaderProps, LanguageSelectorDropdown(), LanguageSelectorDropdownProps (+31 more)

### Community 41 - "prsService"
Cohesion: 0.29
Nodes (3): clearWorkspaceChanges(), prsService, isSystemPath()

### Community 42 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 45 - "SlashMenuEngine"
Cohesion: 0.23
Nodes (3): escapeHtml(), SlashCommand, SlashMenuEngine

### Community 46 - "events.service.ts"
Cohesion: 0.17
Nodes (7): chokidar, UI_DIR, UI_DIST_DIR, Client, eventsService, start(), findAvailablePort()

### Community 47 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution, outDir, resolveJsonModule (+7 more)

### Community 48 - "BubbleMenuEngine"
Cohesion: 0.26
Nodes (3): BubbleMenuEngine, createTextFragmentFromSelection(), formatTextFragmentUrl()

### Community 51 - "3. Standard Component Archetypes"
Cohesion: 0.15
Nodes (12): 1. Buttons, 1. Core Principles, 2. Cards & Containers, 2. Color System & Design Tokens (CSS), 3. Navigation, 3. Standard Component Archetypes, 4. Typography Scale (Google Material Design 3 Type Scale), 5. Responsive Design & Window Size Classes (Google M3) (+4 more)

### Community 52 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, rootDir, skipLibCheck (+4 more)

### Community 53 - "WorkbenchCanvas.tsx"
Cohesion: 0.14
Nodes (21): CodeMirrorEditor(), ExcelViewer(), ExcelViewerProps, GenericFileViewer(), GenericFileViewerProps, CodeMirrorEditor, CsvEditor, DocxViewer (+13 more)

### Community 54 - "DraftStoreService"
Cohesion: 0.27
Nodes (3): DocDraft, DraftStore, DraftStoreService

### Community 56 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, oxlint, @types/diff, @types/js-yaml, @types/marked, @types/node, @types/react, @types/react-dom (+3 more)

### Community 57 - "ContextSidebar.tsx"
Cohesion: 0.12
Nodes (26): collapseFilesToReferences(), processNode(), ContextSelectorModal(), ContextSelectorModalProps, expandReferencesToFiles(), findNodeByPath(), getFilesUnderNode(), IndeterminateCheckbox() (+18 more)

### Community 59 - ".scrollToFragment"
Cohesion: 0.33
Nodes (7): calculateSimilarity(), createRangeFromNodeAndOffsets(), findTextFragmentInElement(), levenshteinDistance(), normalizeForSearch(), parseTextFragmentUrl(), TextFragmentQuery

### Community 60 - "TemplatesSubView.tsx"
Cohesion: 0.09
Nodes (43): LanguageSwitcher(), SkillsHubModal(), SkillsHubModalProps, TabMode, TemplatePickerModal(), TemplatePickerModalProps, AlertBanner(), Card() (+35 more)

### Community 61 - "ChatMemoryStore"
Cohesion: 0.27
Nodes (3): ChatMemoryStore, ChatMemoryStoreService, ChatSessionRecord

### Community 62 - "properties"
Cohesion: 0.18
Nodes (11): type, type, type, properties, architecture_pattern, description, lead, repository_url (+3 more)

### Community 63 - "properties"
Cohesion: 0.18
Nodes (11): type, type, properties, type, handle, id, name, role (+3 more)

### Community 67 - "Regra Arquitetural: Taxonomias Dinâmicas e Uso Obrigatório de Cores do `.project.config.json`"
Cohesion: 0.25
Nodes (7): 1. Proibição de Listas Fixas (Zero Hardcoded Taxonomies), 2. Uso Obrigatório das Cores Configuradas nas Chips / Badges, 3. Checklist Obrigatório para Agentes & PRs, O que fazer:, Regra Arquitetural: Taxonomias Dinâmicas e Uso Obrigatório de Cores do `.project.config.json`, Regras Visuais para Chips / Badges:, ADR

### Community 68 - "ai.service.ts"
Cohesion: 0.18
Nodes (10): @anthropic-ai/sdk, @google/generative-ai, DEFAULT_GLOBAL_SYSTEM_PROMPT, AIExecutionResult, AIServiceCallOptions, ChatMessage, RawTurnMetrics, RawTurnTelemetryRecord (+2 more)

### Community 69 - "anyOf"
Cohesion: 0.25
Nodes (8): items, anyOf, statuses, tags, items, type, items, type

### Community 70 - "Regra Arquitetural: Zero Hardcoded Data & Configuração Dinâmica"
Cohesion: 0.29
Nodes (6): 1. Princípio Fundamental (Zero Hardcoding), 2. Padrão Universal: Sugestão $\rightarrow$ Customização $\rightarrow$ Persistência, 3. Checklist de Implementação de Novos Campos / Listas, 4. Validação de Identificadores (Slugs) & Prevenção de Conflitos, 5. Padrão Global de Ícones & Componente `IconPicker`, Regra Arquitetural: Zero Hardcoded Data & Configuração Dinâmica

### Community 74 - "properties"
Cohesion: 0.29
Nodes (7): type, type, type, properties, ai_template_prompt, categories, project

### Community 75 - ".oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 80 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, preview

### Community 81 - "SlashMenu.tsx"
Cohesion: 0.40
Nodes (3): SLASH_COMMANDS, SlashCommandItem, SlashMenuProps

### Community 82 - "main/index.ts"
Cohesion: 0.20
Nodes (5): __dirname, __filename, findAvailablePort(), startEmbeddedServer(), electron

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

### Community 95 - "dependencies"
Cohesion: 0.14
Nodes (14): dependencies, ajv, ajv-formats, @anthropic-ai/sdk, chokidar, diff, fastify, @fastify/cors (+6 more)

### Community 98 - "Button.tsx"
Cohesion: 0.33
Nodes (4): ButtonGroupProps, ButtonProps, ButtonSize, ButtonVariant

## Knowledge Gaps
- **570 isolated node(s):** `name`, `version`, `description`, `type`, `main` (+565 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 685 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `useWorkspace`, `Button.tsx`, `ReposView.tsx`, `Chip.tsx`, `SettingsSubView.tsx`, `NotionEditor.tsx`, `types/index.ts`, `Spinner.tsx`, `StatCard.tsx`, `frontend/package.json`, `SlashMenu.tsx`, `WorkbenchCanvas.tsx`, `i18n/index.ts`, `ContextSidebar.tsx`, `BubbleMenu.tsx`, `Layout.tsx`, `TemplatesSubView.tsx`, `RagSearchModal.tsx`?**
  _High betweenness centrality (0.153) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _570 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `aicenter.service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11014492753623188 - nodes in this community are weakly interconnected._
- **Why does `loadConfig()` connect `loadConfig` to `aicenter.service.ts`, `ai.routes.ts`, `ai.service.ts`, `storage.ts`, `translationsService`, `prWorktreeService`, `prsService`, `app.ts`, `governanceService`, `prSecurityService`, `customToolsService`, `git.ts`, `templates.service.ts`, `workspaceService`, `constants.ts`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **Should `useWorkspace` be split into smaller, more focused modules?**
  _Cohesion score 0.07567567567567568 - nodes in this community are weakly interconnected._
- **Why does `marked` connect `NotionEditor.tsx` to `useWorkspace`, `frontend/package.json`, `SettingsSubView.tsx`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Should `ai.routes.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07236544549977386 - nodes in this community are weakly interconnected._