import type { TemplateItem, TutorialItem } from '../../types';
import type { ApiResponse } from './client';

export const templatesApi = {
  // Templates Básicos e Gestão
  async getTemplates(): Promise<{ templates: TemplateItem[] }> {
    const res = await fetch('/api/templates');
    return res.json();
  },

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

  // Tutorials
  async getTutorials(): Promise<{ tutorials: TutorialItem[] }> {
    const res = await fetch('/api/tutorials');
    return res.json();
  },
};
