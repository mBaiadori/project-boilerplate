import { FastifyInstance } from 'fastify';
import { wikiService } from './wiki.service.js';

export async function wikiRoutes(fastify: FastifyInstance) {
  fastify.get('/api/chat/memory/wiki', async (_request, reply) => {
    return reply.send({
      wiki: wikiService.getWikiPages(),
    });
  });

  fastify.post('/api/chat/memory/wiki', async (request, reply) => {
    const body = request.body as { slug?: string; title?: string; content?: string; category?: string };
    try {
      const result = wikiService.saveWikiPage(body.slug || '', body.title || '', body.content || '', body.category);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post('/api/chat/memory/wiki/delete', async (request, reply) => {
    const body = request.body as { slug?: string };
    try {
      const result = wikiService.deleteWikiPage(body.slug || '');
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });
}
