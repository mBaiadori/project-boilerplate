import { describe, it, expect } from 'vitest';
import { computeClientDiff } from './diff';

describe('computeClientDiff Utility', () => {
  it('returns no changes when contents are strictly identical', () => {
    const content = '# Title\nSame text\n';
    const result = computeClientDiff(content, content, 'test.md');

    expect(result.hasChanges).toBe(false);
    expect(result.additions).toBe(0);
    expect(result.deletions).toBe(0);
    expect(result.diff_text).toBe('');
  });

  it('correctly tracks line additions', () => {
    const oldContent = 'Line 1\nLine 2\n';
    const newContent = 'Line 1\nLine 1.5\nLine 2\nLine 3\n';
    const result = computeClientDiff(oldContent, newContent, 'test.md');

    expect(result.hasChanges).toBe(true);
    expect(result.additions).toBe(2);
    expect(result.deletions).toBe(0);
    expect(result.diff_text).toContain('+Line 1.5');
    expect(result.diff_text).toContain('+Line 3');
  });

  it('correctly tracks line deletions', () => {
    const oldContent = 'Line 1\nLine 2\nLine 3';
    const newContent = 'Line 1\nLine 3';
    const result = computeClientDiff(oldContent, newContent, 'test.md');

    expect(result.hasChanges).toBe(true);
    expect(result.additions).toBe(0);
    expect(result.deletions).toBe(1);
    expect(result.diff_text).toContain('-Line 2');
  });

  it('handles empty inputs without throwing errors', () => {
    const result = computeClientDiff('', '', 'empty.txt');
    expect(result.hasChanges).toBe(false);
    expect(result.additions).toBe(0);
    expect(result.deletions).toBe(0);
  });
});
