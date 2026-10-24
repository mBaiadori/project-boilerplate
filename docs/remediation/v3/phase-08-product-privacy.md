# Fase 8 — Produto, privacidade e operação

**Objetivo:** transformar os riscos operacionais e as ideias do relatório em decisões documentadas e recursos verificáveis.
**Resolve:** riscos operacionais 2–8, governança como convenção, LGPD, distribuição, ideias de produto.
**Esforço:** grande; cada item é um PR separado e opcional. **Pré-requisitos:** Fases 1 e 3.

## Itens

### 8.1 Modelo de ameaça (documento)
- `docs/THREAT_MODEL.md`: app local de um usuário; o que o token protege e o que não protege; leitura do disco por processos do mesmo usuário; governança (`denied_paths`, `canAccessDocument`) como orientação e não controle de acesso. Linkar do README.

### 8.2 Política de IA por classificação (LGPD)
- Campo de classificação por documento/departamento em `.project.config.json` (via `WorkspaceContext`, sem listas estáticas).
- Regra: classificação sensível só vai para provedor local (Ollama); bloqueio server-side em `ai.routes.ts` com mensagem clara e registro em log.
- Teste: documento sensível + provedor externo → 403.

### 8.3 Escritas de agente com aprovação humana
- Toda escrita por agente/ferramenta gera diff pendente; só persiste com confirmação.
- Se `auto_pr_on_save` estiver ligado, texto de IA em mensagem de commit passa por `assertSafe...` (Fase 2) e limite de tamanho.

### 8.4 Repo de produção e rollback
- Ações destrutivas (`reset`, rollback, push forçado) exigem confirmação digitada do nome do repo quando `is_private`/org configurada como produção.
- Criar commit de segurança (branch/tag `backup/...`) antes de rollback.

### 8.5 CLIs externos
- Validar `claude_cli_path`/`antigravity_cli_path`: arquivo existente, executável, fora de diretórios graváveis por todos; exibir caminho resolvido na UI antes da primeira execução.

### 8.6 Escala
- RAG e `docs-metadata.service`: indexação incremental por `mtime`/hash em worker, sem bloquear o event loop; benchmark com repo de 10 mil arquivos como critério.

### 8.7 Distribuição
- Assinatura/notarização (macOS) e Authenticode (Windows); auto-update com verificação de assinatura.
- `bytenode` descrito como ofuscação; remover do discurso de proteção.
- SBOM (`cyclonedx`) por release.

### 8.8 Trilha de auditoria e links
- Log de auditoria encadeado por hash (aprovações de ferramentas, escritas de agente, push); commits assinados opcionais.
- Verificação de links quebrados/grafo como check de PR.

## Gate de saída (por item)
- [ ] Decisão registrada em documento ou ADR.
- [ ] Teste automatizado cobrindo a regra (quando for código).
- [ ] Nenhum item enfraquece gates de fases anteriores.
