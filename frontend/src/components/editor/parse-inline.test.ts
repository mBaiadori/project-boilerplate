import { describe, it, expect } from 'vitest';
import { NotionEditorEngine } from './notion-editor-engine';
import { sanitizeHtml } from '../../utils/sanitize';

describe('Phase 3: Editor Bugs & HTML Hardening (B2, B3, style)', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const engine = new NotionEditorEngine({
    canvasElement: container,
    filePath: 'test.md',
    onChange: () => {},
    onSave: () => {},
  });

  it('3.1.1: Links com querystring (&) não devem sofrer double escaping (&amp;amp;)', () => {
    const input = '[Link com query](https://a.com/?a=1&b=2)';
    const html = engine.parseInlineMarkdown(input);
    expect(html).toContain('href="https://a.com/?a=1&amp;b=2"');
    expect(html).not.toContain('&amp;amp;');
  });

  it('3.1.2: Links com parênteses balanceados devem ser capturados por completo', () => {
    const input = '[Wikipedia](https://pt.wikipedia.org/wiki/A_(B))';
    const html = engine.parseInlineMarkdown(input);
    expect(html).toContain('href="https://pt.wikipedia.org/wiki/A_(B)"');
  });

  it('3.1.3: Expressões aritméticas (2*3*4) e snake_case não devem virar itálico', () => {
    const inputMath = 'O resultado de 2*3*4 é 24';
    const htmlMath = engine.parseInlineMarkdown(inputMath);
    expect(htmlMath).not.toContain('<em>');

    const inputSnake = 'A variável my_snake_case_var é importante';
    const htmlSnake = engine.parseInlineMarkdown(inputSnake);
    expect(htmlSnake).not.toContain('<em>');
  });

  it('3.1.4: Protocolo javascript: deve ser neutralizado para href="#"', () => {
    const input = '[Evil](javascript:alert(1))';
    const html = engine.parseInlineMarkdown(input);
    expect(html).toContain('href="#"');
    expect(html).not.toContain('javascript:');
  });

  it('3.1.5: URL externa com .md não deve ser tratada como documento interno (_self)', () => {
    const input = '[External Doc](https://evil.com/readme.md)';
    const html = engine.parseInlineMarkdown(input);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain('notion-doc-link');
  });

  it('3.1.6: Links relativos e âncoras locais devem abrir como documento interno (_self)', () => {
    const inputRelative = '[Guia Interno](docs/guide.md)';
    const htmlRelative = engine.parseInlineMarkdown(inputRelative);
    expect(htmlRelative).toContain('target="_self"');
    expect(htmlRelative).toContain('notion-doc-link');

    const inputAnchor = '[Seção 1](#section-1)';
    const htmlAnchor = engine.parseInlineMarkdown(inputAnchor);
    expect(htmlAnchor).toContain('target="_self"');
  });

  it('3.1.7: Tags HTML brutas no texto inline devem ser escapadas como texto literal', () => {
    const input = 'Texto com <img src=x onerror=alert(1)> perigoso';
    const html = engine.parseInlineMarkdown(input);
    expect(html).toContain('&lt;img');
    expect(html).not.toContain('<img');
  });

  it('3.1.8: sanitizeHtml deve remover atributos style injetados', () => {
    const dirty = '<p style="background:url(//evil.com/leak); color:red">Texto</p>';
    const clean = sanitizeHtml(dirty);
    expect(clean).not.toContain('style=');
  });

  it('3.1.9: sanitizeHtml deve garantir rel="noopener noreferrer" em links target="_blank"', () => {
    const htmlWithBlank = '<a href="https://example.com" target="_blank">Externo</a>';
    const clean = sanitizeHtml(htmlWithBlank);
    expect(clean).toContain('rel="noopener noreferrer"');
    expect(clean).toContain('target="_blank"');
  });
});
