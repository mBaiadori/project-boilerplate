import { describe, it, expect, beforeEach } from 'vitest';
import { NotionEditorEngine } from './notion-editor-engine';
import { SlashMenuEngine } from './slash-menu';
import { NotionTable } from './notion-table';

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

  it('setMarkdown should neutralize raw HTML scripts, img onerror and svg onload', () => {
    const maliciousMd = [
      '# Heading',
      '<script>alert(1)</script>',
      '<img src=x onerror="alert(\'xss\')" />',
      '<svg onload="alert(\'svg-xss\')"><circle r="5" /></svg>',
      '[Malicious Link](javascript:alert("link-xss"))',
      '[Data Link](data:text/html,<script>alert(1)</script>)',
      'Normal paragraph text',
    ].join('\n');

    engine.setMarkdown(maliciousMd);

    // Nenhuma tag <script> real executável no DOM
    expect(engine.canvas.querySelectorAll('script').length).toBe(0);
    // Nenhuma imagem com handler onerror executável no DOM
    expect(engine.canvas.querySelectorAll('img[onerror]').length).toBe(0);
    // Nenhum SVG com handler onload executável no DOM
    expect(engine.canvas.querySelectorAll('svg[onload]').length).toBe(0);

    // Nenhum elemento no DOM possui atributos de eventos (on*)
    const allElements = engine.canvas.querySelectorAll('*');
    allElements.forEach((el) => {
      Array.from(el.attributes).forEach((attr) => {
        expect(attr.name.toLowerCase().startsWith('on')).toBe(false);
      });
    });

    // Nenhum link possui schemes perigosos javascript: ou data:
    const links = engine.canvas.querySelectorAll('a');
    links.forEach((a) => {
      const href = a.getAttribute('href') || '';
      expect(href.toLowerCase().startsWith('javascript:')).toBe(false);
      expect(href.toLowerCase().startsWith('data:')).toBe(false);
    });
  });

  it('table from markdown should neutralize dangerous handlers and schemes in cells', () => {
    const tableMd = [
      '| Coluna 1 | Coluna 2 |',
      '| --- | --- |',
      '| <b onmouseover="alert(1)">Texto</b> | [Perigo](javascript:alert(2)) |',
      '| Normal | [Data](data:text/html,abc) |',
    ];

    const tableHtml = NotionTable.fromMarkdownLines(tableMd);
    const wrapper = document.createElement('div');
    wrapper.innerHTML = tableHtml;
    new NotionTable({ wrapper });

    // Célula com evento: nenhum elemento com handler onmouseover existe no DOM
    expect(wrapper.querySelectorAll('[onmouseover]').length).toBe(0);
    const allElements = wrapper.querySelectorAll('*');
    allElements.forEach((el) => {
      Array.from(el.attributes).forEach((attr) => {
        expect(attr.name.toLowerCase().startsWith('on')).toBe(false);
      });
    });

    // Nenhum link possui esquema perigoso
    const links = wrapper.querySelectorAll('a');
    links.forEach((a) => {
      const href = a.getAttribute('href') || '';
      expect(href.startsWith('javascript:')).toBe(false);
      expect(href.startsWith('data:')).toBe(false);
    });
  });

  it('SlashMenuEngine should escape HTML in search queries and dictionary terms', () => {
    const hostEl = document.createElement('div');
    document.body.appendChild(hostEl);

    const slashMenu = new SlashMenuEngine({
      container: hostEl,
      onSelectCommand: () => {},
      dictionaryTerms: [
        {
          codename: 'test-term',
          term: '<img src=x onerror=alert("term")>',
          definition: '<script>alert("def")</script>',
          synonyms: ['<svg onload=alert(1)>'],
        },
      ],
    });

    slashMenu.init();
    slashMenu.query = '<b onfocus=alert(1)>malicious</b>';
    slashMenu.renderList();

    const listContainer = slashMenu.listContainer;
    expect(listContainer).not.toBeNull();
    // Nenhum elemento script ou atributos de eventos injetados no menu
    expect(listContainer?.querySelectorAll('script').length).toBe(0);
    expect(listContainer?.querySelectorAll('[onerror]').length).toBe(0);
    expect(listContainer?.querySelectorAll('[onfocus]').length).toBe(0);
    expect(listContainer?.querySelectorAll('[onload]').length).toBe(0);

    const allElements = listContainer?.querySelectorAll('*') || [];
    allElements.forEach((el) => {
      Array.from(el.attributes).forEach((attr) => {
        expect(attr.name.toLowerCase().startsWith('on')).toBe(false);
      });
    });

    slashMenu.destroy();
  });
});
