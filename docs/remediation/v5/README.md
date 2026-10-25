# Plano de Remediação v5 — Context OS

Origem: Revisão Geral Completa de 2026-10-25 sobre o commit `79879f6` (conclusão das fases v4 00–07).  
Achados principais: **SEC-01 a SEC-05** (segurança e contenção), **B5 a B7** (bugs de boot, CORS e concorrência), **C14 a C17** (incoerências e dados hardcoded), **PERF-01 e PERF-02** (performance e bundle splitting), **ARCH-01** (desacoplamento de estado).

Cada fase é um roteiro independente, executável e estritamente verificável por testes automatizados (RED → GREEN).

---

## Como Executar uma Fase

1. Crie uma branch de trabalho para a fase: `git checkout -b fix/v5-phase-NN-nome`.
2. Escreva primeiro os testes marcados como **RED** e confirme que falham, provando a existência da falha.
3. Implemente a solução sem enfraquecer tipagens, sem `@ts-ignore` e sem aumentar as linhas de base em `scripts/guards.baseline.json`.
4. Execute o **Gate de Saída** da fase. A fase só é considerada fechada quando todos os testes passarem localmente e no pipeline de verificação (`npm run verify`).
5. Faça o commit semântico e abra o PR para integração contínua antes do merge em `main`.

> **Regra de Ouro:** Não altere dados de produção nem acerte caminhos com bypass temporário.  
> **Regra de Qualidade:** `npm run verify` deve permanecer verde a cada merge.

---

## Matriz de Fases v5

| Fase | Arquivo | Foco Principal | Prioridade | Esforço | Depende de |
|---|---|---|:---:|:---:|:---:|
| 0 | [phase-00-path-traversal-containment.md](phase-00-path-traversal-containment.md) | SEC-01: Path Traversal em Workspace, Wiki, Traduções e Worktrees (`resolveSafeRepoPath`) | **P0** | Médio | — |
| 1 | [phase-01-desktop-boot-and-session.md](phase-01-desktop-boot-and-session.md) | SEC-02, SEC-03: Polling do Electron em `/api/health`, eliminação do delay de 9s e token no desktop | **P0** | Pequeno | — |
| 2 | [phase-02-identity-cors-and-branching.md](phase-02-identity-cors-and-branching.md) | C14, B5, C16: Remoção do fallback `'marcosbaiadori'`, CORS dinâmico para `dev1` e fix em `getDefaultBranch` | **P1** | Pequeno | — |
| 3 | [phase-03-frontend-links-and-security.md](phase-03-frontend-links-and-security.md) | SEC-04: Protocol-relative URLs (`//evil.com`) neutralizadas no editor e no `sanitize.ts` | **P1** | Pequeno | — |
| 4 | [phase-04-atomic-writes-and-concurrency.md](phase-04-atomic-writes-and-concurrency.md) | B7, REL-01, REL-02: Escrita atômica em índices (`writeJsonAtomic`), fila de concorrência na auditoria e timeout Git | **P2** | Médio | 0 |
| 5 | [phase-05-performance-code-splitting.md](phase-05-performance-code-splitting.md) | PERF-01, PERF-02: Code-splitting com `React.lazy()` nas 9 subviews e correção de alertas oxlint | **P2** | Médio | — |
| 6 | [phase-06-architecture-state-decoupling.md](phase-06-architecture-state-decoupling.md) | ARCH-01: Modularização e desmembramento do monólito `WorkspaceContext.tsx` em stores de domínio | **P3** | Grande | 5 |

---

## Rastreabilidade de Achados

| Código | Descrição Resumida | Fase |
|---|---|:---:|
| **SEC-01** | Path traversal em `WorkspaceService`, `WikiService` e `TranslationsService` | **Fase 0** |
| **SEC-02** | Desktop polling rota autenticada `/api/status` gerando timeout de 9s no boot | **Fase 1** |
| **SEC-03** | Inconsistência de bootstrap em modo desktop (`CONTEXT_OS_DESKTOP="1"`) | **Fase 1** |
| **SEC-04** | Protocol-relative URLs (`//evil.com`) tratadas como links internos no editor | **Fase 3** |
| **SEC-05** | Privilégios excessivos e env amplo em `AntigravityAdapter` | **Fase 1** |
| **B5** | CORS do bootstrap rejeita segunda instância de desenvolvimento (`npm run dev1`) | **Fase 2** |
| **B6** | `getDefaultBranch` assume branch alfabética de `for-each-ref` em vez do branch oficial | **Fase 2** |
| **B7** | Gravações de arquivos de índice (`rag-index.json`, `.dictionary.json`) sem atomicidade | **Fase 4** |
| **C14** | Fallback hardcoded para `'marcosbaiadori'` em 10 pontos do módulo PRs | **Fase 2** |
| **C15** | Worktrees de PR criadas incorretamente dentro de `.git/context-pr-worktrees` | **Fase 0** |
| **C16** | `saveWikiPage` não registra alterações em `recordChange` (não gera rascunhos) | **Fase 4** |
| **REL-01** | Corrida de concorrência em `audit-chain.service.ts` ao gravar eventos assíncronos | **Fase 4** |
| **REL-02** | Ausência de timeout determinístico em `executeGitCommandWithProgress` | **Fase 4** |
| **PERF-01**| Bundle do frontend com 1.63 MB por importação estática de todas as subviews | **Fase 5** |
| **PERF-02**| 198 alertas de pureza e renderização em cascata no `oxlint` | **Fase 5** |
| **ARCH-01**| Acoplamento excessivo em `WorkspaceContext.tsx` (2.031 linhas, 96 conexões) | **Fase 6** |
