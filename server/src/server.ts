import { buildApp } from './app.js';
import { findAvailablePort } from './utils/port.js';

const DESIRED_PORT = Number(process.env.PORT) || 4100;
const HOST = process.env.HOST || '0.0.0.0';

async function start() {
  try {
    const port = await findAvailablePort(DESIRED_PORT);
    const app = await buildApp();
    await app.listen({ port, host: HOST });
    console.log(`🚀 Context OS Fastify Server rodando em http://localhost:${port}`);
  } catch (err) {
    console.error('Erro ao iniciar o servidor Fastify:', err);
    process.exit(1);
  }
}

start();
