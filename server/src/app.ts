import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import fastify, { FastifyInstance } from "fastify";
import fs from "node:fs";
import path from "node:path";
import { resolveUiDistDir } from "./config/constants.js";
import { aiRoutes } from "./modules/ai/ai.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { dictionaryRoutes } from "./modules/dictionary/dictionary.routes.js";
import { eventsRoutes } from "./modules/events/events.routes.js";
import { eventsService } from "./modules/events/events.service.js";
import { gitRoutes } from "./modules/git/git.routes.js";
import { governanceRoutes } from "./modules/governance/governance.routes.js";
import { prsRoutes } from "./modules/prs/prs.routes.js";
import { ragRoutes } from "./modules/rag/rag.routes.js";
import { reposRoutes } from "./modules/repos/repos.routes.js";
import { settingsRoutes } from "./modules/settings/settings.routes.js";
import { skillsRoutes } from "./modules/skills/skills.routes.js";
import { systemRoutes } from "./modules/system/system.routes.js";
import { templatesRoutes } from "./modules/templates/templates.routes.js";
import { translationsRoutes } from "./modules/translations/translations.routes.js";
import { tutorialsRoutes } from "./modules/tutorials/tutorials.routes.js";
import { wikiRoutes } from "./modules/wiki/wiki.routes.js";
import { workspaceRoutes } from "./modules/workspace/workspace.routes.js";

export async function buildApp(): Promise<FastifyInstance> {
  const isDev = process.env.NODE_ENV === "development";
  const app = fastify({
    bodyLimit: 50 * 1024 * 1024, // 50MB limit for importing documents, spreadsheets, PDFs and media
    logger: isDev
      ? {
          level: "info",
          transport: {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "HH:MM:ss",
              ignore: "pid,hostname",
            },
          },
        }
      : true,
  });

  // 1. CORS
  await app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
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
  await app.register(gitRoutes);
  await app.register(skillsRoutes);
  await app.register(ragRoutes);
  await app.register(systemRoutes);
  await app.register(translationsRoutes);
  await app.register(governanceRoutes);

  // 3. Static Assets & SPA Fallback (Serving ui/dist or ui/)
  const staticRoot = resolveUiDistDir();
  console.log(
    `[Fastify Server] Servindo assets estáticos do frontend em: ${staticRoot}`,
  );
  if (fs.existsSync(staticRoot)) {
    await app.register(fastifyStatic, {
      root: staticRoot,
      prefix: "/",
    });

    app.setNotFoundHandler(async (request, reply) => {
      if (request.raw.url && request.raw.url.startsWith("/api")) {
        return reply
          .status(404)
          .send({ error: `Endpoint '${request.raw.url}' não encontrado.` });
      }
      const indexHtml = path.join(staticRoot, "index.html");
      if (fs.existsSync(indexHtml)) {
        return reply.sendFile("index.html");
      }
      return reply.status(404).send({ error: "Not Found" });
    });
  } else {
    console.warn(
      `[Fastify Server] Aviso: Diretório estático ${staticRoot} não encontrado.`,
    );
  }

  app.addHook("onClose", async () => {
    eventsService.closeAll();
  });

  return app;
}
