import { useState, useCallback } from 'react';
import { API } from '../services/api';
import type { TemplateItem } from '../types';

export interface UseTemplateReturn {
  templates: TemplateItem[];
  communityTemplates: TemplateItem[];
  loading: boolean;
  importingId: string | null;
  error: string | null;
  fetchTemplates: () => Promise<void>;
  fetchCommunityTemplates: () => Promise<void>;
  resolveTemplate: (id: string) => Promise<TemplateItem | null>;
  createTemplate: (data: Partial<TemplateItem>) => Promise<{ success: boolean; message?: string; template?: TemplateItem }>;
  updateTemplate: (id: string, data: Partial<TemplateItem>) => Promise<{ success: boolean; message?: string; template?: TemplateItem }>;
  importFromCommunity: (id: string) => Promise<{ success: boolean; message: string }>;
  deleteTemplate: (id: string) => Promise<{ success: boolean; message?: string }>;
}

/**
 * Hook to interact with the template system.
 * - Fetches project templates and community templates.
 * - Resolves a single template by ID.
 * - Creates, updates and deletes templates.
 * - Imports community templates into the project.
 */
export function useTemplate(): UseTemplateReturn {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [communityTemplates, setCommunityTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await API.getProjectTemplates();
      if (res.ok && res.data?.templates) {
        setTemplates(res.data.templates);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar templates.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCommunityTemplates = useCallback(async () => {
    try {
      const res = await API.getCommunityTemplates();
      if (res.ok && res.data?.templates) {
        setCommunityTemplates(res.data.templates);
      }
    } catch {
      // ignore
    }
  }, []);

  const resolveTemplate = useCallback(async (id: string) => {
    if (!id) return null;
    try {
      const res = await API.getTemplate(id);
      if (res.ok && res.data?.template) {
        return res.data.template;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const createTemplate = useCallback(async (data: Partial<TemplateItem>) => {
    try {
      const res = await API.createProjectTemplate({
        id: data.id,
        templateName: data.templateName || data.title,
        title: data.title || '',
        ext: 'md',
        category: data.category || 'geral',
        description: data.description || '',
        tags: data.tags || [],
        badge: data.badge || 'Local',
        content: data.content || '',
        prompt: data.prompt || data.systemPrompt || '',
        source: 'local',
      });
      if (res.ok && res.data?.template) {
        await fetchTemplates();
        return { success: true, template: res.data.template };
      }
      return { success: false, message: (res.data as any)?.error || 'Erro ao criar template.' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Erro de conexão.' };
    }
  }, [fetchTemplates]);

  const updateTemplate = useCallback(async (id: string, data: Partial<TemplateItem>) => {
    try {
      const res = await API.updateProjectTemplate(id, data);
      if (res.ok && res.data?.template) {
        await fetchTemplates();
        return { success: true, template: res.data.template };
      }
      return { success: false, message: (res.data as any)?.error || 'Erro ao atualizar template.' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Erro de conexão.' };
    }
  }, [fetchTemplates]);

  const importFromCommunity = useCallback(async (id: string) => {
    setImportingId(id);
    try {
      const res = await API.importTemplateFromCommunity(id);
      if (res.ok) {
        // Refresh both lists after import
        await fetchTemplates();
        return { success: true, message: res.data?.message || 'Template importado.' };
      }
      return { success: false, message: (res.data as any)?.error || 'Erro ao importar.' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Erro de conexão.' };
    } finally {
      setImportingId(null);
    }
  }, [fetchTemplates]);

  const deleteTemplate = useCallback(async (id: string, repo?: string) => {
    try {
      const res = await API.deleteProjectTemplate(id, repo);
      if (res.ok) {
        const target = id.toLowerCase().trim().replace(/\.md$/, '');
        setTemplates((prev) => prev.filter((t) => {
          const tId = (t.id || '').toLowerCase().trim().replace(/\.md$/, '');
          const tName = (t.templateName || '').toLowerCase().trim().replace(/\.md$/, '');
          return tId !== target && tName !== target;
        }));
        await fetchTemplates();
        return { success: true, message: res.data?.message || 'Template removido com sucesso.' };
      }
      return { success: false, message: (res.data as any)?.error || 'Erro ao remover template.' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Erro de conexão ao remover.' };
    }
  }, [fetchTemplates]);

  return {
    templates,
    communityTemplates,
    loading,
    importingId,
    error,
    fetchTemplates,
    fetchCommunityTemplates,
    resolveTemplate,
    createTemplate,
    updateTemplate,
    importFromCommunity,
    deleteTemplate,
  };
}
