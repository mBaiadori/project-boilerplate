# Fase 5 — Qualidade, testes e CI

**Objetivo:** o CI valida o que o projeto realmente entrega e ninguém baixa a barra sem ser notado.
**Resolve:** testes do frontend fora do CI, lint ausente do CI, `strict`, `audit` não bloqueante, segredos, ambiguidade de refs no Git.
**Esforço:** grande. **Pré-requisitos:** Fase 0.
Arquivos: [ci.yml](../../../.github/workflows/ci.yml), `frontend/tsconfig.app.json`, `frontend/package.json`, `scripts/guards.mjs`, `scripts/guards.baseline.json`, `.github/dependabot.yml`, `git.ts`.

## Passos

### 5.1 CI
- Job `frontend`: acrescentar `npx vitest run` e `npx oxlint` (já há script `lint`). Falhar em warning novo via `--deny-warnings` se viável.
- Job `audit`: remover `continue-on-error`; `--audit-level=high` bloqueante em `server/` e `frontend/`.
- Job novo `secrets`: `gitleaks/gitleaks-action` com config que ignora `*.test.ts`.
- Job novo `desktop-build` (só em PR para `main`): `npm --prefix desktop run build:ts`.
- Cache de `npm` e `concurrency` com `cancel-in-progress` para PRs.
- `CODEOWNERS`: `scripts/guards.baseline.json`, `.github/workflows/*`, `server/src/security/*`, `server/src/utils/git-validate.ts` exigem revisão do dono.

### 5.2 Testes que faltam (RED→GREEN)
- **Git:** nomes de branch/arquivo com espaço, `-`, `$()`, `:`, unicode, em fuzz de propriedade (200 casos aleatórios) passando por `createAndCheckoutBranch`, `commitChanges`, `executeGit`.
- **Ambiguidade:** `checkout`/`branch`/`diff` com nome igual a arquivo; usar `--end-of-options` (Git ≥ 2.24) ou `git switch` em `createAndCheckoutBranch` (hoje `checkout safeName` sem `--`). Teste com branch chamada `HEAD`/`main.md`.
- **Merge 3-way, governança (`canAccessDocument`, `denied_paths`)**: tabelas de casos.
- **Frontend:** `parseInlineMarkdown`, `isSafeUrl`, `WorkspaceContext` reducer e serialização do editor (round-trip markdown → HTML → markdown).
- Meta: cobertura de linhas ≥ 60% em `server/src/utils` e `security`, medida por `node --experimental-test-coverage`, registrada no baseline e só pode subir.

### 5.3 Tipagem e lint
- Frontend `strict` por pastas: criar `tsconfig.strict.json` com `include` crescente (`utils/`, `services/`, depois `components/`). Rodar no CI.
- Servidor: ligar `noUncheckedIndexedAccess` primeiro em `utils/` e `security/`.
- `any`: baseline 355/456 só desce; meta −10% por fase.
- Adicionar guard `ts_ignore = 0` e `eslint_disable`/`oxlint-disable` com baseline.

### 5.4 Higiene do repositório
- Dependabot já existe; agrupar por ecossistema e semanal.
- `scripts/kill-stale-tests.sh` (Fase 0) documentado.
- `graphify update .` no hook `pre-push` opcional.

## Gate de saída
- [ ] CI em PR roda: tsc ×2, testes ×2 (server + vitest), oxlint, build, guards, audit bloqueante, gitleaks.
- [ ] Fuzz de Git passando sem flakiness em 5 execuções seguidas.
- [ ] `tsconfig.strict.json` cobre ao menos `utils/` e `services/` do frontend.
- [ ] `CODEOWNERS` ativo e branch protection exigindo o CI.
- [ ] Cobertura registrada e baseline versionado.
