import { FastifyInstance } from 'fastify';
import { workspaceService } from './workspace.service.js';

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
    const body = request.body as { path?: string; content?: string; is_folder?: boolean; isFolder?: boolean; meta?: any };
    try {
      const isFolder = !!(body.is_folder || body.isFolder);
      return reply.send(workspaceService.createFile(body.path || '', body.content || '', isFolder, body.meta));
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
      const created = workspaceService.createFile(fullRelPath, `# ${body.title || 'Nova Especificação'}\n\nEspecificação estruturada.`);
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
