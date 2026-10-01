import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PROJECTS_DIR } from '../../config/constants.js';
import { loadConfig, saveConfig } from '../../config/storage.js';
import { callGitHubAPI } from '../../utils/git.js';
import {
  CollaboratorInfo,
  GitHubPermission,
  SecurityLevelNumber,
  GovernanceQuorumRules,
  BranchProtectionStatus,
  GovernanceAuditLogEntry,
  SecurityVaultConfig,
  DynamicSecurityLevel,
  DEFAULT_DYNAMIC_SECURITY_LEVELS,
  normalizeDynamicSecurityLevel,
  DepartmentConfig,
  DEFAULT_DEPARTMENTS,
  SecretScanResult,
  SecretScanViolation,
} from './governance.types.js';
import {
  SECURITY_LEVELS,
  deriveLevelKey,
  decryptDocument,
  isEncryptedEnvelope,
  parseEncryptedEnvelope,
  buildEncryptedEnvelope,
  generateLevelCanary,
  verifyLevelCanary,
  createUserKeySlot,
  unlockUserKeySlot,
  scanContentForSecrets,
} from '../../utils/crypto.js';

// In-memory Ephemeral Token Store for Secure AI Context Pipe
interface EphemeralAIToken {
  token: string;
  user: string;
  level: SecurityLevelNumber;
  expiresAt: number;
  keys: Record<number, string>; // level -> base64 derived key
}

const ephemeralTokens = new Map<string, EphemeralAIToken>();

export class GovernanceService {
  private getRepoDir(repoName?: string): string {
    const cfg = loadConfig();
    const activeRepoName = repoName || cfg.active_repo?.name || 'local';
    return path.join(PROJECTS_DIR, activeRepoName);
  }

  private getProjectConfigPath(repoName?: string): string {
    const dir = this.getRepoDir(repoName);
    return path.join(dir, '.project.config.json');
  }

  private readProjectConfig(repoName?: string): any {
    const p = this.getProjectConfigPath(repoName);
    if (fs.existsSync(p)) {
      try {
        return JSON.parse(fs.readFileSync(p, 'utf-8'));
      } catch {}
    }
    return {};
  }

  private writeProjectConfig(repoName: string | undefined, data: any): void {
    const p = this.getProjectConfigPath(repoName);
    try {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.warn(`[GovernanceService] Falha ao salvar .project.config.json:`, err);
    }
  }

