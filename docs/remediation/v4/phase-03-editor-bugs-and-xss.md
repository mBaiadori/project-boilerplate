# Fase 3 — Bugs do editor e endurecimento de HTML (B2, B3, `style`)

**Objetivo:** links e formatação inline corretos e nenhuma via de CSS/HTML injetado.
**Resolve:** B2, B3, `style` em `sanitizeHtml`.
**Esforço:** pequeno a médio. **Pré-requisitos:** Fase 0.
Arquivos: [notion-editor-engine.ts](../../../frontend/src/components/editor/notion-editor-engine.ts) (`parseInlineMarkdown` L1430-1448, `escapeHtml` L37), [sanitize.ts](../../../frontend/src/utils/sanitize.ts), `sanitize.test.ts`, `rich-diff.ts`, `dictionary-matcher.ts`, `slash-menu.ts`.

## Contexto
- B2: `parseInlineMarkdown` escapa `&` no texto inteiro e depois `escapeHtml(trimmedHref)` de novo: `?a=1&b=2` vira `&amp;amp;`. `)` na URL encerra o link. `\*(.*?)\*` quebra `2*3*4`.
- B3: `isDoc` usa `endsWith('.md')`/`includes(':~:text=')` e abre externos como `_self`.
- `sanitizeHtml` permite `style`: injeção de CSS (sobrepor UI, exfiltrar por `url()`).
- Há 3 cópias de `escapeHtml` (`notion-editor-engine`, `rich-diff`, `dictionary-matcher`, `slash-menu`).

## Passos

### 3.1 RED — testes (`parse-inline.test.ts`, vitest)
- `[x](https://a.com/?a=1&b=2)` → `href="https://a.com/?a=1&amp;b=2"` (uma única vez escapado).
- `[x](https://pt.wikipedia.org/wiki/A_(B))` → link completo com `)` balanceado.
- `2*3*4` e `snake_case_word` não viram itálico/negrito.
- `[x](javascript:alert(1))` → `href="#"`.
- `[x](https://evil.com/readme.md)` → `target="_blank"` com `rel="noopener noreferrer"`; `[x](docs/a.md)` e `[x](#sec)` → `_self`.
- `<img src=x onerror=alert(1)>` no texto → literal escapado.
- `sanitizeHtml('<p style="background:url(//evil)">x</p>')` → sem atributo `style`.
**Verifica:** hoje os de `&`, `)`, `*` e `style` falham.

### 3.2 Implementação
- Extrair `frontend/src/utils/html-escape.ts` (uma só `escapeHtml`) e substituir as cópias.
- `parseInlineMarkdown`: processar em **passes com tokens** (primeiro `code`, depois links, depois ênfase) em vez de regex encadeadas sobre string já escapada; escapar cada fragmento **uma vez**. Opcional: trocar por `marked` já presente no projeto com `sanitizeHtml` na saída, com testes de equivalência para o dialeto atual.
- `isDoc`: decidir por **URL parseada**: `isDoc = !/^[a-z][a-z0-9+.-]*:/i.test(href) && (path.endsWith('.md') || href.startsWith('#'))`. Externos sempre `_blank` + `rel="noopener noreferrer"`.
- `sanitizeHtml`: remover `'style'` de `ADD_ATTR`; manter `class`. Se algum recurso do diff depender de `style`, trocar por classes CSS.
- Adicionar hook DOMPurify `afterSanitizeAttributes` para forçar `rel="noopener noreferrer"` em `target="_blank"`.
**Verifica:** `cd frontend && npx vitest run && npx tsc -p tsconfig.app.json --noEmit`.

### 3.3 Cobertura de innerHTML
- Listar os ~30 `innerHTML =` do editor (`grep -n "innerHTML *=" frontend/src/components/editor`) e classificar: (a) constante, (b) escapado, (c) sanitizado. Qualquer (d) "outro" vira ticket. Salvar a tabela em `docs/remediation/v4/innerhtml-audit.md`.
- Guard em `scripts/guards.mjs`: `dangerously_without_sanitize = 0` (todo `dangerouslySetInnerHTML` precisa de `sanitizeHtml(`).

## Gate de saída
- [ ] Testes de 3.1 verdes (vitest).
- [ ] Uma única implementação de `escapeHtml` no frontend.
- [ ] `style` fora de `ADD_ATTR`; corpus XSS existente continua verde.
- [ ] `innerhtml-audit.md` com todas as ocorrências classificadas.
- [ ] Validação visual do editor feita por você (links, listas, itálico).
