export interface RagChunk {
  id: string;
  repo: string;
  filePath: string;
  relativePath: string;
  sectionTitle: string;
  content: string;
  lineStart: number;
  lineEnd: number;
  tokens: string[];
  termFrequency: Record<string, number>;
  updatedAt: number;
}

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

export interface RagSearchOptions {
  query: string;
  repo?: string;
  limit?: number;
  minScore?: number;
}

export interface RagFileManifestItem {
  relativePath: string;
  mtimeMs: number;
  size: number;
  chunkIds: string[];
}

export interface RagDiskStorage {
  repo: string;
  lastIndexedAt: number;
  manifest: Record<string, RagFileManifestItem>;
  chunks: RagChunk[];
}

export interface RagStats {
  repo: string;
  totalDocuments: number;
  totalChunks: number;
  lastIndexedAt: string;
  indexedFiles: string[];
}
