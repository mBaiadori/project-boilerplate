# Fase 2 — Refs e argumentos Git seguros (S2, C4)

**Objetivo:** nenhum valor vindo de requisição, de repo clonado ou de PR remoto vira opção, refspec ou argumento mal tokenizado do Git.
**Resolve:** S2, C4 (`main` fixo, string vs array).
**Esforço:** médio. **Pré-requisitos:** Fase 0.
Arquivos: [git.ts](../../server/src/utils/git.ts) (`splitCommandToArgs` L183, `executeGitCommand`), [pr-worktree.service.ts](../../server/src/modules/prs/pr-worktree.service.ts#L32), `pr-conflicts.service.ts`, `git-health.ts`, `git.service.ts`.

## Passos

### 2.1 RED — testes (`git.refs.test.ts`, repo temporário real)
- `assertSafeRef` rejeita: `--upload-pack=touch /tmp/x`, `-c`, `a..b`, `a:b`, `a b`, vazio, `@{`, `..`, controle/NUL, > 255 chars. Aceita: `main`, `feat/x-1`, `gov/update-2675`.
- `assertSafeHash` aceita `^[0-9a-f]{4,64}$` apenas.
- Branch de PR chamada `--upload-pack=...` → `fetchPrBranch` lança erro e **não** cria `/tmp/x`.
- Arquivo `meu arquivo.md` e `a"b.md` passam por stage/commit corretamente.
- Mensagem de commit com `$(...)`, crases, `\`, `-m` embutido → gravada literalmente.
**Verifica:** hoje os de refs e de arquivos com espaço falham.

### 2.2 Implementação
- `server/src/utils/git-args.ts`: `assertSafeRef`, `assertSafeHash`, `assertSafeRemote` (usa regex e `git check-ref-format --branch` via `execFile`). Tipos opacos `GitRef`, `GitHash` que só o validador produz.
- Em todo uso de `executeGit([...])` com valor externo: validar antes, usar `--end-of-options` (Git ≥ 2.24) ou `--` antes de caminhos.
- `pr-worktree.service.ts`: refspec montado só com ref validada; `fetch origin -- <refspec>`.
- Remover `executeGitCommand(string)` e `splitCommandToArgs` depois de confirmar com `grep -rn "executeGitCommand(" server/src` que não restam chamadores (hoje a única ocorrência é a própria definição).
- C4: função `getDefaultBranch(repoDir)` (usa `symbolic-ref refs/remotes/origin/HEAD`, com fallback) e usá-la nos `"main"` fixos de `git.ts` (L591, L654, L764–770, L878–905, L1017).

### 2.3 Guard
- Em `scripts/guards.mjs` adicionar guard `git_string_exec = 0` e `git_main_literal` com baseline atual (só pode descer).
**Verifica:** `cd server && npx tsc --noEmit && npm test && node ../scripts/guards.mjs`.

## Gate de saída
- [ ] Todos os testes de 2.1 verdes, incluindo o de "não cria /tmp/x".
- [ ] `splitCommandToArgs` e `executeGitCommand` removidos.
- [ ] Repo de teste com default `master` funciona em sync/rollback.
- [ ] Guards atualizados e verdes.
