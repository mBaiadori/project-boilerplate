# Fase 0 — Recursão no Git, segurança dos testes e timeouts (B1, R1, R2)

**Objetivo:** a suíte termina, não toca no `config.json` real e o CI não fica preso.
**Resolve:** B1, R1, R2.
**Esforço:** pequeno. **Pré-requisitos:** nenhum. **Prioridade:** P0.
Arquivos: [git.ts](../../../server/src/utils/git.ts) (`getGitBranches` ~L696, `getDefaultBranch` ~L812, `getGitStatus` ~L587, `pullGitRepo` ~L522), `server/package.json` (script `test`), [ci.yml](../../../.github/workflows/ci.yml), `config-migration.test.ts`, `storage-vault.test.ts`, `default-branch.test.ts`.

## Contexto
O commit `ed4bf9f` fez `getGitBranches` chamar `getDefaultBranch`, que chama `getGitBranches` no passo 2. Cada volta dispara `git` indefinidamente. Vi 10 processos de teste girando em CPU, alguns há 3 h. O working tree tem um conserto parcial (volta a `"main"` literal dentro de `getGitBranches`).

## Passos

### 0.1 RED — testes (`git.recursion.test.ts`, repo temporário real)
- Conta chamadas a `executeGit` (via wrapper/spy ou contador injetável) durante `getGitBranches(repo)`: no máximo 3.
- Idem para `getGitStatus(repo)` e `getDefaultBranch(repo)`: nenhuma reentrada. Use `--test-timeout=10000` para o teste falhar em vez de travar.
- Repo com branch `master` e sem `origin`: `getDefaultBranch` retorna `master`; `getGitBranches().current` retorna `master`.
- Repo vazio (sem commits): `getGitBranches` e `getDefaultBranch` retornam sem lançar.
**Verifica:** no commit `ed4bf9f` o teste estoura o timeout.

### 0.2 Implementação (B1)
- Regra de dependência: **`getDefaultBranch` só pode chamar `executeGit`**, nunca `getGitBranches` nem `getGitStatus`. Troque o passo 2 por `executeGit(['for-each-ref','--format=%(refname:short)','refs/heads'])` e escolha `main`, depois `master`, depois o primeiro.
- `getGitBranches` e `getGitStatus` recebem o fallback via `getDefaultBranch` **só no caminho de erro**, nunca no caminho feliz.
- Se o conserto parcial do working tree for mantido, adicione ao menos o teste 0.1 antes do commit.
**Verifica:** `cd server && npx tsx --test --test-timeout=30000 src/utils/git.test.ts src/modules/repos/default-branch.test.ts`.

### 0.3 Isolamento do config (R1)
- Em `server/package.json`: `"test": "node ../scripts/run-tests.mjs"`, script que cria `fs.mkdtempSync` e chama `tsx --test --test-timeout=60000 'src/**/*.test.ts'` com `CONTEXT_OS_USER_DATA=<tmp>` e `HOME=<tmp>` (isola também `~/.context-os/session-token` e o cofre).
- `constants.ts` L11 lê `CONTEXT_OS_USER_DATA`; confirme que `CONFIG_PATH`, `PROJECTS_CONFIG_PATH` e o cofre derivam dele.
- Nos 3 testes citados, remover o backup/restore do arquivo real (deixar apenas por segurança) e **abortar com erro** se `CONFIG_PATH` apontar para fora de `os.tmpdir()`.
- RED: teste que lê `CONFIG_PATH` e falha se não estiver sob `os.tmpdir()`.
**Verifica:** rode `npm test`, depois `stat config.json`: o `mtime` não muda. `shasum config.json` antes e depois idêntico.

### 0.4 Timeouts (R2)
- `ci.yml`: `timeout-minutes: 15` em cada job (`server`, `frontend`, `guards`, `audit`).
- Script de teste já com `--test-timeout=60000` (0.3).
- Limpeza local: script `scripts/kill-stale-tests.sh` (`pkill -f "tsx --test"`) documentado no README da raiz.
**Verifica:** simular teste que dorme 2 min e confirmar que falha em 60 s.

### 0.5 Processo
- PR a partir de branch (`fix/v4-git-recursion`); CI roda no PR antes do merge.
- `.github/pull_request_template.md` já existe: incluir item "CI rodou sobre este commit".

## Gate de saída
- [x] `npm test` do servidor termina em < 3 min com todos os testes verdes (2,45s, 139 testes passando).
- [x] Teste de não recursão presente e falhando no commit `ed4bf9f` (validado em git.recursion.test.ts).
- [x] `config.json` e `~/.context-os/` intactos após `npm test` (hash igual).
- [x] `timeout-minutes` em todos os jobs; `--test-timeout` no runner.
- [x] Nenhum processo `tsx --test` restante: `ps aux | grep "[t]sx --test"` vazio.
