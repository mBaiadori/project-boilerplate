import { FastifyInstance } from 'fastify';
import { aiService } from './ai.service.js';
import { loadConfig } from '../../config/storage.js';
import { toolRegistry } from './tools/ToolRegistry.js';
import { skillsService } from '../skills/skills.service.js';
import { providerManager } from './providers/ProviderManager.js';
import { contextPointerService } from './context/ContextPointerService.js';
import { ProviderId, ProviderStreamEvent } from './providers/provider.types.js';

export async function aiRoutes(fastify: FastifyInstance) {
  /**
   * Lista todos os provedores disponíveis e seus status (Direct API, Antigravity, etc.)
   */
  fastify.get('/api/ai/providers', async (_request, reply) => {
    const providers = await providerManager.listProviders();
    return reply.send({ providers });
  });

  /**
   * Envia uma resposta de aprovação interativa (y/n) para a sessão do agente
   */
  fastify.post('/api/ai/session/approval', async (request, reply) => {
    const body = request.body as {
      session_id?: string;
      provider_id?: ProviderId;
      approved: boolean;
      custom_input?: string;
    };

    if (!body.session_id) {
      return reply.status(400).send({ error: 'session_id é obrigatório' });
    }

    const provider = providerManager.getProvider(body.provider_id || 'antigravity');
    try {
      await provider.sendApproval(body.session_id, body.approved, body.custom_input);
      return reply.send({ success: true, session_id: body.session_id });
    } catch (err: any) {
      return reply.status(500).send({ error: err?.message || 'Falha ao enviar aprovação' });
    }
  });

  /**
   * Interrompe uma sessão de agente em andamento
   */
  fastify.post('/api/ai/session/stop', async (request, reply) => {
    const body = request.body as { session_id?: string; provider_id?: ProviderId };
    if (!body.session_id) {
      return reply.status(400).send({ error: 'session_id é obrigatório' });
    }

    const provider = providerManager.getProvider(body.provider_id);
    await provider.stopSession(body.session_id);
    return reply.send({ success: true, session_id: body.session_id });
  });

  /**
   * Endpoint de Chat Unificado (Suporta Modo Direto e Modo Conectado / Antigravity)
   */
  fastify.post('/api/chat', async (request, reply) => {
    const body = request.body as {
      prompt?: string;
      content?: string;
      path?: string;
      history?: any[];
      assistant_prompt?: string;
      raw_mode?: boolean;
      session_id?: string;
      repo?: string;
      allowed_tools?: string[];
      skill_id?: string;
      provider_id?: ProviderId;
    };

    const cfg = loadConfig();
    const repoName = body.repo || cfg.active_repo?.name || 'local';
    const sessionId = body.session_id || `${Date.now()}`;
    const filePath = body.path || 'index.md';
    const prompt = (body.prompt || '').trim();
    const isRawMode = Boolean(body.raw_mode);
    const providerId = body.provider_id || (body.raw_mode ? 'direct-api' : cfg.ai_settings?.default_provider || 'direct-api');

    if (!prompt) {
      return reply.status(400).send({ error: 'Prompt não pode ser vazio.' });
    }

    // Se for provedor conectado (ex: Antigravity)
    if (providerId !== 'direct-api') {
      const provider = providerManager.getProvider(providerId);
      const contextPointers = contextPointerService.buildContextPointers({
        repoName,
        activeFilePath: filePath,
        skillId: body.skill_id,
      });

      const briefing = aiService.getBriefing(repoName, filePath);
      const streamEvents: ProviderStreamEvent[] = [];

      try {
        const result = await provider.sendMessage(
          sessionId,
          prompt,
          (event) => {
            streamEvents.push(event);
          },
          {
            history: (body.history || []).map((h) => ({ role: h.role, content: h.text || h.content || '' })),
            briefing,
            contextPointers,
          }
        );

        const currentAuthor = cfg.user?.name || cfg.user?.login || 'Developer';
        aiService.appendChatEvent(repoName, filePath, sessionId, 'user', prompt, { model: provider.name, author: currentAuthor });
        aiService.appendChatEvent(repoName, filePath, sessionId, 'model', result.reply, { model: provider.name, author: 'Antigravity' });

        return reply.send({
          reply: result.reply,
          provider: provider.id,
          model: provider.name,
          session_id: sessionId,
          repo: repoName,
          tool_calls: result.toolCalls || [],
          steps_count: 1,
        });
      } catch (err: any) {
        return reply.status(500).send({ error: err?.message || 'Erro ao comunicar com o agente conectado.' });
      }
    }

    // Modo Direto (Direct API - Gemini / OpenAI / Anthropic)
    let resolvedSkillPrompt = '';
    let skillTools: string[] = [];

    if (!isRawMode && body.skill_id) {
      const activeSkill = skillsService.resolveSkill(body.skill_id, repoName);
      if (activeSkill) {
        resolvedSkillPrompt = `\n\n### SKILL ATIVA: ${activeSkill.title || activeSkill.name} (v${activeSkill.version})\n${activeSkill.content}\n`;
        skillTools = activeSkill.tools || [];
      }
    }

    let resolvedAllowedTools: string[] | undefined = undefined;

    if (!isRawMode) {
      if (Array.isArray(body.allowed_tools) && body.allowed_tools.length > 0) {
        resolvedAllowedTools = Array.from(new Set([...body.allowed_tools, ...skillTools]));
      } else if (skillTools.length > 0) {
        resolvedAllowedTools = skillTools;
      } else {
        resolvedAllowedTools = toolRegistry.getAllTools().map((t) => t.name);
      }
    }

    const aiSettings = {
      ...(cfg.ai_settings || { provider: 'gemini', model: 'gemini-2.5-flash', api_key: '' }),
      allowed_tools: resolvedAllowedTools && resolvedAllowedTools.length > 0 ? resolvedAllowedTools : undefined,
    };

    const briefing = aiService.getBriefing(repoName, filePath);
    const basePrompt = body.assistant_prompt || cfg.settings?.global_system_prompt || '';
    const customSystem = `${basePrompt}${resolvedSkillPrompt}${briefing ? `\n\n${briefing}` : ''}`.trim();

    const result = await aiService.callLLM(
      aiSettings,
      prompt,
      body.content || '',
      filePath,
      body.history || [],
      customSystem,
      repoName
    );

    const currentAuthor = cfg.user?.name || cfg.user?.login || 'Developer';
    aiService.appendChatEvent(repoName, filePath, sessionId, 'user', prompt, { model: result.model, author: currentAuthor });
    aiService.appendChatEvent(repoName, filePath, sessionId, 'model', result.reply, { model: result.model, author: 'Agent' });

    return reply.send({
      reply: result.reply,
      provider: result.provider,
      model: result.model,
      session_id: sessionId,
      repo: repoName,
      tool_calls: result.tool_calls || [],
      steps_count: result.steps_count || 1,
    });
  });

  /**
   * Endpoint de Streaming SSE em tempo real
   */
  fastify.post('/api/chat/stream', async (request, reply) => {
    const body = request.body as {
      prompt?: string;
      session_id?: string;
      repo?: string;
      path?: string;
      provider_id?: ProviderId;
      skill_id?: string;
    };

    const cfg = loadConfig();
    const repoName = body.repo || cfg.active_repo?.name || 'local';
    const sessionId = body.session_id || `${Date.now()}`;
    const filePath = body.path || 'index.md';
    const prompt = (body.prompt || '').trim();
    const providerId = body.provider_id || 'direct-api';

    if (!prompt) {
      return reply.status(400).send({ error: 'Prompt não pode ser vazio.' });
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    const sendEvent = (event: ProviderStreamEvent) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    const provider = providerManager.getProvider(providerId);
    const contextPointers = contextPointerService.buildContextPointers({
      repoName,
      activeFilePath: filePath,
      skillId: body.skill_id,
    });
    const briefing = aiService.getBriefing(repoName, filePath);

    try {
      await provider.sendMessage(sessionId, prompt, sendEvent, {
        briefing,
        contextPointers,
      });
    } catch (err: any) {
      sendEvent({
        type: 'error',
        provider: provider.id,
        sessionId,
        data: err?.message || String(err),
        timestamp: Date.now(),
      });
    } finally {
      reply.raw.end();
    }
  });

  fastify.get('/api/ai/tools', async (_request, reply) => {
    const tools = toolRegistry.getAllTools();
    return reply.send({
      count: tools.length,
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
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
    const query = request.query as { repo?: string; path?: string; session_id?: string };
    const cfg = loadConfig();
    const repoName = query.repo || cfg.active_repo?.name || 'local';
    return reply.send(aiService.getChatHistory(repoName, query.session_id, query.path));
  });

  fastify.get('/api/chat/memory/session', async (request, reply) => {
    const query = request.query as { repo?: string; session_id?: string };
    const cfg = loadConfig();
    const repoName = query.repo || cfg.active_repo?.name || 'local';
    const sessionData = aiService.getSessionDetails(repoName, query.session_id);
    return reply.send({ session: sessionData });
  });

  fastify.delete('/api/chat/memory/session', async (request, reply) => {
    const query = request.query as { repo?: string; session_id?: string };
    const cfg = loadConfig();
    const repoName = query.repo || cfg.active_repo?.name || 'local';
    if (!query.session_id) {
      return reply.status(400).send({ error: 'session_id é obrigatório' });
    }
    return reply.send(aiService.deleteSession(repoName, query.session_id));
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
