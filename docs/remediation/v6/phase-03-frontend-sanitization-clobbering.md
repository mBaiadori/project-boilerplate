# Fase 03 — Endurecimento de Sanitização no Frontend e Mitigação de DOM Clobbering (M5)

**Objetivo:** Corrigir vulnerabilidades no motor de sanitização do frontend (`sanitize.ts`), eliminando a aceitação de URLs relativas a protocolo (`//evil.com`) em tags de mídia/links, removendo vetores de DOM Clobbering e phishing na whitelist do DOMPurify, e eliminando falsos positivos na validação de URLs com parâmetros legítimos.  
**Resolve:** Achado **M5** (Severidade Média).  
**Prioridade:** P1.  
**Esforço:** Pequeno.  
**Arquivos Principais:**
- `frontend/src/utils/sanitize.ts`
- `frontend/src/utils/sanitize.test.ts` (Novo ou expandido)

---

## 1. Contexto e Diagnóstico

### 1.1 Brecha de Protocol-Relative Beacons no DOMPurify
No arquivo `frontend/src/utils/sanitize.ts`:
```typescript
ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|#|\/|\.\/|\.\.\/|_blank|_self|_parent|_top)/i
```
O trecho `|\/|` casa com qualquer string que comece com uma barra simples (`/`). Porém, uma URL relativa a protocolo (`//evil.com/beacon.png`) também começa com `/`!  
Quando inserida em uma tag `<img src="//evil.com/tracker.png">`, o navegador herda o protocolo atual (`http:` ou `https:`) e dispara uma requisição GET automática para o servidor externo, vazando IP e possibilitando rastreamento/exfiltração de dados em documentos ou respostas de IA.  
Além disso, valores como `_blank`, `_self`, `_parent` e `_top` são valores do atributo `target` de links e nunca deveriam constar em uma expressão regular de esquemas de URI.

### 1.2 Vetores de Phishing e DOM Clobbering na Whitelist
1. **Tag `input` em `ADD_TAGS`:** Permitir tags `<input>` em Markdown renderizado possibilita a injeção de campos falsos de captura de credenciais (phishing) dentro de notas ou respostas de IA.
2. **Atributos `id` e `contenteditable` em `ADD_ATTR`:** Permitir atributos `id` arbitrários expõe a aplicação a **DOM Clobbering** (onde elementos HTML sobrescrevem variáveis globais no objeto `window` ou propriedades de `document`). Permitir `contenteditable` permite desestruturar o canvas do editor Notion.

### 1.3 Falso Positivo em `isSafeUrl`
A verificação `/on\w+\s*=/i.test(rawUrl)` bloqueia indiscriminadamente parâmetros válidos de URL que contenham palavras como `connection=1`, `action=on_line`, `addon=false` etc., quebrando links legítimos que contêm tais termos na query string.

---

## 2. Passos de Execução

### 2.1 RED — Testes Unitários de Sanitização (`sanitize.test.ts`)
Criar ou expandir a suíte de testes do frontend com os seguintes casos:
- **Teste 1:** `<img src="//attacker.com/leak.gif">` sanitizado pelo `sanitizeHtml` deve ter o atributo `src` removido ou neutralizado, não permitindo protocolo relativo.
- **Teste 2:** `<input type="password" placeholder="Sua senha">` deve ter a tag `input` removida.
- **Teste 3:** Elementos com atributo `id="submit"` ou `contenteditable="true"` devem ter esses atributos específicos expurgados pelo DOMPurify.
- **Teste 4:** `isSafeUrl("https://exemplo.com/api?connection=true&addon=active")` deve retornar `true` (sem falso positivo).
- **Teste 5:** `isSafeUrl("javascript:alert(1)")` e `isSafeUrl("//attacker.com")` devem continuar retornando `false`.

**Comando RED:**
```bash
cd frontend && npm test -- src/utils/sanitize.test.ts
```

---

### 2.2 Refatoração de `frontend/src/utils/sanitize.ts`

1. **Ajuste na Expressão Regular de URIs Permitidas:**
   Substituir a regra permissiva por uma restrição estrita que aceita apenas caminhos relativos de barra única (que NÃO comecem com barra dupla `//`):
   ```typescript
   // Aceita http, https, mailto, tel, âncoras locais (#), caminho relativo de barra única (/(?!/)), ./ e ../
   ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|#|\/(?!\/)|\.\/|\.\.\/)/i,
   ```

2. **Saneamento de `ADD_TAGS` e `ADD_ATTR`:**
   - Remover `'input'` da lista `ADD_TAGS`.
   - Remover `'id'` e `'contenteditable'` da lista `ADD_ATTR`.
   - Manter as tags e atributos estritamente necessários para renderização rica (como `mark`, `code`, `pre`, `data-type`, `class`).

3. **Correção de `isSafeUrl`:**
   Tratar a validação de event handlers sem interferir nos parâmetros da query string:
   ```typescript
   export function isSafeUrl(rawUrl: string): boolean {
     if (!rawUrl || typeof rawUrl !== 'string') return false;
     const trimmed = rawUrl.trim();

     // Rejeitar qualquer URL com aspas, quebras de tag ou esquemas perigosos
     if (/["'<>]/.test(trimmed) || /^(?:javascript|data|vbscript):/i.test(trimmed) || trimmed.startsWith('//')) {
       return false;
     }

     // Permitir âncoras locais e caminhos relativos seguros
     if (
       trimmed.startsWith('#') ||
       (trimmed.startsWith('/') && !trimmed.startsWith('//')) ||
       trimmed.startsWith('./') ||
       trimmed.startsWith('../')
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

## 3. Gate de Saída

- [ ] Todos os testes em `frontend/src/utils/sanitize.test.ts` passando com 100% de sucesso.
- [ ] Verificação estática com `npx tsc -p tsconfig.app.json --noEmit` e `tsconfig.strict.json` com 0 erros.
- [ ] `node scripts/guards.mjs` confirmando que os guardas de `dangerouslySetInnerHTML` e `innerHTML` continuam respeitados.
- [ ] `npm run verify` executando com sucesso.
