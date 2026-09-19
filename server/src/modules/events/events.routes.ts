import { FastifyInstance } from 'fastify';
import { eventsService } from './events.service.js';

export async function eventsRoutes(fastify: FastifyInstance) {
  fastify.get('/api/events', async (request, reply) => {
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.flushHeaders();

    const client = eventsService.addClient(reply);

    // Initial connect message
    reply.raw.write('event: connected\ndata: {}\n\n');

    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
        eventsService.removeClient(client);
      }
    }, 25000);

    request.raw.on('close', () => {
      clearInterval(heartbeat);
      eventsService.removeClient(client);
    });
  });
}
