# Fase 6 — Qualidade, testes e CI

**Objetivo:** a barra de qualidade passa a ser um contrato verificado, não convenção.
**Resolve:** frontend sem `strict` (C8), sem ESLint/Prettier, 2 testes no frontend, `any` alto, `audit` não bloqueante, sem gitleaks.
**Esforço:** grande, em incrementos. **Pré-requisitos:** Fase 0.

## Passos

### 6.1 Lint e format
- ESLint (`typescript-eslint`, `react-hooks`, `no-floating-promises`, `no-unsafe-*` em modo aviso inicial) e Prettier em `server/`, `frontend/`, `desktop/`.
- Aplicar Prettier num commit isolado (`style: prettier`), sem mistura com lógica.
- CI: job `lint` com `--max-warnings` igual ao número atual (baseline que só desce).

### 6.2 Tipagem
- Frontend: ligar `strict` por etapas (`noImplicitAny`, `strictNullChecks`), corrigindo por pasta; usar `tsconfig.strict.json` com `include` crescente enquanto houver pendências.
- `any`: reduzir os baselines 355/456 em ≥ 10% por PR de fase; `noUncheckedIndexedAccess` nos módulos novos.

### 6.3 Testes que faltam
- Servidor: governança (`canAccessDocument`, `denied_paths`), merge 3-way, bootstrap/CORS (Fase 1), refs Git (Fase 2), approvals (Fase 3).
- Frontend: `WorkspaceContext` (reducers), `sanitize`, diff viewer, fluxo de salvar/dirty.
- Cobertura mínima com `c8`/`vitest --coverage`: iniciar no valor atual e subir (só sobe).

### 6.4 CI
- Remover `continue-on-error` do job `audit` (`--audit-level=high`).
- Adicionar `gitleaks` e `actions/dependency-review-action` em PR.
- Job de build desktop (Linux, sem assinar) para pegar quebra de empacotamento.
- Dependabot já existe: agrupar atualizações de minor/patch.

## Gate de saída
- [ ] `lint`, `tsc`, testes, `guards`, `audit`, `gitleaks` obrigatórios na proteção de branch.
- [ ] Frontend com `strict` ligado em pelo menos as pastas novas e plano para o resto.
- [ ] Cobertura registrada e não regride.
- [ ] Baselines de `any` menores que 355/456.
