import fs from 'node:fs';
import path from 'node:path';
import {
  CONFIG_PATH,
  PROJECTS_CONFIG_PATH,
  PROJECTS_DIR,
  loadCanonicalTemplates,
  DEFAULT_GLOBAL_SYSTEM_PROMPT,
  DEFAULT_TEMPLATE_CREATOR_PROMPT,
  DEFAULT_PROJECT_ABOUT_PROMPT,
} from './constants.js';
import { validateJsonSchema } from '../utils/schema.validator.js';

export interface WorkspaceChange {
  path: string;
  type: 'ADDED' | 'MODIFIED' | 'DELETED';
  old_content: string;
  new_content: string;
  timestamp: string;
}

export interface AppConfig {
  authenticated: boolean;
  token: string;
  user: any;
  orgs: any[];
  active_repo: any;
  ai_settings: {
    provider: string;
    model: string;
    api_key: string;
    custom_endpoint: string;
  };
  settings: {
    auto_pr_on_save: boolean;
    template_creator_prompt: string;
    global_system_prompt: string;
  };
  workspace_changes: Record<string, WorkspaceChange[]>;
  templates?: any[];
  workflows?: any[];
  prs?: any[];
  governance?: {
    min_approvals: number;
    reviewers: string[];
  };
}

export function loadProjectsMasterConfig(): Record<string, any> {
  if (fs.existsSync(PROJECTS_CONFIG_PATH)) {
    try {
      const data = fs.readFileSync(PROJECTS_CONFIG_PATH, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      console.error(`Erro ao carregar ${PROJECTS_CONFIG_PATH}:`, e);
    }
  }

  // Fallback
  return {
    mandatory_structure: {
      directories: [
        'project', 'domains', 'engenharia', 'templates',
        '.spec-memory/_rules', '.spec-memory/concepts', '.spec-memory/decisions',
        '.spec-memory/gotchas', '.spec-memory/handoffs', '.spec-memory/sessions',
      ],
      essential_files: [
        {
          path: '.spec-memory/_meta.yaml',
          content: 'version: 1.0\ninitialized: true\n',
        },
      ],
    },
    project_defaults: {
      version: '1.0.0',
      categories: ['geral', 'arquitetura', 'engenharia', 'produto', 'segurança', 'infraestrutura', 'dados'],
      tags: ['backend', 'frontend', 'api', 'database', 'security', 'core', 'auth', 'mobile', 'spec'],
      statuses: [
        { key: 'draft', label: 'Rascunho (DRAFT)', badge: 'badge-neutral' },
        { key: 'proposed', label: 'Proposto (PROPOSED)', badge: 'badge-warning' },
        { key: 'review', label: 'Em Revisão (REVIEW)', badge: 'badge-info' },
        { key: 'approved', label: 'Aprovado (APPROVED)', badge: 'badge-success' },
        { key: 'superseded', label: 'Substituído (SUPERSEDED)', badge: 'badge-secondary' },
        { key: 'deprecated', label: 'Obsoleto (DEPRECATED)', badge: 'badge-danger' },
      ],
      governance_rules: { min_approvals_default: 1 },
      default_reviewers: [],
    },
    suggested_domains: [],
    workflows: [],
    default_project_about_prompt: DEFAULT_PROJECT_ABOUT_PROMPT,
  };
}

export function saveProjectsMasterConfig(cfg: any): void {
  fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  fs.writeFileSync(PROJECTS_CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
}

export function loadConfig(): AppConfig {
  const canonical = loadCanonicalTemplates();
  let cfg: any = {};

  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
      cfg = JSON.parse(data);
    } catch (e) {
      console.error(`Erro ao carregar ${CONFIG_PATH}:`, e);
    }
  }

  if (!cfg || Object.keys(cfg).length === 0) {
    cfg = {
      authenticated: false,
      token: '',
      ai_settings: {
        provider: 'gemini',
        model: 'gemini-3.5-flash',
        api_key: process.env.GEMINI_API_KEY || '',
        custom_endpoint: 'http://localhost:11434/v1',
      },
      settings: {
        auto_pr_on_save: false,
        template_creator_prompt: DEFAULT_TEMPLATE_CREATOR_PROMPT,
        global_system_prompt: DEFAULT_GLOBAL_SYSTEM_PROMPT,
      },
      workspace_changes: {},
      user: null,
      orgs: [],
      active_repo: null,
      prs: [],
    };
  }

  cfg.templates = canonical;
  const master = loadProjectsMasterConfig();
  if (!cfg.workflows || cfg.workflows.length === 0) {
    cfg.workflows = master.workflows || [];
  }
  return cfg as AppConfig;
}

export function saveConfig(cfg: AppConfig): void {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
  } catch (e) {
    console.error(`Erro ao salvar ${CONFIG_PATH}:`, e);
  }
}

