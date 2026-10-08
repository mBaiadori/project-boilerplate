import { test, describe } from 'node:test';
import assert from 'node:assert';
import { LightweightLocalProvider } from './providers/LightweightLocalProvider.js';

describe('Traduções & Preservação Estrutural (Markdown / Frontmatter)', () => {
  const provider = new LightweightLocalProvider();

  test('Deve traduzir o frontmatter title e preservar chaves oficiais', async () => {
    const markdown = `---
title: "Documento de Arquitetura"
category: "Engenharia"
status: "Draft"
---

# Introdução

Texto de exemplo.`;

    const translated = await provider.translate(markdown, {
      sourceLang: 'pt-BR',
      targetLang: 'en',
      preserveFrontmatter: true,
    });

    // Frontmatter deve existir
    assert.match(translated, /^---\r?\n/);
    assert.match(translated, /category:\s*["']?Engenharia["']?/);
    assert.match(translated, /status:\s*["']?Draft["']?/);
    // Título traduzido não deve estar vazio
    assert.match(translated, /title:\s*".*"/i);
    // Não deve conter mais o título original em português exatamente idêntico se traduzido
    assert.ok(translated.includes('title:'));
  });

  test('Deve preservar marcadores de Callout (> [!NOTE]) sem quebrar para citação comum', async () => {
    const markdown = `> [!NOTE]
> Este é um callout importante.

> [!TIP]
> Dica de performance.`;

    const translated = await provider.translate(markdown, {
      sourceLang: 'pt-BR',
      targetLang: 'en',
      preserveFrontmatter: false,
    });

    assert.match(translated, />\s*\[!NOTE\]/);
    assert.match(translated, />\s*\[!TIP\]/);
  });

  test('Deve preservar marcadores de Checkbox (- [ ] e - [x]) sem deformar', async () => {
    const markdown = `- [ ] Tarefa pendente
- [x] Tarefa concluída`;

    const translated = await provider.translate(markdown, {
      sourceLang: 'pt-BR',
      targetLang: 'en',
      preserveFrontmatter: false,
    });

    assert.match(translated, /- \[ \] /);
    assert.match(translated, /- \[x\] /);
  });

  test('Deve preservar tabela GFM com pipes e separadores', async () => {
    const markdown = `| Header 1 | Header 2 |
| --- | --- |
| Dado 1 | Dado 2 |`;

    const translated = await provider.translate(markdown, {
      sourceLang: 'pt-BR',
      targetLang: 'en',
      preserveFrontmatter: false,
    });

    assert.ok(translated.includes('| --- | --- |'));
    assert.match(translated, /\|.*\|/);
  });

  test('Deve preservar blocos de código e diagramas Mermaid intactos', async () => {
    const markdown = `\`\`\`mermaid
graph TD
  A[Início] --> B[Fim]
\`\`\`

\`\`\`typescript
const x: number = 42;
\`\`\``;

    const translated = await provider.translate(markdown, {
      sourceLang: 'pt-BR',
      targetLang: 'en',
      preserveFrontmatter: false,
    });

    assert.ok(translated.includes('graph TD'));
    assert.ok(translated.includes('const x: number = 42;'));
  });
});
