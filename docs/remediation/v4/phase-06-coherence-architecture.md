# Fase 6 — Coerência e arquitetura (C6–C13, monólitos)

**Objetivo:** reduzir acoplamento (a causa de B1) e eliminar incoerências de identidade, config e convenções.
**Resolve:** C6, C7, C8, C9, C10, C11, C13, monólitos.
**Esforço:** médio a grande. **Pré-requisitos:** Fase 0.
Arquivos: `package.json` (raiz), `server/src/utils/git.ts`, `frontend/src/context/WorkspaceContext.tsx`, `notion-editor-engine.ts`, `.gitignore`, `docs/`.

## Passos

### 6.1 Separar `git.ts` (~1.550 linhas) — previne novo B1
- `git-core.ts`: `executeGit`, `buildGitEnv`, `redactTokens`, `executeGitCommandWithProgress`. **Não importa nada do resto.**
- `git-queries.ts`: `getGitStatus`, `getGitBranches`, `getDefaultBranch`, `getGitLog`, `getGitDiff` (só leitura, depende de `git-core`).
- `git-ops.ts`: `commitChanges`, `createAndCheckoutBranch`, `pull`, `sync`, `rollbackToCommit` (depende de `queries`).
- `git.ts` vira reexportação para não quebrar imports.
- Guard `import_cycle`: `npx madge --circular server/src` no CI (ou script próprio). RED: o ciclo B1 faria o guard falhar.
**Verifica:** `npx madge --circular --extensions ts server/src` retorna vazio; `npm test` verde.

### 6.2 Identidade do produto (C6)
- Escolher um nome (ex.: **Context OS**) e uniformizar: `package.json` raiz (`name`), pasta do repositório documentada no README, `desktop` (`productName`, `appId`), `window title`, caminho `~/.context-os`.
- Não renomear pasta local sem aviso; apenas docs e metadados.

### 6.3 Config e auth (C7)
- Substituir `local_mode` como token sentinela por campo explícito `auth_mode: 'github' | 'local'` em `config.json`, com migração em `config/storage.ts` e teste em `config-migration.test.ts`.

### 6.4 Scripts multiplataforma (C9)
- `dev1` do `package.json` raiz usa variáveis inline (não funciona no Windows): migrar para `cross-env` ou `scripts/dev-user2.mjs`.
- Confirmar `build` do servidor sem `cp -r` (já usa `copy-schemas.mjs`).

### 6.5 Versionar a remediação (C10) e limpar docs
- Remover `docs/remediation/` e `docs/remediation-v3/` do `.gitignore` (ou manter só `docs/remediation/**/scratch`), e commitar v1–v4.
- Mover `docs/ECC-main`, `docs/ai-memory-main`, `docs/skills-main`, `PROBLEM.txt`, `fet.txt` para fora do repo ou documentar por que ficam; garantir que `docs/*-main/` está ignorado.

### 6.6 Autor dos commits (C11)
- Definir `user.name`/`user.email` reais no repositório e no ambiente de CI/automação; rejeitar commits `test@example.com` com `git log --format=%ae` num hook ou check de PR.
- Em `git.test.ts`, garantir que `user.email=test@example.com` é configurado **apenas** no repositório temporário (confirmar que `git config --local` roda dentro de `repoDir`, não do repo do projeto).

### 6.7 Estado e erros (C13)
- Padronizar: serviços **lançam** `AppError(code, status, safeMessage)`; rotas não montam `{success:false}`. Migrar por módulo, começando por `skills` e `repos`.
- Frontend: um único `ApiError` com `code` e `requestId`.

### 6.8 Estado global do frontend
- Dividir `WorkspaceContext` (2.030 linhas) em stores por domínio (workspace, git, ai, governança) com seletores (`useSyncExternalStore`/Zustand já em uso? confirmar) e `React.lazy` nas views pesadas (`AccessGovernanceManager`, `RawInspectorSidebar`, `AICopilotPanel`, `FirstRunWizard`).
- `notion-editor-engine.ts` (2.731): separar parser (`markdown-parse.ts`), serializador (`markdown-serialize.ts`), menus e blocos; manter API pública.
- Fazer em PRs pequenos; cada PR deve manter `tsc` e vitest verdes e **não aumentar** o baseline de `any`.

## Gate de saída
- [ ] Nenhum ciclo de import em `server/src` (guard no CI).
- [ ] Nome do produto uniforme em `package.json`, desktop e README.
- [ ] `auth_mode` explícito e migração testada.
- [ ] `dev1` funciona em Windows (ou documentado como só Unix).
- [ ] `docs/remediation/` versionada.
- [ ] Nenhum commit com autor `test@example.com` no `main` após a fase.
- [ ] `WorkspaceContext.tsx` e `notion-editor-engine.ts` abaixo de 1.200 linhas cada.
