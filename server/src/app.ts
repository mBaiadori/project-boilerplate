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

import {
  getSessionToken,
  isValidSessionToken,
  isValidHostHeader,
  parseCookies,
} from "./security/session.js";
import { authRateLimiter, toolExecRateLimiter } from "./security/rate-limit.js";

export async function buildApp(): Promise<FastifyInstance> {
  const isDev = process.env.NODE_ENV === "development";
  const app = fastify({
    bodyLimit: 2 * 1024 * 1024, // 2MB safe global default for standard JSON requests (prevents memory DoS)
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

  // 1. CORS: Permitir clientes locais e Electron/Webviews, bloqueando websites externos da internet
  await app.register(cors, {
    origin: (origin, cb) => {
      // Requisições diretas de apps locais sem header Origin (Electron main, cURL, desktop apps)
      if (!origin) {
        return cb(null, true);
      }
      try {
        const parsed = new URL(origin);
        const isLocalHost =
          parsed.hostname === "localhost" ||
          parsed.hostname === "127.0.0.1" ||
          parsed.hostname === "::1" ||
          parsed.protocol === "file:" ||
          parsed.protocol === "vscode-webview:" ||
          parsed.protocol === "app:";
        if (isLocalHost) {
          return cb(null, true);
        }
      } catch {
        // Falha no parsing de URL
      }
      return cb(new Error("Acesso de origem cruzada não autorizado."), false);
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-ContextOS-Token"],
  });

  // 2. Proteção Anti-DNS Rebinding e Autenticação de Sessão Local (N3)
  app.addHook("onRequest", async (request, reply) => {
    // 2.1 Validação de Host Header
    if (!isValidHostHeader(request.headers.host)) {
      return reply.status(403).send({
        error: "Host não autorizado (proteção anti-DNS-rebinding).",
      });
    }

    const url = request.raw.url || "";
    const pathname = url.split("?")[0];

    // Permite assets estáticos, páginas e requisições OPTIONS pré-voo
    if (request.method === "OPTIONS" || !pathname.startsWith("/api/")) {
      return;
    }

    // Rate Limiting para rotas sensíveis
    const clientIp = request.ip || '127.0.0.1';
    if (pathname.startsWith('/api/auth/')) {
      const rateCheck = authRateLimiter.consume(clientIp);
      if (!rateCheck.allowed) {
        return reply.status(429).header('Retry-After', String(rateCheck.retryAfterSec || 1)).send({
          error: 'Muitas requisições para a rota de autenticação. Tente novamente em instantes.',
        });
      }
    } else if (pathname.startsWith('/api/skills/custom/execute')) {
      const rateCheck = toolExecRateLimiter.consume(clientIp);
      if (!rateCheck.allowed) {
        return reply.status(429).header('Retry-After', String(rateCheck.retryAfterSec || 1)).send({
          error: 'Muitas execuções de ferramentas customizadas solicitadas.',
        });
      }
    }

    // Allowlist explícita de endpoints públicos
    if (
      pathname === "/api/session/bootstrap" ||
      pathname === "/api/health" ||
      pathname === "/health"
    ) {
      return;
    }

    // Extração do token de sessão (Header X-ContextOS-Token, Cookie ctxos_session ou Authorization)
    const headerToken = request.headers["x-contextos-token"] as string | undefined;
    const cookies = parseCookies(request.headers.cookie);
    const cookieToken = cookies["ctxos_session"];
    let bearerToken: string | undefined;
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      bearerToken = authHeader.substring(7).trim();
    }

    const candidateToken = headerToken || cookieToken || bearerToken;

    if (!isValidSessionToken(candidateToken)) {
      return reply.status(401).send({
        error: "Não autorizado: Sessão inválida ou não informada.",
      });
    }
  });

  // Cabeçalhos de Segurança Estritos (Anti-MIME-sniffing, Anti-Clickjacking, Referrer-Policy)
  app.addHook("onSend", async (_request, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "SAMEORIGIN");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
  });

  // Global Error Handler defensivo: Sanitiza paths de sistema e inclui correlation ID
  app.setErrorHandler((error: Error & { statusCode?: number; code?: string }, request, reply) => {
    const requestId = (request.id as string) || `req-${Date.now()}`;
    if (request.log?.error) {
      request.log.error({ err: error, requestId }, 'Unhandled Server Error');
    }

    const statusCode =
      typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 600
        ? error.statusCode
        : 500;

    let safeMessage = error.message || 'Erro interno do servidor';
    if (statusCode === 500) {
      if (/(\/Users\/|\/home\/|[a-zA-Z]:\\|node_modules)/i.test(safeMessage)) {
        safeMessage = 'Ocorreu um erro interno inesperado no servidor.';
      }
    }

    return reply.status(statusCode).send({
      error: safeMessage,
      code: error.code || 'INTERNAL_ERROR',
      requestId,
    });
  });

  // Rota de teste controlada para validação de error handler exclusivamente fora de produção
  if (process.env.NODE_ENV !== 'production') {
    app.get('/api/test-leak-error', async () => {
      throw new Error('Falha catastrófica em /Users/MarcosBaiadori/secrets/key.pem');
    });
  }

  // 3. Rota de Bootstrap de Sessão Local (emite cookie HttpOnly e retorna token para SPA/Electron)
  app.get("/api/session/bootstrap", async (request, reply) => {
    const origin = request.headers.origin;
    if (origin) {
      try {
        const parsed = new URL(origin);
        const hostHeader = (request.headers.host || '').toLowerCase();
        const hostWithoutPort = hostHeader.split(':')[0];
        const reqPort = hostHeader.includes(':') ? hostHeader.split(':')[1] : (parsed.protocol === 'https:' ? '443' : '80');

        const isSameHost = (parsed.hostname === hostWithoutPort || (parsed.hostname === 'localhost' && hostWithoutPort === '127.0.0.1') || (parsed.hostname === '127.0.0.1' && hostWithoutPort === 'localhost'));
        const isSameOrigin = isSameHost && (parsed.port === reqPort || (!parsed.port && reqPort === '80'));
        const isViteDev = (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') && (parsed.port === '5173' || parsed.port === '4100');
        const isDesktopApp = parsed.protocol === 'app:' || parsed.protocol === 'vscode-webview:' || parsed.protocol === 'file:';

        if (!isSameOrigin && !isViteDev && !isDesktopApp) {
          return reply.status(403).send({
            error: "Acesso de origem cruzada ao bootstrap de sessão negado.",
          });
        }
      } catch {
        return reply.status(403).send({
          error: "Origin inválido para bootstrap de sessão.",
        });
      }
    }

    const token = getSessionToken();
    reply.header(
      "Set-Cookie",
      `ctxos_session=${token}; Path=/; HttpOnly; SameSite=Strict`,
    );
    return reply.send({ token, authenticated: true });
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
