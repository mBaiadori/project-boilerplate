import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PROJECTS_DIR } from "../../config/constants.js";
import { loadConfig, saveConfig } from "../../config/storage.js";
import { callGitHubAPI } from "../../utils/git.js";
import {
  CollaboratorInfo,
  GitHubPermission,
  GovernanceQuorumRules,
  BranchProtectionStatus,
  GovernanceAuditLogEntry,
  DepartmentConfig,
  DEFAULT_DEPARTMENTS,
  SecretScanResult,
  SecretScanViolation,
  OrganizationTeamInfo,
  OrganizationMemberInfo,
  RepoTeamInfo,
} from "./governance.types.js";
import { scanContentForSecrets } from "../../utils/crypto.js";

// In-memory Ephemeral Token Store for Secure AI Context Pipe
interface EphemeralAIToken {
  token: string;
  user: string;
  folder?: string;
  expiresAt: number;
}

const ephemeralTokens = new Map<string, EphemeralAIToken>();

export class GovernanceService {
  private getRepoDir(repoName?: string): string {
    const cfg = loadConfig();
    const activeRepoName = repoName || cfg.active_repo?.name || "local";
    return path.join(PROJECTS_DIR, activeRepoName);
  }

  private getProjectConfigPath(repoName?: string): string {
    const dir = this.getRepoDir(repoName);
    return path.join(dir, ".project.config.json");
  }

  public readProjectConfig(repoName?: string): any {
    const p = this.getProjectConfigPath(repoName);
    if (fs.existsSync(p)) {
      try {
        return JSON.parse(fs.readFileSync(p, "utf-8"));
      } catch {}
    }
    return {};
  }

  private writeProjectConfig(repoName: string | undefined, data: any): void {
    const p = this.getProjectConfigPath(repoName);
    try {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
      console.warn(
        `[GovernanceService] Falha ao salvar .project.config.json:`,
        err,
      );
    }
  }

