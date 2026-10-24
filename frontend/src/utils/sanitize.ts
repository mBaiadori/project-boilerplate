import DOMPurify from 'dompurify';

const SAFE_URL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/**
 * Valida se uma URL é segura para navegação ou inclusão em href/src.
 * Bloqueia protocolos perigosos como javascript:, vbscript:, data:, etc.
 */
export function isSafeUrl(rawUrl: string): boolean {
  if (!rawUrl) return false;
  const trimmed = rawUrl.trim().replace(/[\x00-\x20\x7F-\x9F]+/g, '');

  // Rejeitar qualquer URL com aspas, quebras de tag ou event handlers embutidos
  if (/["'<>]/.test(rawUrl) || /on\w+\s*=/i.test(rawUrl)) {
    return false;
  }

  // Bloquear schemes perigosos expressamente
  if (/^(?:javascript|data|vbscript):/i.test(trimmed)) {
    return false;
  }

  // Permitir âncoras locais e caminhos relativos
  if (
    trimmed.startsWith('#') ||
    trimmed.startsWith('/') ||
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

// Força rel="noopener noreferrer" em links target="_blank" para mitigar tabnabbing
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

/**
 * Sanitiza com segurança strings de HTML geradas a partir de Markdown, diffs ou respostas de IA
 * antes de serem passadas para o dangerouslySetInnerHTML do React ou canvas do editor.
 */
export function sanitizeHtml(rawHtml: string): string {
  if (!rawHtml) return '';
  return DOMPurify.sanitize(rawHtml, {
    FORBID_ATTR: ['style'],
    ADD_TAGS: [
      'mark', 'ins', 'del', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'details', 'summary', 'blockquote', 'code', 'pre', 'span', 'input',
    ],
    ADD_ATTR: [
      'target', 'rel', 'class', 'data-type', 'data-indent',
      'data-mermaid-code', 'type', 'checked', 'spellcheck', 'contenteditable',
      'data-term-key', 'data-id', 'id',
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|#|\/|\.\/|\.\.\/|_blank|_self|_parent|_top)/i,
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
