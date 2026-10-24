import { describe, it, expect, beforeEach } from 'vitest';
import { NotionEditorEngine } from './notion-editor-engine';

describe('NotionEditorEngine Security Tests', () => {
  let container: HTMLDivElement;
  let engine: NotionEditorEngine;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    engine = new NotionEditorEngine({
      canvasElement: container,
      filePath: 'test.md',
      onChange: () => {},
      onSave: () => {},
    });
  });

  it('parseInlineMarkdown should neutralize javascript: URLs in markdown links', () => {
    const maliciousMd = '[Click me](javascript:alert("pwned"))';
    const parsed = engine.parseInlineMarkdown(maliciousMd);

    expect(parsed.toLowerCase()).not.toContain('href="javascript:');
    expect(parsed.toLowerCase()).not.toContain('href=\'javascript:');
  });

  it('parseInlineMarkdown should neutralize data: URLs in markdown links', () => {
    const maliciousMd = '[Click me](data:text/html;base64,PHNjcmlwdD4=)';
    const parsed = engine.parseInlineMarkdown(maliciousMd);

    expect(parsed.toLowerCase()).not.toContain('href="data:');
  });

  it('parseInlineMarkdown should escape quotes in link hrefs to prevent attribute injection', () => {
    const maliciousMd = '[Click me](" onmouseover="alert(1))';
    const parsed = engine.parseInlineMarkdown(maliciousMd);

    expect(parsed.toLowerCase()).not.toContain('onmouseover=');
  });

  it('parseInlineMarkdown should allow legitimate links', () => {
    const safeMd = '[Documentation](https://example.com/guide.md)';
    const parsed = engine.parseInlineMarkdown(safeMd);

    expect(parsed).toContain('href="https://example.com/guide.md"');
    expect(parsed).toContain('Documentation</a>');
  });
});
