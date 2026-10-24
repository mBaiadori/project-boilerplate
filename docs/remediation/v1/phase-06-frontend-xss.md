# Fase 6 — XSS no frontend (N7)

**Objetivo:** conteúdo de repositório ou de LLM nunca vira HTML executável, nem no editor.
**Resolve:** N7 (XSS residual).
**Esforço:** médio. **Pré-requisitos:** Fase 0. Mantém o `sanitizeHtml` já existente em `frontend/src/utils/sanitize.ts`.

Superfície: ~30 atribuições `innerHTML` em `notion-editor-engine.ts` (ex.: `parseMarkdownLinesToHtml` L1213, L1424, L1693 SVG/mermaid), `slash-menu.ts`, `bubble-menu.ts`, `notion-table.ts`, `viewers/DocxViewer.tsx`, além dos `dangerouslySetInnerHTML` já cobertos.

## Passos

### 6.1 Infra de teste do frontend
Adicionar `vitest` + `jsdom` ao frontend (`npm test`), com script no `verify.sh`. Necessário porque hoje há 0 testes no frontend.
**Verifica:** um teste trivial passa em `npm --prefix frontend test`.

### 6.2 RED — corpus de payloads
`frontend/src/utils/xss-corpus.ts` com payloads: `<img src=x onerror=...>`, `<svg onload>`, `javascript:` em links, `<iframe srcdoc>`, `data:text/html`, markdown com HTML cru, SVG com `<script>`, nomes de arquivo/título com `<`.
Testes:
- `sanitizeHtml` remove todos (já deve passar; regressão).
- Renderização do markdown do editor (`parseMarkdownLinesToHtml`) com cada payload: no DOM resultante **não pode** existir `script`, atributos `on*`, `javascript:` nem `iframe`.
- Menus (`slash-menu`, `bubble-menu`) com títulos/ícones maliciosos.
**Verifica:** os testes do editor falham onde houver escape faltante (a auditoria não confirmou se `parseMarkdownLinesToHtml` escapa).

### 6.3 Correções
- Todo `innerHTML` que recebe dado externo passa por `sanitizeHtml` ou é trocado por `textContent`/`createElement`.
- Mermaid/SVG: `securityLevel: 'strict'` e `sanitizeHtml` com perfil SVG.
- Links: permitir só `http`, `https`, `mailto`, caminhos relativos.
- `DocxViewer`: sanitizar saída do conversor.
- Constante de política única exportada de `sanitize.ts`; sem configurações duplicadas.

### 6.4 Guarda e CSP
- Guard (Fase 0): novo `innerHTML =` com expressão não literal sem `sanitizeHtml`/`escapeHtml` na mesma linha falha o `guards.mjs`. Exceções por comentário `// xss-safe: motivo`.
- CSP via `helmet` (Fase 3) ou meta tag: `script-src 'self'`, sem `unsafe-inline` em scripts; ajustar o build do Vite se necessário.

## Gate de saída
- [ ] Testes do corpus verdes para sanitizer, editor, menus e viewers.
- [ ] Guard de `innerHTML` ativo e verde.
- [ ] `npm run verify` (inclui testes do frontend) verde.
- [ ] Manual: criar um `.md` com `<img src=x onerror=alert(1)>` num repo de teste, abrir no editor, no diff e no copilot → nenhum alerta.
