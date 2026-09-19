import { FastifyInstance } from 'fastify';
import { reposService } from './repos.service.js';

export async function reposRoutes(fastify: FastifyInstance) {
  fastify.get('/api/repos', async (_request, reply) => {
    try {
      const result = await reposService.listRepos();
      return reply.send(result);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  fastify.post('/api/repos/select', async (request, reply) => {
    try {
      const result = reposService.selectRepo(request.body);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post('/api/repos/create', async (request, reply) => {
    try {
      const result = await reposService.createRepo(request.body as any);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });
}
