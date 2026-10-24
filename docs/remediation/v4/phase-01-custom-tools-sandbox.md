# Fase 1 — Sandbox e aprovação de custom tools (S3, S4, B4)

**Objetivo:** código de ferramenta customizada não consegue sair do diretório do projeto, abrir rede, executar processos nem aprovar a si mesmo.
**Resolve:** S3, S4, B4.
**Esforço:** médio. **Pré-requisitos:** Fase 0.
Arquivos: [script-runner.ts](../../../server/src/modules/skills/script-runner.ts), [custom-tools.service.ts](../../../server/src/modules/skills/custom-tools.service.ts) (L109, L134, L185, L252), `skills.routes.ts`, `custom-tools.security.test.ts`, `server/src/utils/atomic-write.ts`.

> [!NOTE]
> O working tree já contém parte desta fase (tmp `0o700`, `payload.json` `0o600`, `assertSafeRepoPath` com `realpath`, `Object.freeze` em `safeUtils`). Revise o diff com `git diff -- server/src/modules/skills` antes de recomeçar, e **não duplique** o trabalho.

## Contexto
O runner usa `vm.createContext` e injeta `Buffer`, `Date`, `JSON`, `Math`, `setTimeout`, `Promise` do realm do host. `Buffer.constructor.constructor('return process')()` devolve o `process` real e o sandbox acaba. O env mínimo (`PATH`) e o timeout atenuam, mas o subprocesso lê qualquer arquivo do usuário.

## Passos

### 1.1 RED — testes (`custom-tools.escape.test.ts`)
Cada código abaixo roda via `runIsolatedScript`, e o teste espera erro ou resultado inofensivo:
- `return Buffer.constructor.constructor('return process')().pid` → não retorna número do host.
- `return (async()=>{}).constructor('return process')()` e `this.constructor.constructor('return process')()`.
- `readProjectFile('../../../etc/hosts')` e arquivo via symlink apontando para fora → `Acesso negado`.
- `fetch('http://127.0.0.1:1/')` e `fetch('https://example.com')` → bloqueado (sem rede).
- `require('child_process')`, `process.binding('spawn_sync')`, `import('node:fs')` → falham.
- Laço infinito `while(true){}` → encerra em `timeoutMs` e o processo filho morre (`ps` não lista o pid).
- `new Array(1e9).fill(0)` → morre por limite de memória, o servidor segue vivo.
- Saída de 50 MB → truncada/erro, sem estourar memória do servidor.
**Verifica:** os de `constructor.constructor` e rede falham hoje.

### 1.2 Implementação (S3, B4)
- **Não passar objetos do host para o contexto.** Dentro do runner, recriar `JSON`, `Math` e `Date` no próprio contexto (`vm.runInContext('({JSON,Math,Date})', ctx)`), e para `Buffer` expor funções que recebem/devolvem `string` (`toBase64`, `fromBase64`). `setTimeout`/`Promise` não devem ser injetados do host.
- Criar o contexto com `codeGeneration: { strings: false, wasm: false }` e `Object.setPrototypeOf(sandbox, null)`; congelar protótipos intrínsecos no contexto.
- Subprocesso com `node --permission --allow-fs-read=<tempDir> --allow-fs-read=<safeRepoDir> --allow-fs-write=<safeRepoDir>`, **sem** `--allow-child-process`, `--allow-worker`, `--allow-addons`, `--allow-wasi` (exige Node ≥ 22; declarar `engines.node` e falhar de forma clara se menor).
- Limites: `--max-old-space-size=128`, `maxBuffer` do `execFile` em 1 MB e truncamento de stdout.
- Rede: com `--permission` não há bloqueio nativo de rede; remover `fetch` do global dentro do runner (`globalThis.fetch = undefined` antes do `vm`) e documentar que rede continua sendo possível se o Node principal expuser `net`. Para garantia real, planejar `unshare`/`sandbox-exec` (macOS) como fase futura.
- B4: remover a `isPathInside` duplicada do template do runner, gerar o runner a partir de um módulo único (`runner-template.ts`) que usa `realpath` (já parcialmente feito em `assertSafeRepoPath`; cobrir também `writeProjectFile`, onde o destino pode ainda não existir: validar `realpath` do diretório pai).
- Gravar `runner.mjs` com `mode: 0o600` e remover o tmp no `finally` mesmo em exceções.
**Verifica:** `cd server && npx tsx --test --test-timeout=60000 src/modules/skills/*.test.ts`.

### 1.3 Aprovação (S4)
- `approved_by`: gravar identidade real (`os.userInfo().username` + origem `ui`/`api`), data e hash do manifesto aprovado. Remover o valor fixo `'user'` (L134).
- `tool-approvals.json`, `tool.json`, `handler.js`: trocar `writeFileSync` (L109, L185, L252) por `writeJsonAtomic`/`writeFileAtomic` de `atomic-write.ts`.
- Rota de aprovação exige **header `X-ContextOS-Confirm: <hash do manifesto>`** devolvido antes pela UI após mostrar o diff. Sem ele → 409 com o diff. Rate limit (Fase 4) de 5/min.
- Qualquer mudança em `handler_code` invalida a aprovação (já feito por hash; cobrir com teste).
- RED: aprovar sem `X-ContextOS-Confirm` falha; com hash antigo falha; execução de ferramenta com hash alterado falha.

### 1.4 UI (validação visual é sua)
- Modal de aprovação mostra: nome, diff do manifesto, código do handler, permissões pedidas. Botão só habilita após rolar o código.

## Gate de saída
- [ ] Todos os testes de 1.1 verdes; nenhum `skip`.
- [ ] Nenhum objeto do host dentro do contexto do `vm` (revisão de código).
- [ ] Subprocesso roda com `--permission` sem `--allow-child-process`.
- [ ] `grep -n "writeFileSync" server/src/modules/skills/custom-tools.service.ts` vazio.
- [ ] `approved_by` não é mais literal fixo.
- [ ] Tmp removido após sucesso, erro e timeout (teste lista `os.tmpdir()`).
