import { FastifyInstance } from 'fastify';
import { loadCanonicalTutorials } from '../../config/constants.js';

export async function tutorialsRoutes(fastify: FastifyInstance) {
  fastify.get('/api/tutorials', async (_request, reply) => {
    return reply.send({
      tutorials: loadCanonicalTutorials(),
    });
  });
}
