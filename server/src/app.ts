import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import path from 'node:path';
import { UI_DIR, UI_DIST_DIR } from './config/constants.js';

import { eventsRoutes } from './modules/events/events.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { reposRoutes } from './modules/repos/repos.routes.js';
import { workspaceRoutes } from './modules/workspace/workspace.routes.js';
import { dictionaryRoutes } from './modules/dictionary/dictionary.routes.js';
import { wikiRoutes } from './modules/wiki/wiki.routes.js';
import { templatesRoutes } from './modules/templates/templates.routes.js';
import { prsRoutes } from './modules/prs/prs.routes.js';
import { settingsRoutes } from './modules/settings/settings.routes.js';
import { tutorialsRoutes } from './modules/tutorials/tutorials.routes.js';
import { aiRoutes } from './modules/ai/ai.routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
    },
  });

  // 1. CORS
  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // 2. Register Modular API Routes
  await app.register(eventsRoutes);
  await app.register(authRoutes);
  await app.register(reposRoutes);
  await app.register(workspaceRoutes);
  await app.register(dictionaryRoutes);
  await app.register(wikiRoutes);
  await app.register(templatesRoutes);
  await app.register(prsRoutes);
  await app.register(settingsRoutes);
  await app.register(tutorialsRoutes);
  await app.register(aiRoutes);

  // 3. Static Assets & SPA Fallback (Serving ui/dist or ui/)
  const staticRoot = fs.existsSync(UI_DIST_DIR) ? UI_DIST_DIR : UI_DIR;
  if (fs.existsSync(staticRoot)) {
    await app.register(fastifyStatic, {
      root: staticRoot,
      prefix: '/',
    });

    app.setNotFoundHandler(async (request, reply) => {
      if (request.raw.url && request.raw.url.startsWith('/api')) {
        return reply.status(404).send({ error: `Endpoint '${request.raw.url}' não encontrado.` });
      }
      const indexHtml = path.join(staticRoot, 'index.html');
      if (fs.existsSync(indexHtml)) {
        return reply.sendFile('index.html');
      }
      return reply.status(404).send({ error: 'Not Found' });
    });
  }

  return app;
}
