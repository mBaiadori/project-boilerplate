import fs from "node:fs";
import path from "node:path";
import { PROJECTS_DIR } from "../../config/constants.js";
import {
  loadConfig,
  saveConfig,
  ensureDefaultRepoFiles,
} from "../../config/storage.js";
import {
  callGitProviderAPI,
  applyBranchProtection,
  checkBranchProtection,
  ensureGitRepo,
  executeGitCommand,
  isGitRepo,
} from "../../utils/git.js";
import { workspaceService } from "../workspace/workspace.service.js";

export interface RepoDiagnosisCheckItem {
  exists: boolean;
  valid: boolean;
  path: string;
  label: string;
  details?: string;
}

export interface RepoDiagnosis {
  name: string;
  full_name: string;
  is_local: boolean;
  is_cloned_locally: boolean;
  is_owner: boolean;
  can_admin: boolean;
  checks: {
    project_config: RepoDiagnosisCheckItem;
    docs_metadata: RepoDiagnosisCheckItem;
    hidden_files: RepoDiagnosisCheckItem;
    codeowners: RepoDiagnosisCheckItem;
    dictionary: RepoDiagnosisCheckItem;
    templates: RepoDiagnosisCheckItem;
    spec_memory: RepoDiagnosisCheckItem;
    branch_protection: {
      supported: boolean;
      active: boolean;
      label: string;
      details?: string;
    };
  };
  is_ready: boolean;
  missing_essentials: string[];
}

export interface RepoInitializePayload {
  name: string;
  preset?: "recommended" | "custom" | "minimal";
  project_config?: {
    name?: string;
    description?: string;
    categories?: Array<{
      id: string;
      label: string;
      color?: string;
      description?: string;
    }>;
    tags?: Array<{ id: string; label: string; color?: string }>;
    statuses?: Array<{ id: string; label: string; color?: string }>;
    badges?: Array<{ id: string; label: string; color?: string }>;
    governance_rules?: { min_approvals_default: number };
  };
  security?: {
    enable_branch_protection?: boolean;
    required_approvals?: number;
    create_codeowners?: boolean;
  };
  folders?: string[];
  include_spec_memory?: boolean;
}

export class ReposService {
  async listRepos() {
    const cfg = loadConfig();
    const localRepos: any[] = [];
    const userLogin = cfg.user?.login?.toLowerCase() || "";

    // Local repositories in projects/ (excluding internal SSOT blueprint folders like 'default' or '_default')
    if (fs.existsSync(PROJECTS_DIR)) {
      const items = fs.readdirSync(PROJECTS_DIR);
      for (const item of items) {
        const fullPath = path.join(PROJECTS_DIR, item);
        if (
          fs.statSync(fullPath).isDirectory() &&
          !item.startsWith(".") &&
          item !== "default" &&
          item !== "_default"
        ) {
          localRepos.push({
            name: item,
            full_name: `local/${item}`,
            description: "Repositório local de especificações",
            is_local: true,
            is_private: false,
            default_branch: "main",
            owner: cfg.user?.login || "local",
            owner_type: "User",
            is_owner: true,
            is_org: false,
            is_fork: false,
            permissions: { admin: true, push: true, pull: true },
          });
        }
      }
    }

    if (!cfg.authenticated || !cfg.token) {
      return {
        authenticated: false,
        repos: localRepos,
        active_repo: cfg.active_repo,
      };
    }

    // Git Provider repositories (GitHub)
    const { statusCode, data } = await callGitProviderAPI(
      "/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member",
      cfg.token,
    );
    const remoteRepos = Array.isArray(data) ? [...data] : [];

    // Busca repositórios de cada organização registrada em cfg.orgs
    if (Array.isArray(cfg.orgs)) {
      for (const org of cfg.orgs) {
        if (org.login && org.login.toLowerCase() !== userLogin && !org.is_personal) {
          try {
            const { statusCode: orgRepoStatus, data: orgRepoData } = await callGitProviderAPI(
              `/orgs/${org.login}/repos?per_page=100&sort=updated`,
              cfg.token,
            );
            if (orgRepoStatus === 200 && Array.isArray(orgRepoData)) {
              for (const or of orgRepoData) {
                if (
                  !remoteRepos.some(
                    (existing) =>
                      existing.full_name?.toLowerCase() === or.full_name?.toLowerCase() ||
                      existing.id === or.id,
                  )
                ) {
                  remoteRepos.push(or);
                }
              }
            }
          } catch (err) {
            console.warn(`[ReposService] Erro ao buscar repos da org ${org.login}:`, err);
          }
        }
      }
    }

    const formattedRemote = remoteRepos.map((r: any) => {
      const ownerLogin = r.owner?.login || "";
      const isOwner = ownerLogin.toLowerCase() === userLogin;
      const isOrg =
        r.owner?.type === "Organization" || (!isOwner && ownerLogin !== "");
      const rawPerms = r.permissions || {};
      const permissions = {
        admin: typeof rawPerms.admin === "boolean" ? rawPerms.admin : isOwner,
        push: typeof rawPerms.push === "boolean" ? rawPerms.push : isOwner,
        pull: typeof rawPerms.pull === "boolean" ? rawPerms.pull : true,
      };

      const isClonedLocally =
        fs.existsSync(path.join(PROJECTS_DIR, r.name)) &&
        fs.existsSync(path.join(PROJECTS_DIR, r.name, ".git"));

      return {
        name: r.name,
        full_name: r.full_name,
        html_url: r.html_url,
        description: r.description || "",
        is_private: Boolean(r.private),
        default_branch: r.default_branch || "main",
        is_local: false,
        is_cloned_locally: isClonedLocally,
        owner: ownerLogin,
        owner_type: r.owner?.type || (isOwner ? "User" : "Organization"),
        is_owner: isOwner,
        is_org: isOrg,
        is_fork: Boolean(r.fork),
        permissions,
      };
    });

    // Merge without duplicating names (prefer remote data)
    const repoNames = new Set(formattedRemote.map((r) => r.name));
    for (const lr of localRepos) {
      if (!repoNames.has(lr.name)) {
        formattedRemote.push({
          ...lr,
          is_cloned_locally: true,
        });
      }
    }

    return {
      authenticated: true,
      repos: formattedRemote,
      active_repo: cfg.active_repo,
    };
  }

