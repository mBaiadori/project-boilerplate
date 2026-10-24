# Fase 0 — Rede de segurança (CI e gate local)

**Objetivo:** ter um comando único e uma pipeline que provem "nada quebrou" antes de mexer em segurança.
**Resolve:** C10 (testes verdes sem cobrir riscos), ausência de CI.
**Esforço:** pequeno. **Pré-requisitos:** nenhum.

## Passos

### 0.1 Script de gate local
Criar `scripts/verify.sh` (executável) que roda, em ordem e parando no primeiro erro:
1. `cd server && npx tsc --noEmit`
2. `cd server && npm test`
3. `cd frontend && npx tsc -p tsconfig.app.json --noEmit`
4. `cd frontend && npm run build`
5. `node scripts/guards.mjs` (ver 0.2)

Adicionar `"verify": "bash scripts/verify.sh"` no `package.json` da raiz.
**Verifica:** `npm run verify` termina com código 0 no estado atual.

### 0.2 Guardas estáticos (começam permissivos, endurecem nas fases)
Criar `scripts/guards.mjs`: lê um arquivo `scripts/guards.baseline.json` com contagens e **falha se qualquer contagem subir**:
- `executeGitCommand(` de string fora de testes (baseline 132; Fase 1 leva a 0).
- `new Function(` (baseline 1; Fase 2 leva a 0).
- `execAsync(`/`exec(` com string (Fase 1 e 2).
- `dangerouslySetInnerHTML` sem `sanitizeHtml` na mesma expressão (baseline 0).
- `: any`/`as any` (baseline 345/460; só pode descer).
**Verifica:** alterar temporariamente um arquivo para somar uma ocorrência faz `node scripts/guards.mjs` sair com 1.

### 0.3 CI
Criar `.github/workflows/ci.yml` com jobs `server`, `frontend`, `guards` (`npm ci`, tsc, testes, build) em `ubuntu-latest` e `macos-latest`. Adicionar job `audit` com `npm audit --omit=dev --audit-level=high` em modo **informativo** (`continue-on-error: true`); a Fase 5 o torna bloqueante.
**Verifica:** abrir PR de teste e ver os jobs executarem; `npm run verify` local equivale ao CI.

### 0.4 Dependabot
Criar `.github/dependabot.yml` (npm em `/server`, `/frontend`, `/desktop`; github-actions), semanal.

## Gate de saída
- [ ] `npm run verify` passa localmente (67 testes, tsc, build).
- [ ] `node scripts/guards.mjs` passa e falha ao aumentar qualquer contagem.
- [ ] CI roda verde em um PR de teste.
- [ ] Baseline registrada em `scripts/guards.baseline.json`.
