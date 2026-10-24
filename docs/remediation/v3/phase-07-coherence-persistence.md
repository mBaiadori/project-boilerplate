# Fase 7 — Coerência, persistência e monólitos

**Objetivo:** configuração e dados consistentes, escrita em disco à prova de falha, estrutura mais fácil de manter.
**Resolve:** C1, C5, C6, C7, C9, C10, persistência não atômica, monólitos, backup do `config.json`.
**Esforço:** médio a grande. **Pré-requisitos:** Fase 0 (C4 já está na Fase 2).

## Passos

### 7.1 Persistência atômica
- `server/src/utils/atomic-write.ts`: `writeJsonAtomic(path, data)` (tmp no mesmo diretório, `fsync`, `rename`, modo 0o600 para segredos).
- Migrar `tool-approvals.json`, `workspace_changes.json`, metadados, dicionário, templates, token de sessão.
- Guard `writeFileSync_json` com baseline que só desce.
- Backup rotativo do `config.json` (`config.json.bak`, últimos 3) antes de cada escrita; ação "restaurar" nas configurações.

### 7.2 Coerência de configuração
- **C1:** `default_branch` do repo ativo nunca deve receber a branch atual. Localizar escrita (`repos.service.ts` L465/L651) e separar `default_branch` de `current_branch`; teste com repo em `gov/update-2675`. Corrigir o valor atual em `config.json`.
- **C5:** `rollbackToCommit`: recusar com working tree sujo (ou `git stash` automático com aviso), sem `reset --hard` implícito; teste com alteração não commitada.
- **C7:** substituir o sentinela `local_mode` no campo `token` por campo `mode: 'local' | 'github'`; migração de `config.json` existente.
- **C9:** documentar `dev1` (porta 4101, `.user2-data`) no README ou remover.
- **C6:** decidir o nome único do produto e alinhar pasta, `package.json` (`spec-driven-context-os`) e UI.
- **C10:** decidir se `docs/remediation/` sai do `.gitignore`.

### 7.3 Build multiplataforma
- `server/package.json`: `build` hoje usa `tsc && node ../scripts/copy-schemas.mjs`; confirmar que nenhum script restante usa `cp -r`/`rm -rf` (`grep -rn "cp -r\|rm -rf" package.json */package.json`) e trocar por scripts Node.
- Rodar o job de build também em `windows-latest`.

### 7.4 Monólitos (um por PR, sem mudar comportamento)
- Ordem sugerida: `WorkspaceContext.tsx` (dividir por domínio: workspace, repos, PRs, IA), `notion-editor-engine.ts`, `git.ts`, `prs.service.ts`, `governance.service.ts`.
- Regra: testes de caracterização antes de mover código; commit só de movimentação.
- Limite de tamanho por arquivo no `guards.mjs` (ex.: 1.500 linhas, baseline por arquivo).

## Gate de saída
- [ ] Nenhum `writeFileSync` direto em JSON de estado (guard).
- [ ] `default_branch` estável; teste cobre.
- [ ] `rollbackToCommit` não perde trabalho sujo; teste cobre.
- [ ] Build verde em Ubuntu, macOS e Windows.
- [ ] Nenhum arquivo novo acima do limite; os existentes não crescem.
