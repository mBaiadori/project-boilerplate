# Plano de Remediação v8 — Context OS

**Origem:** Relatório de Revisão Geral, Auditoria de Segurança e Análise de Arquitetura de 2026-10-25 sobre a branch `main` (`5e44e19`).  
**Achados Principais:** 
- **SEC-01** (Execução arbitrária de comandos em ferramentas shell customizadas via interpretadores);
- **SEC-02** (Vazamento potencial de token Bearer do GitHub em `callGitHubAPI` para URLs arbitrárias);
- **SEC-03** (Rate limiting por IP local único e ausência de `trustProxy` em reverse proxy);
- **SEC-04** (Corrupção potencial de `.project.config.json` e `prs.json` por escrita direta não-atômica);
- **SEC-05** (Superfície de ataque de sandbox em pastas de automação `.github/` e `.agents/`);
- **BUG-01** (Exceção por Temporal Dead Zone em `SkillsHubModal.tsx`);
- **BUG-02** (Resolução quebrada de repositórios organizacionais em ferramentas nativas de IA);
- **BUG-03** (Desperdício de CPU e re-renders por subscrição global de Zustand em `WorkspaceContext`);
- **INC-01** (Divergência entre o `THREAT_MODEL.md` e a implementação real da trilha de auditoria SHA-256);
- **INC-02 / EVO-01** (RAG semântico construído mas desconectado do chat de IA, gerando sobrecarga de tokens);
- **INC-03** (Violação da regra de taxonomias dinâmicas e cores em nós do explorador de arquivos).

---

## Como Executar Cada Fase

1. **Branch Isolada:** Crie uma branch específica a partir de `main`: `git checkout -b fix/v8-phase-NN-nome`.
2. **Ciclo TDD (RED):** Escreva ou expanda os testes automatizados da fase, comprovando o vetor de falha, vulnerabilidade ou regressão antes de modificar a implementação.
3. **Implementação (GREEN):** Aplique a correção técnica mínima, aderente às regras de arquitetura e tipagens estritas.
4. **Respeito aos Guardas Estáticos:** Não adicione supressões `@ts-ignore`, casts desnecessários ou `any` adicional. O script `node scripts/guards.mjs` deve permanecer 100% verde sem aumento de baselines.
5. **Gate de Saída:** Execute `bash scripts/verify.sh` garantindo sucesso em todos os 6 passos (TSC, testes do servidor, TSC do frontend, testes do frontend, build do frontend e guardas).
6. **Merge Seguro:** Faça o merge na branch `main` com commit explícito não-fast-forward: `git merge --no-ff`.

---

## Matriz de Fases v8

| Fase | Arquivo | Foco Principal | Prioridade | Esforço | Depende de | Status |
|---|---|---|:---:|:---:|:---:|:---:|
| **00** | [phase-00-execution-hardening-and-url-protection.md](phase-00-execution-hardening-and-url-protection.md) | **SEC-01 / SEC-02 / SEC-05:** Allowlist de binários para shell tools, blindagem de destino no `callGitHubAPI` e proteção de `.github/` e `.agents/` no sandbox | **P0** | Médio | — | ✅ **Concluído** (`25f4a31`) |
| **01** | [phase-01-frontend-bugs-and-state-optimization.md](phase-01-frontend-bugs-and-state-optimization.md) | **BUG-01 / BUG-03 / D1:** Correção de TDZ em `SkillsHubModal.tsx`, otimização de seletores Zustand no `WorkspaceContext` e limpeza de `@types/papaparse` | **P0** | Pequeno | — | ✅ **Concluído** (`f3d81fd`) |
| **02** | [phase-02-repo-resolution-atomic-writes-and-rate-limit.md](phase-02-repo-resolution-atomic-writes-and-rate-limit.md) | **BUG-02 / SEC-04 / SEC-03:** Resolução de repositórios com owner em `native-tools`, escrita atômica em governança/PRs e resiliência em `rate-limit.ts` | **P1** | Médio | 00 | ✅ **Concluído** (`93e288f`) |
| **03** | [phase-03-rag-chat-integration-and-audit-coherence.md](phase-03-rag-chat-integration-and-audit-coherence.md) | **INC-02 / INC-01 / INC-03:** Conexão do RAG local ao chat de IA, unificação da auditoria SHA-256 e aplicação dinâmica de cores no explorador | **P1** | Médio | 02 | ✅ **Concluído** (`dc39e70`) |

---

## Rastreabilidade de Achados

| Código | Descrição Resumida | Severidade | Fase de Remediação |
|---|---|:---:|:---:|
| **SEC-01** | `executeShellHandler` permite execução de comandos arbitrários via interpretadores (`bash -c`, `python -c`) após aprovação única do template | **Alta** | **Fase 00** |
| **SEC-02** | `callGitHubAPI` aceita URLs arbitrárias e transmite token Bearer para qualquer host remoto | **Alta** | **Fase 00** |
| **SEC-05** | Sandbox de scripts não bloqueia gravação em `.github/workflows/` (injeção de CI) ou `.agents/rules/` | **Média** | **Fase 00** |
| **BUG-01** | `SkillsHubModal.tsx` acessa `loadData()` no `useEffect` antes de sua declaração (Temporal Dead Zone) | **Alta** | **Fase 01** |
| **BUG-03** | `WorkspaceContext.tsx` assina múltiplos stores Zustand sem seletores, disparando tempestade de re-renders | **Média** | **Fase 01** |
| **BUG-02** | `native-tools.ts` remove barras de `repoName`, falhando a resolução de arquivos de repositórios sob organizações | **Média** | **Fase 02** |
| **SEC-04** | Gravações diretas com `fs.writeFileSync` em `.project.config.json` e `prs.json` suscetíveis a corrupção em crashes | **Média** | **Fase 02** |
| **SEC-03** | Chave de rate limit fixa em IP local e Fastify sem `trustProxy`, causando colisões e DoS acidental | **Média** | **Fase 02** |
| **INC-02** | `ragService.buildContextPrompt` implementado mas desconectado das rotas de chat, gerando payloads gigantes no frontend | **Média** | **Fase 03** |
| **INC-01** | `THREAT_MODEL.md` alega auditoria criptográfica de aprovações, push e reversões, mas apenas `ai.service.ts` registra na cadeia SHA-256 | **Alta** | **Fase 03** |
| **INC-03** | `FileTreeNode.tsx` hardcodeia regras estáticas de tags (`kpi`, `ideacao`) em vez de ler `.project.config.json` | **Baixa** | **Fase 03** |

---

## Critérios de Aceite Globais

Para considerar o Plano de Remediação v8 concluído:
1. **TypeScript:** `npx tsc --noEmit` no servidor, frontend (`tsconfig.app.json` e `tsconfig.strict.json`) e desktop com **0 erros**.
2. **Suíte de Testes:** Todas as suítes de testes unitários do servidor e do frontend passando com 100% de sucesso.
3. **Guardas Estáticos:** `node scripts/guards.mjs` respeitando integralmente as baselines de segurança e qualidade.
4. **Verificação Completa:** `bash scripts/verify.sh` retornando código de saída 0.
