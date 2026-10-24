# Plano de Remediação v3 — Context OS

Origem: revisão v3 de 2026-10-24 (achados S1–S6, incoerências C1–C10), feita sobre o commit `12cc57d`.
Cada fase é um arquivo independente, executável e verificável sozinho.

## Como executar uma fase
1. Confira os **pré-requisitos** do arquivo da fase.
2. Escreva primeiro os testes marcados **RED** e confirme que falham (provam o problema).
3. Implemente os passos na ordem; cada passo termina com um comando de verificação.
4. Rode o **Gate de saída**. A fase só fecha se todos os itens passarem.
5. Um PR por fase (`fix(security): v3 fase NN – …`). O CI precisa ficar verde antes do merge.

> Regra: não pule o RED.
> Regra: uma fase não pode enfraquecer o gate de outra (nada de `skip`, `@ts-ignore` novo, baseline de `scripts/guards.baseline.json` aumentado).
> Regra: nunca commitar direto em `main`; foi o que deixou o CI sem validar o commit `12cc57d`.

## Fases

| Fase | Arquivo | Resolve | Prioridade | Esforço | Depende de | Status |
|---|---|---|---|---|---|---|
| 0 | [phase-00-pr-and-ci.md](phase-00-pr-and-ci.md) | Risco operacional 1, CI nunca rodou | P0 | P | — | 🟢 |
| 1 | [phase-01-session-hardening.md](phase-01-session-hardening.md) | S1, S5, C2, C3 | P0 | M | 0 | 🟢 |
| 2 | [phase-02-git-refs.md](phase-02-git-refs.md) | S2, C4 | P0 | M | 0 | 🟢 |
| 3 | [phase-03-custom-tools.md](phase-03-custom-tools.md) | S3, S4 | P1 | M | 1 | 🟢 |
| 4 | [phase-04-server-hardening.md](phase-04-server-hardening.md) | S6 (servidor) | P2-P3 | M | 1 | 🟢 |
| 5 | [phase-05-frontend-xss.md](phase-05-frontend-xss.md) | S6 (innerHTML) | P1 | M | 0 | 🟢 |
| 6 | [phase-06-quality-ci.md](phase-06-quality-ci.md) | Qualidade, testes, CI | P2 | G | 0 | ⬜ |
| 7 | [phase-07-coherence-persistence.md](phase-07-coherence-persistence.md) | C1, C5–C10, persistência, monólitos | P2-P3 | M-G | 0 | ⬜ |
| 8 | [phase-08-product-privacy.md](phase-08-product-privacy.md) | Riscos 2–8, LGPD, ideias | P3 | G | 1, 3 | ⬜ |

Ordem recomendada: 0 → 1 → 2 → 3 → 4 → 8. As fases 5, 6 e 7 podem andar em paralelo depois da 0.

## Convenções de verificação
- Servidor: `cd server && npx tsc --noEmit && npm test`.
- Frontend: `cd frontend && npx tsc -p tsconfig.app.json --noEmit`.
- Guards: `node scripts/guards.mjs`.
- Deps: `npm audit --omit=dev --audit-level=high` em `server/` e `frontend/`.
- Testes novos ficam ao lado do código (`*.test.ts`), runner `node:test` via `tsx`.
- Validação visual de UI é feita por você no navegador.

## Linha de base (commit `12cc57d`)
- Servidor: 126 testes passando; frontend: 2 arquivos de teste.
- `npm audit --omit=dev`: 0 vulnerabilidades nos dois.
- `any`: 355 frontend, 456 servidor (baseline do guards).
- `err.message`: 169 pontos; `console.*`: 124 no servidor.
- `splitCommandToArgs` em uso em `server/src/utils/git.ts`; sem validador de refs.
