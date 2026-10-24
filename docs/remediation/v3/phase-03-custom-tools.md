# Fase 3 — Sandbox e aprovação de ferramentas customizadas (S3, S4)

**Objetivo:** código de manifesto de repositório não escapa do diretório do repo, não usa rede nem processos, e só roda após aprovação humana com identidade e diff.
**Resolve:** S3, S4.
**Esforço:** médio. **Pré-requisitos:** Fase 1 (sem token fraco, a aprovação perde sentido).
Arquivos: [script-runner.ts](../../server/src/modules/skills/script-runner.ts), [custom-tools.service.ts](../../server/src/modules/skills/custom-tools.service.ts), `skills.routes.ts`.

## Decisões a confirmar com você
1. **Node mínimo:** o modelo `--permission` exige Node ≥ 22 (já usado no CI). Confirmar que o Electron empacotado usa Node compatível; senão, ferramentas `javascript` ficam só no modo servidor.
2. **Rede no runner:** proposta = bloquear totalmente; ferramenta que precisa de HTTP usa o handler `http` (com SSRF guard).
3. **Identidade do aprovador:** proposta = login da conta Git ativa (`config.user.login`) em vez de `'user'`.

## Passos

### 3.1 RED — testes
- Código que faz `process.binding`, `require('child_process')`, `import('node:child_process')` ou `this.constructor.constructor('return process')()` → falha controlada sem executar comando (arquivo sentinela não criado).
- Código lendo `../../.ssh/id_rsa` ou symlink para fora do repo → erro.
- `fetch('http://127.0.0.1:...')` dentro do runner → bloqueado.
- Loop infinito → morto em 15 s; alocação de 2 GB → morto por limite de memória.
- Diretório temporário removido mesmo quando o runner falha ou estoura timeout.
- Alterar 1 byte do manifesto após aprovação → `approved:false`.
- `tool-approvals.json` corrompido → tratado como "nada aprovado", sem lançar.
**Verifica:** hoje os testes de escape, rede e limpeza devem falhar ou precisar de ajuste.

### 3.2 Implementação
- `script-runner.ts`: `execFile(process.execPath, ['--permission', '--allow-fs-read=<tmpDir>,<safeRepoDir>', '--max-old-space-size=128', runner])`, sem `--allow-child-process`, `--allow-worker`, `--allow-addons`; `env` mínimo (`{}`), `cwd` no tmp.
- tmp: `fs.mkdtemp` com `mode 0o700`; `finally { fs.rmSync(tmpDir, { recursive: true, force: true }) }`.
- Limitar tamanho de `stdout` (`maxBuffer`) e do payload.
- `custom-tools.service.ts`: `approved_by` com a identidade (decisão 3); escrita de `tool-approvals.json` atômica (tmp + rename, mesmo helper da Fase 7).
- `skills.routes.ts`: endpoint de aprovação devolve e exige o **diff do manifesto** (`hash` anterior, atual, campos alterados); rate limit (Fase 4).
- UI: tela de aprovação mostra código/comando e URL completos antes do botão (validação visual sua).

## Gate de saída
- [ ] Testes de 3.1 verdes em Linux (CI) e macOS.
- [ ] `grep -rn "node:vm" server/src` só aparece como defesa adicional, não como fronteira única.
- [ ] Aprovação exibe diff e registra identidade.
- [ ] Documentado o que a sandbox garante e o que não garante.