const BINARY_EXTENSIONS = new Set([
  '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svgz',
  '.zip', '.tar', '.gz', '.7z', '.rar',
  '.mp4', '.mp3', '.wav', '.ogg', '.mov', '.avi',
  '.exe', '.dll', '.dylib', '.so', '.wasm', '.bin'
]);

function sanitizeContentForStorage(filePath: string, content: string): string {
  if (!content) return '';
  const ext = path.extname(filePath).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) {
    return `[Arquivo binário: ${ext}]`;
  }
  if (content.length > 200000) {
    return content.slice(0, 10000) + `\n\n... [Conteúdo truncado para armazenamento (${content.length} bytes)]`;
  }
  return content;
}

export function recordChange(
  repoName: string,
  relPath: string,
  changeType: 'ADDED' | 'MODIFIED' | 'DELETED',
  oldContent: string = '',
  newContent: string = ''
): void {
  const cleanPath = relPath.trim().replace(/^\/+/, '');
  if (!cleanPath) return;

  const safeOldContent = sanitizeContentForStorage(cleanPath, oldContent);
  const safeNewContent = sanitizeContentForStorage(cleanPath, newContent);

  const cfg = loadConfig();
  if (!cfg.workspace_changes) {
    cfg.workspace_changes = {};
  }
  if (!cfg.workspace_changes[repoName]) {
    cfg.workspace_changes[repoName] = [];
  }

  const existingIdx = cfg.workspace_changes[repoName].findIndex((c) => c.path === cleanPath);
  const now = new Date().toISOString();

  if (existingIdx >= 0) {
    const existing = cfg.workspace_changes[repoName][existingIdx];
    // Preserve initial old_content if previously added/modified
    const preservedOldContent = existing.old_content !== undefined ? existing.old_content : safeOldContent;
    
    // If the file reverted to original content, discard the change
    if (preservedOldContent === safeNewContent && changeType !== 'DELETED') {
      cfg.workspace_changes[repoName].splice(existingIdx, 1);
      saveConfig(cfg);
      return;
    }

    cfg.workspace_changes[repoName][existingIdx] = {
      path: cleanPath,
      type: existing.type === 'ADDED' && changeType !== 'DELETED' ? 'ADDED' : changeType,
      old_content: preservedOldContent,
      new_content: safeNewContent,
      timestamp: now,
    };
  } else {
    // If saving identical content from scratch, don't record a change
    if (safeOldContent === safeNewContent && changeType !== 'DELETED') {
      return;
    }

    cfg.workspace_changes[repoName].push({
      path: cleanPath,
      type: changeType,
      old_content: safeOldContent,
      new_content: safeNewContent,
      timestamp: now,
    });
  }

  saveConfig(cfg);
}

export function clearWorkspaceChanges(repoName: string): void {
  const cfg = loadConfig();
  if (cfg.workspace_changes && cfg.workspace_changes[repoName]) {
    cfg.workspace_changes[repoName] = [];
    saveConfig(cfg);
  }
}

export function getSSOTDefaultDir(): string {
  const defaultDir = path.join(PROJECTS_DIR, 'default');
  const altDefaultDir = path.join(PROJECTS_DIR, '_default');

  if (fs.existsSync(altDefaultDir) && !fs.existsSync(defaultDir)) {
    return altDefaultDir;
  }
  return defaultDir;
}

export function syncBlueprint(sourceDir: string, targetDir: string, repoName: string = ''): void {
  if (!fs.existsSync(sourceDir)) return;
  fs.mkdirSync(targetDir, { recursive: true });

  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;

    const srcPath = path.join(sourceDir, entry.name);
    const dstPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      syncBlueprint(srcPath, dstPath, repoName);
    } else if (entry.isFile()) {
      if (!fs.existsSync(dstPath)) {
        fs.mkdirSync(path.dirname(dstPath), { recursive: true });
        fs.copyFileSync(srcPath, dstPath);
        console.log(`[SSOT Onboarding] Criado arquivo essencial '${entry.name}' no repositório '${repoName || path.basename(targetDir)}'.`);

        // Validate JSON if applicable
        validateAndReportSchema(dstPath, entry.name);
      } else {
        // File already exists -> Verify structure integrity, alert and auto-repair if corrupted/partial
        verifyAndRepairStructure(srcPath, dstPath, entry.name, repoName || path.basename(targetDir));
      }
    }
  }
}

