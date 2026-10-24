import type { SkillItem, ProjectSkillsManifest } from '../../types';
import type { ApiResponse } from './client';

export const skillsApi = {
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
};
