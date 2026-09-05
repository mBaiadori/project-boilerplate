// =============================================================================
// API CLIENT MODULE (REST CALLS TO LOCAL SERVER & GITHUB)
// =============================================================================

export const API = {
  async getStatus() {
    const res = await fetch('/api/status');
    return res.json();
  },

  async loginWithToken(token) {
    const res = await fetch('/api/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    return { ok: res.ok, data: await res.json() };
  },

  async logout() {
    const res = await fetch('/api/auth/logout', { method: 'POST' });
    return res.json();
  },

  async getRepos() {
    const res = await fetch('/api/repos');
    return { ok: res.ok, data: await res.json() };
  },

  async createRepo({ name, owner, description, enable_protection, required_approvals, is_private }) {
    const res = await fetch('/api/repos/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, owner, description, enable_protection, required_approvals, is_private })
    });
    return { ok: res.ok, data: await res.json() };
  },

  async selectRepo(repo) {
    const res = await fetch('/api/repos/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(repo)
    });
    return { ok: res.ok, data: await res.json() };
  },

  async getProjectFile(path = 'index.md') {
    const res = await fetch(`/api/project/file?path=${encodeURIComponent(path)}`);
    return res.json();
  },

  async createProjectFile({ path, is_folder, content }) {
    const res = await fetch('/api/project/file/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, is_folder, content })
    });
    return { ok: res.ok, data: await res.json() };
  },

  async deleteProjectFile(path) {
    const res = await fetch(`/api/project/file?path=${encodeURIComponent(path)}`, {
      method: 'DELETE'
    });
    return { ok: res.ok, data: await res.json() };
  },

  async renameProjectFile({ old_path, new_path }) {
    const res = await fetch('/api/project/file/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ old_path, new_path })
    });
    return { ok: res.ok, data: await res.json() };
  },

  async getProjectTree() {
    const res = await fetch('/api/project/tree');
    return res.json();
  },

  async getProjectGraph() {
    const res = await fetch('/api/project/graph');
    return res.json();
  },

  async getDocumentContext(path) {
    const res = await fetch(`/api/project/document-context?path=${encodeURIComponent(path)}`);
    return res.json();
  },

  async getAuditReport() {
    const res = await fetch('/api/project/audit');
    return res.json();
  },

  async scaffoldEntity(data) {
    const res = await fetch('/api/project/scaffold', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return { ok: res.ok, data: await res.json() };
  },

  // Centralized Workspace Changes & Diff Staging
  async getWorkspaceChanges() {
    const res = await fetch('/api/workspace/changes');
    return res.json();
  },

  async saveWorkspaceFile({ path, content }) {
    const res = await fetch('/api/workspace/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content })
    });
    return { ok: res.ok, data: await res.json() };
  },

  async generatePRSummaryAI() {
    const res = await fetch('/api/workspace/generate-pr-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    return { ok: res.ok, data: await res.json() };
  },

  async createUnifiedPR({ title, description }) {
    const res = await fetch('/api/workspace/create-pr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description })
    });
    return { ok: res.ok, data: await res.json() };
  },

  async discardWorkspaceChanges(path = null) {
    const res = await fetch('/api/workspace/discard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(path ? { path } : {})
    });
    return { ok: res.ok, data: await res.json() };
  },

  // Templates Management
  async getTemplates() {
    const res = await fetch('/api/templates');
    return res.json();
  },

  async saveTemplate(templateData) {
    const res = await fetch('/api/templates/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(templateData)
    });
    return { ok: res.ok, data: await res.json() };
  },

  async deleteTemplate(id) {
    const res = await fetch(`/api/templates?id=${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    return { ok: res.ok, data: await res.json() };
  },

  async generateTemplateAI(idea) {
    const res = await fetch('/api/templates/generate-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idea })
    });
    return { ok: res.ok, data: await res.json() };
  },

  // System Settings
  async getSettings() {
    const res = await fetch('/api/settings');
    return res.json();
  },

  async saveSettings(settings) {
    const res = await fetch('/api/settings/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings })
    });
    return { ok: res.ok, data: await res.json() };
  },

  // Governance
  async getGovernance() {
    const res = await fetch('/api/governance');
    return res.json();
  },

  async addReviewer({ name, handle, role, tier }) {
    const res = await fetch('/api/governance/reviewers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, handle, role, tier })
    });
    return { ok: res.ok, data: await res.json() };
  },

  async removeReviewer(id) {
    const res = await fetch(`/api/governance/reviewers?id=${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    return { ok: res.ok, data: await res.json() };
  },

  async updateGovernanceSettings({ min_approvals }) {
    const res = await fetch('/api/governance/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ min_approvals })
    });
    return { ok: res.ok, data: await res.json() };
  },

  // Agentic AI Chat & Memory Engine
  async sendChatMessage({ prompt, content, path, history, assistant_prompt, session_id, repo }) {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, content, path, history, assistant_prompt, session_id, repo })
    });
    return { ok: res.ok, data: await res.json() };
  },

  async getMemoryBrief({ repo, path }) {
    const params = new URLSearchParams();
    if (repo) params.set('repo', repo);
    if (path) params.set('path', path);
    const res = await fetch(`/api/chat/memory/brief?${params.toString()}`);
    return { ok: res.ok, data: await res.json() };
  },

  async getMemoryHistory({ repo, path }) {
    const params = new URLSearchParams();
    if (repo) params.set('repo', repo);
    if (path) params.set('path', path);
    const res = await fetch(`/api/chat/memory/history?${params.toString()}`);
    return { ok: res.ok, data: await res.json() };
  },

  async getMemorySession({ repo, session_id }) {
    const params = new URLSearchParams();
    if (repo) params.set('repo', repo);
    if (session_id) params.set('session_id', session_id);
    const res = await fetch(`/api/chat/memory/session?${params.toString()}`);
    return { ok: res.ok, data: await res.json() };
  },

  async getMemoryWiki({ repo, query } = {}) {
    const params = new URLSearchParams();
    if (repo) params.set('repo', repo);
    if (query) params.set('q', query);
    const res = await fetch(`/api/chat/memory/wiki?${params.toString()}`);
    return { ok: res.ok, data: await res.json() };
  },

  async saveMemoryWikiEntry({ repo, category, slug, title, content }) {
    const res = await fetch('/api/chat/memory/wiki', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo, category, slug, title, content })
    });
    return { ok: res.ok, data: await res.json() };
  },

  async deleteMemoryWikiEntry({ repo, category, slug }) {
    const res = await fetch('/api/chat/memory/wiki/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo, category, slug })
    });
    return { ok: res.ok, data: await res.json() };
  },

  async finalizeMemorySession({ repo, path, session_id, summary }) {
    const res = await fetch('/api/chat/memory/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo, path, session_id, summary })
    });
    return { ok: res.ok, data: await res.json() };
  },

  async getMemoryActor() {
    const res = await fetch('/api/chat/memory/actor');
    return { ok: res.ok, data: await res.json() };
  },

  async getAISettings() {
    const res = await fetch('/api/ai/settings');
    return { ok: res.ok, data: await res.json() };
  },

  async getAIModels({ provider, api_key, custom_endpoint } = {}) {
    const params = new URLSearchParams();
    if (provider) params.set('provider', provider);
    if (api_key) params.set('api_key', api_key);
    if (custom_endpoint) params.set('custom_endpoint', custom_endpoint);
    const res = await fetch(`/api/ai/models?${params.toString()}`);
    return { ok: res.ok, data: await res.json() };
  },

  async saveAISettings({ provider, model, api_key, custom_endpoint }) {
    const res = await fetch('/api/ai/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, model, api_key, custom_endpoint })
    });
    return { ok: res.ok, data: await res.json() };
  },

  // PRs
  async getPRs() {
    const res = await fetch('/api/prs');
    return res.json();
  },

  async createPR({ title, content, path }) {
    const res = await fetch('/api/prs/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, path })
    });
    return { ok: res.ok, data: await res.json() };
  },

  async approvePR(id) {
    const res = await fetch('/api/prs/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    return { ok: res.ok, data: await res.json() };
  },

  async mergePR(id) {
    const res = await fetch('/api/prs/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    return { ok: res.ok, data: await res.json() };
  },

  // Tutorials & Knowledge Hub
  async getTutorials() {
    const res = await fetch('/api/tutorials');
    return { ok: res.ok, data: await res.json() };
  },

  // Template Store & Installed Packs
  async getTemplateStore() {
    const res = await fetch('/api/templates/store');
    return { ok: res.ok, data: await res.json() };
  },

  async installTemplate(template_id) {
    const res = await fetch('/api/templates/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id })
    });
    return { ok: res.ok, data: await res.json() };
  },

  async getInstalledTemplates() {
    const res = await fetch('/api/templates/installed');
    return { ok: res.ok, data: await res.json() };
  },

  // Project Governance Status & Bootstrap
  async getProjectStatus() {
    const res = await fetch('/api/project/status');
    return { ok: res.ok, data: await res.json() };
  },

  async bootstrapProject(starter_pack = 'standard') {
    const res = await fetch('/api/project/bootstrap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ starter_pack })
    });
    return { ok: res.ok, data: await res.json() };
  },

  // Engineering Standards & ADRs
  async getEngineeringFiles() {
    const res = await fetch('/api/engineering/files');
    return { ok: res.ok, data: await res.json() };
  },

  async createEngineeringFile({ title, category, filename, content }) {
    const res = await fetch('/api/engineering/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, category, filename, content })
    });
    return { ok: res.ok, data: await res.json() };
  },

  // Ubiquitous Dictionary API
  async getDictionary() {
    const res = await fetch('/api/dictionary');
    return { ok: res.ok, data: await res.json() };
  },

  async saveDictionary(terms) {
    const res = await fetch('/api/dictionary/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ terms })
    });
    return { ok: res.ok, data: await res.json() };
  },

  // Dynamic Domains and Documents Catalog for Selectors
  async getProjectDomainsDocs() {
    const res = await fetch('/api/project/domains-docs');
    return { ok: res.ok, data: await res.json() };
  },

  // Pre-PR Sync & Conflict Verification
  async getProjectSyncStatus() {
    const res = await fetch('/api/project/sync-status');
    return { ok: res.ok, data: await res.json() };
  },

  // GitLens / Blame & Auditoria
  async getFileBlame(path) {
    const res = await fetch(`/api/git/blame?path=${encodeURIComponent(path)}`);
    return { ok: res.ok, data: await res.json() };
  },

  // Project Configuration & Setup (Layers, Taxonomy, 5W2H, Governance)
  async getProjectConfig() {
    const res = await fetch('/api/project/config');
    return { ok: res.ok, data: await res.json() };
  },

  async saveProjectConfig(configData) {
    const res = await fetch('/api/project/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configData)
    });
    return { ok: res.ok, data: await res.json() };
  },

  async resetProjectConfig() {
    const res = await fetch('/api/project/config/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    return { ok: res.ok, data: await res.json() };
  },

  async getProjectMembers() {
    const res = await fetch('/api/project/members');
    return { ok: res.ok, data: await res.json() };
  }
};
