import { diffLines, diffWordsWithSpace } from 'diff';
import { marked } from 'marked';

export interface VisualDiffStats {
  hasChanges: boolean;
  addedWords: number;
  removedWords: number;
  addedLines: number;
  removedLines: number;
}

export interface DiffLineItem {
  type: 'added' | 'removed' | 'unchanged';
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
}

/**
 * Escapes HTML characters to prevent XSS during custom diff injections.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Computes statistics on added and removed words and lines.
 */
export function computeVisualDiffStats(oldText: string = '', newText: string = ''): VisualDiffStats {
  const cleanOld = (oldText || '').trim();
  const cleanNew = (newText || '').trim();

  if (cleanOld === cleanNew) {
    return { hasChanges: false, addedWords: 0, removedWords: 0, addedLines: 0, removedLines: 0 };
  }

  const lineDiff = diffLines(cleanOld, cleanNew);
  let addedLines = 0;
  let removedLines = 0;

  for (const part of lineDiff) {
    if (part.added) addedLines += part.count || 0;
    if (part.removed) removedLines += part.count || 0;
  }

  const wordDiff = diffWordsWithSpace(cleanOld, cleanNew);
  let addedWords = 0;
  let removedWords = 0;

  for (const part of wordDiff) {
    const wordCount = (part.value.match(/\b\w+\b/g) || []).length;
    if (part.added) addedWords += wordCount;
    if (part.removed) removedWords += wordCount;
  }

  return {
    hasChanges: addedWords > 0 || removedWords > 0 || addedLines > 0 || removedLines > 0,
    addedWords,
    removedWords,
    addedLines,
    removedLines,
  };
}

/**
 * Computes line-by-line diff items with accurate line numbers for code/PR diff views.
 */
export function computeLineDiff(oldText: string = '', newText: string = ''): DiffLineItem[] {
  const lineDiff = diffLines(oldText || '', newText || '');
  const result: DiffLineItem[] = [];
  let oldLine = 1;
  let newLine = 1;

  for (const part of lineDiff) {
    const lines = part.value.replace(/\r?\n$/, '').split(/\r?\n/);
    for (const line of lines) {
      if (part.added) {
        result.push({
          type: 'added',
          newLineNumber: newLine++,
          content: line,
        });
      } else if (part.removed) {
        result.push({
          type: 'removed',
          oldLineNumber: oldLine++,
          content: line,
        });
      } else {
        result.push({
          type: 'unchanged',
          oldLineNumber: oldLine++,
          newLineNumber: newLine++,
          content: line,
        });
      }
    }
  }

  return result;
}

/**
 * Generates an intuitive, readable HTML document with visual insertions and deletions.
 */
export function generateVisualMarkdownDiffHtml(oldMarkdown: string = '', newMarkdown: string = ''): string {
  const cleanOld = (oldMarkdown || '').trim();
  const cleanNew = (newMarkdown || '').trim();

  if (!cleanOld && !cleanNew) {
    return '<p style="color:var(--color-outline, #64748b);font-style:italic">Documento vazio.</p>';
  }

  if (cleanOld === cleanNew) {
    return marked.parse(cleanNew) as string;
  }

  const lineDiff = diffLines(cleanOld, cleanNew);
  const resultChunks: string[] = [];

  for (let i = 0; i < lineDiff.length; i++) {
    const current = lineDiff[i];
    const next = lineDiff[i + 1];

    // Case 1: Replacement (removed block followed immediately by added block)
    if (current.removed && next && next.added) {
      const parsedRemoved = marked.parse(current.value) as string;
      const parsedAdded = marked.parse(next.value) as string;

      resultChunks.push(`
        <div class="rich-diff-replacement-group" style="margin: 12px 0; border: 1px solid var(--color-outline-variant, #cbd5e1); border-radius: 8px; overflow: hidden;">
          <div style="background: rgba(239, 68, 68, 0.08); padding: 8px 12px; border-bottom: 1px solid rgba(239, 68, 68, 0.2); color: #991b1b; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;">
            - Versão Oficial Anterior (Substituída)
          </div>
          <div class="rich-diff-block rich-diff-removed" style="padding: 12px 16px; background: rgba(254, 226, 226, 0.25); text-decoration: line-through; opacity: 0.85;">
            ${parsedRemoved}
          </div>
          <div style="background: rgba(34, 197, 94, 0.08); padding: 8px 12px; border-top: 1px solid rgba(34, 197, 94, 0.2); border-bottom: 1px solid rgba(34, 197, 94, 0.2); color: #166534; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;">
            + Nova Versão Traduzida (Proposta)
          </div>
          <div class="rich-diff-block rich-diff-added" style="padding: 12px 16px; background: rgba(220, 252, 231, 0.35);">
            ${parsedAdded}
          </div>
        </div>
      `);
      i++; // skip next since it's already handled
      continue;
    }

    // Case 2: Purely added block
    if (current.added) {
      const parsedAdded = marked.parse(current.value) as string;
      resultChunks.push(`
        <div class="rich-diff-block rich-diff-added" style="margin: 10px 0; border-left: 4px solid #22c55e; background: rgba(220, 252, 231, 0.35); padding: 10px 16px; border-radius: 0 6px 6px 0;">
          <div style="font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase; margin-bottom: 4px;">
            + Adicionado
          </div>
          ${parsedAdded}
        </div>
      `);
      continue;
    }

    // Case 3: Purely removed block
    if (current.removed) {
      const parsedRemoved = marked.parse(current.value) as string;
      resultChunks.push(`
        <div class="rich-diff-block rich-diff-removed" style="margin: 10px 0; border-left: 4px solid #ef4444; background: rgba(254, 226, 226, 0.35); padding: 10px 16px; border-radius: 0 6px 6px 0; text-decoration: line-through; opacity: 0.85;">
          <div style="font-size: 11px; font-weight: 700; color: #991b1b; text-transform: uppercase; margin-bottom: 4px;">
            - Removido
          </div>
          ${parsedRemoved}
        </div>
      `);
      continue;
    }

    // Case 4: Unchanged block
    const parsedUnchanged = marked.parse(current.value) as string;
    resultChunks.push(`<div class="rich-diff-block rich-diff-unchanged" style="margin: 6px 0;">${parsedUnchanged}</div>`);
  }

  return resultChunks.join('\n');
}
