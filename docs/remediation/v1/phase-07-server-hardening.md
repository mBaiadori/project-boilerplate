# Fase 7 — Endurecimento do servidor (N5, N7)

**Objetivo:** chaves e erros não vazam, endpoints de IA não viram SSRF, logs seguros e recursos limitados.
**Resolve:** N5, N7 (erros, logs, SSE, shutdown, scanner de segredos).
**Esforço:** médio. **Pré-requisitos:** Fase 3 (auth/rate limit) e `ssrf-guard` da Fase 2.

## Passos

### 7.1 Chaves fora da query string
`settings.routes.ts` (`/api/settings/...` com `api_key`, `custom_endpoint` na query): mover para `POST` com corpo JSON; manter a rota antiga respondendo 410 por uma versão. Atualizar `services/api/system.api.ts`/`ai.api.ts`.
RED: teste que chama a rota com `api_key` na query e espera 410; teste do POST verde.
**Verifica:** grep por `api_key` em URLs no frontend = 0.

### 7.2 Validar `custom_endpoint`
Usar o `ssrf-guard` com exceção explícita para `localhost` **apenas** em provedores locais (Ollama), configurada via flag do provedor, não livre. Esquema `http(s)`; sem credenciais na URL.
RED: endpoints `http://169.254.169.254`, `http://10.0.0.5`, `file://` recusados; `http://localhost:11434/v1` aceito para Ollama.

### 7.3 Erros sem vazamento
`setErrorHandler` global: log completo no servidor (com id de correlação), resposta `{ error, code, requestId }` sem stack/paths. Trocar os 136 `err.message` diretos por erros tipados (`AppError` com mensagem segura) de forma incremental por módulo.
RED: teste que força uma exceção com path no texto e verifica que a resposta não contém `/Users/` nem `node_modules`.
Guard (Fase 0): contagem de `message: err.message` só desce.

### 7.4 Logs
Substituir `console.*` (122) por `app.log`/logger pino por módulo; `redact` para `authorization`, `cookie`, `api_key`, `token`; `serializers.req` sem query string. Em produção, `logger` com nível `info`.
RED: teste que loga uma requisição com `?api_key=SECRET` e `Authorization` e confere que `SECRET` não aparece na saída capturada.

### 7.5 SSE e recursos
Limite de clientes em `eventsService` (ex.: 20); `bodyLimit` por rota revisado; shutdown aguarda gravações pendentes (substituir `process.exit` em 250 ms por drenagem com limite maior e fallback).
Testes: 21º cliente SSE recebe 429; shutdown não trunca um `writeConfig` em andamento.

### 7.6 Scanner de segredos
Avaliar integrar `gitleaks` como etapa opcional (binário) com fallback para o scanner atual; ampliar testes com JWT e connection strings.

## Gate de saída
- [ ] Testes de 7.1–7.5 verdes; nenhuma chave em query string.
- [ ] `npm run verify` verde.
- [ ] Manual: forçar um erro (repo inexistente) e ver mensagem amigável sem caminhos; conferir um log real sem tokens.
