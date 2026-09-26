// API CLIENT MODULE (REST Calls to Backend Server)
import type { 
  WorkspaceStatus, Repo, WorkspaceChange, TreeNode, 
  PR, TemplateItem, TutorialItem, AISettingsState, DictionaryTerm, User,
  GitStatus, GitCommitInfo, DocumentMetadataItem, WhatsNewSummary,
  SkillItem, ProjectSkillsManifest, ToolCallRecord,
  AgentDefinition, MCPServerDefinition, ToolItem, CustomToolItem
} from '../types';

export interface ApiResponse<T = any> {
  ok: boolean;
  data: T;
}

export const API = {
  async getStatus(): Promise<WorkspaceStatus> {
    const res = await fetch('/api/status');
    return res.json();
  },

  async loginWithToken(token: string): Promise<ApiResponse<{ success?: boolean; user?: User; error?: string }>> {
    const res = await fetch('/api/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    return { ok: res.ok, data: await res.json() };
  },

  async logout(): Promise<{ success: boolean }> {
    const res = await fetch('/api/auth/logout', { method: 'POST' });
    return res.json();
  },

  async getRepos(): Promise<ApiResponse<{ repos: Repo[] }>> {
    const res = await fetch('/api/repos');
    return { ok: res.ok, data: await res.json() };
  },

  async createRepo(payload: { 
    name: string; 
    owner?: string; 
    description?: string; 
    enable_protection?: boolean; 
    required_approvals?: number; 
    is_private?: boolean 
  }): Promise<ApiResponse<any>> {
    const res = await fetch('/api/repos/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { ok: res.ok, data: await res.json() };
  },

  async selectRepo(repo: Partial<Repo>): Promise<ApiResponse<any>> {
    const res = await fetch('/api/repos/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(repo)
    });
    return { ok: res.ok, data: await res.json() };
  },

  async getProjectFile(path: string): Promise<{ path: string; content: string; meta?: any; source?: string; error?: string }> {
    const res = await fetch(`/api/project/file?path=${encodeURIComponent(path)}`);
    return res.json();
  },

  async createProjectFile(payload: { path: string; is_folder?: boolean; content?: string; meta?: any; templateId?: string }): Promise<ApiResponse<any>> {
    const res = await fetch('/api/project/file/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { ok: res.ok, data: await res.json() };
  },

  async importFiles(payload: {
    target_folder?: string;
    files: Array<{
      name: string;
      relativePath?: string;
      content?: string;
      base64?: string;
      meta?: any;
    }>;
    repo?: string;
  }): Promise<ApiResponse<{ success: boolean; importedFiles: Array<{ path: string; name: string; isBinary: boolean; size: number }>; errors?: string[]; error?: string; tree?: TreeNode[] }>> {
    const res = await fetch('/api/project/files/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { ok: res.ok, data: await res.json() };
  },

  async deleteProjectFile(path: string): Promise<ApiResponse<any>> {
    const res = await fetch(`/api/project/file?path=${encodeURIComponent(path)}`, {
      method: 'DELETE'
    });
    return { ok: res.ok, data: await res.json() };
  },

  async renameProjectFile(payload: { old_path: string; new_path: string }): Promise<ApiResponse<any>> {
    const res = await fetch('/api/project/file/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { ok: res.ok, data: await res.json() };
  },

  async openInOS(path?: string, repo?: string): Promise<ApiResponse<{ success?: boolean; message?: string; fullPath?: string; error?: string }>> {
    const res = await fetch('/api/project/open-in-os', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, repo })
    });
    return { ok: res.ok, data: await res.json() };
  },

  async getProjectTree(repo?: string): Promise<{ repo: Repo; tree: TreeNode[] }> {
    const res = await fetch(`/api/project/tree${repo ? `?repo=${encodeURIComponent(repo)}` : ''}`);
    return res.json();
  },

  async getProjectMetadata(repo?: string): Promise<ApiResponse<DocumentMetadataItem[]>> {
    const res = await fetch(`/api/project/metadata${repo ? `?repo=${encodeURIComponent(repo)}` : ''}`);
    return { ok: res.ok, data: await res.json() };
  },

  async getProjectMetadataOptions(repo?: string): Promise<ApiResponse<{ categories: string[]; statuses: Array<{ key: string; label: string; badge?: string }>; tags: string[] }>> {
    const res = await fetch(`/api/project/metadata/options${repo ? `?repo=${encodeURIComponent(repo)}` : ''}`);
    return { ok: res.ok, data: await res.json() };
  },

  async getProjectConfig(repo?: string): Promise<ApiResponse<any>> {
    const res = await fetch(`/api/project/config${repo ? `?repo=${encodeURIComponent(repo)}` : ''}`);
    return { ok: res.ok, data: await res.json() };
  },

  async saveProjectConfig(configData: any, repo?: string): Promise<ApiResponse<any>> {
    const res = await fetch('/api/project/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: configData, repo })
    });
    return { ok: res.ok, data: await res.json() };
  },

  async updateDocumentMetadataItem(payload: { path: string; meta: Partial<DocumentMetadataItem>; repo?: string }): Promise<ApiResponse<{ success: boolean; meta: DocumentMetadataItem; tree: TreeNode[] }>> {
    const res = await fetch('/api/project/metadata/item', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { ok: res.ok, data: await res.json() };
  },

  async getDocumentContext(path: string): Promise<any> {
    const res = await fetch(`/api/project/document-context?path=${encodeURIComponent(path)}`);
    return res.json();
  },

  async scaffoldEntity(data: any): Promise<ApiResponse<any>> {
    const res = await fetch('/api/project/scaffold', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return { ok: res.ok, data: await res.json() };
  },

  // Centralized Workspace Changes & Diff Staging
  async getWorkspaceChanges(): Promise<{ 
    changes: WorkspaceChange[]; 
    total_additions: number; 
    total_deletions: number; 
    guardrail: string;
  }> {
    const res = await fetch('/api/workspace/changes');
    return res.json();
  },

  async saveWorkspaceFile(payload: { path: string; content: string; meta?: any }): Promise<ApiResponse<any>> {
    const res = await fetch('/api/workspace/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { ok: res.ok, data: await res.json() };
  },

  async saveProjectFile(payload: { path: string; content: string; meta?: any }): Promise<ApiResponse<any>> {
    return this.saveWorkspaceFile(payload);
  },

  async askAI(payload: { prompt: string; content?: string; path?: string; history?: any[] }): Promise<ApiResponse<any>> {
    return this.sendChatMessage(payload);
  },

  async generatePRSummaryAI(repo?: string): Promise<ApiResponse<{ success?: boolean; title?: string; description?: string }>> {
    const res = await fetch('/api/workspace/generate-pr-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(repo ? { repo } : {})
    });
    return { ok: res.ok, data: await res.json() };
  },

  async createUnifiedPR(payload: { title: string; description: string; repo?: string }): Promise<ApiResponse<any>> {
    const res = await fetch('/api/workspace/create-pr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { ok: res.ok, data: await res.json() };
  },

  async discardWorkspaceChanges(path: string | null = null): Promise<ApiResponse<any>> {
    const res = await fetch('/api/workspace/discard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(path ? { path } : {})
    });
    return { ok: res.ok, data: await res.json() };
  },

  // Templates Management
  async getTemplates(): Promise<{ templates: TemplateItem[] }> {
    const res = await fetch('/api/templates');
    return res.json();
  },

  async saveTemplate(templateData: any): Promise<ApiResponse<any>> {
    const res = await fetch('/api/templates/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(templateData)
    });
    return { ok: res.ok, data: await res.json() };
  },

  async deleteTemplate(id: string): Promise<ApiResponse<any>> {
    const res = await fetch(`/api/templates?id=${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    return { ok: res.ok, data: await res.json() };
  },

  async generateTemplateAI(idea: string): Promise<ApiResponse<any>> {
    const res = await fetch('/api/templates/generate-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idea })
    });
    return { ok: res.ok, data: await res.json() };
  },

  // System Settings
  async getSettings(): Promise<any> {
    const res = await fetch('/api/settings');
    return res.json();
  },

  async saveSettings(settings: any): Promise<ApiResponse<any>> {
    const res = await fetch('/api/settings/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings })
    });
    return { ok: res.ok, data: await res.json() };
  },

  // Agentic AI Chat & Memory Engine
  async sendChatMessage(payload: { 
    prompt: string; 
    content?: string; 
    path?: string; 
    history?: any[]; 
    assistant_prompt?: string; 
    raw_mode?: boolean;
    session_id?: string; 
    repo?: string;
    skill_id?: string;
    allowed_tools?: string[];
  }): Promise<ApiResponse<{ reply: string; diff?: any; actions?: any[]; tool_calls?: ToolCallRecord[]; steps_count?: number; provider?: string; model?: string }>> {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { ok: res.ok, data: await res.json() };
  },

  async getMemoryBrief(params: { repo?: string; path?: string } = {}): Promise<ApiResponse<any>> {
    const query = new URLSearchParams();
    if (params.repo) query.set('repo', params.repo);
    if (params.path) query.set('path', params.path);
    const res = await fetch(`/api/chat/memory/brief?${query.toString()}`);
    return { ok: res.ok, data: await res.json() };
  },

  async getMemoryHistory(params: { repo?: string; path?: string } = {}): Promise<ApiResponse<any>> {
    const query = new URLSearchParams();
    if (params.repo) query.set('repo', params.repo);
    if (params.path) query.set('path', params.path);
    const res = await fetch(`/api/chat/memory/history?${query.toString()}`);
    return { ok: res.ok, data: await res.json() };
  },

  async getMemorySession(params: { repo?: string; session_id?: string } = {}): Promise<ApiResponse<any>> {
    const query = new URLSearchParams();
    if (params.repo) query.set('repo', params.repo);
    if (params.session_id) query.set('session_id', params.session_id);
    const res = await fetch(`/api/chat/memory/session?${query.toString()}`);
    return { ok: res.ok, data: await res.json() };
  },

  async deleteMemorySession(params: { repo?: string; session_id: string }): Promise<ApiResponse<any>> {
    const query = new URLSearchParams();
    if (params.repo) query.set('repo', params.repo);
    query.set('session_id', params.session_id);
    const res = await fetch(`/api/chat/memory/session?${query.toString()}`, {
      method: 'DELETE'
    });
    return { ok: res.ok, data: await res.json() };
  },

  async getMemoryWiki(params: { repo?: string; query?: string } = {}): Promise<ApiResponse<any>> {
    const query = new URLSearchParams();
    if (params.repo) query.set('repo', params.repo);
    if (params.query) query.set('q', params.query);
    const res = await fetch(`/api/chat/memory/wiki?${query.toString()}`);
    return { ok: res.ok, data: await res.json() };
  },

  async saveMemoryWikiEntry(payload: { repo?: string; category: string; slug: string; title: string; content: string }): Promise<ApiResponse<any>> {
    const res = await fetch('/api/chat/memory/wiki', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { ok: res.ok, data: await res.json() };
  },

  async deleteMemoryWikiEntry(payload: { repo?: string; category: string; slug: string }): Promise<ApiResponse<any>> {
    const res = await fetch('/api/chat/memory/wiki/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { ok: res.ok, data: await res.json() };
  },

  async resetMemoryScope(payload: { repo?: string; scope: string }): Promise<ApiResponse<any>> {
    const res = await fetch('/api/chat/memory/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { ok: res.ok, data: await res.json() };
  },

  async finalizeMemorySession(payload: { repo?: string; path?: string; session_id?: string; summary?: string }): Promise<ApiResponse<any>> {
    const res = await fetch('/api/chat/memory/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { ok: res.ok, data: await res.json() };
  },

  async getMemoryActor(): Promise<ApiResponse<any>> {
    const res = await fetch('/api/chat/memory/actor');
    return { ok: res.ok, data: await res.json() };
  },

  async getAISettings(): Promise<ApiResponse<AISettingsState>> {
    const res = await fetch('/api/ai/settings');
    return { ok: res.ok, data: await res.json() };
  },

  async getAIModels(params: { provider?: string; api_key?: string; custom_endpoint?: string } = {}): Promise<ApiResponse<{
    provider?: string;
    models: string[];
    detailedModels?: Array<{ id: string; name: string; description?: string }>;
    isDynamic?: boolean;
    message?: string;
    error?: string;
  }>> {
    const query = new URLSearchParams();
    if (params.provider) query.set('provider', params.provider);
    if (params.api_key) query.set('api_key', params.api_key);
    if (params.custom_endpoint) query.set('custom_endpoint', params.custom_endpoint);
    const res = await fetch(`/api/ai/models?${query.toString()}`);
    return { ok: res.ok, data: await res.json() };
  },

  async saveAISettings(payload: { provider: string; model: string; api_key?: string; custom_endpoint?: string }): Promise<ApiResponse<any>> {
    const res = await fetch('/api/ai/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { ok: res.ok, data: await res.json() };
  },

  // PRs
  async getPRs(repo?: string): Promise<{ 
    prs: PR[]; 
    repo?: Repo; 
    selected_repo?: string; 
    all_prs_count?: number; 
    available_repos?: Array<{ name: string; count: number }>;
    governance?: any; 
  }> {
    const query = repo ? `?repo=${encodeURIComponent(repo)}` : '';
    const res = await fetch(`/api/prs${query}`);
    return res.json();
  },

  async createPR(payload: { title: string; content?: string; path?: string; repo?: string }): Promise<ApiResponse<any>> {
    const res = await fetch('/api/prs/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { ok: res.ok, data: await res.json() };
  },

  async approvePR(id: number | string): Promise<ApiResponse<any>> {
    const res = await fetch('/api/prs/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    return { ok: res.ok, data: await res.json() };
  },

  async mergePR(id: number | string): Promise<ApiResponse<any>> {
    const res = await fetch('/api/prs/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    return { ok: res.ok, data: await res.json() };
  },

  async rejectPR(id: number | string, reason?: string): Promise<ApiResponse<any>> {
    const res = await fetch('/api/prs/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, reason })
    });
    return { ok: res.ok, data: await res.json() };
  },

  async getPRFileDiff(params: { path: string; commit?: string; repo?: string }): Promise<ApiResponse<{ diff: string }>> {
    const query = new URLSearchParams();
    query.set('path', params.path);
    if (params.commit) query.set('commit', params.commit);
    if (params.repo) query.set('repo', params.repo);
    const res = await fetch(`/api/prs/file-diff?${query.toString()}`);
    return { ok: res.ok, data: await res.json() };
  },

  // Tutorials
  async getTutorials(): Promise<{ tutorials: TutorialItem[] }> {
    const res = await fetch('/api/tutorials');
    return res.json();
  },

  // Template Store
  async getTemplateStore(): Promise<ApiResponse<any>> {
    const res = await fetch('/api/templates/store');
    return { ok: res.ok, data: await res.json() };
  },

  async installTemplate(template_id: string): Promise<ApiResponse<any>> {
    const res = await fetch('/api/templates/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id })
    });
    return { ok: res.ok, data: await res.json() };
  },

  async getInstalledTemplates(): Promise<ApiResponse<any>> {
    const res = await fetch('/api/templates/installed');
    return { ok: res.ok, data: await res.json() };
  },

  // Project Governance Status & Bootstrap
  async getProjectStatus(): Promise<ApiResponse<any>> {
    const res = await fetch('/api/project/status');
    return { ok: res.ok, data: await res.json() };
  },

  async bootstrapProject(starter_pack = 'standard'): Promise<ApiResponse<any>> {
    const res = await fetch('/api/project/bootstrap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ starter_pack })
    });
    return { ok: res.ok, data: await res.json() };
  },

  // Ubiquitous Dictionary
  async getDictionary(): Promise<ApiResponse<{ terms: DictionaryTerm[] }>> {
    const res = await fetch('/api/dictionary');
    return { ok: res.ok, data: await res.json() };
  },

  async saveDictionary(terms: DictionaryTerm[]): Promise<ApiResponse<any>> {
    const res = await fetch('/api/dictionary/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ terms })
    });
    return { ok: res.ok, data: await res.json() };
  },

  async getProjectDomainsDocs(): Promise<ApiResponse<any>> {
    const res = await fetch('/api/project/domains-docs');
    return { ok: res.ok, data: await res.json() };
  },

  async getProjectSyncStatus(): Promise<ApiResponse<any>> {
    const res = await fetch('/api/project/sync-status');
    return { ok: res.ok, data: await res.json() };
  },

  async getFileBlame(path: string): Promise<ApiResponse<any>> {
    const res = await fetch(`/api/git/blame?path=${encodeURIComponent(path)}`);
    return { ok: res.ok, data: await res.json() };
  },

  async getFileGitHistory(path: string, limit = 30): Promise<ApiResponse<{ repo_name: string; file_path: string; commits: GitCommitInfo[] }>> {
    const res = await fetch(`/api/git/file-history?path=${encodeURIComponent(path)}&limit=${limit}`);
    return { ok: res.ok, data: await res.json() };
  },

  async getFileVersion(path: string, hash: string): Promise<ApiResponse<{ success: boolean; content: string; error?: string }>> {
    const res = await fetch(`/api/git/file-version?path=${encodeURIComponent(path)}&hash=${encodeURIComponent(hash)}`);
    return { ok: res.ok, data: await res.json() };
  },

  // Git Core Management
  async getGitStatus(): Promise<ApiResponse<GitStatus>> {
    const res = await fetch('/api/git/status');
    return { ok: res.ok, data: await res.json() };
  },

  async getGitLog(limit = 20): Promise<ApiResponse<{ repo_name: string; commits: GitCommitInfo[] }>> {
    const res = await fetch(`/api/git/log?limit=${limit}`);
    return { ok: res.ok, data: await res.json() };
  },

  async getGitBranches(): Promise<ApiResponse<{ current: string; branches: string[] }>> {
    const res = await fetch('/api/git/branches');
    return { ok: res.ok, data: await res.json() };
  },

  async createOrSwitchBranch(branch: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    const res = await fetch('/api/git/branch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch })
    });
    return { ok: res.ok, data: await res.json() };
  },

  async commitGitChanges(payload: { message: string; files?: string[] }): Promise<ApiResponse<{ success: boolean; message: string; commitHash?: string }>> {
    const res = await fetch('/api/git/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { ok: res.ok, data: await res.json() };
  },

  async syncGit(branch?: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    const res = await fetch('/api/git/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch })
    });
    return { ok: res.ok, data: await res.json() };
  },

  async getGitDiff(path?: string): Promise<ApiResponse<{ diff: string }>> {
    const url = path ? `/api/git/diff?path=${encodeURIComponent(path)}` : '/api/git/diff';
    const res = await fetch(url);
    return { ok: res.ok, data: await res.json() };
  },

  async getGitDiagnostic(): Promise<ApiResponse<{ version: string; installed: boolean }>> {
    const res = await fetch('/api/git/diagnostic');
    return { ok: res.ok, data: await res.json() };
  },

  async getWhatsNew(lastSeenHash?: string): Promise<ApiResponse<WhatsNewSummary>> {
    const url = lastSeenHash ? `/api/git/whats-new?lastSeenHash=${encodeURIComponent(lastSeenHash)}` : '/api/git/whats-new';
    const res = await fetch(url);
    return { ok: res.ok, data: await res.json() };
  },

  async getWhatsNewFileDiff(path: string, lastSeenHash?: string): Promise<ApiResponse<{ diff: string }>> {
    const query = new URLSearchParams({ path });
    if (lastSeenHash) query.set('lastSeenHash', lastSeenHash);
    const res = await fetch(`/api/git/whats-new-diff?${query.toString()}`);
    return { ok: res.ok, data: await res.json() };
  },

  // ─── Templates ─────────────────────────────────────────────────────────────

  async getProjectTemplates(): Promise<ApiResponse<{ templates: TemplateItem[] }>> {
    const res = await fetch('/api/project/templates');
    return { ok: res.ok, data: await res.json() };
  },

  async getAllTemplates(): Promise<ApiResponse<{ templates: TemplateItem[] }>> {
    const res = await fetch('/api/project/templates/all');
    return { ok: res.ok, data: await res.json() };
  },

  async getCommunityTemplates(): Promise<ApiResponse<{ templates: TemplateItem[] }>> {
    const res = await fetch('/api/templates/community');
    return { ok: res.ok, data: await res.json() };
  },

  async getTemplate(id: string): Promise<ApiResponse<{ template: TemplateItem }>> {
    const res = await fetch(`/api/project/templates/${encodeURIComponent(id)}`);
    return { ok: res.ok, data: await res.json() };
  },

  async createProjectTemplate(payload: {
    id?: string;
    templateName?: string;
    title: string;
    ext?: string;
    category?: string;
    description?: string;
    tags?: string[];
    badge?: string;
    content?: string;
    prompt?: string;
    systemPrompt?: string;
    source?: string;
  }): Promise<ApiResponse<{ success: boolean; template: TemplateItem }>> {
    const res = await fetch('/api/project/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { ok: res.ok, data: await res.json() };
  },

  async updateProjectTemplate(id: string, payload: Partial<TemplateItem>): Promise<ApiResponse<{ success: boolean; template: TemplateItem }>> {
    const res = await fetch(`/api/project/templates/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { ok: res.ok, data: await res.json() };
  },

  async deleteProjectTemplate(id: string, repo?: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    const url = `/api/project/templates/${encodeURIComponent(id)}${repo ? `?repo=${encodeURIComponent(repo)}` : ''}`;
    const res = await fetch(url, {
      method: 'DELETE'
    });
    return { ok: res.ok, data: await res.json() };
  },

  async deleteCommunityTemplate(id: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    const url = `/api/templates/community/${encodeURIComponent(id)}`;
    const res = await fetch(url, {
      method: 'DELETE'
    });
    return { ok: res.ok, data: await res.json() };
  },

  async importTemplateFromCommunity(id: string): Promise<ApiResponse<{ success: boolean; message: string; template: TemplateItem }>> {
    const res = await fetch(`/api/project/templates/${encodeURIComponent(id)}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    return { ok: res.ok, data: await res.json() };
  },

  async syncTemplatesMetadata(): Promise<ApiResponse<{ success: boolean; count: number }>> {
    const res = await fetch('/api/project/templates/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    return { ok: res.ok, data: await res.json() };
  },

  // ─── SKILLS & HARNESS API ───────────────────────────────────────────────
  async getSkillsHub(category?: string, search?: string): Promise<ApiResponse<{ count: number; skills: SkillItem[] }>> {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (search) params.set('search', search);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`/api/skills/hub${qs}`);
    return { ok: res.ok, data: await res.json() };
  },

  async getSkillsProject(repo?: string): Promise<ApiResponse<{ repo: string; count: number; manifest: ProjectSkillsManifest; installed_skills: SkillItem[] }>> {
    const qs = repo ? `?repo=${encodeURIComponent(repo)}` : '';
    const res = await fetch(`/api/skills/project${qs}`);
    return { ok: res.ok, data: await res.json() };
  },

  async installSkill(skillId: string, repo?: string): Promise<ApiResponse<{ success: boolean; message: string; skill: SkillItem }>> {
    const res = await fetch('/api/skills/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skill_id: skillId, repo })
    });
    return { ok: res.ok, data: await res.json() };
  },

  async uninstallSkill(skillId: string, repo?: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    const qs = repo ? `?repo=${encodeURIComponent(repo)}` : '';
    const res = await fetch(`/api/skills/uninstall/${encodeURIComponent(skillId)}${qs}`, {
      method: 'DELETE'
    });
    return { ok: res.ok, data: await res.json() };
  },

  async customizeSkill(skillId: string, data: Partial<SkillItem>, repo?: string): Promise<ApiResponse<{ success: boolean; skill: SkillItem }>> {
    const res = await fetch(`/api/skills/project/${encodeURIComponent(skillId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, repo })
    });
    return { ok: res.ok, data: await res.json() };
  },

  async getWorkspaceContextBundle(path: string, repo?: string): Promise<ApiResponse<any>> {
    const params = new URLSearchParams({ path });
    if (repo) params.set('repo', repo);
    const res = await fetch(`/api/workspace/context-bundle?${params.toString()}`);
    return { ok: res.ok, data: await res.json() };
  },

  // --- AI Center: Agents ---
  async getAgentsHub(): Promise<ApiResponse<{ agents: AgentDefinition[] }>> {
    const res = await fetch('/api/aicenter/agents/hub');
    return { ok: res.ok, data: await res.json() };
  },

  async getAgentsProject(repo?: string): Promise<ApiResponse<{ repo: string; agents: AgentDefinition[] }>> {
    const qs = repo ? `?repo=${encodeURIComponent(repo)}` : '';
    const res = await fetch(`/api/aicenter/agents/project${qs}`);
    return { ok: res.ok, data: await res.json() };
  },

  async installAgent(agentId: string, repo?: string): Promise<ApiResponse<{ success: boolean; agent: AgentDefinition }>> {
    const res = await fetch('/api/aicenter/agents/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: agentId, repo })
    });
    return { ok: res.ok, data: await res.json() };
  },

  async uninstallAgent(agentId: string, repo?: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    const qs = repo ? `?repo=${encodeURIComponent(repo)}` : '';
    const res = await fetch(`/api/aicenter/agents/uninstall/${encodeURIComponent(agentId)}${qs}`, {
      method: 'DELETE'
    });
    return { ok: res.ok, data: await res.json() };
  },

  // --- AI Center: Tools ---
  async getTools(): Promise<ApiResponse<{ tools: ToolItem[] }>> {
    const res = await fetch('/api/aicenter/tools');
    return { ok: res.ok, data: await res.json() };
  },

  async executeToolTest(toolName: string, args: Record<string, any>, repo?: string): Promise<ApiResponse<any>> {
    const res = await fetch('/api/aicenter/tools/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool_name: toolName, args, repo })
    });
    return { ok: res.ok, data: await res.json() };
  },

  // --- AI Center: MCP Connectors ---
  async getMcpTemplates(): Promise<ApiResponse<{ templates: MCPServerDefinition[] }>> {
    const res = await fetch('/api/aicenter/mcp/templates');
    return { ok: res.ok, data: await res.json() };
  },

  async getMcpProject(repo?: string): Promise<ApiResponse<{ repo: string; servers: MCPServerDefinition[] }>> {
    const qs = repo ? `?repo=${encodeURIComponent(repo)}` : '';
    const res = await fetch(`/api/aicenter/mcp/project${qs}`);
    return { ok: res.ok, data: await res.json() };
  },

  async saveMcpServer(server: MCPServerDefinition, repo?: string): Promise<ApiResponse<{ success: boolean; server: MCPServerDefinition }>> {
    const res = await fetch('/api/aicenter/mcp/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ server, repo })
    });
    return { ok: res.ok, data: await res.json() };
  },

  async removeMcpServer(serverId: string, repo?: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    const qs = repo ? `?repo=${encodeURIComponent(repo)}` : '';
    const res = await fetch(`/api/aicenter/mcp/remove/${encodeURIComponent(serverId)}${qs}`, {
      method: 'DELETE'
    });
    return { ok: res.ok, data: await res.json() };
  },

  // --- AI Center: Custom Project Tools ---
  async getCustomTools(repo?: string): Promise<ApiResponse<{ repo: string; tools: CustomToolItem[] }>> {
    const qs = repo ? `?repo=${encodeURIComponent(repo)}` : '';
    const res = await fetch(`/api/aicenter/custom-tools${qs}`);
    return { ok: res.ok, data: await res.json() };
  },

  async saveCustomTool(tool: Partial<CustomToolItem>, repo?: string): Promise<ApiResponse<{ success: boolean; tool: CustomToolItem }>> {
    const res = await fetch('/api/aicenter/custom-tools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool, repo })
    });
    return { ok: res.ok, data: await res.json() };
  },

  async deleteCustomTool(toolId: string, repo?: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    const qs = repo ? `?repo=${encodeURIComponent(repo)}` : '';
    const res = await fetch(`/api/aicenter/custom-tools/${encodeURIComponent(toolId)}${qs}`, {
      method: 'DELETE'
    });
    return { ok: res.ok, data: await res.json() };
  },

  async testCustomTool(tool: Partial<CustomToolItem>, args: Record<string, any>, repo?: string): Promise<ApiResponse<any>> {
    const res = await fetch('/api/aicenter/custom-tools/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool, args, repo })
    });
    return { ok: res.ok, data: await res.json() };
  },
};



