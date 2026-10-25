# Plano de Remediação v7 — Context OS

**Origem:** Relatório de Revisão Geral, Auditoria de Segurança e Análise de Arquitetura de 2026-10-25 sobre a branch `main`.  
**Achados Principais:** **S1** (Crítico / Escape de Sandbox e Gravação em `.git`), **S2** (Incoerência de TTL no Threat Model), **S3** (Ausência de Rate Limiting em Rotas Pesadas de Git e Stream SSE) e **S4** (Privacidade LGPD em RAG e Limpeza de Dependências Inativas).  
**Objetivo:** Consolidar a segurança e a integridade do Context OS eliminando o vetor de escape do sandbox de custom tools, protegendo a pasta sensível `.git/` contra injeção de hooks maliciosos, sincronizando a especificação de segurança oficial do sistema e protegendo endpoints de alto consumo de CPU e rede.

Cada fase foi estruturada para ser executada de forma estritamente modular, orientada a testes automatizados (**TDD RED ➔ GREEN**), sem relaxamento de tipagens estritas e sem aumento das linhas de base de guards estáticos.

---

## Como Executar Cada Fase

1. **Branch de Trabalho:** Crie uma branch isolada para a fase: `git checkout -b fix/v7-phase-NN-nome`.
2. **Ciclo TDD (RED):** Escreva ou expanda primeiro os testes automatizados da fase comprovando a existência do vetor de risco ou incoerência.
3. **Implementação (GREEN):** Implemente a correção técnica mínima, robusta e aderente às regras de arquitetura.
4. **Respeito aos Guardas:** Não utilize `@ts-ignore`, `any` adicional ou casts desnecessários. Verifique que `node scripts/guards.mjs` permanece 100% verde.
5. **Gate de Saída:** Execute o script de validação unificado (`npm run verify` ou `bash scripts/verify.sh`).
6. **Merge Seguro:** Faça o merge em `main` via merge não-fast-forward (`git merge --no-ff`).

---

## Matriz de Fases v7

| Fase | Arquivo | Foco Principal | Prioridade | Esforço | Depende de |
|---|---|---|:---:|:---:|:---:|
| **00** | [phase-00-sandbox-hardening-and-git-protection.md](phase-00-sandbox-hardening-and-git-protection.md) | **S1:** Blindagem do sandbox contra escape de Realm (via construtor de funções do host) e proibição de leitura/escrita em `.git/` e `.tools/` | **P0** | Médio | — |
| **01** | [phase-01-threat-model-and-session-coherence.md](phase-01-threat-model-and-session-coherence.md) | **S2:** Sincronização do `THREAT_MODEL.md` com o TTL de 12 horas (43.200s) e atualização de asserções em testes | **P0** | Pequeno | — |
| **02** | [phase-02-heavy-ops-rate-limiting.md](phase-02-heavy-ops-rate-limiting.md) | **S3:** Rate limiting para operações volumosas de Git (`clone`, `pull`, `push`) e streaming de chat (`/api/chat/stream`) | **P1** | Médio | 00 |
| **03** | [phase-03-rag-privacy-and-dependency-cleanup.md](phase-03-rag-privacy-and-dependency-cleanup.md) | **S4:** Validação de política LGPD no indexador semântico RAG e desinstalação de dependências mortas (`@fastify/rate-limit`) | **P1** | Pequeno | 02 |

---

## Rastreabilidade de Achados

| Código | Descrição Resumida | Severidade | Fase de Remediação |
|---|---|:---:|:---:|
| **S1** | Funções utilitárias passadas à sandbox (`script-runner.ts`) pertencem ao Realm do host, permitindo recuperar `process` e módulos Node.js (`node:http`), além de permitir gravação arbitrária de hooks em `.git/` | **Crítica** | **Fase 00** |
| **S2** | `THREAT_MODEL.md` ainda cita cookie de 8 horas (`Max-Age=28800`), divergindo do TTL implementado de 12 horas (`Max-Age=43200`) e gerando asserções inconsistentes | **Média** | **Fase 01** |
| **S3** | Endpoints de clonagem de repositório, sincronização Git e streaming SSE de chat não possuem limitação de taxa (rate limiting), suscetíveis a exaustão de conexões ou CPU | **Média** | **Fase 02** |
| **S4** | O indexador semântico RAG pode carregar documentos confidenciais sem consulta preventiva a `checkAiPolicy` e o `package.json` do servidor mantém `@fastify/rate-limit` sem uso | **Média / Baixa** | **Fase 03** |

---

## Verificação e Critérios de Aceite Globais

Para considerar o Plano de Remediação v7 concluído:
1. **TypeScript:** `npx tsc --noEmit` no servidor, frontend (`tsconfig.app.json` e `tsconfig.strict.json`) e desktop com **0 erros**.
2. **Suíte de Testes:** Todas as suítes de testes unitários do servidor e do frontend passando com 100% de sucesso.
3. **Guardas Estáticos:** `node scripts/guards.mjs` respeitando todas as baselines.
4. **Script Unificado:** `bash scripts/verify.sh` concluído com código de retorno 0.