function validateAndReportSchema(filePath: string, fileName: string): void {
  try {
    if (fileName === '.project.config.json' || fileName === 'project.config.json') {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const res = validateJsonSchema('project.config', data);
      if (!res.valid) {
        console.warn(`[Schema Warning] project.config em ${filePath} inválido:`, res.errors);
      }
    } else if (fileName === '.dictionary.json' || fileName === 'dictionary.json') {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const res = validateJsonSchema('dictionary', data);
      if (!res.valid) {
        console.warn(`[Schema Warning] dictionary em ${filePath} inválido:`, res.errors);
      }
    } else if (fileName === '.docs.metadata.json' || fileName === 'docs.metadata.json') {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const res = validateJsonSchema('docs.metadata', data);
      if (!res.valid) {
        console.warn(`[Schema Warning] docs.metadata em ${filePath} inválido:`, res.errors);
      }
    } else if (fileName === '.templates.json' || fileName === 'templates.json') {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const res = validateJsonSchema('templates', data);
      if (!res.valid) {
        console.warn(`[Schema Warning] templates em ${filePath} inválido:`, res.errors);
      }
    }
  } catch (err) {
    console.warn(`[Schema Warning] Erro ao validar ${fileName} em ${filePath}:`, err);
  }
}

function verifyAndRepairStructure(srcPath: string, dstPath: string, fileName: string, repoName: string): void {
  if (!fileName.endsWith('.json')) return;

  let targetContent = '';
  try {
    targetContent = fs.readFileSync(dstPath, 'utf-8');
  } catch {
    return;
  }

  let targetJson: any;

  try {
    targetJson = JSON.parse(targetContent);
  } catch (parseError) {
    console.warn(`[SSOT Auto-Repair] ⚠️ JSON corrompido detectado em '${fileName}' (${repoName}). Restaurando a partir do default.`);
    try {
      fs.copyFileSync(srcPath, dstPath);
      return;
    } catch (copyErr) {
      console.error(`[SSOT Auto-Repair] Falha ao restaurar '${fileName}':`, copyErr);
      return;
    }
  }

  let srcJson: any = {};
  try {
    srcJson = JSON.parse(fs.readFileSync(srcPath, 'utf-8'));
  } catch {}

  let modified = false;

  if (fileName === '.project.config.json' || fileName === 'project.config.json') {
    if (typeof targetJson !== 'object' || targetJson === null || Array.isArray(targetJson)) {
      targetJson = { ...srcJson };
      modified = true;
    } else {
      if (!targetJson.project || typeof targetJson.project !== 'object') {
        targetJson.project = { ...(srcJson.project || { name: repoName, description: '', version: '1.0.0' }) };
        modified = true;
      }
      if (!targetJson.project.name) {
        targetJson.project.name = repoName;
        modified = true;
      }
      if (!Array.isArray(targetJson.categories)) {
        targetJson.categories = srcJson.categories || ['geral', 'engenharia', 'produto'];
        modified = true;
      }
      if (!Array.isArray(targetJson.tags)) {
        targetJson.tags = srcJson.tags || ['rfc', 'prd', 'api', 'guia'];
        modified = true;
      }
      if (!Array.isArray(targetJson.statuses) || targetJson.statuses.length === 0) {
        targetJson.statuses = srcJson.statuses || [
          { key: 'draft', label: 'Rascunho (DRAFT)', badge: 'badge-neutral' },
          { key: 'review', label: 'Em Revisão (REVIEW)', badge: 'badge-info' },
          { key: 'approved', label: 'Aprovado (APPROVED)', badge: 'badge-success' },
          { key: 'deprecated', label: 'Obsoleto (DEPRECATED)', badge: 'badge-danger' },
        ];
        modified = true;
      }
      if (!targetJson.governance_rules) {
        targetJson.governance_rules = srcJson.governance_rules || { min_approvals_default: 1 };
        modified = true;
      }
      if (!Array.isArray(targetJson.reviewers)) {
        targetJson.reviewers = srcJson.reviewers || [];
        modified = true;
      }
    }

    const validation = validateJsonSchema('project.config', targetJson);
    if (!validation.valid) {
      console.warn(`[SSOT Schema Alert] '${fileName}' em '${repoName}' possui inconsistências de schema:`, validation.errors);
    }
  } else if (fileName === '.hidden_files.json') {
    if (!Array.isArray(targetJson)) {
      targetJson = Array.isArray(srcJson) ? srcJson : [];
      modified = true;
    } else {
      const defaultEntries = Array.isArray(srcJson) ? srcJson : [];
      for (const item of defaultEntries) {
        if (!targetJson.includes(item)) {
          targetJson.push(item);
          modified = true;
        }
      }
    }
  } else if (fileName === '.docs.metadata.json') {
    if (!Array.isArray(targetJson)) {
      console.warn(`[SSOT Auto-Repair] '${fileName}' em '${repoName}' não era um array válido. Corrigindo.`);
      targetJson = [];
      modified = true;
    }
  } else if (fileName === '.templates.json') {
    if (!Array.isArray(targetJson)) {
      targetJson = Array.isArray(srcJson) ? srcJson : [];
      modified = true;
    } else if (targetJson.length === 0 && Array.isArray(srcJson) && srcJson.length > 0) {
      targetJson = [...srcJson];
      modified = true;
    }
  } else if (fileName === '.dictionary.json') {
    if (typeof targetJson !== 'object' || targetJson === null || Array.isArray(targetJson)) {
      targetJson = { version: '1.0.0', terms: [], domains: [] };
      modified = true;
    } else {
      if (!Array.isArray(targetJson.terms)) {
        targetJson.terms = [];
        modified = true;
      }
      if (!Array.isArray(targetJson.domains)) {
        targetJson.domains = [];
        modified = true;
      }
    }
  }

  if (modified) {
    try {
      fs.writeFileSync(dstPath, JSON.stringify(targetJson, null, 2), 'utf-8');
      console.log(`[SSOT Auto-Repair] Estrutura de '${fileName}' em '${repoName}' corrigida e atualizada com sucesso.`);
    } catch (saveErr) {
      console.error(`[SSOT Auto-Repair] Erro ao salvar correção em '${fileName}':`, saveErr);
    }
  }
}

