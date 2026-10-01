import { ITranslationProvider, TranslationOptions } from '../translation.types.js';

export interface MaskedMarkdown {
  rawFrontmatter: string | null;
  frontmatterLines: string[] | null;
  maskedBody: string;
  placeholders: Map<string, string>;
}

export abstract class BaseTranslationProvider implements ITranslationProvider {
  abstract id: string;
  abstract name: string;
  abstract description: string;
  abstract isLocal: boolean;

  abstract executeRawTranslation(text: string, sourceLang: string, targetLang: string, glossary?: Record<string, string>): Promise<string>;

  /**
   * Executa a tradução de um documento Markdown completo preservando frontmatter, blocos de código e links
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

    // 3. Restaurar placeholders
    placeholders.forEach((originalText, placeholderKey) => {
      const escapedKey = placeholderKey.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      translatedBody = translatedBody.replace(new RegExp(escapedKey, 'g'), () => originalText);
    });

    // 4. Tratar Frontmatter YAML apenas se preserveFrontmatter for true (por padrão traduções não têm frontmatter)
    let translatedFrontmatter = '';
    if (options.preserveFrontmatter === true && rawFrontmatter && frontmatterLines) {
      const translatedLines: string[] = [];
      for (const line of frontmatterLines) {
        const titleMatch = line.match(/^(\s*title\s*:\s*["']?)(.*?)(["']?\s*)$/i);
        const descMatch = line.match(/^(\s*description\s*:\s*["']?)(.*?)(["']?\s*)$/i);

        if (titleMatch && titleMatch[2].trim()) {
          try {
            const transTitle = await this.executeRawTranslation(titleMatch[2], sourceLang, targetLang, options.glossary);
            translatedLines.push(`${titleMatch[1]}${transTitle.trim()}${titleMatch[3]}`);
            continue;
          } catch {}
        }

        if (descMatch && descMatch[2].trim()) {
          try {
            const transDesc = await this.executeRawTranslation(descMatch[2], sourceLang, targetLang, options.glossary);
            translatedLines.push(`${descMatch[1]}${transDesc.trim()}${descMatch[3]}`);
            continue;
          } catch {}
        }

        translatedLines.push(line);
      }
      translatedFrontmatter = `---\n${translatedLines.join('\n')}\n---\n\n`;
    }

    return translatedFrontmatter + translatedBody.trim();
  }

  /**
   * Extrai o Frontmatter e mascara blocos de código, tags HTML, links e termos especiais
   */
  protected extractAndMask(markdown: string): MaskedMarkdown {
    const placeholders = new Map<string, string>();
    let counter = 0;

    const createPlaceholder = (prefix: string, content: string) => {
      counter++;
      const key = `[[__${prefix}_PLH_${counter}__]]`;
      placeholders.set(key, content);
      return key;
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

    // 2. Mascarar blocos de código com cercas (``` ... ```)
    body = body.replace(/```[\s\S]*?```/g, (match) => {
      return createPlaceholder('CODEBLOCK', match);
    });

    // 3. Mascarar código inline (`...`)
    body = body.replace(/`[^`\n]+`/g, (match) => {
      return createPlaceholder('INLINECODE', match);
    });

    // 4. Mascarar URLs em links markdown [texto](url) -> preserva texto, mascara a url
    body = body.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text, url) => {
      const urlPlh = createPlaceholder('URL', url);
      return `[${text}](${urlPlh})`;
    });

    // 5. Mascarar tags HTML
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
}
