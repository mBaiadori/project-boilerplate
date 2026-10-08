import { ITranslationProvider, TranslationOptions } from '../translation.types.js';

export interface PlaceholderItem {
  prefix: string;
  counter: number;
  originalText: string;
}

export interface MaskedMarkdown {
  rawFrontmatter: string | null;
  frontmatterLines: string[] | null;
  maskedBody: string;
  placeholders: PlaceholderItem[];
}

export abstract class BaseTranslationProvider implements ITranslationProvider {
  abstract id: string;
  abstract name: string;
  abstract description: string;
  abstract isLocal: boolean;

  abstract executeRawTranslation(text: string, sourceLang: string, targetLang: string, glossary?: Record<string, string>): Promise<string>;

  /**
   * Executa a tradução de um documento Markdown completo preservando frontmatter, blocos de código e elementos de formatação
   */
  async translate(markdownContent: string, options: TranslationOptions): Promise<string> {
    if (!markdownContent || !markdownContent.trim()) {
      return markdownContent;
    }

    const sourceLang = options.sourceLang || 'pt-BR';
    const targetLang = options.targetLang;

    if (sourceLang.toLowerCase() === targetLang.toLowerCase()) {
      return markdownContent;
    }

    // 1. Extrair e mascarar partes estruturais
    const { rawFrontmatter, frontmatterLines, maskedBody, placeholders } = this.extractAndMask(markdownContent);

    // 2. Traduzir o corpo mascarado
    let translatedBody = await this.executeRawTranslation(maskedBody, sourceLang, targetLang, options.glossary);

    // 3. Restaurar placeholders de forma ultra-resiliente
    // Motores de tradução automáticos costumam inserir espaços ou alterar a caixa dos delimitadores:
    // Ex: [[__CALLOUT_PLH_1__]] pode virar [[ __CALLOUT_PLH_1__ ]] ou [[__callout_plh_1__]]
    for (const item of placeholders) {
      const { prefix, counter, originalText } = item;
      const escapedPrefix = prefix.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const pattern = new RegExp(
        `(?:\\[\\[|\\[\\s*\\[)\\s*_*\\s*${escapedPrefix}_(?:PLH_)?${counter}\\s*_*\\s*(?:\\]\\]|\\]\\s*\\])`,
        'gi'
      );
      translatedBody = translatedBody.replace(pattern, () => originalText);
    }

    // 4. Pós-processamento: normalizar pontuações e delimitadores Markdown que o tradutor possa ter espaçado
    translatedBody = this.sanitizePostTranslation(translatedBody);

    // 5. Tratar Frontmatter YAML apenas se preserveFrontmatter for true
    let translatedFrontmatter = '';
    if (options.preserveFrontmatter === true) {
      if (rawFrontmatter && frontmatterLines) {
        const translatedLines: string[] = [];
        let hasTitle = false;
        for (const line of frontmatterLines) {
          // Capturar chave title com ou sem aspas
          const titleMatch = line.match(/^(\s*title\s*:\s*)(["']?)(.*?)\2(\s*)$/i);
          // Capturar chave description com ou sem aspas
          const descMatch = line.match(/^(\s*description\s*:\s*)(["']?)(.*?)\2(\s*)$/i);

          if (titleMatch) {
            hasTitle = true;
            const rawTitle = titleMatch[3].trim() || options.documentTitle || '';
            if (rawTitle) {
              try {
                const transTitle = await this.executeRawTranslation(rawTitle, sourceLang, targetLang, options.glossary);
                const safeTitle = transTitle.trim().replace(/"/g, '\\"');
                translatedLines.push(`${titleMatch[1]}"${safeTitle}"${titleMatch[4]}`);
                continue;
              } catch (e) {
                console.warn('[BaseTranslationProvider] Falha ao traduzir title do frontmatter:', e);
              }
            }
          }

          if (descMatch && descMatch[3].trim()) {
            try {
              const rawDesc = descMatch[3].trim();
              const transDesc = await this.executeRawTranslation(rawDesc, sourceLang, targetLang, options.glossary);
              const safeDesc = transDesc.trim().replace(/"/g, '\\"');
              translatedLines.push(`${descMatch[1]}"${safeDesc}"${descMatch[4]}`);
              continue;
            } catch (e) {
              console.warn('[BaseTranslationProvider] Falha ao traduzir description do frontmatter:', e);
            }
          }

          // Mantém as demais chaves oficiais 100% inalteradas (category, status, tags, author, etc.)
          translatedLines.push(line);
        }

        if (!hasTitle && options.documentTitle) {
          try {
            const transTitle = await this.executeRawTranslation(options.documentTitle, sourceLang, targetLang, options.glossary);
            const safeTitle = transTitle.trim().replace(/"/g, '\\"');
            translatedLines.unshift(`title: "${safeTitle}"`);
          } catch {}
        }

        translatedFrontmatter = `---\n${translatedLines.join('\n')}\n---\n\n`;
      } else if (options.documentTitle) {
        try {
          const transTitle = await this.executeRawTranslation(options.documentTitle, sourceLang, targetLang, options.glossary);
          const safeTitle = transTitle.trim().replace(/"/g, '\\"');
          translatedFrontmatter = `---\ntitle: "${safeTitle}"\n---\n\n`;
        } catch (e) {
          translatedFrontmatter = `---\ntitle: "${options.documentTitle}"\n---\n\n`;
        }
      }
    }

    return translatedFrontmatter + translatedBody.trim();
  }

  /**
   * Extrai o Frontmatter e mascara blocos de código, tags HTML, links, callouts, checkboxes e tabelas
   */
  protected extractAndMask(markdown: string): MaskedMarkdown {
    const placeholders: PlaceholderItem[] = [];
    let counter = 0;

    const createPlaceholder = (prefix: string, content: string) => {
      counter++;
      placeholders.push({
        prefix,
        counter,
        originalText: content,
      });
      return `[[__${prefix}_PLH_${counter}__]]`;
    };

    let body = markdown;
    let rawFrontmatter: string | null = null;
    let frontmatterLines: string[] | null = null;

    // 1. Parse Frontmatter
    const frontmatterMatch = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    if (frontmatterMatch) {
      rawFrontmatter = frontmatterMatch[0].trim();
      frontmatterLines = frontmatterMatch[1].split(/\r?\n/);
      body = markdown.slice(frontmatterMatch[0].length);
    }

    // 2. Mascarar blocos de código com cercas (``` ... ```) incluindo diagramas Mermaid
    body = body.replace(/```[\s\S]*?```/g, (match) => {
      return createPlaceholder('CODEBLOCK', match);
    });

    // 3. Mascarar código inline (`...`)
    body = body.replace(/`[^`\n]+`/g, (match) => {
      return createPlaceholder('INLINECODE', match);
    });

    // 4. Mascarar cabeçalhos de Callouts / Alertas
    // Suporta tanto GFM: > [!NOTE], > [!TIP], > [!WARNING], > [!DANGER], > [!CAUTION], > [!INFO], > [!SUCCESS]
    // quanto variantes em português: > [!NOTA], > [!DICA], > [!AVISO], etc.
    body = body.replace(/^>\s*\[!\s*([a-zA-ZÀ-ÿ0-9_-]+)\s*\]/gmi, (_match, rawType) => {
      const norm = rawType.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      let canonical = 'NOTE';
      if (['tip', 'dica', 'success', 'sucesso'].includes(norm)) canonical = 'TIP';
      else if (['warning', 'aviso', 'atencao', 'important', 'importante'].includes(norm)) canonical = 'WARNING';
      else if (['danger', 'perigo', 'caution', 'cuidado'].includes(norm)) canonical = 'DANGER';
      else if (['info', 'informacao'].includes(norm)) canonical = 'INFO';
      return createPlaceholder('CALLOUT', `> [!${canonical}]`);
    });

    // Mascarar containers estilo :::note ... :::
    body = body.replace(/^:::\s*([a-zA-ZÀ-ÿ0-9_-]+)(?:\s+(.*))?$/gmi, (_match, rawType, extraTitle) => {
      const norm = rawType.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      let canonical = 'NOTE';
      if (['tip', 'dica', 'success', 'sucesso'].includes(norm)) canonical = 'TIP';
      else if (['warning', 'aviso', 'atencao', 'important', 'importante'].includes(norm)) canonical = 'WARNING';
      else if (['danger', 'perigo', 'caution', 'cuidado'].includes(norm)) canonical = 'DANGER';
      else if (['info', 'informacao'].includes(norm)) canonical = 'INFO';
      const heading = extraTitle ? ` ${extraTitle.trim()}` : '';
      return createPlaceholder('CALLOUT', `> [!${canonical}]${heading}`);
    });
    body = body.replace(/^:::\s*$/gm, '');

    // 5. Mascarar prefixos de Checkbox / To-Do (- [ ] , - [x] , * [ ] , – [ ])
    body = body.replace(/^(\s*[-*+–—]\s*\[[ xX]?\]\s*)/gm, (match) => {
      const isChecked = match.toLowerCase().includes('x');
      const indent = match.match(/^\s*/)?.[0] || '';
      const canonicalBox = `${indent}- [${isChecked ? 'x' : ' '}] `;
      return createPlaceholder('TODOBOX', canonicalBox);
    });

    // 6. Mascarar separadores estruturais de tabelas GFM (| --- | --- |)
    body = body.replace(/^\s*\|(?:\s*:?-+:?\s*\|)+\s*$/gm, (match) => {
      return createPlaceholder('TABLESEP', match.trim());
    });

    // 7. Mascarar URLs em links markdown [texto](url) -> preserva texto, mascara a url
    body = body.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text, url) => {
      const urlPlh = createPlaceholder('URL', url.trim());
      return `[${text}](${urlPlh})`;
    });

    // 8. Mascarar tags HTML completas (<details>, <summary>, <span>, <kbd>, etc.)
    body = body.replace(/<[^>]+>/g, (match) => {
      return createPlaceholder('HTMLTAG', match);
    });

    return {
      rawFrontmatter,
      frontmatterLines,
      maskedBody: body,
      placeholders,
    };
  }

  /**
   * Corrige pequenas anomalias de formatação introduzidas por serviços de Machine Translation
   */
  protected sanitizePostTranslation(text: string): string {
    let result = text;

    // Normalizar links: [ texto ] ( URL ) -> [texto](URL)
    result = result.replace(/\[\s*([^\]]+?)\s*\]\s*\(\s*([^)]+?)\s*\)/g, '[$1]($2)');

    // Normalizar negrito: ** texto ** -> **texto**
    result = result.replace(/\*\*\s+([^*]+?)\s+\*\*/g, '**$1**');

    // Normalizar itálico com asterisco: * texto * -> *texto*
    result = result.replace(/(^|[^*])\*\s+([^*\n]+?)\s+\*([^*]|$)/g, '$1*$2*$3');

    // Normalizar tachado: ~~ texto ~~ -> ~~texto~~
    result = result.replace(/~~\s+([^~]+?)\s+~~/g, '~~$1~~');

    // Normalizar espaçamento pós-blockquote de callout
    result = result.replace(/^>\s*\[!\s*(NOTE|TIP|WARNING|DANGER|INFO)\s*\]\s*$/gmi, '> [!$1]');

    return result;
  }
}

