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
  [key: string]: any;
}

export interface ProjectMetadataOptions {
  categories: string[];
  statuses: Array<{ key: string; label: string; badge?: string }>;
  tags: string[];
}

export interface PR {
  id: number;
  repo_full_name?: string;
  title: string;
  description: string;
  file_path?: string;
  changes?: WorkspaceChange[];
  branch: string;
  author: string;
  status: 'OPEN' | 'MERGED' | 'CLOSED' | 'open' | 'merged' | 'closed' | string;
  approvals: string[];
  created_at: string;
  merged_at?: string;
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
  custom_endpoint?: string;
  providers: Record<string, AIProviderMeta>;
}

export interface TemplateItem {
  id: string;
  title: string;
  category: string;
  description: string;
  filename: string;
  content: string;
  icon?: string;
  installed?: boolean;
  assistant?: string;
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
  };
  contextBadges?: string[];
  isStreaming?: boolean;
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