  async diagnoseRepo(repoName: string): Promise<RepoDiagnosis> {
    if (!repoName) {
      throw new Error("Nome do repositório é obrigatório para diagnóstico");
    }

    const cfg = loadConfig();
    const repoDir = path.join(PROJECTS_DIR, repoName);
    const isClonedLocally =
      fs.existsSync(repoDir) && fs.existsSync(path.join(repoDir, ".git"));
    const isLocal =
      cfg.active_repo?.name === repoName
        ? Boolean(cfg.active_repo?.is_local)
        : !cfg.token;
    const fullName =
      cfg.active_repo?.name === repoName
        ? cfg.active_repo?.full_name || repoName
        : repoName;
    const isOwner =
      cfg.active_repo?.name === repoName
        ? Boolean(cfg.active_repo?.is_owner)
        : true;
    const canAdmin =
      isLocal || Boolean(cfg.active_repo?.permissions?.admin) || isOwner;

    // 1. Check .project.config.json
    const pConfigPath = path.join(repoDir, ".project.config.json");
    let hasPConfig = fs.existsSync(pConfigPath);
    let validPConfig = false;
    let pConfigDetails = "Não encontrado";
    if (hasPConfig) {
      try {
        const parsed = JSON.parse(fs.readFileSync(pConfigPath, "utf-8"));
        if (
          parsed &&
          typeof parsed === "object" &&
          Array.isArray(parsed.categories)
        ) {
          validPConfig = true;
          pConfigDetails = `${parsed.categories.length} categorias, ${parsed.tags?.length || 0} tags configuradas`;
        } else {
          pConfigDetails = "Arquivo corrompido ou formato inválido";
        }
      } catch {
        pConfigDetails = "JSON inválido";
      }
    }

    // 2. Check .docs.metadata.json
    const pMetaPath = path.join(repoDir, ".docs.metadata.json");
    let hasPMeta = fs.existsSync(pMetaPath);
    let validPMeta = false;
    let pMetaDetails = "Não encontrado";
    if (hasPMeta) {
      try {
        const parsed = JSON.parse(fs.readFileSync(pMetaPath, "utf-8"));
        if (Array.isArray(parsed)) {
          validPMeta = true;
          pMetaDetails = `${parsed.length} documento(s) catalogado(s)`;
        } else {
          pMetaDetails = "Formato inválido (esperado array de documentos)";
        }
      } catch {
        pMetaDetails = "JSON inválido";
      }
    }

    // 3. Check .hidden_files.json
    const pHiddenPath = path.join(repoDir, ".hidden_files.json");
    const hasHidden = fs.existsSync(pHiddenPath);

    // 4. Check .github/CODEOWNERS
    const pCodeownersPath = path.join(repoDir, ".github", "CODEOWNERS");
    const hasCodeowners = fs.existsSync(pCodeownersPath);

    // 5. Check .dictionary.json
    const pDictPath = path.join(repoDir, ".dictionary.json");
    const hasDict = fs.existsSync(pDictPath);

    // 6. Check .templates.json
    const pTemplatesPath = path.join(repoDir, ".templates.json");
    const hasTemplates = fs.existsSync(pTemplatesPath);

    // 7. Check .spec-memory/
    const pSpecMemoryPath = path.join(repoDir, ".spec-memory");
    const hasSpecMemory =
      fs.existsSync(pSpecMemoryPath) &&
      fs.statSync(pSpecMemoryPath).isDirectory();

    // 8. Check Branch Protection
    let branchProtectionSupported = !isLocal && Boolean(cfg.token) && canAdmin;
    let branchProtectionActive = false;
    let branchProtectionDetails = isLocal
      ? "Não aplicável (modo local)"
      : "Não verificada";

    if (branchProtectionSupported && cfg.token && fullName.includes("/")) {
      const defaultBranch = cfg.active_repo?.default_branch || "main";
      const protCheck = await checkBranchProtection(
        fullName,
        defaultBranch,
        cfg.token,
      );
      branchProtectionActive = protCheck.isProtected;
      branchProtectionDetails =
        protCheck.details ||
        (branchProtectionActive
          ? "Ativa no provedor"
          : "Sem proteção configurada");
    }

    const missingEssentials: string[] = [];
    if (!hasPConfig || !validPConfig)
      missingEssentials.push(".project.config.json");
    if (!hasPMeta || !validPMeta) missingEssentials.push(".docs.metadata.json");
    if (!hasHidden) missingEssentials.push(".hidden_files.json");

    const isReady = isClonedLocally && missingEssentials.length === 0;

    return {
      name: repoName,
      full_name: fullName,
      is_local: isLocal,
      is_cloned_locally: isClonedLocally,
      is_owner: isOwner,
      can_admin: canAdmin,
      checks: {
        project_config: {
          exists: hasPConfig,
          valid: validPConfig,
          path: ".project.config.json",
          label: "Configurações de Taxonomia (.project.config.json)",
          details: pConfigDetails,
        },
        docs_metadata: {
          exists: hasPMeta,
          valid: validPMeta,
          path: ".docs.metadata.json",
          label: "Catálogo de Governança (.docs.metadata.json)",
          details: pMetaDetails,
        },
        hidden_files: {
          exists: hasHidden,
          valid: hasHidden,
          path: ".hidden_files.json",
          label: "Proteção de Arquivos (.hidden_files.json)",
          details: hasHidden ? "Configurado" : "Pendente",
        },
        codeowners: {
          exists: hasCodeowners,
          valid: hasCodeowners,
          path: ".github/CODEOWNERS",
          label: "Propriedade de Código (.github/CODEOWNERS)",
          details: hasCodeowners ? "Configurado" : "Pendente",
        },
        dictionary: {
          exists: hasDict,
          valid: hasDict,
          path: ".dictionary.json",
          label: "Dicionário Ubíquo (.dictionary.json)",
          details: hasDict ? "Configurado" : "Opcional",
        },
        templates: {
          exists: hasTemplates,
          valid: hasTemplates,
          path: ".templates.json",
          label: "Modelos de Documento (.templates.json)",
          details: hasTemplates ? "Configurado" : "Opcional",
        },
        spec_memory: {
          exists: hasSpecMemory,
          valid: hasSpecMemory,
          path: ".spec-memory/",
          label: "Memória Persistente de IA (.spec-memory/)",
          details: hasSpecMemory ? "Configurada" : "Opcional",
        },
        branch_protection: {
          supported: branchProtectionSupported,
          active: branchProtectionActive,
          label: "Proteção de Branch (main)",
          details: branchProtectionDetails,
        },
      },
      is_ready: isReady,
      missing_essentials: missingEssentials,
    };
  }

