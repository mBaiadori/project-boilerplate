# Fase 5 — XSS residual no editor (S6, `innerHTML`)

**Objetivo:** conteúdo de repositório (Markdown, nomes, links) nunca executa script no editor.
**Resolve:** a pendência "confirmar escape em `parseMarkdownLinesToHtml` e `innerHTML`" (≈30 usos em `notion-editor-engine.ts`, `slash-menu.ts`, `bubble-menu.ts`, `notion-table.ts`).
**Esforço:** médio. **Pré-requisitos:** Fase 0.

## Passos

### 5.1 Inventário
- `grep -rn "innerHTML\|outerHTML\|insertAdjacentHTML" frontend/src` e classificar cada uso: (a) literal estático, (b) interpola dado, (c) recebe HTML de `parseMarkdownLinesToHtml`.
- Registrar a tabela no PR. Só (b) e (c) exigem correção.

### 5.2 RED — testes (`vitest`)
- Markdown com `<img src=x onerror=alert(1)>`, `[x](javascript:alert(1))`, `<svg onload=...>`, `<a href="data:text/html,...">`, atributo `"` quebrando contexto, e `</script>` → saída sem `on*`, sem `javascript:`/`data:` em `href`/`src`.
- Nome de arquivo/título com HTML renderizado em slash menu e bubble menu → texto literal.
- Tabela do `notion-table` com célula `<b onmouseover=...>` → inerte.
**Verifica:** os que dependem de dado interpolado sem escape falham.

### 5.3 Implementação
- Interpolações (b): trocar por `textContent`/`createElement`, ou `escapeHtml()` único em `utils/sanitize.ts`.
- Saída de `parseMarkdownLinesToHtml` (c): passar sempre por `sanitizeHtml` (DOMPurify) com allowlist de tags/atributos e `ALLOWED_URI_REGEXP` restrito a `https?|mailto|#`.
- Guard em `guards.mjs`: `innerHTML_unsanitized_frontend` com baseline atual, só desce.
- Evitar duplicação: um único ponto `setSafeHtml(el, html)`.
- Opcional: Trusted Types + CSP (combina com a Fase 4).

**Verifica:** `cd frontend && npx tsc -p tsconfig.app.json --noEmit && npx vitest run && node ../scripts/guards.mjs`.

## Gate de saída
- [ ] Tabela de inventário no PR, sem item (b)/(c) pendente.
- [ ] Testes de 5.2 verdes.
- [ ] Guard novo no baseline mínimo.
- [ ] Você abre um documento com payloads de teste e nada executa.
