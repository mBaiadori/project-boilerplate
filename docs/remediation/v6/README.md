# Plano de Remediação v6 — Context OS

**Origem:** Relatório de Revisão Geral e Auditoria Técnica Completa de 2026-10-25 sobre a branch `main` (pós-fases v4 e v5).  
**Achados Principais:** **A1, A2, A4** (Vulnerabilidades de Severidade Alta), **M1, M3, M5, M6, M7, M8, M9** (Severidade Média) e **B6** (Severidade Baixa / Prevenção Estrutural).  
**Objetivo:** Consolidar a segurança e a integridade do Context OS eliminando bypasses em aprovação de ferramentas, riscos de supply-chain no Electron, janelas de TOCTOU em SSRF, brechas de sanitização no frontend e fragilidades no ciclo de empacotamento.

Cada fase foi desenhada para ser executada de forma estritamente modular, orientada a testes automatizados (**TDD RED ➔ GREEN**), sem relaxamento de tipagens estritas e sem aumento das linhas de base de guards estáticos.

---

## Como Executar uma Fase

1. **Branch de Trabalho:** Crie uma branch isolada para a fase: `git checkout -b fix/v6-phase-NN-nome`.
2. **Ciclo TDD (RED):** Escreva ou expanda primeiro os testes automatizados da fase e verifique que eles falham, comprovando a existência da falha ou vetor de risco.
3. **Implementação (GREEN):** Implemente a correção técnica mínima e robusta necessária para fazer os testes passarem.
4. **Respeito aos Guardas:** Não utilize `@ts-ignore`, `any` adicional ou casts desnecessários. Verifique que `node scripts/guards.mjs` permanece 100% verde.
5. **Gate de Saída:** Execute o script de validação unificado (`npm run verify`).
6. **Merge Seguro:** Faça o merge em `main` via merge não-fast-forward (`git merge --no-ff`).

---

## Matriz de Fases v6

| Fase | Arquivo | Foco Principal | Prioridade | Esforço | Depende de |
|---|---|---|:---:|:---:|:---:|
| **00** | [phase-00-tool-approval-and-integrity.md](phase-00-tool-approval-and-integrity.md) | **A1:** Eliminação do vazamento de hash na aprovação de ferramentas customizadas e confirmação com desafio | **P0** | Médio | — |
| **01** | [phase-01-desktop-electron-hardening.md](phase-01-desktop-electron-hardening.md) | **A2, M1, M3:** Atualização de dependências críticas do Desktop, auditoria no CI, safeStorage fail-closed e restrição de navegação | **P0** | Médio | — |
| **02** | [phase-02-ssrf-pinning-and-dns-rebinding.md](phase-02-ssrf-pinning-and-dns-rebinding.md) | **A4:** Eliminação de TOCTOU e DNS Rebinding em SSRF Guard via IP Pinning e normalização IPv6/IPv4-mapped | **P0** | Médio | — |
| **03** | [phase-03-frontend-sanitization-clobbering.md](phase-03-frontend-sanitization-clobbering.md) | **M5:** Remoção de protocolo relativo em URIs, mitigação de DOM Clobbering (`input`, `id`) e ajuste em `isSafeUrl` | **P1** | Pequeno | — |
| **04** | [phase-04-session-coherence-and-rate-limiting.md](phase-04-session-coherence-and-rate-limiting.md) | **M6, M7, M8:** Alinhamento de Max-Age de cookie (12h), remoção de rotas de teste em produção e rate-limiting unificado | **P2** | Médio | — |
| **05** | [phase-05-repo-guard-and-build-pipeline.md](phase-05-repo-guard-and-build-pipeline.md) | **M9, B6:** Hook global de validação do parâmetro `repo`, script de build limpo (`clean`) e garantia de paridade de bundles | **P2** | Médio | 00, 02 |

---

## Rastreabilidade de Achados

| Código | Descrição Resumida | Severidade | Fase de Remediação |
|---|---|:---:|:---:|
| **A1** | Endpoint `/api/aicenter/custom-tools/:id/approve` devolve o `required_hash` no payload 409, permitindo aprovação arbitrária em 2 passos sem barreira humana | **Alta** | **Fase 00** |
| **A2** | Dependências do Desktop com vulnerabilidades High (`electron`, `electron-updater`, `app-builder-lib`) e ausência do Desktop no job `audit` do CI | **Alta** | **Fase 01** |
| **A4** | SSRF Guard valida o IP no DNS, mas o `fetch` refaz a resolução de rede (janela de DNS Rebinding / TOCTOU com TTL 0) e falta normalização hex de IPv4-mapped | **Alta** | **Fase 02** |
| **M1** | `secure-store:encrypt` no Electron degrada silenciosamente para Base64 quando `safeStorage` não está disponível; falta validação de `senderFrame` no IPC | **Média** | **Fase 01** |
| **M3** | Electron não possui handlers de evento `will-navigate` e `will-redirect`, permitindo navegações in-window não intencionais para links externos | **Média** | **Fase 01** |
| **M5** | `ALLOWED_URI_REGEXP` no DOMPurify permite `//evil.com` (protocol-relative beacon), whitelist expõe DOM clobbering (`input`, `id`), e `isSafeUrl` rejeita queries legítimas | **Média** | **Fase 03** |
| **M6** | Divergência entre `Max-Age=28800` (8h) do cookie e o TTL de 12h (43200s) com renovação deslizante em `session.ts` | **Média** | **Fase 04** |
| **M7** | Limitador de taxa manual em memória que cobre apenas 2 rotas; pacote `@fastify/rate-limit` instalado sem uso; rotas custosas de IA/Git desprotegidas | **Média** | **Fase 04** |
| **M8** | Rota `/api/test-leak-error` condicional a `NODE_ENV !== 'production'` pode ser exposta se a variável de ambiente for omitida | **Média** | **Fase 04** |
| **M9** | Ausência de limpeza pré-build (`clean`) em `server` e `desktop`, gerando risco de empacotamento com artefatos defasados (ex: `server.prod.cjs`) | **Média** | **Fase 05** |
| **B6** | Validação do parâmetro de repositório (`repo`) é dependente de cada handler individual, criando risco de esquecimento e escape em novas rotas | **Baixa** | **Fase 05** |

---

## Verificação e Critérios de Aceite Globais

Para considerar o Plano de Remediação v6 concluído, todos os gates a seguir devem ser atendidos sem ressalvas:

1. **TypeScript:** `npx tsc --noEmit` no servidor, frontend (`tsconfig.app.json` e `tsconfig.strict.json`) e desktop com **0 erros**.
2. **Suíte de Testes:** Todas as suítes de testes unitários de servidor e frontend passando com 100% de sucesso.
3. **Auditoria de Segurança:** `npm audit --omit=dev` retornando **0 vulnerabilidades** no servidor, frontend e desktop.
4. **Guardas Estáticos:** `node scripts/guards.mjs` mantendo ou reduzindo os baselines de código.
5. **Pipeline Unificado:** `npm run verify` executando com sucesso em tempo total inferior a 60 segundos.
