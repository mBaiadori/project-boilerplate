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

  fastify.get('/api/auth/accounts', async (_request, reply) => {
    return reply.send({ accounts: authService.getAccounts() });
  });

  fastify.post('/api/auth/accounts/switch', async (request, reply) => {
    const body = (request.body as { account_id?: string }) || {};
    if (!body.account_id) {
      return reply.status(400).send({ error: 'account_id é obrigatório' });
    }
    try {
      const res = await authService.switchAccount(body.account_id);
      return reply.send(res);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao alternar conta' });
    }
  });

  fastify.delete('/api/auth/accounts/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!id) {
      return reply.status(400).send({ error: 'ID da conta é obrigatório' });
    }
    try {
      const res = authService.removeAccount(decodeURIComponent(id));
      return reply.send(res);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao remover conta' });
    }
  });

  fastify.post('/api/auth/logout', async (_request, reply) => {
    return reply.send(authService.logout());
  });
}