  async selectRepo(repo: any) {
    if (!repo || !repo.name) {
      throw new Error("Repositório inválido.");
    }

    const cfg = loadConfig();
    let htmlUrl = repo.html_url || "";

    // If html_url is missing but we are authenticated, resolve from provider (only if not local)
    if (
      !htmlUrl &&
      !repo.is_local &&
      cfg.authenticated &&
      cfg.token &&
      repo.name !== "default" &&
      repo.name !== "_default" &&
      repo.name !== "local"
    ) {
      try {
        const { data: userRepos } = await callGitProviderAPI(
          "/user/repos?per_page=100",
          cfg.token,
        );
        if (Array.isArray(userRepos)) {
          const match = userRepos.find(
            (r: any) => r.name.toLowerCase() === repo.name.toLowerCase(),
          );
          if (match && match.html_url) {
            htmlUrl = match.html_url;
          }
        }
      } catch {}
    }

    let fullName = repo.full_name;
    if (!fullName && htmlUrl) {
      fullName = htmlUrl
        .replace(/^https?:\/\/[^\/]+\//, "")
        .replace(/\.git$/, "");
    }
    if (!fullName) {
      fullName = repo.name;
    }

    cfg.active_repo = {
      name: repo.name,
      full_name: fullName,
      html_url: htmlUrl,
      description: repo.description || "",
      is_private: Boolean(repo.is_private),
      default_branch: repo.default_branch || "main",
      is_local: repo.is_local !== undefined ? Boolean(repo.is_local) : !htmlUrl,
      owner: repo.owner,
      permissions: repo.permissions || { admin: true, push: true, pull: true },
    };

    const repoDir = path.join(PROJECTS_DIR, repo.name);
    workspaceService.invalidateTreeCache(repo.name);

    // Se o repositório remoto não estiver clonado localmente, clona agora
    await ensureGitRepo(repoDir, cfg.user, htmlUrl, cfg.token, repo.name, true);

    // Realiza o diagnóstico de compatibilidade
    const diagnosis = await this.diagnoseRepo(repo.name);

    if (diagnosis.is_ready) {
      saveConfig(cfg);
      return {
        success: true,
        is_ready: true,
        active_repo: cfg.active_repo,
        diagnosis,
      };
    }

    // Se faltarem arquivos essenciais, não força criação indiscriminada; informa para o Wizard
    return {
      success: true,
      is_ready: false,
      active_repo: cfg.active_repo,
      diagnosis,
    };
  }

  async createRepo(payload: {
    name: string;
    owner?: string;
    description?: string;
    is_private?: boolean;
    enable_protection?: boolean;
    required_approvals?: number;
    auto_initialize?: boolean;
  }) {
    const repoName = payload.name.trim().toLowerCase().replace(/\s+/g, "-");
    if (!repoName) {
      throw new Error("Nome do repositório é obrigatório");
    }

    const cfg = loadConfig();
    const repoDir = path.join(PROJECTS_DIR, repoName);

    if (!cfg.authenticated || !cfg.token) {
      // Criação Local
      if (!fs.existsSync(repoDir)) {
        fs.mkdirSync(repoDir, { recursive: true });
      }
      await ensureGitRepo(repoDir, cfg.user);
      cfg.active_repo = {
        name: repoName,
        full_name: `local/${repoName}`,
        description: payload.description || "Repositório Local",
        is_private: false,
        default_branch: "main",
        is_local: true,
        is_cloned_locally: true,
        is_owner: true,
        permissions: { admin: true, push: true, pull: true },
      };
      saveConfig(cfg);

      if (payload.auto_initialize) {
        return await this.initializeRepo({
          name: repoName,
          preset: "recommended",
          project_config: {
            name: repoName,
            description:
              payload.description ||
              "Repositório de especificações e governança",
          },
        });
      }

      const diagnosis = await this.diagnoseRepo(repoName);
      return {
        success: true,
        message: `Repositório local '${repoName}' criado!`,
        repo: cfg.active_repo,
        is_ready: diagnosis.is_ready,
        diagnosis,
      };
    }

    const owner = payload.owner?.trim() || cfg.user?.login;
    const userLogin = (cfg.user?.login || "").toLowerCase();
    const isPersonal =
      !owner ||
      owner.toLowerCase() === userLogin ||
      owner.toLowerCase() === "personal" ||
      owner.toLowerCase() === "all" ||
      owner.toLowerCase() === "local";
    const targetOwner = isPersonal ? (cfg.user?.login || owner) : owner;
    const endpoint = isPersonal ? "/user/repos" : `/orgs/${targetOwner}/repos`;

    const { statusCode, data: respData } = await callGitProviderAPI(
      endpoint,
      cfg.token,
      "POST",
      {
        name: repoName,
        description: payload.description || "Repositório de Governança",
        private: payload.is_private ?? true,
        visibility: (payload.is_private ?? true) ? "private" : "public",
        auto_init: false, // Repositório mantido em branco
      },
    );

    if (statusCode !== 200 && statusCode !== 201) {
      let errDetail = respData?.message || "Falha na requisição";
      if (Array.isArray(respData?.errors) && respData.errors.length > 0) {
        const extra = respData.errors
          .map((e: any) => e.message || e.code || JSON.stringify(e))
          .join(", ");
        errDetail += ` (${extra})`;
      }
      throw new Error(`Erro ao criar repositório no GitHub: ${errDetail}`);
    }

    const ownerLogin = respData.owner?.login || targetOwner;
    const repoFullName = respData.full_name || `${ownerLogin}/${repoName}`;
    const defaultBranch = respData.default_branch || "main";
    const remoteUrl = respData.html_url || `https://github.com/${repoFullName}`;

    // Registra a organização na lista de orgs se não existir
    if (ownerLogin && ownerLogin.toLowerCase() !== userLogin) {
      if (!cfg.orgs) cfg.orgs = [];
      if (!cfg.orgs.some((o: any) => o.login?.toLowerCase() === ownerLogin.toLowerCase())) {
        cfg.orgs.push({
          login: ownerLogin,
          name: respData.owner?.name || ownerLogin,
          avatar_url: respData.owner?.avatar_url,
          description: respData.owner?.description,
        });
      }
    }

    // Clona ou inicializa o repositório em branco para a máquina
    await ensureGitRepo(repoDir, cfg.user, remoteUrl, cfg.token, repoName);

    cfg.active_repo = {
      name: repoName,
      full_name: repoFullName,
      html_url: remoteUrl,
      description: payload.description || "",
      is_private: payload.is_private ?? true,
      default_branch: defaultBranch,
      is_owner:
        ownerLogin.toLowerCase() === userLogin,
      permissions: { admin: true, push: true, pull: true },
    };
    saveConfig(cfg);

    if (payload.auto_initialize) {
      return await this.initializeRepo({
        name: repoName,
        preset: "recommended",
        project_config: {
          name: repoName,
          description:
            payload.description || "Repositório de especificações e governança",
        },
        security: {
          enable_branch_protection: payload.enable_protection ?? true,
          required_approvals: payload.required_approvals ?? 1,
          create_codeowners: true,
        },
      });
    }

    const diagnosis = await this.diagnoseRepo(repoName);
    return {
      success: true,
      message: `Repositório ${repoFullName} criado com sucesso!`,
      repo: cfg.active_repo,
      is_ready: diagnosis.is_ready,
      diagnosis,
    };
  }

  async initializeRepo(payload: RepoInitializePayload) {
    const {
      name,
      preset = "recommended",
      project_config,
      security,
      folders,
      include_spec_memory,
    } = payload;
    if (!name) {
      throw new Error("Nome do repositório é obrigatório para inicialização");
    }

    const cfg = loadConfig();
    const repoDir = path.join(PROJECTS_DIR, name);

    if (!fs.existsSync(repoDir)) {
      fs.mkdirSync(repoDir, { recursive: true });
    }

    // 1. .hidden_files.json
    const defaultHiddenFiles = [
      ".git",
      ".gitignore",
      ".DS_Store",
      "node_modules",
      ".project.config.json",
      ".docs.metadata.json",
      ".dictionary.json",
      ".templates.json",
      ".templates.metadata.json",
      ".spec-memory",
      ".skills",
      ".agents",
      ".tools",
      ".mcp.json",
      ".hidden_files.json",
    ];
    fs.writeFileSync(
      path.join(repoDir, ".hidden_files.json"),
      JSON.stringify(defaultHiddenFiles, null, 2),
      "utf-8",
    );

    // 2. .project.config.json (com taxonomias e cores dinâmicas)
    const defaultCategories = [
      {
        id: "visao-geral",
        label: "Visão Geral",
        color: "#1a73e8",
        description: "Arquitetura e visão geral",
      },
      {
        id: "especificacoes",
        label: "Especificações",
        color: "#10b981",
        description: "Regras de negócio e PRDs",
      },
      {
        id: "engenharia",
        label: "Engenharia",
        color: "#8b5cf6",
        description: "Guias técnicos e padrões de código",
      },
    ];

    const defaultTags = [
      { id: "core", label: "Core", color: "#1a73e8" },
      { id: "api", label: "API", color: "#06b6d4" },
      { id: "security", label: "Segurança", color: "#ef4444" },
      { id: "frontend", label: "Frontend", color: "#f59e0b" },
      { id: "database", label: "Banco de Dados", color: "#10b981" },
    ];

    const defaultStatuses = [
      { id: "draft", label: "Rascunho", color: "#94a3b8" },
      { id: "in_review", label: "Em Revisão", color: "#f59e0b" },
      { id: "approved", label: "Aprovado", color: "#10b981" },
      { id: "deprecated", label: "Depreciado", color: "#ef4444" },
    ];

    const defaultBadges = [
      { id: "ssot", label: "SSOT", color: "#1a73e8" },
      { id: "rfc", label: "RFC", color: "#8b5cf6" },
      { id: "sdd", label: "SDD", color: "#10b981" },
      { id: "prd", label: "PRD", color: "#06b6d4" },
    ];

    const targetProjectConfig = {
      project: {
        name: project_config?.name || name,
        description:
          project_config?.description ||
          "Repositório de documentação e especificações.",
        version: "1.0.0",
        architecture_pattern: "Documentação Viva & Git SSOT",
        repository_url: cfg.active_repo?.html_url || "",
        lead: cfg.user?.login ? `@${cfg.user.login}` : "@equipe",
      },
      categories: project_config?.categories || defaultCategories,
      tags: project_config?.tags || defaultTags,
      statuses: project_config?.statuses || defaultStatuses,
      badges: project_config?.badges || defaultBadges,
      governance_rules: project_config?.governance_rules || {
        min_approvals_default: 1,
      },
      reviewers: cfg.user?.login ? [`@${cfg.user.login}`] : [],
      ai_assistant_prompt:
        "Você é o assistente inteligente de documentação e engenharia do Context OS.",
    };

    fs.writeFileSync(
      path.join(repoDir, ".project.config.json"),
      JSON.stringify(targetProjectConfig, null, 2),
      "utf-8",
    );

    // 3. .docs.metadata.json
    const docsMetaPath = path.join(repoDir, ".docs.metadata.json");
    if (!fs.existsSync(docsMetaPath)) {
      fs.writeFileSync(docsMetaPath, JSON.stringify([], null, 2), "utf-8");
    }

    // 4. .dictionary.json & .templates.json
    const dictPath = path.join(repoDir, ".dictionary.json");
    if (!fs.existsSync(dictPath)) {
      fs.writeFileSync(
        dictPath,
        JSON.stringify({ version: "1.0.0", terms: [], domains: [] }, null, 2),
        "utf-8",
      );
    }

    const templatesPath = path.join(repoDir, ".templates.json");
    if (!fs.existsSync(templatesPath)) {
      fs.writeFileSync(templatesPath, JSON.stringify([], null, 2), "utf-8");
    }

    // 5. CODEOWNERS
    const shouldCreateCodeowners = security?.create_codeowners ?? true;
    if (shouldCreateCodeowners) {
      const githubDir = path.join(repoDir, ".github");
      if (!fs.existsSync(githubDir)) {
        fs.mkdirSync(githubDir, { recursive: true });
      }
      const ownerLogin =
        cfg.active_repo?.full_name?.split("/")[0] || cfg.user?.login || "admin";
      const codeownersContent = `# Context OS - Governança & Root of Trust
# Arquivos críticos de controle de acesso exigem aprovação do proprietário
.project.config.json @${ownerLogin}
.gitignore @${ownerLogin}
.github/ @${ownerLogin}
`;
      fs.writeFileSync(
        path.join(githubDir, "CODEOWNERS"),
        codeownersContent,
        "utf-8",
      );
    }

    // 6. Pastas de Trabalho Opcionais (apenas se especificadas)
    const targetFolders = folders || [];
    for (const folder of targetFolders) {
      const folderPath = path.join(repoDir, folder);
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
        const keepPath = path.join(folderPath, ".gitkeep");
        if (!fs.existsSync(keepPath)) {
          fs.writeFileSync(keepPath, "", "utf-8");
        }
      }
    }

    // 7. .spec-memory
    const shouldIncludeSpecMemory =
      include_spec_memory ?? preset === "recommended";
    if (shouldIncludeSpecMemory) {
      const specMemoryDir = path.join(repoDir, ".spec-memory");
      if (!fs.existsSync(specMemoryDir)) {
        fs.mkdirSync(specMemoryDir, { recursive: true });
        fs.writeFileSync(path.join(specMemoryDir, ".gitkeep"), "", "utf-8");
      }
    }

    // 8. Branch Protection no GitHub
    let protectionMessage = "Não aplicável";
    const shouldEnableProtection =
      security?.enable_branch_protection ?? preset === "recommended";
    if (
      shouldEnableProtection &&
      cfg.authenticated &&
      cfg.token &&
      cfg.active_repo?.full_name?.includes("/")
    ) {
      const defaultBranch = cfg.active_repo?.default_branch || "main";
      const pRes = await applyBranchProtection(
        cfg.active_repo.full_name,
        defaultBranch,
        cfg.token,
        security?.required_approvals || 1,
      );
      protectionMessage =
        pRes.statusCode === 200 || pRes.statusCode === 201
          ? "Ativada com sucesso"
          : `Pendente (${pRes.data?.message || "Aviso"})`;
    }

    // 9. Git Add, Commit e Push
    const isGit = await isGitRepo(repoDir);
    if (isGit) {
      try {
        await executeGitCommand("git add -A", repoDir);
        await executeGitCommand(
          'git commit -m "chore(context-os): inicializar governanca do framework"',
          repoDir,
        );

        if (cfg.token && cfg.active_repo?.html_url) {
          const defaultBranch = cfg.active_repo?.default_branch || "main";
          await executeGitCommand(`git push origin ${defaultBranch}`, repoDir);
        }
      } catch (gitErr: any) {
        console.warn(
          `[ReposService] Aviso no commit inicial em ${name}:`,
          gitErr.message,
        );
      }
    }

    // 10. Atualiza active_repo e invalida árvore
    if (!cfg.active_repo || cfg.active_repo.name !== name) {
      cfg.active_repo = {
        name,
        full_name: cfg.active_repo?.full_name || name,
        description: targetProjectConfig.project.description,
        is_private: cfg.active_repo?.is_private ?? false,
        default_branch: cfg.active_repo?.default_branch || "main",
        is_local: !cfg.token,
        permissions: { admin: true, push: true, pull: true },
      };
    }
    saveConfig(cfg);
    workspaceService.invalidateTreeCache(name);

    const diagnosis = await this.diagnoseRepo(name);

    return {
      success: true,
      message: `Repositório '${name}' inicializado com sucesso!`,
      active_repo: cfg.active_repo,
      protection: protectionMessage,
      diagnosis,
    };
  }

