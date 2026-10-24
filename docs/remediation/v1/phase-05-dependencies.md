# Fase 5 — Dependências (N6)

**Objetivo:** `npm audit --omit=dev --audit-level=high` zerado em servidor e frontend, e o CI barra regressões.
**Resolve:** N6.
**Esforço:** pequeno a médio (a troca do `xlsx` é a parte trabalhosa). **Pré-requisitos:** Fase 0.

## Passos

### 5.1 Servidor
`cd server && npm audit fix` (fastify ≥ 5.12.6 e `fast-uri`). Reexecutar `npm audit --omit=dev`.
**Verifica:** `npm audit --omit=dev --audit-level=high` sai com 0; `npm test` verde; subir o servidor e chamar uma rota.

### 5.2 Frontend: `xlsx`
- Mapear usos: `grep -rn "from 'xlsx'\|require('xlsx')" frontend/src`.
- RED: escrever teste (vitest, ver Fase 8, ou teste de utilitário) que lê `fixtures/sample.xlsx` e `fixtures/malicious-proto.xlsx` e verifica o resultado esperado e que `Object.prototype` não foi poluído.
- Substituir por `exceljs` (ou `read-excel-file`) atrás de um adaptador único `utils/spreadsheet.ts`, para a UI não depender da lib.
- Limitar tamanho/linhas do arquivo antes de parsear.
**Verifica:** teste do adaptador verde; `npm audit --omit=dev` do frontend sem `xlsx`; importar uma planilha real no viewer (validação sua).

### 5.3 Demais itens do `npm audit` do frontend
Tratar um a um (`npm audit` mostra a árvore). Se algum for só dev/transitivo sem correção, registrar exceção justificada em `docs/remediation/audit-exceptions.md` com data de revisão.

### 5.4 SDKs de IA
Atualizar `@anthropic-ai/sdk` e `openai` para versões atuais em um commit isolado; rodar `ai.service.test.ts`; testar manualmente um chat por provedor configurado.

### 5.5 CI bloqueante
No `ci.yml`, remover `continue-on-error` do job `audit`. Ativar Dependabot (Fase 0) com agrupamento de patch/minor.

## Gate de saída
- [ ] `npm audit --omit=dev --audit-level=high` = 0 vulnerabilidades altas em `server/` e `frontend/` (exceções documentadas, se houver).
- [ ] Nenhum import de `xlsx` restante.
- [ ] `npm run verify` verde; job `audit` do CI bloqueante e verde.
