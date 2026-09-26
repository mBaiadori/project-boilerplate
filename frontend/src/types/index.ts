// Domain Types for Spec-Driven Context OS

export interface User {
  login: string;
  name: string;
  avatar_url?: string;
  role?: string;
  is_local?: boolean;
}

export interface Repo {
  id?: string | number;
  name: string;
  full_name?: string;
  owner?: string;
  is_local?: boolean;
  is_private?: boolean;
  private?: boolean;
  default_branch?: string;
  description?: string;
  stars?: number;
  forks?: number;
  updated_at?: string;
}

export interface WorkspaceStatus {
  authenticated: boolean;
  user: User | null;
  active_repo: Repo | null;
  pending_changes_count: number;
  ai_settings: {
    provider: string;
    model: string;
    has_key: boolean;
    custom_endpoint: string;
  };
}

export interface WorkspaceChange {
  path: string;
  old_content?: string;
  new_content?: string;
  additions?: number;
  deletions?: number;
  type?: 'MODIFIED' | 'ADDED' | 'DELETED';
  guardrail?: string;
  diff?: string;
  diff_text?: string;
  timestamp?: string;
}

export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'dir' | string;
  children?: TreeNode[];
  title?: string;
  is_directory?: boolean;
  status?: string;
  badge?: string;
  desc?: string;
}

export interface DocumentMetadataItem {
  id: string;
  name: string;
  title?: string;
  ext: string;
  path: string;
  status: string;
  categories: string;
  category?: string;
  tags: string[];
  updated_at: string;
  approvers: string[];
  links: string[];
  templateId: string;
  prompt?: string;
  [key: string]: any;
}

export interface ProjectMetadataOptions {
  categories: string[];
  statuses: Array<{ key: string; label: string; badge?: string }>;
  tags: string[];
}

export interface PR {
  id: number | string;
  repo_name?: string;
  repo_full_name?: string;
  github_id?: number;
  github_number?: number;
  title: string;
  description: string;
  file_path?: string;
  changes?: WorkspaceChange[];
  files?: Array<{
    path: string;
    type?: string;
    additions?: number;
    deletions?: number;
    diff_text?: string;
    old_content?: string;
    new_content?: string;
  }>;
  branch: string;
  target_branch?: string;
  author: string;
  status: 'OPEN' | 'MERGED' | 'CLOSED' | 'open' | 'merged' | 'closed' | string;
  approvals: string[];
  created_at: string;
  merged_at?: string;
  closed_at?: string;
  rejection_reason?: string;
  type?: string;
  layer?: string;
  domain?: string;
  html_url?: string;
  is_direct_commit?: boolean;
  commit_hash?: string;
  short_id?: string;
}

export interface ADR {
  id: string;
  title: string;
  status: 'PROPOSED' | 'ACCEPTED' | 'SUPERSEDED' | 'DEPRECATED';
  date?: string;
  context?: string;
  decision?: string;
  consequences?: string;
  author?: string;
  path?: string;
}

export interface DictionaryTerm {
  id?: string;
  term: string;
  codename: string;
  definition: string;
  context: string;
  synonyms?: string[];
}

export interface AIProviderMeta {
  id: string;
  name: string;
  model: string;
  has_key: boolean;
  custom_endpoint: string;
  needs_key: boolean;
  has_endpoint: boolean;
  configured: boolean;
  is_active: boolean;
}

export interface AISettingsState {
  active_provider: string;
  active_model: string;
  provider?: string;
  model?: string;
  has_key?: boolean;
  custom_endpoint?: string;
  providers?: Record<string, AIProviderMeta>;
}