  public logAudit(repoName: string | undefined, entry: Omit<GovernanceAuditLogEntry, 'id' | 'timestamp'>): void {
    const pConfig = this.readProjectConfig(repoName);
    if (!Array.isArray(pConfig.governance_audit_logs)) {
      pConfig.governance_audit_logs = [];
    }
    const logItem: GovernanceAuditLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...entry,
    };
    pConfig.governance_audit_logs.unshift(logItem);
    // Keep last 100 entries
    if (pConfig.governance_audit_logs.length > 100) {
      pConfig.governance_audit_logs = pConfig.governance_audit_logs.slice(0, 100);
    }
    this.writeProjectConfig(repoName, pConfig);
  }

  private resolveRepoFullName(repoName?: string): string {
    const cfg = loadConfig();
    const activeRepo = cfg.active_repo;
    const targetRepoName = repoName || activeRepo?.name || 'local';
    const repoDir = this.getRepoDir(targetRepoName);

    // 1. Inspect git config origin url
    const gitConfigPath = path.join(repoDir, '.git', 'config');
    if (fs.existsSync(gitConfigPath)) {
      try {
        const configText = fs.readFileSync(gitConfigPath, 'utf-8');
        const match = configText.match(/github\.com[/:]([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+?)(\.git|\s|$)/);
        if (match && match[1]) {
          const fullName = match[1].replace(/\.git$/, '');
          if (!fullName.startsWith('local/')) {
            return fullName;
          }
        }
      } catch {}
    }

    // 2. If activeRepo.full_name is valid
    if (activeRepo?.full_name && !activeRepo.full_name.startsWith('local/')) {
      return activeRepo.full_name;
    }

    // 3. Fallback to user.login/repoName
    if (cfg.user?.login && targetRepoName !== 'local') {
      return `${cfg.user.login}/${targetRepoName}`;
    }

    return targetRepoName;
  }

  async getCollaborators(repoName?: string): Promise<{
    collaborators: CollaboratorInfo[];
    isSoloMode: boolean;
    activeCount: number;
    owner: string;
    resolvedFullName: string;
    githubAuthError?: string | null;
  }> {
    const cfg = loadConfig();
    const activeRepo = cfg.active_repo;
    const targetRepoName = repoName || activeRepo?.name || 'local';
    const pConfig = this.readProjectConfig(targetRepoName);
    const localMemberMeta = pConfig.governance_collaborators || {};

    let collaborators: CollaboratorInfo[] = [];
    const ownerLogin = activeRepo?.owner || cfg.user?.login || 'local-owner';
    const resolvedFullName = this.resolveRepoFullName(targetRepoName);
    let githubAuthError: string | null = null;

    const findLocalMeta = (username: string) => {
      const entry = Object.entries(localMemberMeta as Record<string, any>).find(
        ([k]) => k.toLowerCase() === username.toLowerCase()
      );
      return entry ? entry[1] : {};
    };

    // 1. Fetch remote GitHub collaborators if authenticated and valid remote repo
    if (cfg.token && resolvedFullName && !resolvedFullName.startsWith('local/')) {
      try {
        const ghRes = await callGitHubAPI(`/repos/${resolvedFullName}/collaborators?affiliation=all&per_page=100`, cfg.token);
        if (ghRes.statusCode === 200 && Array.isArray(ghRes.data)) {
          collaborators = ghRes.data.map((c: any) => {
            const login = c.login;
            const meta = findLocalMeta(login);
            let perm: GitHubPermission = 'push';
            if (c.permissions?.admin) perm = 'admin';
            else if (c.permissions?.maintain) perm = 'maintain';
            else if (c.permissions?.push) perm = 'push';
            else if (c.permissions?.triage) perm = 'triage';
            else if (c.permissions?.pull) perm = 'pull';

            const isOwner = login.toLowerCase() === ownerLogin.toLowerCase() || login.toLowerCase() === resolvedFullName.split('/')[0].toLowerCase();
            const secLevel: SecurityLevelNumber = meta.level !== undefined ? Number(meta.level) : (meta.security_level !== undefined ? Number(meta.security_level) : (isOwner ? 0 : 2));
            const secLevelId: string = meta.security_level_id || String(secLevel);
            const role = meta.role || meta.role_name || (isOwner ? 'Owner / Tech Lead' : 'Engenheiro / Revisor');
            const departments: string[] = Array.isArray(meta.departments) && meta.departments.length > 0 ? meta.departments : (isOwner ? ['*'] : ['engineering']);
            const allowedPaths: string[] = Array.isArray(meta.allowed_paths) && meta.allowed_paths.length > 0 ? meta.allowed_paths : (isOwner ? ['*'] : ['*']);

            return {
              login,
              id: c.id,
              avatar_url: c.avatar_url || `https://github.com/${login}.png`,
              html_url: c.html_url || `https://github.com/${login}`,
              permission: perm,
              role,
              role_name: role,
              security_level: secLevel,
              level: secLevel,
              security_level_id: secLevelId,
              departments,
              allowed_paths: allowedPaths,
              is_owner: isOwner,
              status: 'active',
            };
          });
        } else if (ghRes.statusCode === 401) {
          githubAuthError = 'Token do GitHub expirado ou inválido (401 Bad credentials).';
        } else if (ghRes.statusCode === 403 || ghRes.statusCode === 404) {
          githubAuthError = `Sem permissão de acesso ao repositório ${resolvedFullName} no GitHub (${ghRes.statusCode}).`;
        }

        // 2. Also fetch Pending Invitations
        try {
          const invRes = await callGitHubAPI(`/repos/${resolvedFullName}/invitations`, cfg.token);
          if (invRes.statusCode === 200 && Array.isArray(invRes.data)) {
            for (const inv of invRes.data) {
              const invitee = inv.invitee;
              if (invitee && invitee.login) {
                const existing = collaborators.find(c => c.login.toLowerCase() === invitee.login.toLowerCase());
                if (!existing) {
                  const meta = localMemberMeta[invitee.login] || {};
                  collaborators.push({
                    login: invitee.login,
                    id: invitee.id,
                    avatar_url: invitee.avatar_url || `https://github.com/${invitee.login}.png`,
                    html_url: invitee.html_url || `https://github.com/${invitee.login}`,
                    permission: (inv.permissions as GitHubPermission) || 'push',
                    role_name: meta.role_name || 'Convidado (Pendente)',
                    security_level: meta.security_level !== undefined ? meta.security_level : 2,
                    allowed_paths: Array.isArray(meta.allowed_paths) ? meta.allowed_paths : ['*'],
                    is_owner: false,
                    status: 'pending',
                    invited_at: inv.created_at,
                  });
                }
              }
            }
          }
        } catch {}
      } catch (err: any) {
        githubAuthError = err.message;
        console.warn('[GovernanceService] Aviso ao buscar colaboradores do GitHub:', err);
      }
    }

    // Fallback or Merge: If no collaborators fetched or local repository, use local user + stored collaborators
    if (collaborators.length === 0) {
      const userLogin = cfg.user?.login || 'local-developer';
      const isOwner = true;
      const ownerMeta = findLocalMeta(userLogin);
      const ownerLevel = ownerMeta.level !== undefined ? Number(ownerMeta.level) : (ownerMeta.security_level !== undefined ? Number(ownerMeta.security_level) : 0);
      const ownerRole = ownerMeta.role || ownerMeta.role_name || 'Owner / Tech Lead';
      const ownerDepts = Array.isArray(ownerMeta.departments) && ownerMeta.departments.length > 0 ? ownerMeta.departments : ['*'];
      const ownerPaths = Array.isArray(ownerMeta.allowed_paths) && ownerMeta.allowed_paths.length > 0 ? ownerMeta.allowed_paths : ['*'];
      collaborators.push({
        login: userLogin,
        id: 1,
        avatar_url: cfg.user?.avatar_url || `https://github.com/${userLogin}.png`,
        html_url: cfg.user?.html_url || `https://github.com/${userLogin}`,
        permission: 'admin',
        role: ownerRole,
        role_name: ownerRole,
        security_level: ownerLevel,
        level: ownerLevel,
        security_level_id: String(ownerLevel),
        departments: ownerDepts,
        allowed_paths: ownerPaths,
        is_owner: isOwner,
        status: 'active',
      });
    }

    // Merge any stored members in .project.config.json that might not be in the remote list
    for (const [login, meta] of Object.entries(localMemberMeta as Record<string, any>)) {
      const existing = collaborators.find(c => c.login.toLowerCase() === login.toLowerCase());
      if (!existing) {
        const secLevel = meta.level !== undefined ? Number(meta.level) : (meta.security_level !== undefined ? Number(meta.security_level) : 2);
        const secLevelId = meta.security_level_id || String(secLevel);
        const memberRole = meta.role || meta.role_name || 'Colaborador';
        const memberDepts = Array.isArray(meta.departments) && meta.departments.length > 0 ? meta.departments : ['engineering'];
        const memberPaths = Array.isArray(meta.allowed_paths) && meta.allowed_paths.length > 0 ? meta.allowed_paths : ['*'];
        collaborators.push({
          login,
          id: Math.floor(Math.random() * 1000000),
          avatar_url: `https://github.com/${login}.png`,
          html_url: `https://github.com/${login}`,
          permission: (meta.permission as GitHubPermission) || 'push',
          role: memberRole,
          role_name: memberRole,
          security_level: secLevel,
          level: secLevel,
          security_level_id: secLevelId,
          departments: memberDepts,
          allowed_paths: memberPaths,
          is_owner: false,
          status: meta.status || 'active',
        });
      }
    }

    const activeCount = collaborators.filter((c) => c.status === 'active').length;
    const isSoloMode = activeCount <= 1;

    return {
      collaborators,
      isSoloMode,
      activeCount,
      owner: ownerLogin,
      resolvedFullName,
      githubAuthError,
    };
  }

  async inviteCollaborator(payload: {
    repo?: string;
    username: string;
    permission: GitHubPermission;
    security_level?: SecurityLevelNumber;
    level?: SecurityLevelNumber;
    role?: string;
    role_name?: string;
    departments?: string[];
    allowed_paths?: string[];
  }): Promise<{ success: boolean; message: string; collaborator: CollaboratorInfo }> {
    const cfg = loadConfig();
    const targetRepoName = payload.repo || cfg.active_repo?.name || 'local';
    const cleanUsername = payload.username.trim().replace(/^@/, '');

    if (!cleanUsername) {
      throw new Error('Nome de usuário do GitHub é obrigatório para convite.');
    }

    const permission = payload.permission || 'push';
    const secLevel = payload.level !== undefined ? Number(payload.level) : (payload.security_level !== undefined ? Number(payload.security_level) : 2);
    const roleName = payload.role || payload.role_name || (permission === 'admin' ? 'Co-Admin' : 'Engenheiro / Revisor');
    const departments = Array.isArray(payload.departments) && payload.departments.length > 0 ? payload.departments : ['engineering'];
    const allowedPaths = Array.isArray(payload.allowed_paths) && payload.allowed_paths.length > 0 ? payload.allowed_paths : ['*'];
    const resolvedFullName = this.resolveRepoFullName(targetRepoName);

    // 1. If remote GitHub repo, send invite via GitHub API
    if (cfg.token && resolvedFullName && !resolvedFullName.startsWith('local/')) {
      try {
        const res = await callGitHubAPI(
          `/repos/${resolvedFullName}/collaborators/${cleanUsername}`,
          cfg.token,
          'PUT',
          { permission }
        );
        if (res.statusCode >= 400 && res.statusCode !== 422) {
          throw new Error(res.data?.message || 'Falha ao convidar usuário no GitHub.');
        }
      } catch (err: any) {
        throw new Error(`Erro ao enviar convite via API do GitHub: ${err.message}`);
      }
    }

    // 2. Persist local metadata in .project.config.json
    const pConfig = this.readProjectConfig(targetRepoName);
    if (!pConfig.governance_collaborators) pConfig.governance_collaborators = {};
    pConfig.governance_collaborators[cleanUsername] = {
      permission,
      security_level: secLevel,
      level: secLevel,
      security_level_id: String(secLevel),
      role: roleName,
      role_name: roleName,
      departments,
      allowed_paths: allowedPaths,
      invited_at: new Date().toISOString(),
      status: 'active',
    };
    this.writeProjectConfig(targetRepoName, pConfig);

    const actor = cfg.user?.login ? `@${cfg.user.login}` : 'Tech Lead';
    this.logAudit(targetRepoName, {
      action: 'COLLABORATOR_INVITED',
      actor,
      target: `@${cleanUsername}`,
      details: `Convidado com permissão Git '${permission}', cargo '${roleName}', Level ${secLevel} e rotas: [${allowedPaths.join(', ')}].`,
    });

    const colInfo: CollaboratorInfo = {
      login: cleanUsername,
      id: Date.now(),
      avatar_url: `https://github.com/${cleanUsername}.png`,
      html_url: `https://github.com/${cleanUsername}`,
      permission,
      role: roleName,
      role_name: roleName,
      security_level: secLevel,
      level: secLevel,
      security_level_id: String(secLevel),
      departments,
      allowed_paths: allowedPaths,
      is_owner: false,
      status: 'active',
    };

    return {
      success: true,
      message: `Convite enviado com sucesso para @${cleanUsername} com cargo '${roleName}', permissão '${permission}' e Level ${secLevel}!`,
      collaborator: colInfo,
    };
  }

  async removeCollaborator(payload: { repo?: string; username: string }): Promise<{ success: boolean; message: string }> {
    const cfg = loadConfig();
    const targetRepoName = payload.repo || cfg.active_repo?.name || 'local';
    const cleanUsername = payload.username.trim().replace(/^@/, '');
    const resolvedFullName = this.resolveRepoFullName(targetRepoName);

    if (cfg.token && resolvedFullName && !resolvedFullName.startsWith('local/')) {
      try {
        await callGitHubAPI(
          `/repos/${resolvedFullName}/collaborators/${cleanUsername}`,
          cfg.token,
          'DELETE'
        );
      } catch (err: any) {
        console.warn(`[GovernanceService] Aviso ao remover colaborador no GitHub:`, err);
      }
    }

    const pConfig = this.readProjectConfig(targetRepoName);
    if (pConfig.governance_collaborators && pConfig.governance_collaborators[cleanUsername]) {
      delete pConfig.governance_collaborators[cleanUsername];
      this.writeProjectConfig(targetRepoName, pConfig);
    }

    const actor = cfg.user?.login ? `@${cfg.user.login}` : 'Tech Lead';
    this.logAudit(targetRepoName, {
      action: 'COLLABORATOR_REMOVED',
      actor,
      target: `@${cleanUsername}`,
      details: `Colaborador removido da governança e do repositório.`,
    });

    return {
      success: true,
      message: `Colaborador @${cleanUsername} removido com sucesso.`,
    };
  }

  async updateCollaboratorClearance(payload: {
    repo?: string;
    username: string;
    security_level?: SecurityLevelNumber;
    level?: SecurityLevelNumber;
    security_level_id?: string;
    role?: string;
    role_name?: string;
    permission?: GitHubPermission;
    departments?: string[];
    allowed_paths?: string[];
  }): Promise<{ success: boolean; message: string }> {
    const cleanUsername = payload.username.trim().replace(/^@/, '');
    const targetRepoName = payload.repo || 'local';
    const cfg = loadConfig();
    const pConfig = this.readProjectConfig(targetRepoName);
    if (!pConfig.governance_collaborators) pConfig.governance_collaborators = {};

    const existingKey = Object.keys(pConfig.governance_collaborators).find(
      (k) => k.toLowerCase() === cleanUsername.toLowerCase()
    ) || cleanUsername;

    const currentData = pConfig.governance_collaborators[existingKey] || {};

    // Sincroniza permissão no GitHub se fornecida e diferente da atual
    if (payload.permission && payload.permission !== currentData.permission) {
      const resolvedFullName = this.resolveRepoFullName(targetRepoName);
      if (cfg.token && resolvedFullName && !resolvedFullName.startsWith('local/')) {
        try {
          await callGitHubAPI(
            `/repos/${resolvedFullName}/collaborators/${cleanUsername}`,
            cfg.token,
            'PUT',
            { permission: payload.permission }
          );
        } catch (err: any) {
          console.warn(`[GovernanceService] Aviso ao atualizar permissão no GitHub para @${cleanUsername}:`, err);
        }
      }
    }

    const rankNum = payload.level !== undefined ? Number(payload.level) : (payload.security_level !== undefined ? Number(payload.security_level) : (currentData.level ?? currentData.security_level ?? 2));
    const secLevelId = payload.security_level_id || String(rankNum);
    const role = payload.role || payload.role_name || currentData.role || currentData.role_name;
    const permission = payload.permission || currentData.permission || 'push';
    const allowedPaths = Array.isArray(payload.allowed_paths) ? payload.allowed_paths : currentData.allowed_paths;

    pConfig.governance_collaborators[existingKey] = {
      ...currentData,
      permission,
      security_level: rankNum,
      level: rankNum,
      security_level_id: secLevelId,
      ...(role ? { role, role_name: role } : {}),
      ...(Array.isArray(payload.departments) ? { departments: payload.departments } : {}),
      ...(Array.isArray(allowedPaths) ? { allowed_paths: allowedPaths } : {}),
    };
    this.writeProjectConfig(targetRepoName, pConfig);

    const actor = cfg.user?.login ? `@${cfg.user.login}` : 'Tech Lead';
    this.logAudit(targetRepoName, {
      action: 'KEY_ROTATED',
      actor,
      target: `@${cleanUsername}`,
      details: `Perfil de acesso de @${cleanUsername} atualizado: Level ${rankNum}${role ? `, Cargo '${role}'` : ''}, Permissão '${permission}'${allowedPaths ? `, Rotas: [${allowedPaths.join(', ')}]` : ''}.`,
    });

    return {
      success: true,
      message: `Perfil de segurança de @${cleanUsername} atualizado com sucesso.`,
    };
  }

  /**
   * Sincroniza automaticamente as rotas permitidas dos colaboradores quando uma pasta é renomeada
   */
  handleFolderRename(oldFolderPath: string, newFolderPath: string, repoName?: string): void {
    const targetRepoName = repoName || 'local';
    const pConfig = this.readProjectConfig(targetRepoName);
    if (!pConfig.governance_collaborators) return;

    const cleanOld = oldFolderPath.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase();
    const cleanNew = newFolderPath.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');

    let modified = false;
    for (const [, meta] of Object.entries(pConfig.governance_collaborators as Record<string, any>)) {
      if (Array.isArray(meta.allowed_paths)) {
        const updatedPaths = meta.allowed_paths.map((p: string) => {
          const cleanP = p.replace(/\\/g, '/').replace(/^\/+/, '');
          const cleanPLower = cleanP.toLowerCase();
          if (cleanPLower === cleanOld) {
            modified = true;
            return cleanNew;
          }
          if (cleanPLower === `${cleanOld}/**` || cleanPLower === `${cleanOld}/*`) {
            modified = true;
            return `${cleanNew}/**`;
          }
          if (cleanPLower.startsWith(`${cleanOld}/`)) {
            modified = true;
            return cleanNew + cleanP.slice(cleanOld.length);
          }
          return p;
        });

        if (modified) {
          meta.allowed_paths = updatedPaths;
        }
      }
    }

    if (modified) {
      this.writeProjectConfig(targetRepoName, pConfig);
      this.logAudit(targetRepoName, {
        action: 'QUORUM_UPDATED',
        actor: 'System',
        details: `Rotas de acesso dos colaboradores atualizadas após renomeio de '${oldFolderPath}' para '${newFolderPath}'.`,
      });
    }
  }

  async getDepartments(repoName?: string): Promise<DepartmentConfig[]> {
    const targetRepoName = repoName || 'local';
    const pConfig = this.readProjectConfig(targetRepoName);
    return Array.isArray(pConfig.departments) && pConfig.departments.length > 0
      ? pConfig.departments
      : DEFAULT_DEPARTMENTS;
  }

  async saveDepartments(
    departments: DepartmentConfig[],
    repoName?: string
  ): Promise<{ success: boolean; departments: DepartmentConfig[] }> {
    const targetRepoName = repoName || 'local';
    const pConfig = this.readProjectConfig(targetRepoName);
    pConfig.departments = departments;
    this.writeProjectConfig(targetRepoName, pConfig);

    const cfg = loadConfig();
    const actor = cfg.user?.login ? `@${cfg.user.login}` : 'Tech Lead';
    this.logAudit(targetRepoName, {
      action: 'LEVEL_UPDATED',
      actor,
      details: `Departamentos da governança atualizados (${departments.length} departamentos configurados).`,
    });

    return {
      success: true,
      departments,
    };
  }

  async getBranchProtection(repoName?: string): Promise<BranchProtectionStatus> {
    const cfg = loadConfig();
    const activeRepo = cfg.active_repo;
    const targetRepoName = repoName || activeRepo?.name || 'local';
    const defaultBranch = activeRepo?.default_branch || 'main';

    if (cfg.authenticated && cfg.token && activeRepo?.full_name && !activeRepo?.is_local && activeRepo?.name === targetRepoName) {
      try {
        const ghRes = await callGitHubAPI(
          `/repos/${activeRepo.full_name}/branches/${defaultBranch}/protection`,
          cfg.token
        );
        if (ghRes.statusCode === 200 && ghRes.data) {
          const d = ghRes.data;
          return {
            enabled: true,
            required_approving_review_count: d.required_pull_request_reviews?.required_approving_review_count || 1,
            dismiss_stale_reviews: d.required_pull_request_reviews?.dismiss_stale_reviews || false,
            require_code_owner_reviews: d.required_pull_request_reviews?.require_code_owner_reviews || false,
            enforce_admins: d.enforce_admins?.enabled || false,
            allow_force_pushes: d.allow_force_pushes?.enabled || false,
            allow_deletions: d.allow_deletions?.enabled || false,
          };
        }
      } catch {}
    }

    // Return stored local rules or default disabled
    const pConfig = this.readProjectConfig(targetRepoName);
    const localProt = pConfig.governance_branch_protection;
    if (localProt) {
      return localProt;
    }

    return {
      enabled: false,
      required_approving_review_count: 1,
      dismiss_stale_reviews: true,
      require_code_owner_reviews: false,
      enforce_admins: true,
      allow_force_pushes: false,
      allow_deletions: false,
    };
  }

  async applyBranchProtection(payload: {
    repo?: string;
    min_approvals?: number;
    enforce_admins?: boolean;
    dismiss_stale_reviews?: boolean;
  }): Promise<{ success: boolean; message: string; protection: BranchProtectionStatus }> {
    const cfg = loadConfig();
    const activeRepo = cfg.active_repo;
    const targetRepoName = payload.repo || activeRepo?.name || 'local';
    const defaultBranch = activeRepo?.default_branch || 'main';
    const minApprovals = payload.min_approvals || 1;

    const protectionPayload = {
      required_status_checks: null,
      enforce_admins: payload.enforce_admins !== false,
      required_pull_request_reviews: {
        dismiss_stale_reviews: payload.dismiss_stale_reviews !== false,
        require_code_owner_reviews: false,
        required_approving_review_count: minApprovals,
      },
      restrictions: null,
      allow_force_pushes: false,
      allow_deletions: false,
    };

    if (cfg.authenticated && cfg.token && activeRepo?.full_name && !activeRepo?.is_local && activeRepo?.name === targetRepoName) {
      try {
        const ghRes = await callGitHubAPI(
          `/repos/${activeRepo.full_name}/branches/${defaultBranch}/protection`,
          cfg.token,
          'PUT',
          protectionPayload
        );
        if (ghRes.statusCode >= 400) {
          throw new Error(ghRes.data?.message || 'Falha ao aplicar branch protection no GitHub.');
        }
      } catch (err: any) {
        console.warn('[GovernanceService] Erro ao aplicar regra de branch protection no GitHub:', err);
      }
    }

    const protectionStatus: BranchProtectionStatus = {
      enabled: true,
      required_approving_review_count: minApprovals,
      dismiss_stale_reviews: payload.dismiss_stale_reviews !== false,
      require_code_owner_reviews: false,
      enforce_admins: payload.enforce_admins !== false,
      allow_force_pushes: false,
      allow_deletions: false,
    };

    const pConfig = this.readProjectConfig(targetRepoName);
    pConfig.governance_branch_protection = protectionStatus;
    this.writeProjectConfig(targetRepoName, pConfig);

    const actor = cfg.user?.login ? `@${cfg.user.login}` : 'Tech Lead';
    this.logAudit(targetRepoName, {
      action: 'BRANCH_PROTECTED',
      actor,
      target: `branch '${defaultBranch}'`,
      details: `Regras de proteção ativadas: ${minApprovals} aprovações exigidas, push direto bloqueado e revisões obsoletas dispensadas no push.`,
    });

    return {
      success: true,
      message: `Branch '${defaultBranch}' protegida com sucesso! Push direto bloqueado e ${minApprovals} aprovações requeridas.`,
      protection: protectionStatus,
    };
  }

  async getQuorumRules(repoName?: string): Promise<{
    rules: GovernanceQuorumRules;
    isSoloMode: boolean;
    activeCollaboratorsCount: number;
    effectiveMinApprovals: number;
  }> {
    const targetRepoName = repoName || 'local';
    const pConfig = this.readProjectConfig(targetRepoName);
    const storedRules = pConfig.governance_rules || {};

    const collabsData = await this.getCollaborators(targetRepoName);
    const activeCount = collabsData.activeCount;
    const isSoloMode = activeCount <= 1;

    const defaultMin = Number(storedRules.min_approvals_default) || 1;
    const effectiveMinApprovals = isSoloMode ? 1 : Math.max(1, defaultMin);

    const rules: GovernanceQuorumRules = {
      mode: storedRules.mode || 'auto',
      min_approvals_default: defaultMin,
      anti_self_approval: storedRules.anti_self_approval !== undefined ? storedRules.anti_self_approval : !isSoloMode,
      require_review_before_merge: storedRules.require_review_before_merge !== false,
      dismiss_stale_reviews_on_push: storedRules.dismiss_stale_reviews_on_push !== false,
      enforce_admins_on_branch: storedRules.enforce_admins_on_branch !== false,
    };

    return {
      rules,
      isSoloMode,
      activeCollaboratorsCount: activeCount,
      effectiveMinApprovals,
    };
  }

  async updateQuorumRules(payload: {
    repo?: string;
    rules: Partial<GovernanceQuorumRules>;
  }): Promise<{ success: boolean; rules: GovernanceQuorumRules }> {
    const targetRepoName = payload.repo || 'local';
    const pConfig = this.readProjectConfig(targetRepoName);
    if (!pConfig.governance_rules) pConfig.governance_rules = {};

    pConfig.governance_rules = {
      ...pConfig.governance_rules,
      ...payload.rules,
    };

    this.writeProjectConfig(targetRepoName, pConfig);

    const cfg = loadConfig();
    const actor = cfg.user?.login ? `@${cfg.user.login}` : 'Tech Lead';
    this.logAudit(targetRepoName, {
      action: 'QUORUM_UPDATED',
      actor,
      details: `Regras de quórum atualizadas: Mínimo padrão de ${pConfig.governance_rules.min_approvals_default} aprovações.`,
    });

    const res = await this.getQuorumRules(targetRepoName);
    return {
      success: true,
      rules: res.rules,
    };
  }

  private getAllMarkdownFiles(dir: string, baseDir = dir): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') && entry.name !== '.translations') {
          if (entry.name === '.git' || entry.name === '.context' || entry.name === 'node_modules') continue;
        }
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules' && entry.name !== '.git') {
            results.push(...this.getAllMarkdownFiles(full, baseDir));
          }
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          results.push(path.relative(baseDir, full));
        }
      }
    } catch {}
    return results;
  }

  async getSecurityLevels(repoName?: string): Promise<DynamicSecurityLevel[]> {
    const vault = await this.getSecurityVault(repoName);
    return vault.levels || DEFAULT_DYNAMIC_SECURITY_LEVELS;
  }

  async saveSecurityLevels(
    levels: DynamicSecurityLevel[],
    repoName?: string
  ): Promise<{ success: boolean; levels: DynamicSecurityLevel[] }> {
    const targetRepoName = repoName || 'local';
    const pConfig = this.readProjectConfig(targetRepoName);
    const vault = await this.getSecurityVault(targetRepoName);
    const salt = vault.salt || crypto.randomBytes(16).toString('hex');

    // Ensure proper rank ordering and default values
    const cleanLevels: DynamicSecurityLevel[] = levels.map((l, idx) => {
      const lvlNum = typeof l.level === 'number' ? l.level : (typeof l.rank === 'number' ? l.rank : idx);
      return {
        id: l.id || String(lvlNum),
        level: lvlNum,
        rank: lvlNum,
        name: l.name || `Level ${lvlNum}`,
        color: l.color || '#3b82f6',
        description: l.description || '',
        updated_at: new Date().toISOString(),
      };
    }).sort((a, b) => a.rank - b.rank);

    // Ensure canary probes exist for non-public levels
    if (!vault.canaries) vault.canaries = {};
    for (const lvl of cleanLevels) {
      if (lvl.rank !== 999 && !vault.canaries[lvl.id]) {
        const defaultKey = deriveLevelKey(`default-key-${lvl.id}`, salt);
        vault.canaries[lvl.id] = generateLevelCanary(lvl.id, defaultKey);
      }
    }

    vault.levels = cleanLevels;
    pConfig.security_levels = cleanLevels;
    pConfig.governance_security_vault = vault;
    this.writeProjectConfig(targetRepoName, pConfig);

    const cfg = loadConfig();
    const actor = cfg.user?.login ? `@${cfg.user.login}` : 'Tech Lead';
    this.logAudit(targetRepoName, {
      action: 'LEVEL_UPDATED',
      actor,
      details: `Níveis de segurança do projeto atualizados (${cleanLevels.length} níveis configurados).`,
    });

    return {
      success: true,
      levels: cleanLevels,
    };
  }

  async migrateDocumentSecurityLevels(payload: {
    oldLevelId: string;
    oldRank?: number;
    newLevelId: string;
    newRank?: number;
    repo?: string;
  }): Promise<{ success: boolean; migratedCount: number; files: string[] }> {
    const targetRepoName = payload.repo || 'local';
    const repoDir = this.getRepoDir(targetRepoName);
    const mdFiles = this.getAllMarkdownFiles(repoDir);
    const migratedFiles: string[] = [];

    for (const relPath of mdFiles) {
      const fullPath = path.join(repoDir, relPath);
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        if (isEncryptedEnvelope(content)) {
          const parsed = parseEncryptedEnvelope(content);
          if (
            parsed.header &&
            (parsed.header.security_level_id === payload.oldLevelId ||
              (payload.oldRank !== undefined && parsed.header.security_level === payload.oldRank))
          ) {
            const updatedHeader = {
              ...parsed.header,
              security_level: payload.newRank !== undefined ? payload.newRank : parsed.header.security_level,
              security_level_id: payload.newLevelId || parsed.header.security_level_id,
              updated_at: new Date().toISOString(),
            };
            if (parsed.payloadData) {
              const newEnv = buildEncryptedEnvelope(updatedHeader, {
                iv: parsed.payloadData.iv,
                authTag: parsed.payloadData.authTag,
                ciphertext: parsed.payloadData.payload,
              });
              fs.writeFileSync(fullPath, newEnv, 'utf-8');
              migratedFiles.push(relPath);
            }
          }
        } else {
          // Plain Markdown frontmatter
          const frontmatterMatch = content.match(/^---\s*[\r\n]+([\s\S]*?)[\r\n]+---/);
          if (frontmatterMatch) {
            const rawFm = frontmatterMatch[1];
            let matched = false;
            const newFmLines: string[] = [];
            for (const line of rawFm.split('\n')) {
              const parts = line.split(':');
              if (parts.length >= 2) {
                const key = parts[0].trim();
                const val = parts.slice(1).join(':').trim().replace(/^["']|["']$/g, '');
                if (
                  (key === 'security_level_id' && val === payload.oldLevelId) ||
                  (key === 'security_level' && payload.oldRank !== undefined && Number(val) === payload.oldRank)
                ) {
                  matched = true;
                  if (key === 'security_level_id') {
                    newFmLines.push(`security_level_id: "${payload.newLevelId}"`);
                  } else if (key === 'security_level') {
                    newFmLines.push(`security_level: ${payload.newRank ?? val}`);
                  }
                } else {
                  newFmLines.push(line);
                }
              } else {
                newFmLines.push(line);
              }
            }
            if (matched) {
              const updatedContent = `---\n${newFmLines.join('\n')}\n---` + content.slice(frontmatterMatch[0].length);
              fs.writeFileSync(fullPath, updatedContent, 'utf-8');
              migratedFiles.push(relPath);
            }
          }
        }
      } catch (err) {
        console.warn(`[GovernanceService] Erro ao migrar arquivo ${relPath}:`, err);
      }
    }

    // Update collaborators as well
    const pConfig = this.readProjectConfig(targetRepoName);
    if (pConfig.governance_collaborators) {
      let collabUpdated = false;
      for (const [, meta] of Object.entries(pConfig.governance_collaborators as Record<string, any>)) {
        if (
          meta.security_level_id === payload.oldLevelId ||
          (payload.oldRank !== undefined && meta.security_level === payload.oldRank)
        ) {
          if (payload.newRank !== undefined) meta.security_level = payload.newRank;
          if (payload.newLevelId) meta.security_level_id = payload.newLevelId;
          collabUpdated = true;
        }
      }
      if (collabUpdated) {
        this.writeProjectConfig(targetRepoName, pConfig);
      }
    }

    const cfg = loadConfig();
    const actor = cfg.user?.login ? `@${cfg.user.login}` : 'Tech Lead';
    this.logAudit(targetRepoName, {
      action: 'DOCUMENTS_MIGRATED',
      actor,
      details: `Migração em lote de ${migratedFiles.length} documento(s) do nível '${payload.oldLevelId}' para '${payload.newLevelId}'.`,
    });

    return {
      success: true,
      migratedCount: migratedFiles.length,
      files: migratedFiles,
    };
  }

  async unlockUserVault(payload: {
    user: string;
    passphrase: string;
    levelId?: string;
    repo?: string;
  }): Promise<{
    success: boolean;
    error?: string;
    unlockedLevels: string[];
    authorizedRanks: number[];
  }> {
    const cleanPass = (payload.passphrase || '').trim();
    if (!cleanPass) {
      return { success: false, error: 'A senha/passphrase não pode ser vazia.', unlockedLevels: [], authorizedRanks: [] };
    }

    const targetRepoName = payload.repo || 'local';
    const vault = await this.getSecurityVault(targetRepoName);
    const salt = vault.salt || 'context-os-default-salt';
    const levels = vault.levels || DEFAULT_DYNAMIC_SECURITY_LEVELS;

    const unlockedLevelIds: string[] = [];
    const authorizedRanks: number[] = [];

    // Check 1: User Slot check if exists for this user
    const userSlots = vault.user_slots?.[payload.user];
    if (userSlots) {
      for (const [lvlId, slot] of Object.entries(userSlots)) {
        const res = unlockUserKeySlot(payload.user, cleanPass, slot, salt);
        if (res.success && res.dek) {
          const canary = vault.canaries?.[lvlId];
          if (!canary || verifyLevelCanary(res.dek, canary)) {
            unlockedLevelIds.push(lvlId);
            const lvlObj = levels.find((l) => l.id === lvlId);
            if (lvlObj) authorizedRanks.push(lvlObj.rank);
          }
        }
      }
    }

    // Check 2: Direct derivation test against canary probes
    for (const lvl of levels) {
      if (lvl.rank === 999) continue;
      const directKey = deriveLevelKey(cleanPass, `${salt}:${lvl.id}`);
      const fallbackKey = deriveLevelKey(cleanPass, salt);
      const canary = vault.canaries?.[lvl.id];

      if (canary) {
        const dummyKey = deriveLevelKey(`default-key-${lvl.id}`, salt);
        const isDummyPlaceholder = verifyLevelCanary(dummyKey, canary);

        if (isDummyPlaceholder) {
          // Level has not had a custom password configured yet -> auto-provision with this password
          await this.setUserPassphrase({
            user: payload.user,
            passphrase: cleanPass,
            levelId: lvl.id,
            repo: targetRepoName,
          });
          unlockedLevelIds.push(lvl.id);
          authorizedRanks.push(lvl.rank);
        } else if (verifyLevelCanary(directKey, canary) || verifyLevelCanary(fallbackKey, canary)) {
          if (!unlockedLevelIds.includes(lvl.id)) {
            unlockedLevelIds.push(lvl.id);
            authorizedRanks.push(lvl.rank);
          }
        }
      } else {
        // Canary does not exist yet -> initialize this level's passphrase
        if (payload.levelId === lvl.id || !payload.levelId) {
          await this.setUserPassphrase({
            user: payload.user,
            passphrase: cleanPass,
            levelId: lvl.id,
            repo: targetRepoName,
          });
          unlockedLevelIds.push(lvl.id);
          authorizedRanks.push(lvl.rank);
        }
      }
    }

    if (payload.levelId && !unlockedLevelIds.includes(payload.levelId)) {
      return {
        success: false,
        error: 'Senha incorreta para o nível de segurança especificado. A validação criptográfica Canary falhou.',
        unlockedLevels: [],
        authorizedRanks: [],
      };
    }

    if (unlockedLevelIds.length === 0) {
      return {
        success: false,
        error: 'Senha incorreta. Não foi possível validar o acesso a nenhum nível de segurança.',
        unlockedLevels: [],
        authorizedRanks: [],
      };
    }

    // Apply Reverse Hierarchy: Lower rank unlocks all higher rank numbers (e.g. Rank 0 unlocks Rank 1, 2, 3)
    const minRank = Math.min(...authorizedRanks);
    for (const lvl of levels) {
      if (lvl.rank >= minRank && !unlockedLevelIds.includes(lvl.id)) {
        unlockedLevelIds.push(lvl.id);
        authorizedRanks.push(lvl.rank);
      }
    }

    return {
      success: true,
      unlockedLevels: unlockedLevelIds,
      authorizedRanks: Array.from(new Set(authorizedRanks)).sort((a, b) => a - b),
    };
  }

  async setUserPassphrase(payload: {
    user: string;
    passphrase: string;
    levelId: string;
    repo?: string;
  }): Promise<{ success: boolean; message: string }> {
    const cleanPass = (payload.passphrase || '').trim();
    if (!cleanPass) {
      throw new Error('A senha não pode ser vazia.');
    }

    const targetRepoName = payload.repo || 'local';
    const pConfig = this.readProjectConfig(targetRepoName);
    const vault = await this.getSecurityVault(targetRepoName);
    const salt = vault.salt || crypto.randomBytes(16).toString('hex');

    const levelKey = deriveLevelKey(cleanPass, `${salt}:${payload.levelId}`);
    
    // Generate Canary Probe
    const canary = generateLevelCanary(payload.levelId, levelKey);
    if (!vault.canaries) vault.canaries = {};
    vault.canaries[payload.levelId] = canary;

    // Create User Key Slot
    const slot = createUserKeySlot(payload.user, cleanPass, payload.levelId, levelKey, salt);
    if (!vault.user_slots) vault.user_slots = {};
    if (!vault.user_slots[payload.user]) vault.user_slots[payload.user] = {};
    vault.user_slots[payload.user][payload.levelId] = slot;

    pConfig.governance_security_vault = vault;
    this.writeProjectConfig(targetRepoName, pConfig);

    const cfg = loadConfig();
    const actor = cfg.user?.login ? `@${cfg.user.login}` : 'Tech Lead';
    this.logAudit(targetRepoName, {
      action: 'KEY_ROTATED',
      actor,
      target: `@${payload.user}`,
      details: `Senha/slot do usuário atualizada com sucesso para o nível '${payload.levelId}'.`,
    });

    return {
      success: true,
      message: `Senha configurada com sucesso para o nível '${payload.levelId}'.`,
    };
  }

  async scanRepositorySecrets(repoName?: string): Promise<SecretScanResult> {
    const targetRepoName = repoName || 'local';
    const repoDir = this.getRepoDir(targetRepoName);
    const allMdFiles = this.getAllMarkdownFiles(repoDir);
    const violations: SecretScanViolation[] = [];

    for (const relPath of allMdFiles) {
      const fullPath = path.join(repoDir, relPath);
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const scan = scanContentForSecrets(content, relPath);
        if (scan.hasSecrets) {
          violations.push(...scan.violations);
        }
      } catch {}
    }

    return {
      hasSecrets: violations.length > 0,
      violations,
    };
  }

  async getSecurityVault(repoName?: string): Promise<SecurityVaultConfig> {
    const targetRepoName = repoName || 'local';
    const pConfig = this.readProjectConfig(targetRepoName);

    let rawLevels: any[] = [];
    if (Array.isArray(pConfig.security_levels) && pConfig.security_levels.length > 0) {
      rawLevels = [...pConfig.security_levels];
    } else if (Array.isArray(pConfig.governance_security_vault?.levels) && pConfig.governance_security_vault.levels.length > 0) {
      rawLevels = [...pConfig.governance_security_vault.levels];
    } else {
      rawLevels = [...DEFAULT_DYNAMIC_SECURITY_LEVELS];
    }

    const seenIds = new Set<string>();
    let levels: DynamicSecurityLevel[] = rawLevels
      .map((l, idx) => normalizeDynamicSecurityLevel(l, idx))
      .filter((l) => {
        if (seenIds.has(l.id)) return false;
        seenIds.add(l.id);
        return true;
      });

    if (!levels.some((l) => l.rank === 999 || l.id === 'public')) {
      levels.push({
        id: 'public',
        level: 999,
        rank: 999,
        name: 'Público / Geral',
        color: '#10b981',
        description: 'Texto plano sem criptografia, acessível para todos os membros',
      });
    }
    levels.sort((a, b) => a.rank - b.rank);

    const salt = pConfig.governance_security_vault?.salt || crypto.randomBytes(16).toString('hex');
    const canaries = pConfig.governance_security_vault?.canaries || {};
    const userSlots = pConfig.governance_security_vault?.user_slots || {};

    // Clean any legacy dummy placeholder canaries
    for (const lvl of levels) {
      if (canaries[lvl.id]) {
        const dummyKey = deriveLevelKey(`default-key-${lvl.id}`, salt);
        if (verifyLevelCanary(dummyKey, canaries[lvl.id])) {
          delete canaries[lvl.id];
        }
      }
    }

    const vaultConfig: SecurityVaultConfig = {
      salt,
      levels,
      canaries,
      user_slots: userSlots,
      ai_privacy_policy: pConfig.governance_security_vault?.ai_privacy_policy || {
        allow_external_ai_for_level_0: false,
        allow_external_ai_for_level_1: true,
        allow_local_ai_only: false,
      },
    };

    pConfig.governance_security_vault = vaultConfig;
    pConfig.security_levels = levels;
    this.writeProjectConfig(targetRepoName, pConfig);

    return vaultConfig;
  }

  async updateSecurityVault(payload: {
    repo?: string;
    vault: Partial<SecurityVaultConfig>;
  }): Promise<{ success: boolean; vault: SecurityVaultConfig }> {
    const targetRepoName = payload.repo || 'local';
    const pConfig = this.readProjectConfig(targetRepoName);
    pConfig.governance_security_vault = {
      ...(pConfig.governance_security_vault || {}),
      ...payload.vault,
    };
    this.writeProjectConfig(targetRepoName, pConfig);

    const cfg = loadConfig();
    const actor = cfg.user?.login ? `@${cfg.user.login}` : 'Tech Lead';
    this.logAudit(targetRepoName, {
      action: 'KEY_ROTATED',
      actor,
      details: 'Parâmetros do Cofre de Segurança e Políticas de Privacidade de IA atualizados.',
    });

    return {
      success: true,
      vault: pConfig.governance_security_vault,
    };
  }

  async getAuditLogs(repoName?: string): Promise<GovernanceAuditLogEntry[]> {
    const targetRepoName = repoName || 'local';
    const pConfig = this.readProjectConfig(targetRepoName);
    return pConfig.governance_audit_logs || [];
  }

  // --- AI SECURE CONTEXT PIPE & EPHEMERAL TOKENS ---

  /**
   * Creates an ephemeral secure token for AI tools/agents to query decrypted context.
   */
  createSecureAIToken(payload: {
    user: string;
    level: SecurityLevelNumber;
    passphrases: Record<number, string>;
    repo?: string;
    ttlMinutes?: number;
  }): { token: string; expiresAt: string; authorizedLevel: SecurityLevelNumber } {
    const targetRepoName = payload.repo || 'local';
    const pConfig = this.readProjectConfig(targetRepoName);
    const salt = pConfig.governance_security_vault?.salt || 'context-os-default-salt';

    const token = `ctx_sec_${crypto.randomBytes(24).toString('hex')}`;
    const ttlMs = (payload.ttlMinutes || 60) * 60 * 1000;
    const expiresAt = Date.now() + ttlMs;

    const keysMap: Record<number, string> = {};
    for (const [lvlStr, pass] of Object.entries(payload.passphrases)) {
      const lvl = Number(lvlStr);
      if (pass) {
        const derived = deriveLevelKey(pass, salt);
        keysMap[lvl] = derived.toString('base64');
      }
    }

    ephemeralTokens.set(token, {
      token,
      user: payload.user,
      level: payload.level,
      expiresAt,
      keys: keysMap,
    });

    return {
      token,
      expiresAt: new Date(expiresAt).toISOString(),
      authorizedLevel: payload.level,
    };
  }

  /**
   * Retrieves and decrypts a document's content specifically for authorized AI agents in memory.
   */
  async getSecureContextForAI(payload: {
    filePath: string;
    token: string;
    repo?: string;
  }): Promise<{
    success: boolean;
    filePath: string;
    content?: string;
    security_level?: number;
    error?: string;
  }> {
    const ephemeral = ephemeralTokens.get(payload.token);
    if (!ephemeral || ephemeral.expiresAt < Date.now()) {
      if (ephemeral) ephemeralTokens.delete(payload.token);
      return {
        success: false,
        filePath: payload.filePath,
        error: 'Token de sessão efêmero expirado ou inválido para acesso ao AI Context Pipe.',
      };
    }

    const targetRepoName = payload.repo || 'local';
    const repoDir = this.getRepoDir(targetRepoName);
    const fullPath = path.join(repoDir, payload.filePath);

    if (!fs.existsSync(fullPath)) {
      return {
        success: false,
        filePath: payload.filePath,
        error: `Arquivo não encontrado no repositório: ${payload.filePath}`,
      };
    }

    const rawContent = fs.readFileSync(fullPath, 'utf-8');
    if (!isEncryptedEnvelope(rawContent)) {
      return {
        success: true,
        filePath: payload.filePath,
        content: rawContent,
        security_level: SECURITY_LEVELS.PUBLIC,
      };
    }

    const parsed = parseEncryptedEnvelope(rawContent);
    const docLevel = parsed.header?.security_level ?? SECURITY_LEVELS.LEVEL_3_OPERATIONAL;

    // Check if user token level has clearance (Reverse hierarchy: user.level <= docLevel)
    if (ephemeral.level > docLevel) {
      return {
        success: false,
        filePath: payload.filePath,
        security_level: docLevel,
        error: `Acesso negado: Este documento é Level ${docLevel}. Sua credencial autorizada é Level ${ephemeral.level}. Apenas Engenheiros Level 0-${docLevel} podem consultar esta especificação.`,
      };
    }

    // Convert keys from Base64
    const availableKeyBuffers: Record<number, Buffer> = {};
    for (const [lvl, b64] of Object.entries(ephemeral.keys)) {
      availableKeyBuffers[Number(lvl)] = Buffer.from(b64, 'base64');
    }

    const decResult = decryptDocument(rawContent, availableKeyBuffers);
    if (!decResult.success) {
      return {
        success: false,
        filePath: payload.filePath,
        security_level: docLevel,
        error: decResult.error || 'Falha ao descriptografar documento para a IA.',
      };
    }

    return {
      success: true,
      filePath: payload.filePath,
      content: decResult.content,
      security_level: docLevel,
    };
  }
}

export const governanceService = new GovernanceService();
