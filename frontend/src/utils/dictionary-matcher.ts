import type { DictionaryTerm } from "../types";

export function getTermSynonyms(term: DictionaryTerm): string[] {
  const all = [
    ...(Array.isArray(term.synonyms) ? term.synonyms : []),
    ...(Array.isArray(term.aliases) ? term.aliases : []),
  ];
  return Array.from(new Set(all.map((s) => (s || "").trim()).filter(Boolean)));
}

export interface MatchEntry {
  phrase: string;
  term: DictionaryTerm;
  matchType: "term" | "synonym" | "codename";
}

/**
 * Compila lista de termos, codinomes e sinônimos ordenada por comprimento decrescente
 * para garantir que frases longas tenham precedência sobre palavras curtas.
 */
export function buildMatchEntries(terms: DictionaryTerm[]): MatchEntry[] {
  const entries: MatchEntry[] = [];
  const seenPhrases = new Set<string>();

  for (const term of terms) {
    if (!term || !term.term) continue;

    // 1. Termo Principal
    const mainTerm = term.term.trim();
    if (mainTerm && !seenPhrases.has(mainTerm.toLowerCase())) {
      entries.push({ phrase: mainTerm, term, matchType: "term" });
      seenPhrases.add(mainTerm.toLowerCase());
    }

    // 2. Codename (se houver)
    const codename = (term.codename || term.code_name || "").trim();
    if (
      codename &&
      codename.length >= 2 &&
      !seenPhrases.has(codename.toLowerCase())
    ) {
      entries.push({ phrase: codename, term, matchType: "codename" });
      seenPhrases.add(codename.toLowerCase());
    }

    // 3. Sinônimos / Aliases
    const syns = getTermSynonyms(term);
    for (const syn of syns) {
      const s = syn.trim();
      if (s && s.length >= 2 && !seenPhrases.has(s.toLowerCase())) {
        entries.push({ phrase: s, term, matchType: "synonym" });
        seenPhrases.add(s.toLowerCase());
      }
    }
  }

  // Ordena por tamanho decrescente
  return entries.sort((a, b) => b.phrase.length - a.phrase.length);
}

function escapeHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface MatchInterval {
  start: number;
  end: number;
  term: DictionaryTerm;
  matchedText: string;
}

export function stripDictionaryHighlightSpans(html: string): string {
  if (!html || !html.includes("dict-term-highlight")) return html;
  let result = html;
  // Unwrap nested or single dict-term-highlight spans iteratively
  while (
    /<span\s+class="dict-term-highlight"[^>]*>([\s\S]*?)<\/span>/i.test(result)
  ) {
    result = result.replace(
      /<span\s+class="dict-term-highlight"[^>]*>([\s\S]*?)<\/span>/gi,
      "$1",
    );
  }
  return result;
}

/**
 * Decora HTML com spans visuais .dict-term-highlight
 * Ignora rigorosamente tags existentes como <a>, <code>, <pre>, <script>, <style> e tags de atributos.
 * Usa matching baseado em intervalos em texto puro para IMPEDIR qualquer matching aninhado ou corrupção de tags/atributos.
 */
