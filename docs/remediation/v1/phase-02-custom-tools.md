# Fase 2 — Ferramentas customizadas seguras (N2)

**Objetivo:** um repositório clonado não executa código nem comandos sem aprovação explícita do usuário, e o que roda fica isolado.
**Resolve:** N2, SSRF do handler `http`.
**Esforço:** médio. **Pré-requisitos:** Fase 0.

Arquivo principal: `server/src/modules/skills/custom-tools.service.ts` (handlers `script` via `new Function`, `shell`, `http`). Rotas em `skills.routes.ts` (`/api/aicenter/tools/execute`, `/api/aicenter/custom-tools`) e `native-tools.ts` (`project_tool_upsert`, que permite à IA **criar** ferramentas).

## Decisões a confirmar com você antes de codar
- Manter o handler `script`? Proposta: sim, mas em processo filho com `node --permission`.
- Manter `shell`? Proposta: sim, só com `command` + `args[]` (sem shell) e parâmetros validados por schema.

## Passos

### 2.1 RED — testes
`custom-tools.security.test.ts` com um repo temporário e manifestos maliciosos:
- Handler `script` com `return this.constructor.constructor('return process')().pid` → deve falhar/ser bloqueado.
- Handler `script` que tenta `require('fs')` ou ler `/etc/hosts` → bloqueado.
- Handler `shell` com parâmetro `a > PWNED`, `$(touch PWNED)` e `--flag` → sentinela ausente e argumento tratado como dado.
- Handler `http` para `http://127.0.0.1`, `http://169.254.169.254`, `http://[::1]`, host que resolve para IP privado → bloqueado.
- Ferramenta nova **não aprovada** → execução recusada.
**Verifica:** hoje estes testes falham.

### 2.2 Aprovação por hash
- Ao descobrir uma ferramenta, calcular `sha256` do manifesto da ferramenta (código, comando, URL).
- Guardar aprovações no vault/config do usuário (não no repo): `{ repo, toolName, hash }`.
- `execute` recusa (HTTP 403 com mensagem clara) se não houver aprovação com o hash atual; qualquer mudança no manifesto revoga.
- Nova rota `POST /api/aicenter/custom-tools/:name/approve`; a UI mostra o código/comando antes de aprovar (tarefa de frontend pequena).
- `project_tool_upsert`/`delete` da IA nunca aprova sozinho; criar uma ferramenta exige nova aprovação.
**Verifica:** testes de aprovação (aprovar, alterar manifesto, tentar executar → 403).

### 2.3 Shell sem shell
`command` vira `{ executable, args: string[] }` com placeholders `{{param}}` substituídos **por elemento do array**; schema de parâmetros com tipo/regex. Usar `execFile`, `shell:false`, `cwd` no repo, `timeout`, ambiente reduzido (sem tokens). Remover a lista de caracteres proibidos.
Migração: manifestos antigos com string única são recusados com erro explicando o novo formato.

### 2.4 Script isolado
Substituir `new Function` por `child_process.fork` de um runner com `node --permission --allow-fs-read=<repoDir>` (sem `--allow-child-process`, sem `--allow-worker`), timeout real com `kill`, ambiente vazio e API reduzida (`readProjectFile` validado). `fetch` só via o guard de 2.5.
**Verifica:** testes de 2.1 para `script` passam; processo morto após timeout (teste com loop infinito).

### 2.5 Guard de SSRF
`utils/ssrf-guard.ts`: resolver o DNS, bloquear loopback, link-local, privados, `169.254.169.254`, `0.0.0.0`, IPv6 equivalentes; rejeitar redirecionamentos para IP bloqueado; só `http(s)`. Testes unitários com lista de IPs. Reutilizado na Fase 7 para `custom_endpoint`.

## Gate de saída
- [ ] `grep -rn "new Function" server/src` = 0; guard baseline atualizado.
- [ ] `custom-tools.security.test.ts` verde.
- [ ] `npm run verify` verde.
- [ ] Manual: clonar repo de teste com ferramenta `shell` → aparece como "não aprovada", não executa; aprovar → executa; editar manifesto → volta a "não aprovada".
