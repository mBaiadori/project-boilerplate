import { diffLines, diffWordsWithSpace } from 'diff';
import { marked } from 'marked';

export interface VisualDiffStats {
  hasChanges: boolean;
  addedWords: number;
  removedWords: number;
  addedLines: number;
  removedLines: number;
}

/**
 * Escapes HTML characters to prevent XSS during custom diff injections.
 */
function escapeHtml(text: string): string {
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
  if (oldText === newText) {
    return { hasChanges: false, addedWords: 0, removedWords: 0, addedLines: 0, removedLines: 0 };
  }

  const lineDiff = diffLines(oldText, newText);
  let addedLines = 0;
  let removedLines = 0;

  for (const part of lineDiff) {
    if (part.added) addedLines += part.count || 0;
    if (part.removed) removedLines += part.count || 0;
  }

  const wordDiff = diffWordsWithSpace(oldText, newText);
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
 * Generates an intuitive, readable HTML document with visual insertions and deletions.
 */
export function generateVisualMarkdownDiffHtml(oldMarkdown: string = '', newMarkdown: string = ''): string {
  if (!oldMarkdown && !newMarkdown) {
    return '<p class="text-muted">Documento vazio.</p>';
  }

  if (oldMarkdown === newMarkdown) {
    return marked.parse(newMarkdown) as string;
  }

  const lineDiff = diffLines(oldMarkdown, newMarkdown);
  const resultChunks: string[] = [];

  for (let i = 0; i < lineDiff.length; i++) {
    const current = lineDiff[i];
    const next = lineDiff[i + 1];

    // Case 1: A replacement (removed block followed immediately by added block) -> Word level diff
    if (current.removed && next && next.added) {
      const words = diffWordsWithSpace(current.value, next.value);
      let mixedMd = '';

      for (const w of words) {
        if (w.added) {
          mixedMd += `<ins class="rich-diff-ins">${escapeHtml(w.value)}</ins>`;
        } else if (w.removed) {
          mixedMd += `<del class="rich-diff-del">${escapeHtml(w.value)}</del>`;
        } else {
          mixedMd += escapeHtml(w.value);
        }
      }

      // Convert line breaks
      const formattedHtml = mixedMd.replace(/\n/g, '<br/>');
      resultChunks.push(`<div class="rich-diff-block rich-diff-modified">${formattedHtml}</div>`);
      i++; // skip next since we handled it
      continue;
    }

    // Case 2: Purely added block
    if (current.added) {
      const parsedAdded = marked.parse(current.value) as string;
      resultChunks.push(`<div class="rich-diff-block rich-diff-added"><ins class="rich-diff-ins-block">${parsedAdded}</ins></div>`);
      continue;
    }

    // Case 3: Purely removed block
    if (current.removed) {
      const parsedRemoved = marked.parse(current.value) as string;
      resultChunks.push(`<div class="rich-diff-block rich-diff-removed"><del class="rich-diff-del-block">${parsedRemoved}</del></div>`);
      continue;
    }

    // Case 4: Unchanged block
    const parsedUnchanged = marked.parse(current.value) as string;
    resultChunks.push(`<div class="rich-diff-block rich-diff-unchanged">${parsedUnchanged}</div>`);
  }

  return resultChunks.join('\n');
}
