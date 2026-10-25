import DOMPurify from 'dompurify';

const SAFE_URL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/**
 * Valida se uma URL é segura para navegação ou inclusão em href/src.
 * Bloqueia protocolos perigosos como javascript:, vbscript:, data:, etc.
 */
export function isSafeUrl(rawUrl: string): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim().replace(/[\x00-\x20\x7F-\x9F]+/g, '');

  // Rejeitar qualquer URL com aspas ou quebras de tag que possam quebrar atributos HTML
  if (/["'<>]/.test(rawUrl)) {
    return false;
  }

  // Bloquear schemes perigosos expressamente e protocol-relative URLs (//)
  if (/^(?:javascript|data|vbscript):/i.test(trimmed) || trimmed.startsWith('//')) {
    return false;
  }

  // Permitir âncoras locais e caminhos relativos de barra única (que não comecem com //)
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

export { escapeHtml } from './html-escape';

// Força rel="noopener noreferrer" em links target="_blank" e neutraliza protocol-relative URLs (M5)
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer');
  }
  const href = node.getAttribute('href');
  if (href && href.trim().startsWith('//')) {
    node.removeAttribute('href');
  }
  const src = node.getAttribute('src');
  if (src && src.trim().startsWith('//')) {
    node.removeAttribute('src');
  }
});

/**
 * Sanitiza com segurança strings de HTML geradas a partir de Markdown, diffs ou respostas de IA
 * antes de serem passadas para o dangerouslySetInnerHTML do React ou canvas do editor.
 */
export function sanitizeHtml(rawHtml: string): string {
  if (!rawHtml) return '';
  return DOMPurify.sanitize(rawHtml, {
    FORBID_TAGS: ['input'],
    FORBID_ATTR: ['style', 'contenteditable', 'id'],
    ADD_TAGS: [
      'mark', 'ins', 'del', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'details', 'summary', 'blockquote', 'code', 'pre', 'span',
    ],
    ADD_ATTR: [
      'target', 'rel', 'class', 'data-type', 'data-indent',
      'data-mermaid-code', 'type', 'checked', 'spellcheck',
      'data-term-key',
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|#|\/(?!\/)|\.\/|\.\.\/|_blank|_self)/i,
  });
}

/**
 * Atribui HTML sanitizado de forma segura a um elemento DOM.
 */
export function setSafeHtml(element: HTMLElement, html: string): void {
  element.innerHTML = sanitizeHtml(html);
}

/**
 * Sanitiza SVGs (como os gerados por Mermaid ou renderizadores gráficos)
 * removendo scripts embutidos, tags estranhas e event handlers.
 */
export function sanitizeSvg(rawSvg: string): string {
  if (!rawSvg) return '';
  return DOMPurify.sanitize(rawSvg, {
    USE_PROFILES: { svg: true, svgFilters: true },
  });
}