  async deleteRepo(payload: {
    name: string;
    owner?: string;
    delete_remote?: boolean;
    delete_local?: boolean;
  }) {
    const { name, owner, delete_remote, delete_local = true } = payload;
    if (!name) {
      throw new Error("Nome do repositório é obrigatório para exclusão");
    }

    const cfg = loadConfig();
    let remoteDeleted = false;

    // Delete remote if requested and authenticated (never for default/local repos)
    if (
      delete_remote &&
      cfg.authenticated &&
      cfg.token &&
      name !== "default" &&
      name !== "_default" &&
      name !== "local"
    ) {
      const repoOwner = owner || cfg.user?.login;
      if (!repoOwner) {
        throw new Error(
          "Proprietário do repositório não encontrado para exclusão remota",
        );
      }
      const endpoint = `/repos/${repoOwner}/${name}`;
      const { statusCode, data } = await callGitProviderAPI(
        endpoint,
        cfg.token,
        "DELETE",
      );
      if (statusCode === 204 || statusCode === 200) {
        remoteDeleted = true;
      } else {
        throw new Error(
          data?.message ||
            `Falha ao excluir no provedor remoto (Status ${statusCode})`,
        );
      }
    }

    // Delete local directory if requested
    if (delete_local) {
      const localDir = path.join(PROJECTS_DIR, name);
      if (fs.existsSync(localDir)) {
        try {
          fs.rmSync(localDir, { recursive: true, force: true });
        } catch (err: any) {
          console.error(
            `[ReposService] Erro ao remover pasta local ${localDir}:`,
            err,
          );
        }
      }
      workspaceService.invalidateTreeCache(name);
    }

    // Reset active_repo if deleted
    if (cfg.active_repo?.name === name) {
      cfg.active_repo = null;
      saveConfig(cfg);
    }

    return {
      success: true,
      remoteDeleted,
      message: `Repositório '${name}' excluído com sucesso.`,
    };
  }

