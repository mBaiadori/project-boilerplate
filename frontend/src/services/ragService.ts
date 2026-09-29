export interface RagSearchResult {
  chunkId: string;
  filePath: string;
  relativePath: string;
  sectionTitle: string;
  snippet: string;
  score: number;
  relevancePercent: number;
  lineStart: number;
  lineEnd: number;
}

export interface RagStats {
  repo: string;
  totalDocuments: number;
  totalChunks: number;
  lastIndexedAt: string;
  indexedFiles: string[];
}

export const ragService = {
  async search(query: string, repo = 'local', limit = 6): Promise<RagSearchResult[]> {
    try {
      const res = await fetch('/api/rag/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, repo, limit }),
      });
      if (!res.ok) throw new Error('Falha na busca RAG');
      const data = await res.json();
      return data.results || [];
    } catch (err) {
      console.error('[RAG Service] Erro na busca:', err);
      return [];
    }
  },

  async reindex(repo = 'local'): Promise<RagStats | null> {
    try {
      const res = await fetch('/api/rag/reindex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo }),
      });
      if (!res.ok) throw new Error('Falha ao reindexar RAG');
      const data = await res.json();
      return data.stats || null;
    } catch (err) {
      console.error('[RAG Service] Erro ao reindexar:', err);
      return null;
    }
  },

  async getStats(repo = 'local'): Promise<RagStats | null> {
    try {
      const res = await fetch(`/api/rag/stats?repo=${encodeURIComponent(repo)}`);
      if (!res.ok) throw new Error('Falha ao obter stats RAG');
      const data = await res.json();
      return data.stats || null;
    } catch (err) {
      console.error('[RAG Service] Erro ao obter stats:', err);
      return null;
    }
  },
};
