import { FastifyInstance } from 'fastify';
import { prsService } from './prs.service.js';

export async function prsRoutes(fastify: FastifyInstance) {
  fastify.get('/api/prs', async (_request, reply) => {
    return reply.send(prsService.getPRs());
  });

  fastify.post('/api/workspace/generate-pr-summary', async (_request, reply) => {
    return reply.send(prsService.generatePRSummary());
  });

  fastify.post('/api/workspace/create-pr', async (request, reply) => {
    try {
      const result = await prsService.createPR(request.body as any);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post('/api/prs/approve', async (request, reply) => {
    const body = request.body as { id?: number | string; approver?: string };
    try {
      const result = prsService.approvePR(body.id || '', body.approver);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post('/api/prs/merge', async (request, reply) => {
    const body = request.body as { id?: number | string };
    try {
      const result = prsService.mergePR(body.id || '');
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });
}
