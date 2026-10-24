import DOMPurify from 'dompurify';

/**
 * Sanitiza com segurança strings de HTML geradas a partir de Markdown, diffs ou respostas de IA
 * antes de serem passadas para o dangerouslySetInnerHTML do React.
 * Preserva tags semânticas e estilos comuns de markdown enquanto remove scripts, iframes e atributos perigosos.
 */
export function sanitizeHtml(rawHtml: string): string {
  if (!rawHtml) return '';
  return DOMPurify.sanitize(rawHtml, {
    USE_PROFILES: { html: true },
    ADD_TAGS: ['mark', 'ins', 'del', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
    ADD_ATTR: ['target', 'rel', 'class', 'style'],
  });
}
