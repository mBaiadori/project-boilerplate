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

export { escapeHtml } from './html-escape';

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
    return '<p class="diff-empty-message">Documento vazio.</p>';
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
        <div class="rich-diff-replacement-group">
          <div class="rich-diff-header rich-diff-header--removed">
            - Versão Oficial Anterior (Substituída)
          </div>
          <div class="rich-diff-block rich-diff-removed">
            ${parsedRemoved}
          </div>
          <div class="rich-diff-header rich-diff-header--added">
            + Nova Versão Traduzida (Proposta)
          </div>
          <div class="rich-diff-block rich-diff-added">
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
        <div class="rich-diff-block rich-diff-block--added-standalone rich-diff-added">
          <div class="rich-diff-tag rich-diff-tag--added">
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
        <div class="rich-diff-block rich-diff-block--removed-standalone rich-diff-removed">
          <div class="rich-diff-tag rich-diff-tag--removed">
            - Removido
          </div>
          ${parsedRemoved}
        </div>
      `);
      continue;
    }

    // Case 4: Unchanged block
    const parsedUnchanged = marked.parse(current.value) as string;
    resultChunks.push(`<div class="rich-diff-block rich-diff-unchanged">${parsedUnchanged}</div>`);
  }

  return resultChunks.join('\n');
}

export interface SideBySideDiffHtmlResult {
  oldHtml: string;
  newHtml: string;
}

/**
 * Generates super clean side-by-side HTML for markdown documents.
 * Highlighting is applied strictly with soft background colors and subtle accent borders,
 * without repeating banners, labels, or extra text blocks.
 */
export function generateSideBySideMarkdownHtml(
  oldMarkdown: string = '',
  newMarkdown: string = ''
): SideBySideDiffHtmlResult {
  const cleanOld = (oldMarkdown || '').trim();
  const cleanNew = (newMarkdown || '').trim();

  if (!cleanOld && !cleanNew) {
    return {
      oldHtml: '<p class="diff-empty-message">Documento vazio.</p>',
      newHtml: '<p class="diff-empty-message">Documento vazio.</p>',
    };
  }

  if (cleanOld === cleanNew) {
    const rendered = marked.parse(cleanNew) as string;
    return { oldHtml: rendered, newHtml: rendered };
  }

  const lineDiff = diffLines(cleanOld, cleanNew);
  const oldChunks: string[] = [];
  const newChunks: string[] = [];

  for (const part of lineDiff) {
    if (part.removed) {
      // Left side: soft red background
      const parsed = marked.parse(part.value) as string;
      oldChunks.push(
        `<div class="diff-highlight-removed">${parsed}</div>`
      );
    } else if (part.added) {
      // Right side: soft green background
      const parsed = marked.parse(part.value) as string;
      newChunks.push(
        `<div class="diff-highlight-added">${parsed}</div>`
      );
    } else {
      // Unchanged content in both sides
      const parsed = marked.parse(part.value) as string;
      oldChunks.push(`<div class="diff-block-unchanged">${parsed}</div>`);
      newChunks.push(`<div class="diff-block-unchanged">${parsed}</div>`);
    }
  }

  return {
    oldHtml: oldChunks.join('\n') || '<p class="diff-empty-message">Documento vazio na versão oficial.</p>',
    newHtml: newChunks.join('\n') || '<p class="diff-empty-message">Documento vazio no rascunho.</p>',
  };
}

