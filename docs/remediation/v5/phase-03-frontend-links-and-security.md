# Fase 3 — Links Externos, Protocol-Relative URLs e Segurança no Editor (SEC-04)

**Objetivo:** Eliminar o vetor de redirecionamento arbitrário e phishing decorrente de URLs relativas a protocolo (`//evil.com`) no editor e no utilitário de sanitização de links.  
**Resolve:** SEC-04 (Protocol-relative URLs tratadas como documentos locais com `target="_self"`).  
**Prioridade:** P1.  
**Esforço:** Pequeno.  
**Arquivos Principais:**
- `frontend/src/utils/sanitize.ts`
- `frontend/src/components/editor/notion-editor-engine.ts`
- `frontend/src/components/editor/parse-inline.test.ts`
- `frontend/src/utils/sanitize.test.ts`

---

## Contexto e Vulnerabilidade

No utilitário de sanitização [sanitize.ts](file:///Users/MarcosBaiadori/Desktop/project-boilerplate/frontend/src/utils/sanitize.ts#L24-L32):
```typescript
if (
  trimmed.startsWith('#') ||
  trimmed.startsWith('/') ||
  trimmed.startsWith('./') ||
  trimmed.startsWith('../') ||
  trimmed.startsWith('?')
) {
  return true;
}
```
URLs que iniciam com barra dupla (como `//evil.com/doc.md`) iniciam com `/`, sendo consideradas seguras.
Em seguida, no analisador inline do editor [notion-editor-engine.ts](file:///Users/MarcosBaiadori/Desktop/project-boilerplate/frontend/src/components/editor/notion-editor-engine.ts#L1454-L1458):
```typescript
const isExternal = /^[a-z][a-z0-9+.-]*:/i.test(trimmedHref);
const isDoc = !isExternal && (trimmedHref.endsWith('.md') || ...);
```
Como `//evil.com/doc.md` não possui scheme alfanumérico com dois-pontos no início, `isExternal` é avaliado como `false`. E como termina em `.md`, o link é classificado como documento interno (`isDoc = true`), sendo gerado com `target="_self"` sem `rel="noopener noreferrer"`.
Ao clicar nesse link no editor, o navegador adota o protocolo da página atual e redireciona a própria janela da SPA para o domínio malicioso externo.

---

## Passos de Execução

### 3.1 RED — Testes Unitários de Links (`parse-inline.test.ts` e `sanitize.test.ts`)
Adicionar casos de teste:
1. `isSafeUrl('//evil.com')`: deve retornar `false` (ou rejeitar protocol-relative URLs que não sejam caminhos relativos de barra única).
2. `isSafeUrl('/docs/guia.md')`: deve retornar `true`.
3. `parseInlineMarkdown('[Link](//evil.com/phishing.md)')`:
   - Não deve conter `target="_self"`.
   - Não deve conter a classe `notion-doc-link`.
   - Deve conter `target="_blank"` e `rel="noopener noreferrer"`, ou converter o href para `'#'` caso protocol-relative seja proibido.
4. `parseInlineMarkdown('[Legítimo](/relativo.md)')`: continua com `target="_self"` e classe `notion-doc-link`.

**Comando de validação RED:**
```bash
cd frontend && npm test
```

---

### 3.2 Correção em `frontend/src/utils/sanitize.ts`
Garantir que caminhos que iniciam com `/` não sejam barras duplas `//` (protocol-relative):
```typescript
// frontend/src/utils/sanitize.ts
export function isSafeUrl(rawUrl: string): boolean {
  if (!rawUrl) return false;
  const trimmed = rawUrl.trim().replace(/[\x00-\x20\x7F-\x9F]+/g, '');

  // Rejeitar qualquer URL com aspas, quebras de tag ou event handlers embutidos
  if (/["'<>]/.test(rawUrl) || /on\w+\s*=/i.test(rawUrl)) {
    return false;
  }

  // Bloquear schemes perigosos expressamente e protocol-relative URLs (//)
  if (/^(?:javascript|data|vbscript):/i.test(trimmed) || trimmed.startsWith('//')) {
    return false;
  }

  // Permitir âncoras locais e caminhos relativos de barra única
  if (
    trimmed.startsWith('#') ||
    (trimmed.startsWith('/') && !trimmed.startsWith('//')) ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('../') ||
    trimmed.startsWith('?')
  ) {
    return true;
  }

  try {
    const parsed = new URL(trimmed, 'https://localhost');
    return SAFE_URL_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}
```

---

### 3.3 Ajuste no Parser Inline de Markdown (`notion-editor-engine.ts`)
Atualizar a detecção de URLs externas para considerar protocol-relative como externa:
```typescript
// frontend/src/components/editor/notion-editor-engine.ts
const isExternal = /^[a-z][a-z0-9+.-]*:/i.test(trimmedHref) || trimmedHref.startsWith('//');
const isDoc = !isExternal && !trimmedHref.startsWith('//') && (
  trimmedHref.endsWith('.md') ||
  trimmedHref.includes('.md#') ||
  trimmedHref.startsWith('#') ||
  trimmedHref.includes(':~:text=')
);
```

---

## Gate de Saída

- [ ] Testes de links em `parse-inline.test.ts` e `sanitize.test.ts` passam com 100% de sucesso.
- [ ] Links com `//` não abrem em `_self` nem recebem classe `notion-doc-link`.
- [ ] `cd frontend && npm test && npm run build` sem erros.
