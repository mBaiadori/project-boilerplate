import { FastifyInstance } from 'fastify';
import { ragService } from './rag.service.js';
import { loadConfig } from '../../config/storage.js';

export async function ragRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/rag/search
   * Busca trechos de documentos relevantes via BM25
   */
  fastify.post('/api/rag/search', async (request, reply) => {
    const body = request.body as {
      query?: string;
      repo?: string;
      limit?: number;
      min_score?: number;
    };

    const cfg = loadConfig();
    const repo = body.repo || cfg.active_repo?.name || 'local';
    const query = (body.query || '').trim();

    if (!query) {
      return reply.status(400).send({ error: 'Parâmetro query é obrigatório.' });
    }

    const results = ragService.search({
      query,
      repo,
      limit: body.limit || 5,
      minScore: body.min_score || 0.1,
    });

    return reply.send({
      query,
      repo,
      total_matches: results.length,
      results,
    });
  });

  /**
   * POST /api/rag/reindex
   * Força a reindexação do repositório
   */
  fastify.post('/api/rag/reindex', async (request, reply) => {
    const body = (request.body as { repo?: string }) || {};
    const cfg = loadConfig();
    const repo = body.repo || cfg.active_repo?.name || 'local';

    const stats = ragService.reindex(repo);
    return reply.send({
      message: 'Repositório reindexado com sucesso.',
      stats,
    });
  });

  /**
   * GET /api/rag/stats
   * Estatísticas do índice RAG
   */
  fastify.get('/api/rag/stats', async (request, reply) => {
    const query = request.query as { repo?: string };
    const cfg = loadConfig();
    const repo = query?.repo || cfg.active_repo?.name || 'local';

    const stats = ragService.getStats(repo);
    return reply.send({ stats });
  });
}
