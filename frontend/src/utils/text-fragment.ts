// =============================================================================
// UTILITY: W3C TEXT FRAGMENTS & RESILIENT DEEP LINKING
// Padrão de fragmentos de texto: #:~:text=[prefix-,]exact[,-suffix]
// Suporta desempate por contexto e correspondência aproximada (Fuzzy Search).
// =============================================================================

export interface TextFragmentQuery {
  exact: string;
  prefix?: string;
  suffix?: string;
}

/**
 * Extrai texto selecionado e contexto circundante (prefixo e sufixo) a partir de uma seleção DOM.
 */
export function createTextFragmentFromSelection(selection: Selection): TextFragmentQuery | null {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const exact = selection.toString().trim();
  if (!exact) return null;

  let prefix = '';
  let suffix = '';

  try {
    // Obter contexto antes da seleção
    const preRange = document.createRange();
    if (range.startContainer.parentNode) {
      preRange.setStart(range.startContainer.parentNode, 0);
      preRange.setEnd(range.startContainer, range.startOffset);
      const preText = preRange.toString().trim();
      const preWords = preText.split(/\s+/).filter(Boolean);
      prefix = preWords.slice(-3).join(' ');
    }

    // Obter contexto depois da seleção
    const postRange = document.createRange();
    if (range.endContainer.parentNode) {
      postRange.setStart(range.endContainer, range.endOffset);
      postRange.setEnd(range.endContainer.parentNode, range.endContainer.parentNode.childNodes.length);
      const postText = postRange.toString().trim();
      const postWords = postText.split(/\s+/).filter(Boolean);
      suffix = postWords.slice(0, 3).join(' ');
    }
  } catch (err) {
    console.warn('[TextFragment] Erro ao extrair contexto circundante:', err);
  }

  return { exact, prefix, suffix };
}

/**
 * Converte um TextFragmentQuery na sintaxe padrão W3C:
 * #:~:text=[prefix-,]exact[,-suffix]
 */
export function formatTextFragmentUrl(filePath: string, fragment: TextFragmentQuery): string {
  const parts: string[] = [];

  if (fragment.prefix) {
    parts.push(`${encodeURIComponent(fragment.prefix)}-,`);
  }
  parts.push(encodeURIComponent(fragment.exact));
  if (fragment.suffix) {
    parts.push(`,-${encodeURIComponent(fragment.suffix)}`);
  }

  return `${filePath}#:~:text=${parts.join('')}`;
}

/**
 * Faz parse de uma URL ou hash com fragmento de texto W3C.
 */
export function parseTextFragmentUrl(urlOrHash: string): TextFragmentQuery | null {
  if (!urlOrHash || !urlOrHash.includes(':~:text=')) {
    return null;
  }

  try {
    const rawFragment = urlOrHash.split(':~:text=')[1]?.split('&')[0];
    if (!rawFragment) return null;

    let decoded = '';
    try {
      decoded = decodeURIComponent(rawFragment.replace(/\+/g, ' '));
    } catch {
      decoded = unescape(rawFragment.replace(/\+/g, ' '));
    }
    
    // Padrão W3C: [prefix-,]textStart[,textEnd][,-suffix]
    let prefix = '';
    let suffix = '';
    let exact = decoded;

    // Prefixo delimitado por '-, ' ou '-,'
    const prefixIdx = exact.indexOf('-,');
    if (prefixIdx !== -1) {
      prefix = exact.slice(0, prefixIdx).trim();
      exact = exact.slice(prefixIdx + 2).trim();
    }

    // Sufixo delimitado por ',-'
    const suffixIdx = exact.lastIndexOf(',-');
    if (suffixIdx !== -1) {
      suffix = exact.slice(suffixIdx + 2).trim();
      exact = exact.slice(0, suffixIdx).trim();
    }

    return {
      exact: exact.trim(),
      prefix: prefix ? prefix.trim() : undefined,
      suffix: suffix ? suffix.trim() : undefined
    };
  } catch (e) {
    console.error('[TextFragment] Erro ao decodificar fragmento:', e);
    return null;
  }
}

