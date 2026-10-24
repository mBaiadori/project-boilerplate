# Plano de Remediação — Context OS

Origem: reauditoria de 2026-10-24 (achados N1–N7, incoerências C1–C11).
Cada fase é um arquivo independente, executável e verificável sozinho.

## Como executar uma fase
1. Abra o arquivo da fase e confira os **pré-requisitos**.
2. Escreva primeiro os testes marcados como **RED** e confirme que falham (provam o bug).
3. Implemente os passos na ordem. Cada passo termina com um comando de verificação.
4. Rode o **Gate de saída**. A fase só fecha se todos os itens passarem.
5. Marque a fase na tabela abaixo e faça um commit por fase (`fix(security): fase NN – …`).

> Regra: não pule o RED. Um teste que nunca falhou não prova nada.
> Regra: uma fase não pode enfraquecer o gate de outra (nada de `skip`, `@ts-ignore` novo ou limite reduzido).

## Fases

| Fase | Arquivo | Resolve | Prioridade | Esforço | Depende de | Status |
|---|---|---|---|---|---|---|
| 0 | [phase-00-safety-net.md](phase-00-safety-net.md) | C10, base de CI | P0 | P | — | 🟢 Concluído |
| 1 | [phase-01-git-no-shell.md](phase-01-git-no-shell.md) | N1 | P0 | M-G | 0 | 🟢 Concluído |
| 2 | [phase-02-custom-tools.md](phase-02-custom-tools.md) | N2 | P0 | M | 0 | 🟢 Concluído |
| 3 | [phase-03-api-auth.md](phase-03-api-auth.md) | N3 | P0 | M | 0 | 🟢 Concluído |
| 4 | [phase-04-paths-symlinks.md](phase-04-paths-symlinks.md) | N4 | P1 | P | 0 | 🟢 Concluído |
| 5 | [phase-05-dependencies.md](phase-05-dependencies.md) | N6 | P1 | P-M | 0 | 🟢 Concluído |
| 6 | [phase-06-frontend-xss.md](phase-06-frontend-xss.md) | N7 (XSS) | P1 | M | 0 | 🟢 Concluído |
| 7 | [phase-07-server-hardening.md](phase-07-server-hardening.md) | N5, N7 | P1-P3 | M | 3 | 🟢 Concluído |
| 8 | [phase-08-quality-coherence.md](phase-08-quality-coherence.md) | C2–C9, C11, qualidade | P2-P3 | G | 0 | 🟢 Concluído |

Ordem recomendada: 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8. As fases 4, 5 e 6 podem ser feitas em paralelo depois da 3.

## Convenções de verificação
- Servidor: `npm --prefix server test` e `npx --prefix server tsc --noEmit` (de `server/`: `npx tsc --noEmit`).
- Frontend: `cd frontend && npx tsc -p tsconfig.app.json --noEmit`.
- Auditoria de deps: `npm audit --omit=dev --audit-level=high` em `server/` e `frontend/`.
- Testes novos ficam ao lado do código (`*.test.ts`), runner `node:test` via `tsx` (já configurado).
- Validação visual de UI é feita por você no navegador; as fases só dão passos manuais curtos quando inevitável.

## Linha de base (antes de começar)
- Servidor: 67 testes passando, `tsc` limpo.
- `npm audit --omit=dev`: servidor 4 (1 alta), frontend 7 (6 altas).
- `executeGitCommand(` (string): 132 chamadas em 10 arquivos.
- `any`: 345 frontend, 460 servidor. Sem CI, sem ESLint.