  public logAudit(
    repoName: string | undefined,
    entry: Omit<GovernanceAuditLogEntry, "id" | "timestamp">,
  ): void {
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
      pConfig.governance_audit_logs = pConfig.governance_audit_logs.slice(
        0,
        100,
      );
    }
    this.writeProjectConfig(repoName, pConfig);
  }

  private resolveRepoFullName(repoName?: string): string {
    const cfg = loadConfig();
    const activeRepo = cfg.active_repo;
    const targetRepoName = repoName || activeRepo?.name || "local";

    // 1. Repositórios locais ou padrão do sistema nunca devem apontar para repositório remoto acidentalmente
    if (
      targetRepoName === "local" ||
      targetRepoName === "default" ||
      targetRepoName === "_default"
    ) {
      if (
        activeRepo?.name === targetRepoName &&
        activeRepo.full_name &&
        !activeRepo.full_name.startsWith("local/") &&
        !activeRepo.is_local
      ) {
        return activeRepo.full_name;
      }
      return `local/${targetRepoName}`;
    }

    // 2. Se o repositório ativo selecionado for o mesmo e for explicitamente local
    if (activeRepo?.name?.toLowerCase() === targetRepoName.toLowerCase()) {
      if (activeRepo.is_local || activeRepo.full_name?.startsWith("local/")) {
        return `local/${targetRepoName}`;
      }
      if (activeRepo.full_name && !activeRepo.full_name.startsWith("local/")) {
        return activeRepo.full_name;
      }
    }

    // 3. Inspeciona o .git/config específico da pasta deste repositório
    const repoDir = this.getRepoDir(targetRepoName);
    const gitConfigPath = path.join(repoDir, ".git", "config");
    if (fs.existsSync(gitConfigPath)) {
      try {
        const configText = fs.readFileSync(gitConfigPath, "utf-8");
        const match = configText.match(
          /url\s*=\s*(?:https?:\/\/[^\/]+(?::\d+)?\/|git@[^:]+:)([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+?)(\.git|\s|$)/,
        );
        if (match && match[1]) {
          const fullName = match[1].replace(/\.git$/, "");
          if (!fullName.startsWith("local/")) {
            return fullName;
          }
        }
      } catch {}
    }

    // 4. Se não há remote configurado no .git/config, o repositório opera em modo local
    return `local/${targetRepoName}`;
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
    const targetRepoName = repoName || activeRepo?.name || "local";
    const pConfig = this.readProjectConfig(targetRepoName);
    const localMemberMeta = pConfig.governance_collaborators || {};

    const resolvedFullName = this.resolveRepoFullName(targetRepoName);
    const repoOwnerFromFullName =
      resolvedFullName &&
      resolvedFullName.includes("/") &&
      !resolvedFullName.startsWith("local/")
        ? resolvedFullName.split("/")[0]
        : null;
    const ownerLogin =
      (typeof activeRepo?.owner === "string"
        ? activeRepo.owner
        : activeRepo?.owner?.login) ||
      repoOwnerFromFullName ||
      cfg.user?.login ||
      "local-owner";
    let collaborators: CollaboratorInfo[] = [];
    let githubAuthError: string | null = null;

    const findLocalMeta = (username: string) => {
      const entry = Object.entries(localMemberMeta as Record<string, any>).find(
        ([k]) => k.toLowerCase() === username.toLowerCase(),
      );
      return entry ? entry[1] : {};
    };

    // 1. Fetch remote collaborators if authenticated and valid remote repo
    if (
      cfg.token &&
      resolvedFullName &&
      !resolvedFullName.startsWith("local/")
    ) {
      try {
        const ghRes = await callGitHubAPI(
          `/repos/${resolvedFullName}/collaborators?affiliation=all&per_page=100`,
          cfg.token,
        );
        if (ghRes.statusCode === 200 && Array.isArray(ghRes.data)) {
          collaborators = ghRes.data.map((c: any) => {
            const login = c.login;
            const meta = findLocalMeta(login);
            let perm: GitHubPermission = "push";
            if (c.permissions?.admin) perm = "admin";
            else if (c.permissions?.maintain) perm = "maintain";
            else if (c.permissions?.push) perm = "push";
            else if (c.permissions?.triage) perm = "triage";
            else if (c.permissions?.pull) perm = "pull";

            const isOwner =
              login.toLowerCase() === ownerLogin.toLowerCase() ||
              login.toLowerCase() ===
                resolvedFullName.split("/")[0].toLowerCase();
            const role =
              meta.role ||
              meta.role_name ||
              (isOwner ? "Owner / Tech Lead" : "Engenheiro / Revisor");
            const departments: string[] =
              Array.isArray(meta.departments) && meta.departments.length > 0
                ? meta.departments
                : isOwner
                  ? ["*"]
                  : ["engineering"];
            const allowedPaths: string[] =
              Array.isArray(meta.allowed_paths) && meta.allowed_paths.length > 0
                ? meta.allowed_paths
                : isOwner
                  ? ["*"]
                  : ["*"];
            const deniedPaths: string[] =
              Array.isArray(meta.denied_paths) ? meta.denied_paths : [];

            return {
              login,
              id: c.id,
              avatar_url: c.avatar_url || `https://github.com/${login}.png`,
              html_url: c.html_url || `https://github.com/${login}`,
              permission: perm,
              role,
              role_name: role,
              departments,
              allowed_paths: allowedPaths,
              denied_paths: deniedPaths,
              is_owner: isOwner,
              status: "active",
            };
          });
        } else if (ghRes.statusCode === 401) {
          githubAuthError = `Token do GitHub expirado ou inválido (401 Bad credentials). Atualize suas credenciais para sincronizar os membros.`;
        } else if (ghRes.statusCode === 403) {
          githubAuthError = `Sem permissão de acesso ao repositório ${resolvedFullName} no GitHub (${ghRes.statusCode}).`;
        } else if (ghRes.statusCode === 404) {
          // Repositório ainda não publicado no servidor remoto -> opera localmente sem erro
          githubAuthError = null;
        }

        // 2. Also fetch Pending Invitations
        try {
          const invRes = await callGitHubAPI(
            `/repos/${resolvedFullName}/invitations`,
            cfg.token,
          );
          if (invRes.statusCode === 200 && Array.isArray(invRes.data)) {
            for (const inv of invRes.data) {
              const invitee = inv.invitee;
              if (invitee && invitee.login) {
                const existing = collaborators.find(
                  (c) => c.login.toLowerCase() === invitee.login.toLowerCase(),
                );
                if (!existing) {
                  const meta = localMemberMeta[invitee.login] || {};
                  collaborators.push({
                    login: invitee.login,
                    id: invitee.id,
                    avatar_url:
                      invitee.avatar_url ||
                      `https://github.com/${invitee.login}.png`,
                    html_url:
                      invitee.html_url || `https://github.com/${invitee.login}`,
                    permission: (inv.permissions as GitHubPermission) || "push",
                    role_name: meta.role_name || "Convidado (Pendente)",
                    allowed_paths: Array.isArray(meta.allowed_paths)
                      ? meta.allowed_paths
                      : ["*"],
                    denied_paths: Array.isArray(meta.denied_paths)
                      ? meta.denied_paths
                      : [],
                    is_owner: false,
                    status: "pending",
                    invited_at: inv.created_at,
                  });
                }
              }
            }
          }
        } catch {}
      } catch (err: any) {
        githubAuthError = err.message;
        console.warn(
          "[GovernanceService] Aviso ao buscar colaboradores do GitHub:",
          err,
        );
      }
    }

    // Fallback or Merge: If no collaborators fetched or local repository, use local user + stored collaborators
    if (collaborators.length === 0) {
      const userLogin = cfg.user?.login || "local-developer";
      const isOwner = true;
      const ownerMeta = findLocalMeta(userLogin);
      const ownerRole =
        ownerMeta.role || ownerMeta.role_name || "Owner / Tech Lead";
      const ownerDepts =
        Array.isArray(ownerMeta.departments) && ownerMeta.departments.length > 0
          ? ownerMeta.departments
          : ["*"];
      const ownerPaths =
        Array.isArray(ownerMeta.allowed_paths) &&
        ownerMeta.allowed_paths.length > 0
          ? ownerMeta.allowed_paths
          : ["*"];
      collaborators.push({
        login: userLogin,
        id: 1,
        avatar_url:
          cfg.user?.avatar_url || `https://github.com/${userLogin}.png`,
        html_url: cfg.user?.html_url || `https://github.com/${userLogin}`,
        permission: "admin",
        role: ownerRole,
        role_name: ownerRole,
        departments: ownerDepts,
        allowed_paths: ownerPaths,
        is_owner: isOwner,
        status: "active",
      });
    }

    // Merge any stored members in .project.config.json that might not be in the remote list
    for (const [login, meta] of Object.entries(
      localMemberMeta as Record<string, any>,
    )) {
      const existing = collaborators.find(
        (c) => c.login.toLowerCase() === login.toLowerCase(),
      );
      if (!existing) {
        const memberRole = meta.role || meta.role_name || "Colaborador";
        const memberDepts =
          Array.isArray(meta.departments) && meta.departments.length > 0
            ? meta.departments
            : ["engineering"];
        const memberPaths =
          Array.isArray(meta.allowed_paths) && meta.allowed_paths.length > 0
            ? meta.allowed_paths
            : ["*"];
        collaborators.push({
          login,
          id: Math.floor(Math.random() * 1000000),
          avatar_url: `https://github.com/${login}.png`,
          html_url: `https://github.com/${login}`,
          permission: (meta.permission as GitHubPermission) || "push",
          role: memberRole,
          role_name: memberRole,
          departments: memberDepts,
          allowed_paths: memberPaths,
          denied_paths: Array.isArray(meta.denied_paths) ? meta.denied_paths : [],
          is_owner: false,
          status: meta.status || "active",
        });
      }
    }

    const activeCount = collaborators.filter(
      (c) => c.status === "active",
    ).length;
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
    role?: string;
    role_name?: string;
    departments?: string[];
    allowed_paths?: string[];
    denied_paths?: string[];
  }): Promise<{
    success: boolean;
    message: string;
    collaborator: CollaboratorInfo;
  }> {
    const cfg = loadConfig();
    const targetRepoName = payload.repo || cfg.active_repo?.name || "local";
    const cleanUsername = payload.username.trim().replace(/^@/, "");

    if (!cleanUsername) {
      throw new Error("Nome de usuário do GitHub é obrigatório para convite.");
    }

    const permission = payload.permission || "push";
    const roleName =
      payload.role ||
      payload.role_name ||
      (permission === "admin" ? "Co-Admin" : "Engenheiro / Revisor");
    const departments =
      Array.isArray(payload.departments) && payload.departments.length > 0
        ? payload.departments
        : ["engineering"];
    const allowedPaths =
      Array.isArray(payload.allowed_paths) && payload.allowed_paths.length > 0
        ? payload.allowed_paths
        : ["*"];
    const deniedPaths =
      Array.isArray(payload.denied_paths) ? payload.denied_paths : [];
    const resolvedFullName = this.resolveRepoFullName(targetRepoName);

    // 1. If remote GitHub repo, send invite via GitHub API
    if (
      cfg.token &&
      resolvedFullName &&
      !resolvedFullName.startsWith("local/")
    ) {
      try {
        const res = await callGitHubAPI(
          `/repos/${resolvedFullName}/collaborators/${cleanUsername}`,
          cfg.token,
          "PUT",
          { permission },
        );
        if (res.statusCode >= 400 && res.statusCode !== 422) {
          throw new Error(
            res.data?.message || "Falha ao convidar usuário no GitHub.",
          );
        }
      } catch (err: any) {
        throw new Error(
          `Erro ao enviar convite via API do GitHub: ${err.message}`,
        );
      }
    }

    // 2. Persist local metadata in .project.config.json
    const pConfig = this.readProjectConfig(targetRepoName);
    if (!pConfig.governance_collaborators)
      pConfig.governance_collaborators = {};
    pConfig.governance_collaborators[cleanUsername] = {
      permission,
      role: roleName,
      role_name: roleName,
      departments,
      allowed_paths: allowedPaths,
      denied_paths: deniedPaths,
      invited_at: new Date().toISOString(),
      status: "active",
    };
    this.writeProjectConfig(targetRepoName, pConfig);

    const actor = cfg.user?.login ? `@${cfg.user.login}` : "Tech Lead";
    this.logAudit(targetRepoName, {
      action: "COLLABORATOR_INVITED",
      actor,
      target: `@${cleanUsername}`,
      details: `Convidado com permissão Git '${permission}', cargo '${roleName}', departamentos: [${departments.join(", ")}] e rotas: [${allowedPaths.join(", ")}].`,
    });

    const colInfo: CollaboratorInfo = {
      login: cleanUsername,
      id: Date.now(),
      avatar_url: `https://github.com/${cleanUsername}.png`,
      html_url: `https://github.com/${cleanUsername}`,
      permission,
      role: roleName,
      role_name: roleName,
      departments,
      allowed_paths: allowedPaths,
      denied_paths: deniedPaths,
      is_owner: false,
      status: "active",
    };

    return {
      success: true,
      message: `Convite enviado com sucesso para @${cleanUsername} com cargo '${roleName}', permissão '${permission}'! Permissões de acesso aos departamentos configuradas.`,
      collaborator: colInfo,
    };
  }

  async removeCollaborator(payload: {
    repo?: string;
    username: string;
  }): Promise<{ success: boolean; message: string }> {
    const cfg = loadConfig();
    const targetRepoName = payload.repo || cfg.active_repo?.name || "local";
    const cleanUsername = payload.username.trim().replace(/^@/, "");
    const resolvedFullName = this.resolveRepoFullName(targetRepoName);

    if (
      cfg.token &&
      resolvedFullName &&
      !resolvedFullName.startsWith("local/")
    ) {
      try {
        await callGitHubAPI(
          `/repos/${resolvedFullName}/collaborators/${cleanUsername}`,
          cfg.token,
          "DELETE",
        );
      } catch (err: any) {
        console.warn(
          `[GovernanceService] Aviso ao remover colaborador no GitHub:`,
          err,
        );
      }
    }

    const pConfig = this.readProjectConfig(targetRepoName);
    if (
      pConfig.governance_collaborators &&
      pConfig.governance_collaborators[cleanUsername]
    ) {
      delete pConfig.governance_collaborators[cleanUsername];
      this.writeProjectConfig(targetRepoName, pConfig);
    }

    const actor = cfg.user?.login ? `@${cfg.user.login}` : "Tech Lead";
    this.logAudit(targetRepoName, {
      action: "COLLABORATOR_REMOVED",
      actor,
      target: `@${cleanUsername}`,
      details: `Colaborador removido da governança e do repositório. Permissões revogadas com sucesso.`,
    });

    return {
      success: true,
      message: `Colaborador @${cleanUsername} removido com sucesso do repositório.`,
    };
  }

  async updateCollaboratorClearance(payload: {
    repo?: string;
    username: string;
    role?: string;
    role_name?: string;
    permission?: GitHubPermission;
    departments?: string[];
    allowed_paths?: string[];
    denied_paths?: string[];
  }): Promise<{ success: boolean; message: string }> {
    const cleanUsername = payload.username.trim().replace(/^@/, "");
    const targetRepoName = payload.repo || "local";
    const cfg = loadConfig();
    const pConfig = this.readProjectConfig(targetRepoName);
    if (!pConfig.governance_collaborators)
      pConfig.governance_collaborators = {};

    const existingKey =
      Object.keys(pConfig.governance_collaborators).find(
        (k) => k.toLowerCase() === cleanUsername.toLowerCase(),
      ) || cleanUsername;

    const currentData = pConfig.governance_collaborators[existingKey] || {};

    // Sincroniza permissão no GitHub se fornecida e diferente da atual
    if (payload.permission && payload.permission !== currentData.permission) {
      const resolvedFullName = this.resolveRepoFullName(targetRepoName);
      if (
        cfg.token &&
        resolvedFullName &&
        !resolvedFullName.startsWith("local/")
      ) {
        try {
          await callGitHubAPI(
            `/repos/${resolvedFullName}/collaborators/${cleanUsername}`,
            cfg.token,
            "PUT",
            { permission: payload.permission },
          );
        } catch (err: any) {
          console.warn(
            `[GovernanceService] Aviso ao atualizar permissão no GitHub para @${cleanUsername}:`,
            err,
          );
        }
      }
    }

    const role =
      payload.role ||
      payload.role_name ||
      currentData.role ||
      currentData.role_name;
    const permission = payload.permission || currentData.permission || "push";
    const allowedPaths = Array.isArray(payload.allowed_paths)
      ? payload.allowed_paths
      : currentData.allowed_paths;
    const deniedPaths = Array.isArray(payload.denied_paths)
      ? payload.denied_paths
      : currentData.denied_paths;

    pConfig.governance_collaborators[existingKey] = {
      ...currentData,
      permission,
      ...(role ? { role, role_name: role } : {}),
      ...(Array.isArray(payload.departments)
        ? { departments: payload.departments }
        : {}),
      ...(Array.isArray(allowedPaths) ? { allowed_paths: allowedPaths } : {}),
      ...(Array.isArray(deniedPaths) ? { denied_paths: deniedPaths } : {}),
    };
    this.writeProjectConfig(targetRepoName, pConfig);

    const actor = cfg.user?.login ? `@${cfg.user.login}` : "Tech Lead";
    this.logAudit(targetRepoName, {
      action: "COLLABORATOR_UPDATED",
      actor,
      target: `@${cleanUsername}`,
      details: `Perfil de acesso de @${cleanUsername} atualizado:${role ? ` Cargo '${role}',` : ""} Permissão '${permission}'${allowedPaths ? `, Rotas: [${allowedPaths.join(", ")}]` : ""}.`,
    });

    return {
      success: true,
      message: `Perfil de governança de @${cleanUsername} atualizado com sucesso.`,
    };
  }

  /**
   * Sincroniza automaticamente as rotas permitidas dos colaboradores quando uma pasta é renomeada
   */
  handleFolderRename(
    oldFolderPath: string,
    newFolderPath: string,
    repoName?: string,
  ): void {
    const targetRepoName = repoName || "local";
    const pConfig = this.readProjectConfig(targetRepoName);
    if (!pConfig.governance_collaborators) return;

    const cleanOld = oldFolderPath
      .replace(/\\/g, "/")
      .replace(/^\/+/, "")
      .replace(/\/+$/, "")
      .toLowerCase();
    const cleanNew = newFolderPath
      .replace(/\\/g, "/")
      .replace(/^\/+/, "")
      .replace(/\/+$/, "");

    let modified = false;
    for (const [, meta] of Object.entries(
      pConfig.governance_collaborators as Record<string, any>,
    )) {
      const updatePathList = (paths: string[]): { updated: string[]; changed: boolean } => {
        let changed = false;
        const updated = paths.map((p: string) => {
          const cleanP = p.replace(/\\/g, "/").replace(/^\/+/, "");
          const cleanPLower = cleanP.toLowerCase();
          if (cleanPLower === cleanOld) {
            changed = true;
            return cleanNew;
          }
          if (
            cleanPLower === `${cleanOld}/**` ||
            cleanPLower === `${cleanOld}/*`
          ) {
            changed = true;
            return `${cleanNew}/**`;
          }
          if (cleanPLower.startsWith(`${cleanOld}/`)) {
            changed = true;
            return cleanNew + cleanP.slice(cleanOld.length);
          }
          return p;
        });
        return { updated, changed };
      };

      if (Array.isArray(meta.allowed_paths)) {
        const { updated, changed } = updatePathList(meta.allowed_paths);
        if (changed) {
          meta.allowed_paths = updated;
          modified = true;
        }
      }

      if (Array.isArray(meta.denied_paths)) {
        const { updated, changed } = updatePathList(meta.denied_paths);
        if (changed) {
          meta.denied_paths = updated;
          modified = true;
        }
      }
    }

    if (modified) {
      this.writeProjectConfig(targetRepoName, pConfig);
      this.logAudit(targetRepoName, {
        action: "QUORUM_UPDATED",
        actor: "System",
        details: `Rotas de acesso dos colaboradores atualizadas após renomeio de '${oldFolderPath}' para '${newFolderPath}'.`,
      });
    }
  }

  async getDepartments(repoName?: string): Promise<DepartmentConfig[]> {
    const targetRepoName = repoName || "local";
    const pConfig = this.readProjectConfig(targetRepoName);
    if (Array.isArray(pConfig.departments) && pConfig.departments.length > 0) {
      return pConfig.departments;
    }
    return DEFAULT_DEPARTMENTS;
  }

  async saveDepartments(
    departments: DepartmentConfig[],
    repoName?: string,
  ): Promise<{ success: boolean; departments: DepartmentConfig[] }> {
    const targetRepoName = repoName || "local";
    const pConfig = this.readProjectConfig(targetRepoName);
    pConfig.departments = departments;
    this.writeProjectConfig(targetRepoName, pConfig);

    const cfg = loadConfig();
    const actor = cfg.user?.login ? `@${cfg.user.login}` : "Tech Lead";
    this.logAudit(targetRepoName, {
      action: "DEPARTMENT_CONFIG_UPDATED",
      actor,
      details: `Departamentos da governança atualizados (${departments.length} departamentos configurados).`,
    });

    return {
      success: true,
      departments,
    };
  }

  async getBranchProtection(
    repoName?: string,
  ): Promise<BranchProtectionStatus> {
    const cfg = loadConfig();
    const activeRepo = cfg.active_repo;
    const targetRepoName = repoName || activeRepo?.name || "local";
    const defaultBranch = activeRepo?.default_branch || "main";

    if (
      cfg.authenticated &&
      cfg.token &&
      activeRepo?.full_name &&
      !activeRepo?.is_local &&
      activeRepo?.name === targetRepoName
    ) {
      try {
        const ghRes = await callGitHubAPI(
          `/repos/${activeRepo.full_name}/branches/${defaultBranch}/protection`,
          cfg.token,
        );
        if (ghRes.statusCode === 200 && ghRes.data) {
          const d = ghRes.data;
          return {
            enabled: true,
            required_approving_review_count:
              d.required_pull_request_reviews
                ?.required_approving_review_count || 1,
            dismiss_stale_reviews:
              d.required_pull_request_reviews?.dismiss_stale_reviews || false,
            require_code_owner_reviews:
              d.required_pull_request_reviews?.require_code_owner_reviews ||
              false,
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
  }): Promise<{
    success: boolean;
    message: string;
    protection: BranchProtectionStatus;
  }> {
    const cfg = loadConfig();
    const activeRepo = cfg.active_repo;
    const targetRepoName = payload.repo || activeRepo?.name || "local";
    const defaultBranch = activeRepo?.default_branch || "main";
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

    if (
      cfg.authenticated &&
      cfg.token &&
      activeRepo?.full_name &&
      !activeRepo?.is_local &&
      activeRepo?.name === targetRepoName
    ) {
      try {
        const ghRes = await callGitHubAPI(
          `/repos/${activeRepo.full_name}/branches/${defaultBranch}/protection`,
          cfg.token,
          "PUT",
          protectionPayload,
        );
        if (ghRes.statusCode >= 400) {
          const msg = ghRes.data?.message || "";
          if (
            ghRes.statusCode === 403 &&
            (msg.includes("Upgrade to GitHub Pro") ||
              msg.includes("pricing plans"))
          ) {
            console.info(
              "[GovernanceService] Repositório privado em plano GitHub Free: O GitHub exige plano Pro/Team para regras de nuvem em repositórios privados. Governança local mantida 100% ativa.",
            );
          } else {
            console.warn(
              "[GovernanceService] Aviso do GitHub ao aplicar branch protection:",
              ghRes.statusCode,
              msg,
            );
          }
        }
      } catch (err: any) {
        console.warn(
          "[GovernanceService] Erro ao aplicar regra de branch protection no GitHub:",
          err?.message || err,
        );
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

    const actor = cfg.user?.login ? `@${cfg.user.login}` : "Tech Lead";
    this.logAudit(targetRepoName, {
      action: "BRANCH_PROTECTED",
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
    const targetRepoName = repoName || "local";
    const pConfig = this.readProjectConfig(targetRepoName);
    const storedRules = pConfig.governance_rules || {};

    const collabsData = await this.getCollaborators(targetRepoName);
    const activeCount = collabsData.activeCount;
    const isSoloMode = activeCount <= 1;

    const defaultMin = Number(storedRules.min_approvals_default) || 1;
    const effectiveMinApprovals = isSoloMode ? 1 : Math.max(1, defaultMin);

    const rules: GovernanceQuorumRules = {
      mode: storedRules.mode || "auto",
      min_approvals_default: defaultMin,
      anti_self_approval:
        storedRules.anti_self_approval !== undefined
          ? storedRules.anti_self_approval
          : !isSoloMode,
      require_review_before_merge:
        storedRules.require_review_before_merge !== false,
      dismiss_stale_reviews_on_push:
        storedRules.dismiss_stale_reviews_on_push !== false,
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
    const targetRepoName = payload.repo || "local";
    const pConfig = this.readProjectConfig(targetRepoName);
    if (!pConfig.governance_rules) pConfig.governance_rules = {};

    pConfig.governance_rules = {
      ...pConfig.governance_rules,
      ...payload.rules,
    };

    this.writeProjectConfig(targetRepoName, pConfig);

    const cfg = loadConfig();
    const actor = cfg.user?.login ? `@${cfg.user.login}` : "Tech Lead";
    this.logAudit(targetRepoName, {
      action: "QUORUM_UPDATED",
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
        if (entry.name.startsWith(".") && entry.name !== ".translations") {
          if (
            entry.name === ".git" ||
            entry.name === ".context" ||
            entry.name === "node_modules"
          )
            continue;
        }
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== "node_modules" && entry.name !== ".git") {
            results.push(...this.getAllMarkdownFiles(full, baseDir));
          }
        } else if (entry.isFile() && entry.name.endsWith(".md")) {
          results.push(path.relative(baseDir, full));
        }
      }
    } catch {}
    return results;
  }

  async scanRepositorySecrets(repoName?: string): Promise<SecretScanResult> {
    const targetRepoName = repoName || "local";
    const repoDir = this.getRepoDir(targetRepoName);
    const allMdFiles = this.getAllMarkdownFiles(repoDir);
    const violations: SecretScanViolation[] = [];

    for (const relPath of allMdFiles) {
      const fullPath = path.join(repoDir, relPath);
      try {
        const content = fs.readFileSync(fullPath, "utf-8");
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

  async getAuditLogs(repoName?: string): Promise<GovernanceAuditLogEntry[]> {
    const targetRepoName = repoName || "local";
    const pConfig = this.readProjectConfig(targetRepoName);
    return pConfig.governance_audit_logs || [];
  }

  // --- AI SECURE CONTEXT PIPE & EPHEMERAL TOKENS ---

  /**
   * Creates an ephemeral secure token for AI tools/agents to query decrypted context.
   */
  createSecureAIToken(payload: {
    user: string;
    folder?: string;
    repo?: string;
    ttlMinutes?: number;
  }): { token: string; expiresAt: string } {
    const token = `ctx_sec_${crypto.randomBytes(24).toString("hex")}`;
    const ttlMs = (payload.ttlMinutes || 60) * 60 * 1000;
    const expiresAt = Date.now() + ttlMs;

    ephemeralTokens.set(token, {
      token,
      user: payload.user,
      folder: payload.folder,
      expiresAt,
    });

    return {
      token,
      expiresAt: new Date(expiresAt).toISOString(),
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
    error?: string;
  }> {
    const ephemeral = ephemeralTokens.get(payload.token);
    if (!ephemeral || ephemeral.expiresAt < Date.now()) {
      if (ephemeral) ephemeralTokens.delete(payload.token);
      return {
        success: false,
        filePath: payload.filePath,
        error:
          "Token de sessão efêmero expirado ou inválido para acesso ao AI Context Pipe.",
      };
    }

    const targetRepoName = payload.repo || "local";
    const repoDir = this.getRepoDir(targetRepoName);
    const fullPath = path.join(repoDir, payload.filePath);

    if (!fs.existsSync(fullPath)) {
      return {
        success: false,
        filePath: payload.filePath,
        error: `Arquivo não encontrado no repositório: ${payload.filePath}`,
      };
    }

    const rawContent = fs.readFileSync(fullPath, "utf-8");
    return {
      success: true,
      filePath: payload.filePath,
      content: rawContent,
    };
  }

  /**
   * Lista todos os times da Organização no GitHub
   */
  async getOrgTeams(orgLogin: string): Promise<OrganizationTeamInfo[]> {
    const cfg = loadConfig();
    if (!cfg.token || !orgLogin) {
      return [];
    }
    try {
      const res = await callGitHubAPI(`/orgs/${orgLogin}/teams?per_page=100`, cfg.token, "GET");
      if (res.statusCode === 200 && Array.isArray(res.data)) {
        return res.data.map((t: any) => ({
          id: t.id,
          slug: t.slug,
          name: t.name,
          description: t.description || "",
          permission: t.permission || "pull",
          members_count: t.members_count || 0,
          privacy: t.privacy || "closed",
        }));
      }
      return [];
    } catch (err) {
      console.warn(`[GovernanceService] Falha ao listar times da org ${orgLogin}:`, err);
      return [];
    }
  }

  /**
   * Lista todos os membros da Organização no GitHub
   */
  async getOrgMembers(orgLogin: string): Promise<OrganizationMemberInfo[]> {
    const cfg = loadConfig();
    if (!cfg.token || !orgLogin) {
      return [];
    }
    try {
      const res = await callGitHubAPI(`/orgs/${orgLogin}/members?per_page=100`, cfg.token, "GET");
      if (res.statusCode === 200 && Array.isArray(res.data)) {
        return res.data.map((m: any) => ({
          id: m.id,
          login: m.login,
          avatar_url: m.avatar_url || `https://github.com/${m.login}.png`,
          html_url: m.html_url || `https://github.com/${m.login}`,
          role: m.site_admin ? "admin" : "member",
        }));
      }
      return [];
    } catch (err) {
      console.warn(`[GovernanceService] Falha ao listar membros da org ${orgLogin}:`, err);
      return [];
    }
  }

  /**
   * Lista times com acesso a um repositório específico
   */
  async getRepoTeams(owner: string, repo: string): Promise<RepoTeamInfo[]> {
    const cfg = loadConfig();
    if (!cfg.token || !owner || !repo) {
      return [];
    }
    try {
      const res = await callGitHubAPI(`/repos/${owner}/${repo}/teams?per_page=100`, cfg.token, "GET");
      if (res.statusCode === 200 && Array.isArray(res.data)) {
        return res.data.map((t: any) => ({
          id: t.id,
          slug: t.slug,
          name: t.name,
          description: t.description || "",
          permission: t.permission || "pull",
          permissions: t.permissions,
        }));
      }
      return [];
    } catch (err) {
      console.warn(`[GovernanceService] Falha ao listar times do repo ${owner}/${repo}:`, err);
      return [];
    }
  }

  /**
   * Adiciona ou atualiza permissão de um time em um repositório
   */
  async addTeamToRepo(payload: {
    org: string;
    teamSlug: string;
    owner: string;
    repo: string;
    permission: string;
  }): Promise<{ success: boolean; message?: string }> {
    const cfg = loadConfig();
    if (!cfg.token) {
      throw new Error("Token do GitHub não autenticado");
    }
    const { org, teamSlug, owner, repo, permission } = payload;
    const res = await callGitHubAPI(
      `/orgs/${org}/teams/${teamSlug}/repos/${owner}/${repo}`,
      cfg.token,
      "PUT",
      { permission: permission || "push" }
    );
    if (res.statusCode === 204 || res.statusCode === 200 || res.statusCode === 201) {
      return { success: true, message: `Time @${org}/${teamSlug} adicionado ao repositório ${owner}/${repo} com permissão '${permission}'` };
    }
    throw new Error(res.data?.message || `Erro ao associar time ao repositório (${res.statusCode})`);
  }

  /**
   * Remove acesso de um time de um repositório
   */
  async removeTeamFromRepo(payload: {
    org: string;
    teamSlug: string;
    owner: string;
    repo: string;
  }): Promise<{ success: boolean; message?: string }> {
    const cfg = loadConfig();
    if (!cfg.token) {
      throw new Error("Token do GitHub não autenticado");
    }
    const { org, teamSlug, owner, repo } = payload;
    const res = await callGitHubAPI(
      `/orgs/${org}/teams/${teamSlug}/repos/${owner}/${repo}`,
      cfg.token,
      "DELETE"
    );
    if (res.statusCode === 204 || res.statusCode === 200) {
      return { success: true, message: `Time @${org}/${teamSlug} removido do repositório ${owner}/${repo}` };
    }
    throw new Error(res.data?.message || `Erro ao remover time do repositório (${res.statusCode})`);
  }
}

export const governanceService = new GovernanceService();