/**
 * Calcula distância de Levenshtein entre duas strings para busca aproximada.
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substituição
          matrix[i][j - 1] + 1,     // inserção
          matrix[i - 1][j] + 1      // deleção
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calcula similaridade percentual (0 a 1) entre duas strings.
 */
export function calculateSimilarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  if (longer.length === 0) return 1.0;
  return (longer.length - levenshteinDistance(longer, shorter)) / longer.length;
}

/**
 * Normaliza string removendo pontuação externa e múltiplos espaços para busca confiável
 */
function normalizeForSearch(str: string): string {
  return (str || '')
    .toLowerCase()
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Procura um trecho dentro do DOM de um elemento container,
 * utilizando busca exata e fallback resiliente (Fuzzy Search).
 */
export function findTextFragmentInElement(
  container: HTMLElement,
  fragment: TextFragmentQuery
): { element: HTMLElement; range: Range; isExact: boolean } | null {
  if (!container || !fragment || !fragment.exact) return null;

  const rawExact = fragment.exact.trim();
  const exactNorm = normalizeForSearch(rawExact);
  if (!exactNorm) return null;

  // 1. Coletar todos os blocos relevantes do documento Notion
  const blockSelector = [
    'p',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'li',
    'blockquote',
    'pre', 'code',
    '.notion-callout',
    '.notion-callout-content',
    'td', 'th',
    '.notion-toggle-content',
    'summary',
    '.notion-todo-item',
    '.notion-todo-text',
    '.notion-code-block',
    '.notion-code-content',
    'div[contenteditable="true"]'
  ].join(', ');

  let rawBlocks = Array.from(container.querySelectorAll(blockSelector)) as HTMLElement[];
  // Filtrar elementos que contenham texto e não sejam duplicatas puras
  let blocks = rawBlocks.filter(b => (b.textContent || '').trim().length > 0);

  if (blocks.length === 0 && (container.textContent || '').trim()) {
    blocks = [container];
  }

  const prefixNorm = fragment.prefix ? normalizeForSearch(fragment.prefix) : '';
  const suffixNorm = fragment.suffix ? normalizeForSearch(fragment.suffix) : '';

  // ETAPA 1: Busca Exata com preferência por correspondência de prefixo/sufixo
  let exactCandidates: { element: HTMLElement; index: number; textNorm: string }[] = [];

  for (const block of blocks) {
    const rawText = block.textContent || block.innerText || '';
    const textNorm = normalizeForSearch(rawText);
    const index = textNorm.indexOf(exactNorm);
    if (index !== -1) {
      exactCandidates.push({ element: block, index, textNorm });
    }
  }

  if (exactCandidates.length > 0) {
    // Se houver prefixo, tentar desempate
    if (prefixNorm) {
      const matchWithPrefix = exactCandidates.find(c => c.textNorm.includes(prefixNorm));
      if (matchWithPrefix) {
        const range = createRangeFromNodeAndOffsets(matchWithPrefix.element, matchWithPrefix.index, matchWithPrefix.index + exactNorm.length);
        return { element: matchWithPrefix.element, range: range || document.createRange(), isExact: true };
      }
    }

    // Se houver sufixo, tentar desempate
    if (suffixNorm) {
      const matchWithSuffix = exactCandidates.find(c => c.textNorm.includes(suffixNorm));
      if (matchWithSuffix) {
        const range = createRangeFromNodeAndOffsets(matchWithSuffix.element, matchWithSuffix.index, matchWithSuffix.index + exactNorm.length);
        return { element: matchWithSuffix.element, range: range || document.createRange(), isExact: true };
      }
    }

    // Retornar o primeiro candidato exato (ou o mais específico / menor elemento)
    const bestExact = exactCandidates.reduce((prev, curr) => {
      const prevLen = prev.element.textContent?.length || 999999;
      const currLen = curr.element.textContent?.length || 999999;
      return currLen < prevLen ? curr : prev;
    }, exactCandidates[0]);

    const range = createRangeFromNodeAndOffsets(bestExact.element, bestExact.index, bestExact.index + exactNorm.length);
    return { element: bestExact.element, range: range || document.createRange(), isExact: true };
  }

  // ETAPA 2: Busca por Subsequência de Palavras (caso pontuações ou tags inline tenham quebrado a string exata)
  const targetWords = exactNorm.split(' ').filter(w => w.length > 1);
  if (targetWords.length >= 2) {
    for (const block of blocks) {
      const textNorm = normalizeForSearch(block.textContent || '');
      const allWordsPresent = targetWords.every(word => textNorm.includes(word));
      if (allWordsPresent) {
        const range = document.createRange();
        range.selectNodeContents(block);
        return { element: block, range, isExact: true };
      }
    }
  }

  // ETAPA 3: Busca Resiliente (Fuzzy Matching para pequenas edições ou correções)
  let bestMatch: { element: HTMLElement; score: number } | null = null;

  for (const block of blocks) {
    const rawText = (block.textContent || block.innerText || '').trim();
    if (!rawText) continue;

    const textNorm = normalizeForSearch(rawText);
    const blockWords = textNorm.split(' ').filter(Boolean);
    if (blockWords.length === 0) continue;

    const windowSize = Math.max(targetWords.length, 2);
    for (let i = 0; i <= blockWords.length - 1; i++) {
      const windowStr = blockWords.slice(i, i + windowSize).join(' ');
      const sim = calculateSimilarity(exactNorm, windowStr);
      if (sim >= 0.65 && (!bestMatch || sim > bestMatch.score)) {
        bestMatch = { element: block, score: sim };
      }
    }
  }

  if (bestMatch && bestMatch.score >= 0.65) {
    const range = document.createRange();
    range.selectNodeContents(bestMatch.element);
    return { element: bestMatch.element, range, isExact: false };
  }

  // ETAPA 4: Fallback Global no Container
  const containerTextNorm = normalizeForSearch(container.textContent || '');
  if (containerTextNorm.includes(exactNorm)) {
    const range = document.createRange();
    range.selectNodeContents(container);
    return { element: container, range, isExact: true };
  }

  return null;
}

/**
 * Cria um Range no DOM apontando para as posições de caracteres dentro de um nó de texto.
 */
function createRangeFromNodeAndOffsets(parent: HTMLElement, startOffset: number, endOffset: number): Range | null {
  try {
    const range = document.createRange();
    const treeWalker = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT, null);
    
    let currentOffset = 0;
    let startNode: Node | null = null;
    let nodeStartOffset = 0;
    let endNode: Node | null = null;
    let nodeEndOffset = 0;

    let currentNode = treeWalker.nextNode();
    while (currentNode) {
      const nodeLength = currentNode.textContent?.length || 0;
      
      if (!startNode && currentOffset + nodeLength >= startOffset) {
        startNode = currentNode;
        nodeStartOffset = Math.max(0, startOffset - currentOffset);
      }
      
      if (!endNode && currentOffset + nodeLength >= endOffset) {
        endNode = currentNode;
        nodeEndOffset = Math.min(nodeLength, endOffset - currentOffset);
        break;
      }
      
      currentOffset += nodeLength;
      currentNode = treeWalker.nextNode();
    }

    if (startNode && endNode) {
      range.setStart(startNode, nodeStartOffset);
      range.setEnd(endNode, nodeEndOffset);
      return range;
    }
  } catch (err) {
    console.warn('[TextFragment] Erro ao criar range preciso:', err);
  }

  const fallbackRange = document.createRange();
  fallbackRange.selectNodeContents(parent);
  return fallbackRange;
}
