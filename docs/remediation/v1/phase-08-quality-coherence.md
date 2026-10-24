# Fase 8 — Qualidade e coerência (C2–C9, C11 e dívida técnica)

**Objetivo:** reduzir dívida que faz os bugs voltarem: tipagem, lint, escrita atômica, defaults coerentes, monólitos.
**Resolve:** C2, C3, C7, C8, C9, C11, parte de C5, itens da seção 4 do relatório.
**Esforço:** grande, mas incremental; cada passo é independente e pode virar PR próprio. **Pré-requisitos:** Fase 0.

## Passos

### 8.1 Coerência de configuração
- **C2:** uma única constante `DEFAULT_AI_SETTINGS` em `server/src/config/constants.ts` usada por `storage.ts`, `settings.service.ts`, `auth.service.ts`; alinhar `config.example.json`.
  RED: teste que compara todos os defaults (storage, settings, example) e exige igualdade.
- **C3:** não sobrescrever `default_branch` com a branch atual; ler da API do provedor/`origin/HEAD`. Teste: criar branch de feature e confirmar que `default_branch` permanece.
- **C8:** substituir o sentinela `"local_mode"` por campo explícito `mode: 'local' | 'remote'`; migrar config existente (teste de migração).
- **C9/C7:** documentar `dev1` (README) e definir o nome do produto/pacote em um só lugar.

### 8.2 Escrita atômica em todos os JSON
Criar `utils/atomic-write.ts` (`tmp` + `fsync` + `rename`) e trocar os ~12 `writeFileSync` de estado (metadata, dicionário, templates, `workspace_changes.json`, projetos).
RED: teste que simula falha entre escrita e rename e confirma que o arquivo original permanece íntegro.
Guard: novos `writeFileSync` de `.json` fora do utilitário falham o `guards.mjs`.

### 8.3 Build portátil (C11)
Trocar `cp -r` por script Node (`scripts/copy-schemas.mjs`). **Verifica:** `npm --prefix server run build` e `node dist/server.js` funcionam; rodar no CI em macOS e Windows.

### 8.4 Tipagem
- Frontend: ativar `strict` em `tsconfig.app.json` **por etapas**: primeiro `noImplicitAny`, depois `strictNullChecks`. Usar `tsc` com lista de exceções por arquivo (`// @ts-nocheck` proibido; usar um `tsconfig.strict.json` com `include` crescente).
- Reduzir `any` por módulo; o guard de `any` só desce (baseline 345/460 → meta −30% por rodada).
**Verifica:** `tsc` verde em cada etapa; o número do baseline diminui no commit.

### 8.5 Lint e formatação
ESLint (`typescript-eslint`, `react-hooks`, `no-restricted-syntax` para `new Function`/`child_process.exec`) e Prettier; adicionar ao `verify.sh` e ao CI. Começar em modo `warn`, subir para `error` por pasta.

### 8.6 Testes de cobertura nas áreas de risco
Meta mínima de testes novos: governança (`canAccessDocument`, `denied_paths`), merge 3-way, `workspace.save/import`, auth/vault, rotas protegidas. Medir com `c8` e registrar a cobertura inicial como baseline que só sobe.

### 8.7 Monólitos restantes
Ordem: `WorkspaceContext.tsx` (dividir por domínio, selectors), `notion-editor-engine.ts`, `governance.service.ts`, `prs.service.ts`, `repos.service.ts`, `git.ts`. Regra: refatoração sem mudança de comportamento, com testes escritos **antes** da divisão (characterization tests).
Guard: nenhum arquivo novo acima de 1.500 linhas; lista de exceções só encolhe.

### 8.8 Higiene do repositório
Remover `.DS_Store` e `.VSCodeCounter` do índice se versionados; mover `docs/*-main` para fora do repo ou submódulo; `CODEOWNERS`.

## Gate de saída (por sub-passo, e global ao final)
- [x] Cada sub-passo termina com `npm run verify` verde.
- [x] Defaults de IA idênticos em todos os pontos (teste verde: `config-coherence.test.ts`).
- [x] Escrita atômica em JSON de estado (`atomic-write.ts` e `atomic-write.test.ts`).
- [x] Build portátil cross-platform C11 (`scripts/copy-schemas.mjs`).
- [x] Preservação de `default_branch` e resolução via origin/HEAD (`default-branch.test.ts`).
- [x] Migração de sentinela `local_mode` para campo explícito `mode` (`config-migration.test.ts`).
- [x] Documentação e higiene do repositório (`README.md` com `dev1` e Context OS).