  async updateRepo(payload: {
    current_name: string;
    new_name?: string;
    description?: string;
    is_private?: boolean;
    owner?: string;
  }) {
    const { current_name, new_name, description, is_private, owner } = payload;
    if (!current_name) {
      throw new Error("Nome atual do repositório é obrigatório.");
    }

    const cfg = loadConfig();
    const repoOwner =
      owner || cfg.active_repo?.owner || cfg.user?.login || "local";
    const isLocal =
      !cfg.authenticated || !cfg.token || cfg.active_repo?.is_local;
    const targetName = (new_name || current_name)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");

    if (!targetName) {
      throw new Error("O novo nome do repositório não pode ser vazio.");
    }

    let remoteUpdated = false;
    let updatedRemoteUrl = cfg.active_repo?.html_url || "";
    let updatedFullName =
      cfg.active_repo?.full_name || `${repoOwner}/${targetName}`;

    // 1. Atualizar no Provedor Remoto se aplicável
    if (
      !isLocal &&
      cfg.token &&
      current_name !== "default" &&
      current_name !== "_default" &&
      current_name !== "local"
    ) {
      const endpoint = `/repos/${repoOwner}/${current_name}`;
      const updatePayload: any = {};
      if (new_name && new_name !== current_name) {
        updatePayload.name = targetName;
      }
      if (description !== undefined) {
        updatePayload.description = description;
      }
      if (is_private !== undefined) {
        updatePayload.private = is_private;
      }

      const { statusCode, data } = await callGitProviderAPI(
        endpoint,
        cfg.token,
        "PATCH",
        updatePayload,
      );
      if (statusCode === 200) {
        remoteUpdated = true;
        updatedRemoteUrl = data.html_url || updatedRemoteUrl;
        updatedFullName = data.full_name || `${repoOwner}/${targetName}`;
      } else {
        throw new Error(
          data?.message ||
            `Falha ao atualizar repositório no provedor remoto (Status ${statusCode})`,
        );
      }
    }

    // 2. Renomear pasta local se o nome mudou
    const oldDir = path.join(PROJECTS_DIR, current_name);
    const newDir = path.join(PROJECTS_DIR, targetName);

    if (targetName !== current_name && fs.existsSync(oldDir)) {
      try {
        fs.renameSync(oldDir, newDir);
        workspaceService.invalidateTreeCache(current_name);
        workspaceService.invalidateTreeCache(targetName);
      } catch (err: any) {
        console.error(
          `[ReposService] Erro ao renomear pasta local de ${oldDir} para ${newDir}:`,
          err,
        );
      }
    }

    // 3. Atualizar .project.config.json se existir
    const activeDir = fs.existsSync(newDir)
      ? newDir
      : fs.existsSync(oldDir)
        ? oldDir
        : null;
    if (activeDir) {
      const pConfigPath = path.join(activeDir, ".project.config.json");
      if (fs.existsSync(pConfigPath)) {
        try {
          const pConfig = JSON.parse(fs.readFileSync(pConfigPath, "utf-8"));
          if (pConfig && typeof pConfig === "object") {
            if (!pConfig.project) pConfig.project = {};
            if (targetName) pConfig.project.name = targetName;
            if (description !== undefined)
              pConfig.project.description = description;
            fs.writeFileSync(
              pConfigPath,
              JSON.stringify(pConfig, null, 2),
              "utf-8",
            );
          }
        } catch {}
      }
    }

    // 4. Atualizar config.json do Context OS se era o active_repo
    if (cfg.active_repo?.name === current_name) {
      cfg.active_repo = {
        ...cfg.active_repo,
        name: targetName,
        full_name: updatedFullName,
        html_url: updatedRemoteUrl,
        description:
          description !== undefined ? description : cfg.active_repo.description,
        is_private:
          is_private !== undefined ? is_private : cfg.active_repo.is_private,
      };
      saveConfig(cfg);
    }

    return {
      success: true,
      remoteUpdated,
      message: `Repositório '${targetName}' atualizado com sucesso.`,
      repo: {
        name: targetName,
        full_name: updatedFullName,
        html_url: updatedRemoteUrl,
        description: description,
        is_private: is_private,
      },
    };
  }

