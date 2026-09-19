import * as Diff from 'diff';

export interface DiffResult {
  additions: number;
  deletions: number;
  diff_text: string;
}

export function computeDiff(oldContent: string = '', newContent: string = '', filePath: string = ''): DiffResult {
  const oldLines = oldContent ? oldContent.split('\n') : [];
  const newLines = newContent ? newContent.split('\n') : [];

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
    additions,
    deletions,
    diff_text: patch,
  };
}
