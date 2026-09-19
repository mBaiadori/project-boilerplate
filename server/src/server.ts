import { buildApp } from './app.js';

const PORT = Number(process.env.PORT) || 4100;
const HOST = process.env.HOST || '0.0.0.0';

async function start() {
  try {
    const app = await buildApp();
    await app.listen({ port: PORT, host: HOST });
    console.log(`🚀 Context OS Fastify Server rodando em http://localhost:${PORT}`);
  } catch (err) {
    console.error('Erro ao iniciar o servidor Fastify:', err);
    process.exit(1);
  }
}

start();
