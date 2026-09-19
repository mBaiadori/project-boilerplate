import { FastifyInstance } from 'fastify';
import { authService } from './auth.service.js';

export async function authRoutes(fastify: FastifyInstance) {
  fastify.get('/api/status', async (_request, reply) => {
    return reply.send(authService.getStatus());
  });

  fastify.post('/api/auth/token', async (request, reply) => {
    const body = (request.body as { token?: string }) || {};
    try {
      const result = await authService.authenticateWithToken(body.token || '');
      return reply.send(result);
    } catch (err: any) {
      return reply.status(401).send({ error: err.message || 'Falha na autenticação' });
    }
  });

  fastify.post('/api/auth/logout', async (_request, reply) => {
    return reply.send(authService.logout());
  });
}