export interface TemplateItem {
  id: string;
  templateName?: string;
  title: string;
  ext?: string;
  category: string;
  description?: string;
  tags?: string[];
  badge?: string;
  filename?: string;
  content: string;
  prompt: string;
  systemPrompt?: string;
  path?: string;
  source?: 'local' | 'community' | string;
  icon?: string;
  installed?: boolean;
  skills?: string[];
  assistant?: string;
  assistant_prompt?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface TutorialItem {
  id: string;
  title: string;
  badge: string;
  category?: string;
  content: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  diff?: {
    path: string;
    old_content: string;
    new_content: string;
    rationale?: string;
  };
  contextBadges?: string[];
  isStreaming?: boolean;
  tool_calls?: ToolCallRecord[];
  skill_id?: string;
  steps_count?: number;
}

export interface GitFileStatus {
  path: string;
  status: 'M' | 'A' | 'D' | 'U' | 'R' | 'C' | '??';
  staged: boolean;
}

export interface GitStatus {
  isRepo: boolean;
  branch: string;
  tracking?: string;
  ahead: number;
  behind: number;
  isClean: boolean;
  files: GitFileStatus[];
  remoteUrl?: string;
  repo_name?: string;
}

export interface GitCommitInfo {
  hash: string;
  shortHash: string;
  author: string;
  date: string;
  message: string;
}

export interface WhatsNewItem {
  hash: string;
  shortHash: string;
  author: string;
  date: string;
  message: string;
}

export interface WhatsNewFile {
  path: string;
  status: 'A' | 'M' | 'D';
  statusLabel: string;
  additions: number;
  deletions: number;
}

export interface WhatsNewProposal {
  id: string | number;
  title: string;
  author?: string;
  commitHash?: string;
}

export interface WhatsNewSummary {
  hasNewUpdates: boolean;
  latestHash: string;
  lastSeenHash?: string;
  totalNewCommits: number;
  commits: WhatsNewItem[];
  files: WhatsNewFile[];
  proposals: WhatsNewProposal[];
  summaryMessage: string;
}

export interface SkillItem {
  id: string;
  name: string;
  title?: string;
  description: string;
  category: 'governance' | 'architecture' | 'quality' | 'engineering' | 'memory' | 'general' | 'testing' | 'security' | 'database';
  version: string;
  source: 'system' | 'community' | 'project';
  sourceUrl?: string;
  license?: string;
  author?: string;
  tools: string[];
  suggested_templates?: string[];
  tags?: string[];
  icon?: string;
  content?: string;
  installed_at?: string;
  updated_at?: string;
  is_customized?: boolean;
}

export interface ProjectSkillsManifest {
  version: string;
  project_repo: string;
  installed_skills: {
    id: string;
    version: string;
    source: string;
    installed_at: string;
    updated_at: string;
    is_customized?: boolean;
  }[];
}

export interface ToolCallRecord {
  tool: string;
  args: Record<string, any>;
  result: {
    success: boolean;
    data?: any;
    error?: string;
    message?: string;
  };
  timestamp: string;
}

export interface AgentDefinition {
  id: string;
  name: string;
  title: string;
  role: string;
  description: string;
  system_prompt: string;
  skills: string[];
  tools: string[];
  category: 'architecture' | 'governance' | 'quality' | 'engineering' | 'review' | 'security' | 'general';
  recommended_model?: string;
  temperature?: number;
  source: 'system' | 'community' | 'project';
  sourceUrl?: string;
  license?: string;
  author?: string;
  installed_at?: string;
  icon?: string;
}

export interface MCPServerDefinition {
  id: string;
  name: string;
  description: string;
  type: 'sse' | 'stdio';
  endpoint?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
  status?: 'connected' | 'disconnected' | 'error';
  discovered_tools?: { name: string; description: string }[];
  category?: string;
}

export interface ToolItem {
  name: string;
  description: string;
  parameters: any;
}

export interface CustomToolItem {
  id: string;
  name: string;
  title: string;
  description: string;
  category?: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  handler_type: 'javascript' | 'http' | 'shell';
  handler_code?: string;
  handler_config?: {
    url?: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    command?: string;
  };
  is_active?: boolean;
  source?: 'project' | 'global';
  created_at?: string;
  updated_at?: string;
}




