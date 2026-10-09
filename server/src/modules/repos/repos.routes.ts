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
      const result = await reposService.selectRepo(request.body);
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

  fastify.post('/api/repos/diagnose', async (request, reply) => {
    try {
      const { name } = (request.body as any) || {};
      const result = await reposService.diagnoseRepo(name);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post('/api/repos/initialize', async (request, reply) => {
    try {
      const result = await reposService.initializeRepo(request.body as any);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.get('/api/repos/orgs', async (_request, reply) => {
    try {
      const result = await reposService.listOrgs();
      return reply.send(result);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  fastify.post('/api/repos/orgs', async (request, reply) => {
    try {
      const result = await reposService.createOrg(request.body as any);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.patch('/api/repos', async (request, reply) => {
    try {
      const result = await reposService.updateRepo(request.body as any);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post('/api/repos/update', async (request, reply) => {
    try {
      const result = await reposService.updateRepo(request.body as any);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post('/api/repos/clone', async (request, reply) => {
    try {
      const result = await reposService.cloneRepo(request.body as any);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post('/api/repos/clone-local', async (request, reply) => {
    try {
      const result = await reposService.cloneLocalRepo(request.body as any);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.delete('/api/repos', async (request, reply) => {
    try {
      const result = await reposService.deleteRepo(request.body as any);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });
}

