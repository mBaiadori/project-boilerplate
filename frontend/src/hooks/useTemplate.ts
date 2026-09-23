import { useTemplateStore } from '../stores/templateStore';
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
  deleteTemplate: (id: string, isCommunity?: boolean) => Promise<{ success: boolean; message?: string }>;
  deleteCommunityTemplate: (id: string) => Promise<{ success: boolean; message?: string }>;
}

/**
 * Hook to interact with the template system.
 * Backed by Zustand (useTemplateStore) for centralized, reactive global state.
 */
export function useTemplate(): UseTemplateReturn {
  const templates = useTemplateStore((s) => s.templates);
  const communityTemplates = useTemplateStore((s) => s.communityTemplates);
  const loading = useTemplateStore((s) => s.loading);
  const importingId = useTemplateStore((s) => s.importingId);
  const error = useTemplateStore((s) => s.error);

  const fetchTemplates = useTemplateStore((s) => s.fetchTemplates);
  const fetchCommunityTemplates = useTemplateStore((s) => s.fetchCommunityTemplates);
  const resolveTemplate = useTemplateStore((s) => s.resolveTemplate);
  const createTemplate = useTemplateStore((s) => s.createTemplate);
  const updateTemplate = useTemplateStore((s) => s.updateTemplate);
  const importFromCommunity = useTemplateStore((s) => s.importFromCommunity);
  const deleteTemplate = useTemplateStore((s) => s.deleteTemplate);
  const deleteCommunityTemplate = useTemplateStore((s) => s.deleteCommunityTemplate);

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
    deleteCommunityTemplate,
  };
}

export { useTemplateStore };
