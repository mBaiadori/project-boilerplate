# Fase 1 — Git sem shell (N1)

**Objetivo:** nenhuma entrada externa (mensagem de commit, nome de arquivo/branch/remote, hash) pode ser interpretada por um shell.
**Resolve:** N1 (injeção de comando), C4, C5 (parcial), C6.
**Esforço:** médio a grande (132 chamadas em 10 arquivos). **Pré-requisitos:** Fase 0.

Arquivos com chamadas: `utils/git.ts`, `utils/git-health.ts`, `modules/repos/repos.service.ts`, `modules/prs/{pr-worktree,pr-conflicts,pr-security,prs}.service.ts`, `modules/workspace/workspace.service.ts`, `modules/system/system.service.ts`, `modules/git/git.service.ts`.

## Passos

### 1.1 RED — testes que provam a injeção
Criar `server/src/utils/git-injection.test.ts`. Cada teste cria um repo temporário (`fs.mkdtemp`), tem um **sentinela** (`<tmp>/PWNED`) e afirma que o sentinela **não existe** ao final:
- `commitChanges(repo, 'x $(touch PWNED)')` e com crases.
- Arquivo chamado `$(touch PWNED).md` passando por `commitChanges(..., [file])` e por `git-health` (conflito `--ours`).
- Branch `a$(touch PWNED)` em `createAndCheckoutBranch` e fluxos de worktree de PR.
- `syncGit(repo, 'origin; touch PWNED', 'main')` e `rollbackToCommit(repo, 'HEAD; touch PWNED')`.
- Injeção de argumento: remote `--upload-pack=touch PWNED`.
**Verifica:** `cd server && npm test` → estes testes **falham** hoje. Anote quais.

### 1.2 Infraestrutura segura
Em `utils/git.ts`:
- Extrair `buildGitEnv(token)` (já existe a lógica `GIT_CONFIG_*`).
- Criar `executeGit(args: string[], cwd, opts?)` com `execFile('git', args, { shell:false, env, timeout, maxBuffer })` e a mesma redação de token (inclusive o base64).
- Criar `utils/git-validate.ts`: `assertCommitish` (`^[0-9a-fA-F]{4,40}$` ou ref válida), `assertRemoteName` (`^[A-Za-z0-9._-]+$`, sem `-` inicial), `assertRefName` (regex + `git check-ref-format --branch` via `executeGit`), `assertRelPath` (sem NUL, sem `-` inicial; sempre usar `--` antes de caminhos).
- Testes unitários dos validadores com entradas boas e hostis.
**Verifica:** `npm test` com os testes dos validadores passando.

### 1.3 Migrar os pontos críticos primeiro
Na ordem: `commitChanges` (usar `commit -m <msg>` como argumento, sem escapar), `git add -- <file>`, `git-health` (`checkout --ours -- <f>`), `syncGit`, `rollbackToCommit` (`assertCommitish`; trocar `checkout main` fixo por branch default detectada: resolve C4), `pr-worktree`, `pr-conflicts`.
**Verifica:** os testes RED de 1.1 agora **passam** e nenhum teste antigo quebra.

### 1.4 Migrar o resto por arquivo
Um arquivo por commit. Substituir `executeGitCommand("git x \"${v}\"", cwd)` por `executeGit(["x", v], cwd)`.
**Verifica por arquivo:** `npm test` + `npx tsc --noEmit`; a contagem do guard `executeGitCommand(` cai e o baseline é reduzido.

### 1.5 Remover a API de string
- Apagar `executeGitCommand` (ou deixá-la lançando erro) e o regex `isNetworkCmd`.
- Reduzir o baseline do guard para 0.
- C5: antes de `reset --hard` em `rollbackToCommit`, abortar se houver mudanças não commitadas, a menos que a rota envie `force:true`; teste cobrindo os dois casos.

## Gate de saída
- [ ] `git-injection.test.ts` verde (todos os sentinelas ausentes).
- [ ] `grep -rn "executeGitCommand(" server/src` fora de testes = 0 e `execAsync(` ausente de `git.ts`.
- [ ] `npm run verify` verde; contagem de testes subiu (≥ 67 + novos).
- [ ] Teste manual curto: clonar um repo de teste, editar um doc, commitar com a mensagem `a "b" $HOME \`c\`` e conferir que o texto aparece literal no `git log`.
