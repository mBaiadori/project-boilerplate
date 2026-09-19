import { FastifyInstance } from 'fastify';
import { templatesService } from './templates.service.js';

export async function templatesRoutes(fastify: FastifyInstance) {
  fastify.get('/api/templates', async (_request, reply) => {
    return reply.send({
      templates: templatesService.getTemplates(),
    });
  });

  fastify.get('/api/templates/store', async (_request, reply) => {
    return reply.send({
      templates: templatesService.getTemplates(),
    });
  });

  fastify.get('/api/templates/installed', async (_request, reply) => {
    return reply.send(templatesService.getInstalledTemplates());
  });

  fastify.post('/api/templates/save', async (request, reply) => {
    try {
      const result = templatesService.saveTemplate(request.body as any);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post('/api/templates/install', async (request, reply) => {
    const body = request.body as { template_id?: string; folder?: string };
    try {
      const result = templatesService.installTemplate(body.template_id || '', body.folder);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.delete('/api/templates', async (request, reply) => {
    const query = request.query as { id?: string };
    try {
      const result = templatesService.deleteTemplate(query.id || '');
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.get('/api/workflows', async (_request, reply) => {
    return reply.send(templatesService.getWorkflows());
  });

  fastify.post('/api/workflows/apply', async (request, reply) => {
    const body = request.body as { workflow_id?: string };
    try {
      const result = templatesService.applyWorkflow(body.workflow_id || '');
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });
}
