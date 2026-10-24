# Fase 7 — Produto, privacidade e riscos operacionais

**Objetivo:** documentar o modelo de ameaça, controlar o que vai para IA externa e proteger dados e distribuição.
**Resolve:** riscos operacionais 2–8, LGPD, governança como convenção, ideias de produto.
**Esforço:** grande. **Pré-requisitos:** Fases 1 e 2.
Arquivos: `docs/` (novos), [governance.service.ts](../../../server/src/modules/governance/governance.service.ts), `server/src/modules/ai/*`, `server/src/modules/vault/*`, `desktop/`, `ClaudeCodeAdapter.ts`, `AntigravityAdapter.ts`.

## Passos

### 7.1 Modelo de ameaça (documento)
- `docs/THREAT_MODEL.md`: ativos (tokens GitHub, chaves de IA, documentos, repos), atores (usuário, processo local do mesmo usuário, página web maliciosa, autor de ferramenta/PR), fronteiras e o que **não** é controle: governança (`denied_paths`, `canAccessDocument`) com clone completo em disco, token em `~/.context-os`, `bytenode` como ofuscação.
- Linkar do README e da tela de configurações.

### 7.2 Política de IA por classificação (LGPD)
- RED: documento com classificação `restricted`/`confidential` **não** é enviado a Gemini/OpenAI/Anthropic; só a Ollama local, ou bloqueio com mensagem.
- Campo `ai_policy` em `.project.config.json` (por departamento/classificação: `allow_external | local_only | deny`), lido via `WorkspaceContext`/config (regra do repositório: sem listas estáticas).
- Ponto único de decisão em `ai.service.ts` e `rag.indexer.ts` (indexação também respeita).
- Registro de auditoria: provedor, classificação, hash do conteúdo, usuário, data.

### 7.3 Escrita por agentes com aprovação humana
- Toda escrita feita por agente/ferramenta passa por diff de aprovação (reaproveitar o diff da Fase 1 e o viewer de diff existente).
- Commit/push e rollback em repo marcado `production: true` pedem confirmação dupla; `auto_pr_on_save` permanece `false` por padrão.

### 7.4 CLIs externos
- `ClaudeCodeAdapter` (L142) e `AntigravityAdapter` (L183): validar `cliPath`/`command` — caminho absoluto, arquivo executável, não gravável por outros, nome em allowlist (`claude`, `antigravity`) ou confirmação explícita ao configurar.
- Argumentos sempre em array; prompt via stdin para evitar `ps`/limite de argv.
- RED: caminho configurado como `/tmp/x; rm` ou symlink para fora da allowlist é rejeitado.

### 7.5 Backup e cofre
- Backup automático de `config.json` e do cofre (rotação de 5, com permissão `0600`) antes de cada `saveConfig` alterando contas/IA; restauração guiada na UI.
- Documentar recuperação quando `safeStorage`/keychain não estiver disponível.

### 7.6 Distribuição
- Assinatura e notarização do macOS, assinatura do instalador Windows, auto-update com verificação de assinatura; checklist em `docs/RELEASE.md`.
- Tratar `bytenode` como ofuscação em toda a documentação.

### 7.7 Trilha de auditoria e saúde
- Log de auditoria encadeado por hash (cada entrada inclui hash da anterior) para aprovações, push, rollback, envio a IA.
- Painel de saúde: processos `git` ativos, tamanho dos clones, duração da indexação RAG, clientes SSE.
- Escala: indexar RAG e `docs-metadata` de forma incremental/assíncrona (por arquivo alterado, via `chokidar`).

## Gate de saída
- [ ] `docs/THREAT_MODEL.md` e `docs/RELEASE.md` publicados e linkados.
- [ ] Teste: documento restrito nunca chega a provedor externo (provider mockado não é chamado).
- [ ] CLIs só executam binários validados; testes de rejeição verdes.
- [ ] Backup do `config.json` criado antes de alterações de conta/IA.
- [ ] Log de auditoria verificável (`verifyAuditChain()` retorna ok em teste e detecta adulteração).
