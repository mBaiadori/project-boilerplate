# Fase 0 — PR e CI como porta de entrada

**Objetivo:** nenhuma mudança chega a `main` sem o CI verde.
**Resolve:** risco operacional 1 (remediação sem validação), CI nunca executado sobre `12cc57d`.
**Esforço:** pequeno. **Pré-requisitos:** nenhum.

## Passos

### 0.1 Validar o commit atual no CI
- Criar branch `chore/validate-12cc57d` a partir de `main`, abrir PR vazio e esperar `ci.yml`.
- Se algo falhar em Ubuntu e passar no macOS (caminhos, `cp -r`, case sensitivity), corrigir aqui.
**Verifica:** os 4 jobs (server, frontend, guards, audit) verdes.

### 0.2 Proteger `main`
- GitHub → Settings → Branches: exigir PR, exigir os jobs `server`, `frontend`, `guards`, proibir force-push.
- Em `ci.yml`, trocar o gatilho `push` de `main` por apenas `pull_request` + `push` de `main` (já está), mantendo `gov/*`, `feat/*`, `fix/*`.

### 0.3 Versionar os planos
- `docs/remediation/` está no `.gitignore` (C10); este diretório (`remediation-v3`) não está. Decidir se `docs/remediation/` deve sair do ignore.

### 0.4 Template de PR
- `.github/pull_request_template.md` com checklist: RED escrito, gate da fase, nenhum baseline do guards aumentado.

## Gate de saída
- [ ] PR de validação com CI verde.
- [ ] Proteção de branch ativa.
- [ ] Template de PR commitado.
