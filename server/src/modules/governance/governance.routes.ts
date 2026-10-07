import { FastifyInstance } from 'fastify';
import { governanceService } from './governance.service.js';


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

  // 11. Organization Teams
  fastify.get('/api/governance/orgs/:org/teams', async (request, reply) => {
    const params = request.params as { org: string };
    try {
      const teams = await governanceService.getOrgTeams(params.org);
      return reply.send({ teams });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 12. Organization Members
  fastify.get('/api/governance/orgs/:org/members', async (request, reply) => {
    const params = request.params as { org: string };
    try {
      const members = await governanceService.getOrgMembers(params.org);
      return reply.send({ members });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 13. Repo Teams List
  fastify.get('/api/governance/repos/:owner/:repo/teams', async (request, reply) => {
    const params = request.params as { owner: string; repo: string };
    try {
      const teams = await governanceService.getRepoTeams(params.owner, params.repo);
      return reply.send({ teams });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 14. Add/Update Team on Repo
  fastify.put('/api/governance/repos/:owner/:repo/teams/:team_slug', async (request, reply) => {
    const params = request.params as { owner: string; repo: string; team_slug: string };
    const body = (request.body as any) || {};
    try {
      const result = await governanceService.addTeamToRepo({
        org: body.org || params.owner,
        teamSlug: params.team_slug,
        owner: params.owner,
        repo: params.repo,
        permission: body.permission || 'push',
      });
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 15. Remove Team from Repo
  fastify.delete('/api/governance/repos/:owner/:repo/teams/:team_slug', async (request, reply) => {
    const params = request.params as { owner: string; repo: string; team_slug: string };
    const query = request.query as { org?: string };
    try {
      const result = await governanceService.removeTeamFromRepo({
        org: query.org || params.owner,
        teamSlug: params.team_slug,
        owner: params.owner,
        repo: params.repo,
      });
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });
}

