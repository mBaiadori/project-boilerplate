import * as Diff from 'diff';

export interface ClientDiffResult {
  hasChanges: boolean;
  additions: number;
  deletions: number;
  diff_text: string;
}

/**
 * Computes a fast unified diff and addition/deletion counts in memory.
 */
export function computeClientDiff(
  oldContent: string = '',
  newContent: string = '',
  filePath: string = ''
): ClientDiffResult {
  if (oldContent === newContent) {
    return {
      hasChanges: false,
      additions: 0,
      deletions: 0,
      diff_text: '',
    };
  }

  const patch = Diff.createPatch(filePath || 'file', oldContent || '', newContent || '', '', '');
  const changes = Diff.diffLines(oldContent || '', newContent || '');

  let additions = 0;
  let deletions = 0;

  for (const part of changes) {
    if (part.added) {
      additions += part.count || 0;
    }
    if (part.removed) {
      deletions += part.count || 0;
    }
  }

  return {
    hasChanges: additions > 0 || deletions > 0,
    additions,
    deletions,
    diff_text: patch,
  };
}
