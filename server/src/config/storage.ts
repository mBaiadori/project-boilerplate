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
      layers: [],
      tags: [],
      statuses: [],
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

export function recordChange(
  repoName: string,
  relPath: string,
  changeType: 'ADDED' | 'MODIFIED' | 'DELETED',
  oldContent: string = '',
  newContent: string = ''
): void {
  const cleanPath = relPath.trim().replace(/^\/+/, '');
  if (!cleanPath) return;

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
    const preservedOldContent = existing.old_content !== undefined ? existing.old_content : oldContent;
    
    // If the file reverted to original content, discard the change
    if (preservedOldContent === newContent && changeType !== 'DELETED') {
      cfg.workspace_changes[repoName].splice(existingIdx, 1);
      saveConfig(cfg);
      return;
    }

    cfg.workspace_changes[repoName][existingIdx] = {
      path: cleanPath,
      type: existing.type === 'ADDED' && changeType !== 'DELETED' ? 'ADDED' : changeType,
      old_content: preservedOldContent,
      new_content: newContent,
      timestamp: now,
    };
  } else {
    // If saving identical content from scratch, don't record a change
    if (oldContent === newContent && changeType !== 'DELETED') {
      return;
    }

    cfg.workspace_changes[repoName].push({
      path: cleanPath,
      type: changeType,
      old_content: oldContent,
      new_content: newContent,
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

export function ensureDefaultRepoFiles(repoName: string): void {
  if (!repoName) return;
  const targetDir = path.join(PROJECTS_DIR, repoName);
  const master = loadProjectsMasterConfig();

  // Create mandatory directories
  const dirs = master.mandatory_structure?.directories || ['project', 'domains', 'engenharia', 'templates'];
  for (const d of dirs) {
    fs.mkdirSync(path.join(targetDir, d), { recursive: true });
  }

  // Create essential root files if missing
  const indexMd = path.join(targetDir, 'index.md');
  if (!fs.existsSync(indexMd)) {
    const defaultIndex = `# ${repoName.toUpperCase()} - Governança e Especificações

Bem-vindo ao repositório de especificações e contratos vivos do projeto **${repoName}**.

## Estrutura do Repositório
- \`project/\`: Configurações oficiais, visões estratégicas e políticas de governança.
- \`domains/\`: Contextos delimitados (DDD), modelos de domínio e regras de negócio.
- \`engenharia/\`: Guias de implementação, padrões arquiteturais e esteiras CI/CD.
- \`templates/\`: Catálogo de templates instalados e modelos de especificação.
`;
    fs.writeFileSync(indexMd, defaultIndex, 'utf-8');
  }

  // Essential files from master config
  const essential = master.mandatory_structure?.essential_files || [];
  for (const item of essential) {
    const targetFile = path.join(targetDir, item.path);
    if (!fs.existsSync(targetFile)) {
      fs.mkdirSync(path.dirname(targetFile), { recursive: true });
      fs.writeFileSync(targetFile, item.content || '', 'utf-8');
    }
  }
}