  async cloneRepo(payload: {
    source_name: string;
    new_name: string;
    owner?: string;
    description?: string;
    is_private?: boolean;
  }) {
    const { source_name, new_name, owner, description, is_private } = payload;
    if (!source_name) {
      throw new Error("Nome do repositório de origem é obrigatório.");
    }
    const targetName = new_name?.trim().toLowerCase().replace(/\s+/g, "-");
    if (!targetName) {
      throw new Error("Novo nome do repositório clonado é obrigatório.");
    }

    const cfg = loadConfig();
    const sourceDir = path.join(PROJECTS_DIR, source_name);

    // 1. Criar o novo repositório (local ou remoto)
    const createResult = await this.createRepo({
      name: targetName,
      owner,
      description: description || `Cópia clonada de ${source_name}`,
      is_private: is_private ?? true,
      auto_initialize: false,
    });

    const targetDir = path.join(PROJECTS_DIR, targetName);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // 2. Copiar todos os arquivos de source_name para target_name (exceto .git)
    if (fs.existsSync(sourceDir)) {
      const copyRecursive = (src: string, dest: string) => {
        const entries = fs.readdirSync(src, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name === ".git") continue; // nunca copia a pasta .git
          const srcPath = path.join(src, entry.name);
          const destPath = path.join(dest, entry.name);
          if (entry.isDirectory()) {
            if (!fs.existsSync(destPath))
              fs.mkdirSync(destPath, { recursive: true });
            copyRecursive(srcPath, destPath);
          } else {
            fs.copyFileSync(srcPath, destPath);
          }
        }
      };
      copyRecursive(sourceDir, targetDir);
    }

