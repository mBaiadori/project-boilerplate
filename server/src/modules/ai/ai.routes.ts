import { FastifyInstance } from 'fastify';
import { aiService } from './ai.service.js';
import { loadConfig } from '../../config/storage.js';

export async function aiRoutes(fastify: FastifyInstance) {
  fastify.post('/api/chat', async (request, reply) => {
    const body = request.body as {
      prompt?: string;
      content?: string;
      path?: string;
      history?: any[];
      assistant_prompt?: string;
      session_id?: string;
      repo?: string;
    };

    const cfg = loadConfig();
    const repoName = body.repo || cfg.active_repo?.name || 'local';
    const sessionId = body.session_id || `${Date.now()}`;
    const filePath = body.path || 'index.md';
    const prompt = (body.prompt || '').trim();

    if (!prompt) {
      return reply.status(400).send({ error: 'Prompt não pode ser vazio.' });
    }

    const aiSettings = cfg.ai_settings || { provider: 'gemini', model: 'gemini-2.5-flash', api_key: '' };
    const briefing = aiService.getBriefing(repoName, filePath);
    const customSystem = body.assistant_prompt
      ? `${body.assistant_prompt}\n\n${briefing}`
      : briefing
      ? `${cfg.settings?.global_system_prompt || ''}\n\n${briefing}`
      : cfg.settings?.global_system_prompt;

    const result = await aiService.callLLM(
      aiSettings,
      prompt,
      body.content || '',
      filePath,
      body.history || [],
      customSystem
    );

    aiService.appendChatEvent(repoName, filePath, sessionId, 'user', prompt);
    aiService.appendChatEvent(repoName, filePath, sessionId, 'model', result.reply);

    return reply.send({
      reply: result.reply,
      provider: result.provider,
      model: result.model,
      session_id: sessionId,
      repo: repoName,
    });
  });

  fastify.get('/api/chat/memory/brief', async (request, reply) => {
    const query = request.query as { repo?: string; path?: string };
    const cfg = loadConfig();
    const repoName = query.repo || cfg.active_repo?.name || 'local';
    const briefing = aiService.getBriefing(repoName, query.path || 'index.md');
    return reply.send({ briefing });
  });

  fastify.get('/api/chat/memory/history', async (request, reply) => {
    const query = request.query as { repo?: string; session_id?: string };
    const cfg = loadConfig();
    const repoName = query.repo || cfg.active_repo?.name || 'local';
    return reply.send(aiService.getChatHistory(repoName, query.session_id));
  });

  fastify.get('/api/chat/memory/session', async (request, reply) => {
    const query = request.query as { repo?: string; session_id?: string };
    const cfg = loadConfig();
    const repoName = query.repo || cfg.active_repo?.name || 'local';
    return reply.send(aiService.getChatHistory(repoName, query.session_id));
  });

  fastify.get('/api/chat/memory/actor', async (_request, reply) => {
    const cfg = loadConfig();
    return reply.send({
      actor: cfg.user ? { name: cfg.user.name || cfg.user.login, role: 'Developer' } : { name: 'Dev Local', role: 'Developer' },
    });
  });

  fastify.post('/api/chat/memory/event', async (request, reply) => {
    const body = request.body as { repo?: string; path?: string; session_id?: string; role?: string; text?: string };
    const cfg = loadConfig();
    const repoName = body.repo || cfg.active_repo?.name || 'local';
    const sessionId = body.session_id || `${Date.now()}`;
    aiService.appendChatEvent(repoName, body.path || 'index.md', sessionId, body.role || 'user', body.text || '');
    return reply.send({ success: true, session_id: sessionId });
  });

  fastify.post('/api/chat/memory/finalize', async (request, reply) => {
    const body = request.body as { repo?: string; path?: string; session_id?: string; summary?: string };
    const cfg = loadConfig();
    const repoName = body.repo || cfg.active_repo?.name || 'local';
    if (!body.session_id) {
      return reply.status(400).send({ error: 'session_id é obrigatório' });
    }
    return reply.send(aiService.finalizeSession(repoName, body.path || 'index.md', body.session_id, body.summary));
  });

  fastify.post('/api/chat/memory/reset', async (request, reply) => {
    const body = request.body as { repo?: string };
    const cfg = loadConfig();
    const repoName = body?.repo || cfg.active_repo?.name || 'local';
    return reply.send(aiService.resetMemory(repoName));
  });

  fastify.post('/api/templates/generate-ai', async (request, reply) => {
    const body = request.body as { description?: string; category?: string };
    const cfg = loadConfig();
    const aiSettings = cfg.ai_settings || { provider: 'gemini', model: 'gemini-2.5-flash', api_key: '' };

    const prompt = `Crie um template estruturado em Markdown com frontmatter YAML para a especificação a seguir:
Categoria: ${body.category || 'Domain-Driven Design'}
Descrição: ${body.description || 'Template de especificação'}

Retorne apenas o Markdown completo incluindo o frontmatter no formato:
---
id: "..."
title: "..."
category: "..."
badge: "..."
description: "..."
default_filename: "..."
suggested_folder: "..."
assistant_prompt: "..."
---
# Conteúdo...`;

    const result = await aiService.callLLM(aiSettings, prompt);
    return reply.send({
      content: result.reply,
      provider: result.provider,
    });
  });
}
