import { FastifyInstance } from 'fastify';
import { settingsService } from './settings.service.js';

export async function settingsRoutes(fastify: FastifyInstance) {
  fastify.get('/api/settings', async (_request, reply) => {
    return reply.send(settingsService.getSettings());
  });

  fastify.post('/api/settings/save', async (request, reply) => {
    return reply.send(settingsService.saveSettings(request.body));
  });

  fastify.get('/api/ai/settings', async (_request, reply) => {
    return reply.send(settingsService.getAISettings());
  });

  fastify.post('/api/ai/settings', async (request, reply) => {
    return reply.send(settingsService.saveAISettings(request.body));
  });

  fastify.get('/api/ai/models', async (request, reply) => {
    const query = request.query as { provider?: string; api_key?: string; custom_endpoint?: string };
    const modelsResult = await settingsService.getAvailableModels(query);
    return reply.send(modelsResult);
  });
}
