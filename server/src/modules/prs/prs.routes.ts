import { FastifyInstance } from 'fastify';
import { prsService } from './prs.service.js';

export async function prsRoutes(fastify: FastifyInstance) {
  fastify.get('/api/prs', async (request, reply) => {
    const query = request.query as { repo?: string };
    const result = await prsService.getPRs(query.repo);
    return reply.send(result);
  });

  fastify.get('/api/prs/file-diff', async (request, reply) => {
    const query = request.query as { repo?: string; path?: string; commit?: string };
    const diff = await prsService.getPRFileDiff(query.repo || '', query.path || '', query.commit);
    return reply.send({ diff });
  });

  fastify.post('/api/workspace/generate-pr-summary', async (request, reply) => {
    const body = request.body as { repo?: string } | undefined;
    return reply.send(prsService.generatePRSummary(body?.repo));
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
      const result = await prsService.mergePR(body.id || '');
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post('/api/prs/reject', async (request, reply) => {
    const body = request.body as { id?: number | string; reason?: string };
    try {
      const result = await prsService.rejectPR(body.id || '', body.reason);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });
}
