import { buildApp } from './app.js';
import { findAvailablePort } from './utils/port.js';
import { eventsService } from './modules/events/events.service.js';

const DESIRED_PORT = Number(process.env.PORT) || 4100;
const HOST = process.env.HOST || '0.0.0.0';

async function start() {
  try {
    const port = await findAvailablePort(DESIRED_PORT);
    const app = await buildApp();
    await app.listen({ port, host: HOST });
    console.log(`🚀 Context OS Fastify Server rodando em http://localhost:${port}`);

    let isShuttingDown = false;
    const shutdown = async (_signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      try {
        eventsService.closeAll();
        await app.close();
      } catch {
        // Ignora erros ao desligar
      } finally {
        process.exit(0);
      }
    };

    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    console.error('Erro ao iniciar o servidor Fastify:', err);
    process.exit(1);
  }
}

start();