export function decorateHtmlWithTerms(
  html: string,
  terms: DictionaryTerm[],
): string {
  if (!html || !terms || terms.length === 0) return html;

  // Primeiro remove quaisquer spans de destaque pré-existentes para garantir 100% de idempotência
  const cleanHtml = stripDictionaryHighlightSpans(html);

  const entries = buildMatchEntries(terms);
  if (entries.length === 0) return cleanHtml;

  // Quebra o HTML em partes: Tags vs Conteúdo de Texto
  const tagRegex = /(<\/?[a-zA-Z0-9\-]+(?:\s+[^>]*?)?>)/g;
  const parts = cleanHtml.split(tagRegex);

  let inIgnoredTag = false;
  let ignoredTagName = "";
  const ignoredTags = [
    "a",
    "code",
    "pre",
    "script",
    "style",
    "button",
    "svg",
    "kbd",
    "mark",
    "textarea",
    "input",
  ];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;

    // Se é uma tag HTML
    if (part.startsWith("<") && part.endsWith(">")) {
      const isClosing = part.startsWith("</");
      const isSelfClosing = part.endsWith("/>");
      const matchTag = part.match(/^<\/?([a-zA-Z0-9\-]+)/);

      if (matchTag) {
        const tagName = matchTag[1].toLowerCase();
        if (ignoredTags.includes(tagName)) {
          if (isClosing) {
            if (inIgnoredTag && ignoredTagName === tagName) {
              inIgnoredTag = false;
              ignoredTagName = "";
            }
          } else if (!isSelfClosing) {
            inIgnoredTag = true;
            ignoredTagName = tagName;
          }
        }
      }
      continue;
    }

    // Se estamos dentro de tag ignorada, não altera o texto
    if (inIgnoredTag) continue;

    // Coleta intervalos de match não-sobrepostos no texto puro
    const textChunk = part;
    const intervals: MatchInterval[] = [];

    for (const entry of entries) {
      const escaped = escapeRegex(entry.phrase);
      // Limite de palavras para acentuação e português
      const pattern = new RegExp(
        `(?<=[^a-zA-Z0-9À-ÿ_]|^)(${escaped})(?=[^a-zA-Z0-9À-ÿ_]|$)`,
        "gi",
      );

      let match: RegExpExecArray | null;
      while ((match = pattern.exec(textChunk)) !== null) {
        const start = match.index;
        const matchedText = match[1] || match[0];
        const end = start + matchedText.length;

        // Verifica se há sobreposição com algum intervalo já aceito
        const overlaps = intervals.some(
          (inv) => Math.max(start, inv.start) < Math.min(end, inv.end),
        );

        if (!overlaps) {
          intervals.push({
            start,
            end,
            term: entry.term,
            matchedText,
          });
        }
      }
    }

    if (intervals.length === 0) continue;

    // Ordena os intervalos por posição inicial crescente
    intervals.sort((a, b) => a.start - b.start);

    // Constrói o HTML decorado a partir dos intervalos
    let decorated = "";
    let lastIdx = 0;

    for (const inv of intervals) {
      decorated += textChunk.slice(lastIdx, inv.start);
      const termKey = escapeHtml(
        inv.term.id || inv.term.codename || inv.term.term,
      );
      decorated += `<span class="dict-term-highlight" data-term-key="${termKey}">${inv.matchedText}</span>`;
      lastIdx = inv.end;
    }

    decorated += textChunk.slice(lastIdx);
    parts[i] = decorated;
  }

  return parts.join("");
}

/**
 * Busca termo por chave (id, codename, term) ou sinônimo
 */
export function findDictionaryTerm(
  wordOrKey: string,
  terms: DictionaryTerm[],
): { term: DictionaryTerm; matchType: "term" | "synonym" | "codename" } | null {
  if (!wordOrKey || !terms || terms.length === 0) return null;
  const clean = wordOrKey.trim().toLowerCase();

  for (const t of terms) {
    if (t.id && t.id.toLowerCase() === clean) {
      return { term: t, matchType: "term" };
    }
    if ((t.term || "").trim().toLowerCase() === clean) {
      return { term: t, matchType: "term" };
    }
    if ((t.codename || t.code_name || "").trim().toLowerCase() === clean) {
      return { term: t, matchType: "codename" };
    }
    const syns = getTermSynonyms(t);
    if (syns.some((s) => s.toLowerCase() === clean)) {
      return { term: t, matchType: "synonym" };
    }
  }

  return null;
}

/**
 * Sugestões semânticas / typeahead para digitação (prefixos)
 */
export function findSuggestionsForPrefix(
  prefix: string,
  terms: DictionaryTerm[],
  limit = 6,
): Array<{
  term: DictionaryTerm;
  matchedText: string;
  matchType: "term" | "synonym" | "codename";
}> {
  if (!prefix || prefix.trim().length < 2 || !terms || terms.length === 0)
    return [];
  const clean = prefix.trim().toLowerCase();
  const results: Array<{
    term: DictionaryTerm;
    matchedText: string;
    matchType: "term" | "synonym" | "codename";
  }> = [];
  const seenTermIds = new Set<string>();

  for (const t of terms) {
    const termKey = t.id || t.term;
    if (seenTermIds.has(termKey)) continue;

    const termLower = (t.term || "").toLowerCase();
    const codeLower = (t.codename || t.code_name || "").toLowerCase();

    if (termLower.startsWith(clean)) {
      results.push({ term: t, matchedText: t.term, matchType: "term" });
      seenTermIds.add(termKey);
      if (results.length >= limit) break;
      continue;
    }

    if (codeLower.startsWith(clean)) {
      results.push({
        term: t,
        matchedText: t.codename || t.code_name || "",
        matchType: "codename",
      });
      seenTermIds.add(termKey);
      if (results.length >= limit) break;
      continue;
    }

    const syns = getTermSynonyms(t);
    const matchedSyn = syns.find((s) => s.toLowerCase().startsWith(clean));
    if (matchedSyn) {
      results.push({ term: t, matchedText: matchedSyn, matchType: "synonym" });
      seenTermIds.add(termKey);
      if (results.length >= limit) break;
    }
  }

  return results;
}