export function ensureDefaultRepoFiles(repoName: string): void {
  if (!repoName) return;

  const defaultDir = getSSOTDefaultDir();
  const targetDir = path.join(PROJECTS_DIR, repoName);
  const cfg = loadConfig();

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
    ".hidden_files.json"
  ];

  // Guarantee defaultDir exists with minimal blank structure if missing
  if (!fs.existsSync(defaultDir)) {
    fs.mkdirSync(defaultDir, { recursive: true });
    fs.mkdirSync(path.join(defaultDir, '.spec-memory'), { recursive: true });

    const defaultCfg = {
      project: {
        name: 'Projeto da Equipe',
        description: 'Documentação técnica, RFCs, especificações e base de conhecimento da equipe.',
        version: '1.0.0',
        architecture_pattern: 'Documentação Viva & Git',
        repository_url: '',
        lead: '@equipe',
      },
      categories: ['geral', 'engenharia', 'produto', 'arquitetura', 'guias', 'reunioes'],
      tags: ['rfc', 'prd', 'api', 'backend', 'frontend', 'infra', 'guia', 'nota'],
      statuses: [
        { key: 'draft', label: 'Rascunho (DRAFT)', badge: 'badge-neutral' },
        { key: 'review', label: 'Em Revisão (REVIEW)', badge: 'badge-info' },
        { key: 'approved', label: 'Aprovado (APPROVED)', badge: 'badge-success' },
        { key: 'deprecated', label: 'Obsoleto (DEPRECATED)', badge: 'badge-danger' },
      ],
      governance_rules: { min_approvals_default: 1 },
      reviewers: [],
      ai_assistant_prompt: 'Você é o assistente inteligente de documentação e engenharia da equipe.',
    };
    fs.writeFileSync(path.join(defaultDir, '.project.config.json'), JSON.stringify(defaultCfg, null, 2), 'utf-8');
    fs.writeFileSync(path.join(defaultDir, '.docs.metadata.json'), JSON.stringify([], null, 2), 'utf-8');
    fs.writeFileSync(path.join(defaultDir, '.hidden_files.json'), JSON.stringify(defaultHiddenFiles, null, 2), 'utf-8');
  }

  // Ensure .hidden_files.json exists in defaultDir
  const defaultHiddenPath = path.join(defaultDir, '.hidden_files.json');
  if (!fs.existsSync(defaultHiddenPath)) {
    fs.writeFileSync(defaultHiddenPath, JSON.stringify(defaultHiddenFiles, null, 2), 'utf-8');
  }

  // Ensure default repo itself has an independent .git
  if (!fs.existsSync(path.join(defaultDir, '.git'))) {
    import('../utils/git.js').then(({ ensureGitRepo }) => {
      ensureGitRepo(defaultDir, cfg.user).catch(() => {});
    });
  }

  // If this is the default repo itself, we are done
  if (repoName === 'default' || repoName === '_default') return;

  // Sync from default blueprint to target repository
  syncBlueprint(defaultDir, targetDir, repoName);

  // Auto-scan and populate .docs.metadata.json for all markdown documents in the repo
  import('../modules/workspace/docs-metadata.service.js').then(({ docsMetadataService }) => {
    docsMetadataService.loadDocsMetadata(repoName);
  }).catch((err) => {
    console.warn(`[Onboarding] Erro ao sincronizar docs metadata para ${repoName}:`, err);
  });

  // Ensure target repo has its own independent .git initialized
  if (!fs.existsSync(path.join(targetDir, '.git'))) {
    import('../utils/git.js').then(({ ensureGitRepo }) => {
      ensureGitRepo(targetDir, cfg.user).catch(() => {});
    });
  }
}
