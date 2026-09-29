import { RagChunk, RagSearchOptions, RagSearchResult, RagStats } from './rag.types.js';
import { ragIndexer, tokenizeText } from './rag.indexer.js';

interface IndexCache {
  repo: string;
  chunks: RagChunk[];
  indexedFiles: string[];
  docFrequency: Record<string, number>; // Quantidade de chunks contendo o termo
  avgDocLength: number;
  lastIndexedAt: number;
}

export class RagService {
  private cache = new Map<string, IndexCache>();
  private readonly K1 = 1.2;
  private readonly B = 0.75;

  /**
   * Obtém ou gera o índice em memória para um repositório (com suporte a cache incremental em disco)
   */
  private getOrCreateIndex(repoName: string, force = false): IndexCache {
    const repo = repoName || 'local';
    const cached = this.cache.get(repo);
    const now = Date.now();

    // Reutiliza cache em RAM se tiver menos de 15 segundos e não for forçado
    if (!force && cached && (now - cached.lastIndexedAt < 15000)) {
      return cached;
    }

    // Executa indexação incremental (lê apenas arquivos com mtime alterado)
    const { chunks, indexedFiles } = ragIndexer.indexRepositoryIncremental(repo);
    const docFrequency: Record<string, number> = {};
    let totalLength = 0;

    for (const chunk of chunks) {
      totalLength += chunk.tokens.length;
      for (const token of Object.keys(chunk.termFrequency)) {
        docFrequency[token] = (docFrequency[token] || 0) + 1;
      }
    }

    const avgDocLength = chunks.length > 0 ? totalLength / chunks.length : 1;

    const newIndex: IndexCache = {
      repo,
      chunks,
      indexedFiles,
      docFrequency,
      avgDocLength,
      lastIndexedAt: now,
    };

    this.cache.set(repo, newIndex);
    return newIndex;
  }

  /**
   * Realiza busca BM25 nos documentos do projeto
   */
  search(options: RagSearchOptions): RagSearchResult[] {
    const { query, repo = 'local', limit = 5, minScore = 0.1 } = options;
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    const queryTokens = tokenizeText(cleanQuery);
    if (queryTokens.length === 0) return [];

    const index = this.getOrCreateIndex(repo);
    if (index.chunks.length === 0) return [];

    const N = index.chunks.length;
    const scoredChunks: Array<{ chunk: RagChunk; score: number }> = [];

    for (const chunk of index.chunks) {
      let score = 0;
      const docLen = chunk.tokens.length;

      for (const token of queryTokens) {
        const df = index.docFrequency[token] || 0;
        if (df === 0) continue;

        // IDF (Inverse Document Frequency)
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));

        // TF no chunk atual
        const tf = chunk.termFrequency[token] || 0;

        // Term Score BM25
        const num = tf * (this.K1 + 1);
        const den = tf + this.K1 * (1 - this.B + this.B * (docLen / index.avgDocLength));
        let termScore = idf * (num / den);

        // Boost especial se o termo estiver no título da seção ou no nome do arquivo
        const titleTokens = tokenizeText(chunk.sectionTitle + ' ' + chunk.relativePath);
        if (titleTokens.includes(token)) {
          termScore *= 2.5;
        }

        score += termScore;
      }

      // Exact match boost
      if (cleanQuery.length > 3 && chunk.content.toLowerCase().includes(cleanQuery.toLowerCase())) {
        score += 3.0;
      }

      if (score >= minScore) {
        scoredChunks.push({ chunk, score });
      }
    }

    // Ordena decrescente por relevância
    scoredChunks.sort((a, b) => b.score - a.score);
    const topMatches = scoredChunks.slice(0, limit);

    if (topMatches.length === 0) return [];

    const maxScore = topMatches[0].score || 1;

    return topMatches.map(({ chunk, score }) => {
      const relevancePercent = Math.min(100, Math.round((score / (maxScore * 1.05)) * 100));
      return {
        chunkId: chunk.id,
        filePath: chunk.filePath,
        relativePath: chunk.relativePath,
        sectionTitle: chunk.sectionTitle,
        snippet: this.generateSnippet(chunk.content, queryTokens),
        score: Number(score.toFixed(2)),
        relevancePercent,
        lineStart: chunk.lineStart,
        lineEnd: chunk.lineEnd,
      };
    });
  }

  /**
   * Força a reindexação do repositório (com verificação diferencial)
   */
  reindex(repoName: string): RagStats {
    const index = this.getOrCreateIndex(repoName, true);
    return {
      repo: index.repo,
      totalDocuments: index.indexedFiles.length,
      totalChunks: index.chunks.length,
      lastIndexedAt: new Date(index.lastIndexedAt).toISOString(),
      indexedFiles: index.indexedFiles,
    };
  }

  /**
   * Estatísticas do índice
   */
  getStats(repoName: string): RagStats {
    const index = this.getOrCreateIndex(repoName, false);
    return {
      repo: index.repo,
      totalDocuments: index.indexedFiles.length,
      totalChunks: index.chunks.length,
      lastIndexedAt: new Date(index.lastIndexedAt).toISOString(),
      indexedFiles: index.indexedFiles,
    };
  }

  /**
   * Constrói bloco de prompt enriquecido com trechos do RAG para o Direct API
   */
  buildContextPrompt(query: string, repoName: string, topK = 3): string {
    const results = this.search({ query, repo: repoName, limit: topK, minScore: 0.5 });
    if (results.length === 0) return '';

    const lines: string[] = ['\n[REFERÊNCIAS RELEVANTES DO PROJETO (RAG)]'];
    for (const res of results) {
      lines.push(`--- Documento: ${res.relativePath} (${res.sectionTitle}) [Relevância: ${res.relevancePercent}%] ---`);
      lines.push(res.snippet);
      lines.push('');
    }

    return lines.join('\n');
  }

  private generateSnippet(content: string, queryTokens: string[]): string {
    const lines = content.split('\n');
    let bestLineIndex = 0;
    let maxHits = 0;

    for (let i = 0; i < lines.length; i++) {
      const lineLower = lines[i].toLowerCase();
      let hits = 0;
      for (const tok of queryTokens) {
        if (lineLower.includes(tok)) hits++;
      }
      if (hits > maxHits) {
        maxHits = hits;
        bestLineIndex = i;
      }
    }

    const start = Math.max(0, bestLineIndex - 2);
    const end = Math.min(lines.length, bestLineIndex + 4);
    const snippet = lines.slice(start, end).join('\n');

    return snippet.length > 500 ? snippet.substring(0, 497) + '...' : snippet;
  }
}

export const ragService = new RagService();
