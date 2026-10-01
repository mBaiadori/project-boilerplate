import { FastifyInstance } from 'fastify';
import { governanceService } from './governance.service.js';
import {
  deriveLevelKey,
  encryptDocument,
  decryptDocument,
} from '../../utils/crypto.js';

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

  // 4. Update Collaborator Clearance Level (0-3)
  fastify.post('/api/governance/clearance', async (request, reply) => {
    const body = request.body as any;
    try {
      const result = await governanceService.updateCollaboratorClearance(body);
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

  // 7. Security Vault (Levels 0-3 metadata, Salt & AI Privacy Policies)
  fastify.get('/api/governance/vault', async (request, reply) => {
    const query = request.query as { repo?: string };
    try {
      const result = await governanceService.getSecurityVault(query.repo);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post('/api/governance/vault', async (request, reply) => {
    const body = request.body as any;
    try {
      const result = await governanceService.updateSecurityVault(body);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 8. Dynamic Security Levels
  fastify.get('/api/governance/levels', async (request, reply) => {
    const query = request.query as { repo?: string };
    try {
      const levels = await governanceService.getSecurityLevels(query.repo);
      return reply.send({ levels });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post('/api/governance/levels', async (request, reply) => {
    const body = request.body as { levels: any[]; repo?: string };
    try {
      const result = await governanceService.saveSecurityLevels(body.levels, body.repo);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 8.1. Governance Departments
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

  fastify.post('/api/governance/levels/migrate', async (request, reply) => {
    const body = request.body as {
      oldLevelId: string;
      oldRank?: number;
      newLevelId: string;
      newRank?: number;
      repo?: string;
    };
    try {
      const result = await governanceService.migrateDocumentSecurityLevels(body);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 9. Individual User Key Slots & Canary Validation
  fastify.post('/api/governance/vault/unlock-user', async (request, reply) => {
    const body = request.body as {
      user: string;
      passphrase: string;
      levelId?: string;
      repo?: string;
    };
    try {
      const result = await governanceService.unlockUserVault(body);
      if (!result.success) {
        return reply.status(401).send(result);
      }
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post('/api/governance/vault/set-user-passphrase', async (request, reply) => {
    const body = request.body as {
      user: string;
      passphrase: string;
      levelId: string;
      repo?: string;
    };
    try {
      const result = await governanceService.setUserPassphrase(body);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 10. Secret & Confidential Clearance Scanner
  fastify.get('/api/governance/scan-secrets', async (request, reply) => {
    const query = request.query as { repo?: string };
    try {
      const result = await governanceService.scanRepositorySecrets(query.repo);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 11. Audit Logs
  fastify.get('/api/governance/audit-logs', async (request, reply) => {
    const query = request.query as { repo?: string };
    try {
      const result = await governanceService.getAuditLogs(query.repo);
      return reply.send({ logs: result });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 12. AI Ephemeral Token & Secure Context Pipe
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

  // 13. Crypto Utilities (Encrypt / Decrypt Helper)
  fastify.post('/api/crypto/encrypt', async (request, reply) => {
    const body = request.body as {
      content: string;
      level: number;
      passphrase?: string;
      repo?: string;
      metadata?: any;
    };
    try {
      const vault = await governanceService.getSecurityVault(body.repo);
      const salt = vault.salt || 'context-os-default-salt';
      const key = deriveLevelKey(body.passphrase || `key-level-${body.level}`, salt);
      const envelope = encryptDocument(body.content, body.level, key, body.metadata);
      return reply.send({ success: true, envelope });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  fastify.post('/api/crypto/decrypt', async (request, reply) => {
    const body = request.body as {
      envelope: string;
      passphrases: Record<number, string>;
      repo?: string;
    };
    try {
      const vault = await governanceService.getSecurityVault(body.repo);
      const salt = vault.salt || 'context-os-default-salt';
      const availableKeys: Record<number, Buffer> = {};
      for (const [lvl, pass] of Object.entries(body.passphrases || {})) {
        if (pass) {
          availableKeys[Number(lvl)] = deriveLevelKey(pass, salt);
        }
      }
      const result = decryptDocument(body.envelope, availableKeys);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });
}
