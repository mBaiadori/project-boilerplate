import { FastifyInstance } from 'fastify';
import { skillsService } from './skills.service.js';
import { loadConfig } from '../../config/storage.js';

export async function skillsRoutes(fastify: FastifyInstance) {
  // 1. Listar catálogo global (Hub ECC)
  fastify.get('/api/skills/hub', async (request, reply) => {
    const query = request.query as { category?: string; search?: string };
    let skills = skillsService.getHubSkills();

    if (query.category) {
      skills = skills.filter((s) => s.category.toLowerCase() === query.category?.toLowerCase());
    }

    if (query.search) {
      const q = query.search.toLowerCase();
      skills = skills.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.title && s.title.toLowerCase().includes(q)) ||
          s.description.toLowerCase().includes(q) ||
          (s.tags && s.tags.some((t) => t.toLowerCase().includes(q)))
      );
    }

    return reply.send({
      count: skills.length,
      skills,
    });
  });

  // 2. Obter detalhes de uma skill no Hub
  fastify.get('/api/skills/hub/:id', async (request, reply) => {
    const params = request.params as { id: string };
    const skill = skillsService.getHubSkill(params.id);
    if (!skill) {
      return reply.status(404).send({ error: `Skill '${params.id}' não encontrada no Hub.` });
    }
    return reply.send({ skill });
  });

  // 3. Listar skills instaladas no projeto ativo
  fastify.get('/api/skills/project', async (request, reply) => {
    const query = request.query as { repo?: string };
    const cfg = loadConfig();
    const repoName = query.repo || cfg.active_repo?.name || 'local';
    const installed = skillsService.getProjectSkills(repoName);
    const manifest = skillsService.getProjectManifest(repoName);

    return reply.send({
      repo: repoName,
      count: installed.length,
      manifest,
      installed_skills: installed,
    });
  });

  // 4. Instalar skill no projeto
  fastify.post('/api/skills/install', async (request, reply) => {
    const body = request.body as { skill_id: string; repo?: string };
    if (!body?.skill_id) {
      return reply.status(400).send({ error: 'skill_id é obrigatório.' });
    }

    const cfg = loadConfig();
    const repoName = body.repo || cfg.active_repo?.name || 'local';

    try {
      const result = skillsService.installSkill(repoName, body.skill_id);
      return reply.send({
        success: true,
        message: `Skill '${body.skill_id}' instalada com sucesso no projeto '${repoName}'.`,
        skill: result.skill,
      });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 5. Desinstalar skill do projeto
  fastify.delete('/api/skills/uninstall/:id', async (request, reply) => {
    const params = request.params as { id: string };
    const query = request.query as { repo?: string };
    const cfg = loadConfig();
    const repoName = query.repo || cfg.active_repo?.name || 'local';

    try {
      const result = skillsService.uninstallSkill(repoName, params.id);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 6. Customizar (Fork/Edit) skill no projeto
  fastify.put('/api/skills/project/:id', async (request, reply) => {
    const params = request.params as { id: string };
    const body = request.body as {
      repo?: string;
      title?: string;
      description?: string;
      content?: string;
      tools?: string[];
      tags?: string[];
    };
    const cfg = loadConfig();
    const repoName = body.repo || cfg.active_repo?.name || 'local';

    try {
      const result = skillsService.customizeSkill(repoName, params.id, body);
      return reply.send({
        success: true,
        message: `Skill '${params.id}' customizada com sucesso.`,
        skill: result.skill,
      });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // =========================================================================
  // 7. AGENTS HUB & PROJECT
  // =========================================================================
  fastify.get('/api/aicenter/agents/hub', async (_request, reply) => {
    const { aiCenterService } = await import('./aicenter.service.js');
    return reply.send({ agents: aiCenterService.getHubAgents() });
  });

  fastify.get('/api/aicenter/agents/project', async (request, reply) => {
    const query = request.query as { repo?: string };
    const cfg = loadConfig();
    const repoName = query.repo || cfg.active_repo?.name || 'local';
    const { aiCenterService } = await import('./aicenter.service.js');
    return reply.send({ repo: repoName, agents: aiCenterService.getProjectAgents(repoName) });
  });

  fastify.post('/api/aicenter/agents/install', async (request, reply) => {
    const body = request.body as { agent_id: string; repo?: string };
    const cfg = loadConfig();
    const repoName = body.repo || cfg.active_repo?.name || 'local';
    const { aiCenterService } = await import('./aicenter.service.js');
    try {
      const result = aiCenterService.installAgent(repoName, body.agent_id);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.delete('/api/aicenter/agents/uninstall/:id', async (request, reply) => {
    const params = request.params as { id: string };
    const query = request.query as { repo?: string };
    const cfg = loadConfig();
    const repoName = query.repo || cfg.active_repo?.name || 'local';
    const { aiCenterService } = await import('./aicenter.service.js');
    try {
      const result = aiCenterService.uninstallAgent(repoName, params.id);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // =========================================================================
  // 8. TOOLS LIST & TEST PLAYGROUND
  // =========================================================================
  fastify.get('/api/aicenter/tools', async (_request, reply) => {
    const { aiCenterService } = await import('./aicenter.service.js');
    return reply.send({ tools: aiCenterService.getAllTools() });
  });

  fastify.post('/api/aicenter/tools/execute', async (request, reply) => {
    const body = request.body as { tool_name: string; args?: Record<string, any>; repo?: string };
    const cfg = loadConfig();
    const repoName = body.repo || cfg.active_repo?.name || 'local';
    const { aiCenterService } = await import('./aicenter.service.js');
    try {
      const result = await aiCenterService.executeToolTest(body.tool_name, body.args || {}, repoName);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // =========================================================================
  // 9. MCP CONNECTORS
  // =========================================================================
  fastify.get('/api/aicenter/mcp/templates', async (_request, reply) => {
    const { aiCenterService } = await import('./aicenter.service.js');
    return reply.send({ templates: aiCenterService.getMcpTemplates() });
  });

  fastify.get('/api/aicenter/mcp/project', async (request, reply) => {
    const query = request.query as { repo?: string };
    const cfg = loadConfig();
    const repoName = query.repo || cfg.active_repo?.name || 'local';
    const { aiCenterService } = await import('./aicenter.service.js');
    return reply.send({ repo: repoName, servers: aiCenterService.getProjectMcpServers(repoName) });
  });

  fastify.post('/api/aicenter/mcp/save', async (request, reply) => {
    const body = request.body as { server: any; repo?: string };
    const cfg = loadConfig();
    const repoName = body.repo || cfg.active_repo?.name || 'local';
    const { aiCenterService } = await import('./aicenter.service.js');
    try {
      const result = aiCenterService.saveProjectMcpServer(repoName, body.server);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.delete('/api/aicenter/mcp/remove/:id', async (request, reply) => {
    const params = request.params as { id: string };
    const query = request.query as { repo?: string };
    const cfg = loadConfig();
    const repoName = query.repo || cfg.active_repo?.name || 'local';
    const { aiCenterService } = await import('./aicenter.service.js');
    try {
      const result = aiCenterService.removeProjectMcpServer(repoName, params.id);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });
}

