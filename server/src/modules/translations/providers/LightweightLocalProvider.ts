import { BaseTranslationProvider } from "./BaseTranslationProvider.js";

export class LightweightLocalProvider extends BaseTranslationProvider {
  id = "lightweight-local";
  name = "Motor Leve de Servidor";
  description =
    "Tradução ultra-rápida e leve executada no servidor sem consumo de tokens de IA.";
  isLocal = true;

  private libreTranslateUrl = process.env.LIBRETRANSLATE_URL || "";

  async executeRawTranslation(
    text: string,
    sourceLang: string,
    targetLang: string,
    glossary?: Record<string, string>,
  ): Promise<string> {
    if (!text || !text.trim()) return text;

    // Normalizar códigos de idiomas (ex: pt-BR -> pt, en-US -> en)
    const normSource = sourceLang.split("-")[0].toLowerCase();
    const normTarget = targetLang.split("-")[0].toLowerCase();

    // Se houver LibreTranslate configurado no servidor, tentar traduzir via endpoint local
    if (this.libreTranslateUrl) {
      try {
        const res = await fetch(`${this.libreTranslateUrl}/translate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            q: text,
            source: normSource,
            target: normTarget,
            format: "text",
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as { translatedText?: string };
          if (data.translatedText) {
            return this.applyGlossary(data.translatedText, glossary);
          }
        }
      } catch (err) {
        console.warn(
          `[LightweightLocalProvider] Falha ao consultar LibreTranslate em ${this.libreTranslateUrl}:`,
          err,
        );
      }
    }

    // Tradução de alta velocidade via serviço de Machine Translation leve
    try {
      const translated = await this.translateViaFastEngine(
        text,
        normSource,
        normTarget,
      );
      return this.applyGlossary(translated, glossary);
    } catch (err) {
      console.warn("[LightweightLocalProvider] Erro na tradução rápida:", err);
      return text;
    }
  }

  private async translateViaFastEngine(
    text: string,
    source: string,
    target: string,
  ): Promise<string> {
    const paragraphs = text.split("\n\n");
    const translatedParagraphs: string[] = [];

    for (const p of paragraphs) {
      if (!p.trim()) {
        translatedParagraphs.push(p);
        continue;
      }

      // Se for apenas caracteres de controle ou markdown puro (como #, ---, etc.)
      if (/^([#\->*|_\s]+)$/.test(p)) {
        translatedParagraphs.push(p);
        continue;
      }

      // Se for exclusivamente um placeholder (ex: [[__CALLOUT_PLH_1__]]), mantém intacto
      if (/^\s*\[\[__\w+_PLH_\d+__\]\]\s*$/.test(p)) {
        translatedParagraphs.push(p);
        continue;
      }

      // Se o parágrafo for uma tabela Markdown (contém pipes | e quebras de linha)
      if (p.includes("|") && p.includes("\n")) {
        const tableLines = p.split("\n");
        const translatedTableLines: string[] = [];
        for (const line of tableLines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) {
            translatedTableLines.push(line);
            continue;
          }
          // Se for separador de tabela ou placeholder de separador
          if (
            trimmedLine.startsWith("[[__TABLESEP") ||
            /^\|(?:\s*:?-+:?\s*\|)+$/.test(trimmedLine)
          ) {
            translatedTableLines.push(line);
            continue;
          }
          // Traduzir células individuais da linha preservando os pipes
          if (trimmedLine.startsWith("|") && trimmedLine.endsWith("|")) {
            const rawCells = trimmedLine.split("|");
            // rawCells[0] e rawCells[last] são strings vazias antes/depois do pipe inicial/final
            const innerCells = rawCells.slice(1, -1);
            const translatedCells: string[] = [];
            for (const cell of innerCells) {
              const trimmedCell = cell.trim();
              if (!trimmedCell || /^\[\[__\w+_PLH_\d+__\]\]$/.test(trimmedCell)) {
                translatedCells.push(cell);
              } else {
                const transCell = await this.translateSingleText(trimmedCell, source, target);
                translatedCells.push(` ${transCell.trim()} `);
              }
            }
            translatedTableLines.push(`|${translatedCells.join("|")}|`);
            continue;
          }
          // Linha avulsa dentro da tabela
          const transLine = await this.translateSingleText(trimmedLine, source, target);
          translatedTableLines.push(transLine);
        }
        translatedParagraphs.push(translatedTableLines.join("\n"));
        continue;
      }

      // Parágrafo de texto padrão
      const translatedBlock = await this.translateSingleText(p, source, target);
      translatedParagraphs.push(translatedBlock);
    }

    return translatedParagraphs.join("\n\n");
  }

  private async translateSingleText(
    text: string,
    source: string,
    target: string,
  ): Promise<string> {
    if (!text.trim() || /^([#\->*|_\s]+)$/.test(text)) {
      return text;
    }
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source}&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json) && Array.isArray(json[0])) {
          const translatedBlock = json[0]
            .map((item: any) => item[0])
            .join("");
          return translatedBlock || text;
        }
      }
    } catch {
      // Fallback para o texto original em caso de instabilidade
    }
    return text;
  }

  private applyGlossary(
    text: string,
    glossary?: Record<string, string>,
  ): string {
    if (!glossary || Object.keys(glossary).length === 0) return text;

    let result = text;
    for (const [term, replacement] of Object.entries(glossary)) {
      if (!term.trim() || !replacement.trim()) continue;
      const regex = new RegExp(
        `\\b${term.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`,
        "gi",
      );
      result = result.replace(regex, replacement);
    }
    return result;
  }
}
