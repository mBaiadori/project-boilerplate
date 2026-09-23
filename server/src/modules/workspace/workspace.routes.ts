import { FastifyInstance } from 'fastify';
import { workspaceService } from './workspace.service.js';
import { docsMetadataService } from './docs-metadata.service.js';
import { loadConfig } from '../../config/storage.js';

export async function workspaceRoutes(fastify: FastifyInstance) {
  fastify.get('/api/project/tree', async (_request, reply) => {
    try {
      return reply.send(workspaceService.getTree());
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  fastify.get('/api/project/file', async (request, reply) => {
    const query = request.query as { path?: string };
    const filePath = query.path?.trim();
    if (!filePath) {
      return reply.status(400).send({ error: 'Parâmetro path é obrigatório' });
    }
    try {
      return reply.send(workspaceService.getFile(filePath));
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }
  });

  fastify.get('/api/project/metadata', async (request, reply) => {
    try {
      const query = request.query as { repo?: string };
      const cfg = loadConfig();
      const repoName = query.repo || cfg.active_repo?.name || 'local';
      return reply.send(docsMetadataService.loadDocsMetadata(repoName));
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  fastify.get('/api/project/metadata/options', async (request, reply) => {
    try {
      const query = request.query as { repo?: string };
      const cfg = loadConfig();
      const repoName = query.repo || cfg.active_repo?.name || 'local';
      return reply.send(docsMetadataService.getProjectMetadataOptions(repoName));
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  fastify.get('/api/project/config', async (request, reply) => {
    try {
      const query = request.query as { repo?: string };
      const cfg = loadConfig();
      const repoName = query.repo || cfg.active_repo?.name || 'local';
      return reply.send(docsMetadataService.getProjectConfig(repoName));
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  fastify.post('/api/project/config', async (request, reply) => {
    try {
      const body = request.body as { config?: any; repo?: string } | any;
      const configData = body.config || body;
      const cfg = loadConfig();
      const repoName = body.repo || cfg.active_repo?.name || 'local';
      const result = docsMetadataService.saveProjectConfig(repoName, configData);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.patch('/api/project/metadata/item', async (request, reply) => {
    const body = request.body as { path?: string; meta?: any; repo?: string };
    const cleanPath = (body.path || '').trim().replace(/^\/+/, '');
    if (!cleanPath) {
      return reply.status(400).send({ error: 'Parâmetro path é obrigatório' });
    }
    try {
      const cfg = loadConfig();
      const repoName = body.repo || cfg.active_repo?.name || 'local';
      const result = docsMetadataService.updateDocMetadataItem(repoName, cleanPath, body.meta || {});
      const tree = workspaceService.getTree().tree;
      return reply.send({
        success: true,
        meta: result.meta,
        tree,
      });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post('/api/workspace/save', async (request, reply) => {
    const body = request.body as { path?: string; content?: string; meta?: any };
    if (!body.path) {
      return reply.status(400).send({ error: 'Parâmetro path é obrigatório' });
    }
    try {
      return reply.send(workspaceService.saveFile(body.path, body.content || '', body.meta));
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post('/api/project/file/create', async (request, reply) => {
    const body = request.body as {
      path?: string;
      content?: string;
      is_folder?: boolean;
      isFolder?: boolean;
      meta?: any;
      templateId?: string;
    };
    try {
      const isFolder = !!(body.is_folder || body.isFolder);
      let content = body.content || '';
      let templatePrompt = '';
      const templateId = body.templateId || body.meta?.templateId || '';

      // If a templateId is provided, resolve and apply the template content and templatePrompt
      if (!isFolder && templateId) {
        const { templatesService } = await import('../templates/templates.service.js');
        const cfg = loadConfig();
        const repoName = cfg.active_repo?.name || 'local';
        const tpl = templatesService.resolveTemplate(templateId, repoName);
        if (tpl) {
          content = tpl.content;
          templatePrompt = tpl.prompt || tpl.systemPrompt || '';
        }
      }

      const meta = {
        ...(body.meta && typeof body.meta === 'object' ? body.meta : {}),
        templateId: templateId || '',
        prompt: body.meta?.prompt || '',
      };

      const result = workspaceService.createFile(body.path || '', content, isFolder, meta);
      return reply.send({ ...result, templatePrompt, systemPrompt: templatePrompt, templateId });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post('/api/project/file/rename', async (request, reply) => {
    const body = request.body as { old_path?: string; new_path?: string; oldPath?: string; newPath?: string };
    const oldPath = body.old_path || body.oldPath || '';
    const newPath = body.new_path || body.newPath || '';
    try {
      return reply.send(workspaceService.renameFile(oldPath, newPath));
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.delete('/api/project/file', async (request, reply) => {
    const query = request.query as { path?: string };
    try {
      return reply.send(workspaceService.deleteFile(query.path || ''));
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.get('/api/workspace/changes', async (_request, reply) => {
    return reply.send(workspaceService.getWorkspaceChanges());
  });

  fastify.post('/api/workspace/discard', async (request, reply) => {
    const body = request.body as { paths?: string[] };
    return reply.send(workspaceService.discardChanges(body?.paths));
  });

  fastify.get('/api/project/document-context', async (request, reply) => {
    const query = request.query as { path?: string };
    return reply.send(workspaceService.getDocumentContext(query.path || ''));
  });

  fastify.get('/api/project/status', async (_request, reply) => {
    const treeData = workspaceService.getTree();
    const changesData = workspaceService.getWorkspaceChanges();
    return reply.send({
      repo: treeData.repo,
      total_files: treeData.tree.length,
      pending_changes: changesData.changes.length,
      guardrail: changesData.guardrail,
    });
  });

  fastify.get('/api/project/domains-docs', async (request, reply) => {
    const query = request.query as { path?: string };
    return reply.send(workspaceService.getDocumentContext(query.path || ''));
  });

  fastify.get('/api/project/sync-status', async (_request, reply) => {
    return reply.send({
      synced: true,
      last_sync: new Date().toISOString(),
    });
  });

  fastify.post('/api/project/bootstrap', async (_request, reply) => {
    const treeData = workspaceService.getTree();
    return reply.send({
      success: true,
      message: 'Workspace inicializado com sucesso!',
      tree: treeData.tree,
    });
  });

  fastify.post('/api/project/scaffold', async (request, reply) => {
    const body = request.body as { template_id?: string; folder?: string; filename?: string; title?: string };
    const folder = (body.folder || 'domains').trim().replace(/^\/+/, '');
    const filename = (body.filename || `${body.template_id || 'feature'}.md`).trim().replace(/^\/+/, '');
    const fullRelPath = `${folder}/${filename}`;

    try {
      const created = workspaceService.createFile(fullRelPath, `# ${body.title || 'Nova Especificação'}\n\nEspecificação estruturada.`, false, {
        title: body.title || 'Nova Especificação',
        categories: 'geral',
        status: 'draft',
      });
      return reply.send({
        success: true,
        path: fullRelPath,
        tree: created.tree,
      });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });
}
