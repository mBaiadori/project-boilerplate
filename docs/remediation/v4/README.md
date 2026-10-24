# Plano de Remediação v4 — Context OS

Origem: revisão v4 de 2026-10-24 ([relatorio_revisao_geral_v4.md](../../../.gemini/antigravity-ide/brain/b1d49786-54bb-411c-9d83-2efe7fc7423b/relatorio_revisao_geral_v4.md)), feita sobre o commit `ed4bf9f`.
Achados: **B1–B4** (bugs), **R1–R2** (testes/CI), **S1–S6** (segurança), **C2–C13** (incoerências).
Cada fase é um arquivo independente, executável e verificável sozinho.

## Como executar uma fase
1. Confira os **pré-requisitos** da fase.
2. Escreva primeiro os testes marcados **RED** e confirme que falham (provam o problema).
3. Implemente os passos na ordem; cada passo termina com um comando de verificação.
4. Rode o **Gate de saída**. A fase só fecha se todos os itens passarem.
5. Um PR por fase (`fix: v4 fase NN – …`). O CI precisa ficar verde antes do merge.

> Regra: não pule o RED.
> Regra: uma fase não pode enfraquecer o gate de outra (nada de `skip`, `@ts-ignore` novo, baseline de `scripts/guards.baseline.json` aumentado).
> Regra: nunca commitar direto em `main`. O commit `ed4bf9f` entrou assim, trouxe o ciclo B1 e o CI nunca o validou.
> Regra: **uma única fonte de escrita no repositório.** Durante a revisão, um commit e edições em `git.ts` e `script-runner.ts` apareceram de outro processo. Antes de começar uma fase, rode `git status` e confirme que ninguém mais está editando os mesmos arquivos.

## Fases

| Fase | Arquivo | Resolve | Prioridade | Esforço | Depende de | Status |
|---|---|---|---|---|---|---|
| 0 | [phase-00-git-recursion-and-test-safety.md](phase-00-git-recursion-and-test-safety.md) | B1, R1, R2 | P0 | P | — | 🟢 concluída na branch `fix/v4-phase-00-git-recursion-and-test-safety` |
| 1 | [phase-01-custom-tools-sandbox.md](phase-01-custom-tools-sandbox.md) | S3, S4, B4 | P1 | M | 0 | 🟡 parcial no working tree |
| 2 | [phase-02-session-and-cors.md](phase-02-session-and-cors.md) | S1 (resíduos), C2, C12 | P1 | M | 0 | ⬜ |
| 3 | [phase-03-editor-bugs-and-xss.md](phase-03-editor-bugs-and-xss.md) | B2, B3, `style` no DOMPurify | P1-P2 | P-M | 0 | ⬜ |
| 4 | [phase-04-server-hardening.md](phase-04-server-hardening.md) | S6 (servidor), persistência | P2-P3 | M | 2 | ⬜ |
| 5 | [phase-05-quality-ci.md](phase-05-quality-ci.md) | Testes, CI, lint, `strict` | P2 | G | 0 | ⬜ |
| 6 | [phase-06-coherence-architecture.md](phase-06-coherence-architecture.md) | C6–C13, monólitos, `git-core` | P3 | M-G | 0 | ⬜ |
| 7 | [phase-07-product-privacy.md](phase-07-product-privacy.md) | Riscos 2–8, LGPD, ideias | P3 | G | 1, 2 | ⬜ |

Ordem recomendada: 0 → 1 → 2 → 4 → 7. As fases 3, 5 e 6 podem andar em paralelo depois da 0.

## Convenções de verificação
- Servidor: `cd server && npx tsc --noEmit && npm test`.
- Frontend: `cd frontend && npx tsc -p tsconfig.app.json --noEmit`.
- Guards: `node scripts/guards.mjs`.
- Deps: `npm audit --omit=dev --audit-level=high` em `server/` e `frontend/`.
- Testes novos ficam ao lado do código (`*.test.ts`), runner `node:test` via `tsx`.
- No macOS não existe `timeout`; use `--test-timeout` do próprio runner.
- Validação visual de UI é feita por você no navegador.

## Linha de base (commit `ed4bf9f`)
- `npm test` do servidor **não termina** (B1): `git.test.ts` e `default-branch.test.ts` ficam presos.
- Frontend: 2 arquivos de teste.
- `npm audit --omit=dev`: 0 vulnerabilidades nos dois. `tsc` limpo nos dois.
- `any`: 355 frontend, 456 servidor (baseline do guards).
- `err.message`: 169 pontos; `console.*`: 124 no servidor.
- Working tree com edições não commitadas em `git.ts`, `script-runner.ts`, `custom-tools.service.ts` e `custom-tools.security.test.ts`.

## Rastreabilidade
| Achado | Fase |
|---|---|
| B1 recursão `getGitBranches` ⇄ `getDefaultBranch` | 0 |
| B2 `&` duplamente escapado, `)` em URL, itálico | 3 |
| B3 `isDoc` por substring | 3 |
| B4 `isPathInside` sem `realpath` no runner | 1 |
| R1 testes gravam no `config.json` real | 0 |
| R2 sem timeout em testes e CI | 0 |
| S1 cookie persistente, token sem expiração, CORS | 2 |
| S3 sandbox `vm` com objetos do host | 1 |
| S4 aprovação de ferramentas fraca | 1 |
| S6 helmet, rate limit, `err.message`, `style`, `parseCookies` | 2, 3, 4 |
| C2, C12 | 2 |
| C6–C11, C13 | 6 |