    // 3. Atualizar o nome no .project.config.json do clone
    const pConfigPath = path.join(targetDir, ".project.config.json");
    if (fs.existsSync(pConfigPath)) {
      try {
        const pConfig = JSON.parse(fs.readFileSync(pConfigPath, "utf-8"));
        if (pConfig && typeof pConfig === "object") {
          if (!pConfig.project) pConfig.project = {};
          pConfig.project.name = targetName;
          if (description) pConfig.project.description = description;
          fs.writeFileSync(
            pConfigPath,
            JSON.stringify(pConfig, null, 2),
            "utf-8",
          );
        }
      } catch {}
    }

    // 4. Se houver git no repositório destino, commitar e fazer push
    const clonedRepo =
      (createResult as any).repo || (createResult as any).active_repo;
    if (fs.existsSync(path.join(targetDir, ".git"))) {
      await executeGitCommand("git add -A", targetDir);
      await executeGitCommand(
        `git commit -m "feat: initial cloned structure from ${source_name}" || true`,
        targetDir,
      );
      if (cfg.authenticated && cfg.token && !clonedRepo?.is_local) {
        await executeGitCommand("git push -u origin main || true", targetDir);
      }
    }

    workspaceService.invalidateTreeCache(targetName);

    return {
      success: true,
      message: `Repositório '${targetName}' clonado a partir de '${source_name}' com sucesso!`,
      repo: clonedRepo,
    };
  }

  async listOrgs() {
    const cfg = loadConfig();
    const orgsMap = new Map<string, any>();

    // 1. Inclui conta pessoal do usuário como primeira opção de namespace se autenticado
    if (cfg.user?.login) {
      const userLogin = cfg.user.login;
      orgsMap.set(userLogin.toLowerCase(), {
        login: userLogin,
        avatar_url: cfg.user.avatar_url,
        description: 'Conta Pessoal',
        full_name: `${cfg.user.name || userLogin} (Pessoal)`,
        is_personal: true,
      });
    }

    // 2. Inclui orgs salvas anteriormente na configuração
    if (Array.isArray(cfg.orgs)) {
      for (const o of cfg.orgs) {
        if (o?.login) orgsMap.set(o.login.toLowerCase(), o);
      }
    }

    if (!cfg.authenticated || !cfg.token) {
      return { orgs: Array.from(orgsMap.values()) };
    }

    try {
      // 3. Busca lista direta de organizações do usuário (/user/orgs)
      const { statusCode, data } = await callGitProviderAPI(
        "/user/orgs?per_page=100",
        cfg.token,
      );
      if (statusCode === 200 && Array.isArray(data)) {
        for (const o of data) {
          if (o?.login) {
            orgsMap.set(o.login.toLowerCase(), {
              login: o.login,
              avatar_url: o.avatar_url,
              description: o.description || "",
              full_name: o.full_name || o.name || o.login,
            });
          }
        }
      }

      // 4. Busca memberships ativas do usuário (/user/memberships/orgs)
      try {
        const { statusCode: memStatus, data: memData } = await callGitProviderAPI(
          "/user/memberships/orgs?state=active&per_page=100",
          cfg.token,
        );
        if (memStatus === 200 && Array.isArray(memData)) {
          for (const item of memData) {
            const org = item.organization;
            if (org?.login) {
              orgsMap.set(org.login.toLowerCase(), {
                login: org.login,
                avatar_url: org.avatar_url,
                description: org.description || "",
                full_name: org.name || org.login,
                role: item.role,
              });
            }
          }
        }
      } catch (memErr) {
        console.warn("[ReposService] Erro ao buscar memberships de orgs:", memErr);
      }

      // 5. Auto-descobre organizações a partir dos repositórios que o usuário tem acesso (/user/repos)
      try {
        const { statusCode: repoStatus, data: repoData } = await callGitProviderAPI(
          "/user/repos?per_page=100&sort=updated",
          cfg.token,
        );
        if (repoStatus === 200 && Array.isArray(repoData)) {
          for (const r of repoData) {
            if (r.owner && (r.owner.type === "Organization" || r.owner.login !== cfg.user?.login) && r.owner.login) {
              const oLogin = r.owner.login;
              if (!orgsMap.has(oLogin.toLowerCase())) {
                orgsMap.set(oLogin.toLowerCase(), {
                  login: oLogin,
                  avatar_url: r.owner.avatar_url,
                  description: "",
                  full_name: oLogin,
                });
              }
            }
          }
        }
      } catch (repoErr) {
        console.warn("[ReposService] Erro ao auto-descobrir orgs de repos:", repoErr);
      }

      cfg.orgs = Array.from(orgsMap.values());
      saveConfig(cfg);
    } catch (e) {
      console.warn("[ReposService] Erro ao listar organizações:", e);
    }

    return { orgs: Array.from(orgsMap.values()) };
  }

  async createOrg(payload: {
    username: string;
    full_name?: string;
    description?: string;
    visibility?: string;
  }) {
    const username = payload.username.trim().toLowerCase().replace(/\s+/g, "-");
    if (!username) {
      throw new Error("Nome da organização (identificador) é obrigatório.");
    }

    const cfg = loadConfig();
    if (!Array.isArray(cfg.orgs)) {
      cfg.orgs = [];
    }

    let orgAvatar = `https://github.com/${encodeURIComponent(username)}.png`;
    let orgFullName = payload.full_name || username;
    let orgDesc = payload.description || "";

    if (cfg.authenticated && cfg.token) {
      // Tenta buscar metadados enriquecidos da organização na API do GitHub
      try {
        const { statusCode: orgStatus, data: orgData } = await callGitProviderAPI(
          `/orgs/${username}`,
          cfg.token,
        );
        if (orgStatus === 200 && orgData) {
          orgAvatar = orgData.avatar_url || orgAvatar;
          orgFullName = orgData.name || orgFullName;
          orgDesc = orgData.description || orgDesc;
        }
      } catch (checkErr) {
        console.warn("[ReposService] Verificação de org /orgs/:name falhou:", checkErr);
      }
    }

    const linkedOrg = {
      login: username,
      full_name: orgFullName,
      description: orgDesc,
      avatar_url: orgAvatar,
    };

    const existingIdx = cfg.orgs.findIndex(
      (o: any) => o?.login?.toLowerCase() === username.toLowerCase(),
    );
    if (existingIdx >= 0) {
      cfg.orgs[existingIdx] = linkedOrg;
    } else {
      cfg.orgs.push(linkedOrg);
    }
    saveConfig(cfg);

    return {
      success: true,
      org: linkedOrg,
      message: `Organização '${username}' vinculada com sucesso!`,
    };
  }
}

export const reposService = new ReposService();
