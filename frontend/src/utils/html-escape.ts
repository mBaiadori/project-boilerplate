/**
 * Escapa caracteres HTML perigosos em strings para renderização segura.
 * Canonical implementation used across frontend (Editor, Sanitizer, Diff, Dictionary).
 */
export function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
