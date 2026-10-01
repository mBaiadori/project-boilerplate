import { ITranslationProvider, TranslationOptions } from '../translation.types.js';
import { aiService } from '../../ai/ai.service.js';
import { loadConfig } from '../../../config/storage.js';

export class AiContextualProvider implements ITranslationProvider {
  id = 'ai-contextual';
  name = 'IA Contextual & Semântica (LLM)';
  description = 'Tradução profunda adaptada ao contexto de engenharia de software com alinhamento terminológico.';
  isLocal = false;

  async translate(markdownContent: string, options: TranslationOptions): Promise<string> {
    if (!markdownContent || !markdownContent.trim()) {
      return markdownContent;
    }

    const sourceLang = options.sourceLang || 'Português (pt-BR)';
    const targetLang = options.targetLang;

    const glossarySection = options.glossary && Object.keys(options.glossary).length > 0
      ? `\nGLOSSÁRIO TÉCNICO OBRIGATÓRIO:\n${Object.entries(options.glossary)
          .map(([term, desc]) => `- "${term}": ${desc}`)
          .join('\n')}\n`
      : '';

    const systemPrompt = `Você é um tradutor técnico sênior e especialista em documentação de software e arquitetura.
Sua missão é traduzir com máxima fidelidade o documento Markdown de "${sourceLang}" para "${targetLang}".

DIRETRIZES FUNDAMENTAIS DE PRESERVAÇÃO:
1. PRESERVE o Frontmatter YAML inicial (---) se existir. Traduza apenas campos de texto como "title" e "description". NUNCA altere os campos técnicos como "tags", "category", "status", "id", "author".
2. PRESERVE todos os blocos de código (\`\`\`...\`\`\`) e trechos em código inline (\`...\`) INTACTOS, sem traduzir identificadores, variáveis ou comandos.
3. PRESERVE diagramas Mermaid (\`\`\`mermaid...\`\`\`) e fórmulas matemáticas intactas.
4. PRESERVE as URLs em links Markdown [texto traduzido](url_original_intacta).
5. Mantenha toda a formatação, títulos, listas, tabelas e ênfases Markdown exatamente equivalentes.
${glossarySection}
IMPORTANTE: Retorne EXCLUSIVAMENTE o documento Markdown traduzido, sem introduções, sem blocos explicativos adicionais e sem aspas envolventes.`;

    const userPrompt = `Traduza o seguinte documento Markdown para "${targetLang}":\n\n${markdownContent}`;

    try {
      const cfg = loadConfig();
      const aiSettings = cfg.ai_settings || {
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        has_key: false,
        custom_endpoint: '',
      };

      const result = await aiService.callLLM(
        aiSettings,
        userPrompt,
        '',
        'translation.md',
        [],
        systemPrompt,
        cfg.active_repo?.name || 'local'
      );

      const rawReply = (result?.reply || '').trim();
      if (!rawReply) {
        return markdownContent;
      }

      // Limpar blocos de markdown envolventes se a IA tiver colocado ```markdown ... ``` ao redor de todo o retorno
      const matchFullCodeBlock = rawReply.match(/^```(?:markdown|md)?\r?\n([\s\S]*?)\r?\n```$/);
      if (matchFullCodeBlock) {
        return matchFullCodeBlock[1].trim();
      }

      return rawReply;
    } catch (err) {
      console.error('[AiContextualProvider] Erro ao traduzir via IA:', err);
      throw new Error(`Falha na tradução via IA: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
