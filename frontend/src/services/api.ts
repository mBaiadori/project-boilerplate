// API CLIENT MODULE (REST Calls to Backend Server)
import type { 
  WorkspaceStatus, Repo, WorkspaceChange, TreeNode, 
  PR, TemplateItem, TutorialItem, AISettingsState, DictionaryTerm, User 
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

  async getProjectFile(path = 'index.md'): Promise<{ path: string; content: string; source?: string; error?: string }> {
    const res = await fetch(`/api/project/file?path=${encodeURIComponent(path)}`);
    return res.json();
  },

  async createProjectFile(payload: { path: string; is_folder?: boolean; content?: string }): Promise<ApiResponse<any>> {
    const res = await fetch('/api/project/file/create', {
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

  async getProjectTree(): Promise<{ repo: Repo; tree: TreeNode[] }> {
    const res = await fetch('/api/project/tree');
    return res.json();
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

  async saveWorkspaceFile(payload: { path: string; content: string }): Promise<ApiResponse<any>> {
    const res = await fetch('/api/workspace/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { ok: res.ok, data: await res.json() };
  },

  async saveProjectFile(payload: { path: string; content: string }): Promise<ApiResponse<any>> {
    return this.saveWorkspaceFile(payload);
  },

  async askAI(payload: { prompt: string; content?: string; path?: string; history?: any[] }): Promise<ApiResponse<any>> {
    return this.sendChatMessage(payload);
  },

  async generatePRSummaryAI(): Promise<ApiResponse<{ success?: boolean; title?: string; description?: string }>> {
    const res = await fetch('/api/workspace/generate-pr-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    return { ok: res.ok, data: await res.json() };
  },

  async createUnifiedPR(payload: { title: string; description: string }): Promise<ApiResponse<any>> {
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
    session_id?: string; 
    repo?: string; 
  }): Promise<ApiResponse<{ reply: string; diff?: any; actions?: any[] }>> {
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

  async getAIModels(params: { provider?: string; api_key?: string; custom_endpoint?: string } = {}): Promise<ApiResponse<{ models: string[]; default?: string }>> {
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
  async getPRs(): Promise<{ prs: PR[] }> {
    const res = await fetch('/api/prs');
    return res.json();
  },

  async createPR(payload: { title: string; content?: string; path?: string }): Promise<ApiResponse<any>> {
    const res = await fetch('/api/prs/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { ok: res.ok, data: await res.json() };
  },

  async approvePR(id: number): Promise<ApiResponse<any>> {
    const res = await fetch('/api/prs/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    return { ok: res.ok, data: await res.json() };
  },

  async mergePR(id: number): Promise<ApiResponse<any>> {
    const res = await fetch('/api/prs/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
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
  }
};
