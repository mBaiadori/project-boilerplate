import { FastifyInstance } from 'fastify';
import { governanceService } from './governance.service.js';
import { vaultEngineService } from '../vault/vault-engine.service.js';


export async function governanceRoutes(fastify: FastifyInstance) {
  // 1. Collaborators List
  fastify.get('/api/governance/collaborators', async (request, reply) => {
    const query = request.query as { repo?: string };
    try {
      const result = await governanceService.getCollaborators(query.repo);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 2. Invite Collaborator to GitHub + Set Local Clearance Level
  fastify.post('/api/governance/invite', async (request, reply) => {
    const body = request.body as any;
    try {
      const result = await governanceService.inviteCollaborator(body);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 2.1 Update Collaborator Clearance & Permissions
  fastify.post('/api/governance/clearance', async (request, reply) => {
    const body = request.body as any;
    try {
      const result = await governanceService.updateCollaboratorClearance(body);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 3. Remove Collaborator
  fastify.delete('/api/governance/collaborators/:username', async (request, reply) => {
    const params = request.params as { username: string };
    const query = request.query as { repo?: string };
    try {
      const result = await governanceService.removeCollaborator({
        username: params.username,
        repo: query.repo,
      });
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 5. Branch Protection Status & Configuration
  fastify.get('/api/governance/branch-protection', async (request, reply) => {
    const query = request.query as { repo?: string };
    try {
      const result = await governanceService.getBranchProtection(query.repo);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post('/api/governance/branch-protection', async (request, reply) => {
    const body = request.body as any;
    try {
      const result = await governanceService.applyBranchProtection(body);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 6. Quorum Rules (Solo vs Team auto-detection)
  fastify.get('/api/governance/quorum', async (request, reply) => {
    const query = request.query as { repo?: string };
    try {
      const result = await governanceService.getQuorumRules(query.repo);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post('/api/governance/quorum', async (request, reply) => {
    const body = request.body as any;
    try {
      const result = await governanceService.updateQuorumRules(body);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 7. Governance Departments & Vaults
  fastify.get('/api/governance/departments', async (request, reply) => {
    const query = request.query as { repo?: string };
    try {
      const departments = await governanceService.getDepartments(query.repo);
      return reply.send({ departments });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post('/api/governance/departments', async (request, reply) => {
    const body = request.body as { departments: any[]; repo?: string };
    try {
      const result = await governanceService.saveDepartments(body.departments, body.repo);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 8. Secret & Confidential Clearance Scanner
  fastify.get('/api/governance/scan-secrets', async (request, reply) => {
    const query = request.query as { repo?: string };
    try {
      const result = await governanceService.scanRepositorySecrets(query.repo);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 9. Audit Logs
  fastify.get('/api/governance/audit-logs', async (request, reply) => {
    const query = request.query as { repo?: string };
    try {
      const result = await governanceService.getAuditLogs(query.repo);
      return reply.send({ logs: result });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 10. AI Ephemeral Token & Secure Context Pipe
  fastify.post('/api/governance/ai-token', async (request, reply) => {
    const body = request.body as any;
    try {
      const result = governanceService.createSecureAIToken(body);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post('/api/governance/secure-ai-context', async (request, reply) => {
    const body = request.body as any;
    try {
      const result = await governanceService.getSecureContextForAI(body);
      if (!result.success) {
        return reply.status(403).send(result);
      }
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 11. Decentralized Keymap & Transparent Vault Routes
  fastify.get('/api/governance/keymap', async (request, reply) => {
    const query = request.query as { repo?: string };
    try {
      const keymap = vaultEngineService.getKeymap(query.repo);
      return reply.send(keymap);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  fastify.post('/api/governance/keymap/register', async (request, reply) => {
    const body = request.body as {
      user: string;
      level?: number;
      departments?: string[];
      allowed_paths?: string[];
      repo?: string;
    };
    try {
      const member = vaultEngineService.registerUserPublicKey(body.repo || 'local', body.user, {
        level: body.level ?? 2,
        departments: body.departments || ['engineering'],
        allowed_paths: body.allowed_paths,
      });
      return reply.send({ success: true, member });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post('/api/governance/vault/sync', async (request, reply) => {
    const body = request.body as { repo?: string; user?: string };
    try {
      const result = await vaultEngineService.syncLocalWorkspaceFromGit(body.repo, body.user);
      return reply.send({ success: true, ...result });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // 12. Gestão Unificada de Cofres e Chaves Criptográficas (Zero-Knowledge)
  fastify.get('/api/governance/vault/my-access', async (request, reply) => {
    const query = request.query as { repo?: string; user?: string };
    try {
      const summary = vaultEngineService.getMyAccessSummary(query.repo, query.user);
      return reply.send({ success: true, ...summary });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  fastify.post('/api/governance/vault/grant-access', async (request, reply) => {
    const body = request.body as {
      repo?: string;
      user: string;
      folders: string[];
    };
    try {
      vaultEngineService.grantFolderAccess(body.repo || 'local', body.user, body.folders);
      return reply.send({ success: true, message: `Acesso aos cofres [${body.folders.join(', ')}] concedido para @${body.user}.` });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post('/api/governance/vault/revoke-access', async (request, reply) => {
    const body = request.body as {
      repo?: string;
      user: string;
      folders: string[];
    };
    try {
      vaultEngineService.revokeFolderAccess(body.repo || 'local', body.user, body.folders);
      return reply.send({ success: true, message: `Acesso aos cofres [${body.folders.join(', ')}] revogado para @${body.user} com rotação de chaves executada.` });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post('/api/governance/vault/rotate-key', async (request, reply) => {
    const body = request.body as {
      repo?: string;
      folder: string;
    };
    try {
      vaultEngineService.rotateCompartmentDEK(body.repo || 'local', body.folder);
      return reply.send({ success: true, message: `Chave criptográfica do cofre '${body.folder}' rotacionada com sucesso.` });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.get('/api/governance/vault/status', async (request, reply) => {
    const query = request.query as { repo?: string; user?: string };
    try {
      const cache = vaultEngineService.getCache(query.repo);
      const keymap = vaultEngineService.getKeymap(query.repo);
      const unlockedDEKs = vaultEngineService.getUnlockedDEKs(query.repo, query.user);
      return reply.send({
        lastSync: cache.lastSync,
        cachedFilesCount: Object.keys(cache.files).length,
        unlockedCompartments: Object.keys(unlockedDEKs),
        registeredMembersCount: Object.keys(keymap.members).length,
      });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
}
