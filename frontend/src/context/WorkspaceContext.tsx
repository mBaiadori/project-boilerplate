import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Repo, WorkspaceChange, TreeNode } from '../types';
import { API } from '../services/api';
import { DraftStore } from '../services/draft-store';
import { useAuth } from './AuthContext';

interface WorkspaceContextType {
  activeRepo: Repo | null;
  repos: Repo[];
  tree: TreeNode[];
  activeFile: string;
  fileContent: string;
  pendingChanges: WorkspaceChange[];
  guardrailStatus: string;
  isSaving: boolean;
  isLoadingFile: boolean;
  isLoading: boolean;
  hasUnsavedChanges: boolean;
  loadRepos: () => Promise<void>;
  selectRepo: (repo: Repo) => Promise<void>;
  loadTree: () => Promise<void>;
  loadFile: (filePath: string) => Promise<void>;
  setFileContent: (content: string) => void;
  saveCurrentFile: () => Promise<{ success: boolean; error?: string }>;
  refreshPendingChanges: () => Promise<void>;
  discardChanges: (path?: string) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [activeRepo, setActiveRepo] = useState<Repo | null>(null);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [activeFile, setActiveFile] = useState<string>('index.md');
  const [fileContent, setFileContentState] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [pendingChanges, setPendingChanges] = useState<WorkspaceChange[]>([]);
  const [guardrailStatus, setGuardrailStatus] = useState<string>('CLEAN');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const hasUnsavedChanges = fileContent !== originalContent;

  const loadRepos = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await API.getRepos();
      if (res.ok && res.data.repos) {
        setRepos(res.data.repos);
      }
    } catch (err) {
      console.error('[WorkspaceContext] Erro ao carregar repositórios:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshPendingChanges = useCallback(async () => {
    if (!activeRepo) return;
    try {
      const data = await API.getWorkspaceChanges();
      setPendingChanges(data.changes || []);
      setGuardrailStatus(data.guardrail || 'CLEAN');
    } catch (err) {
      console.error('[WorkspaceContext] Erro ao buscar alterações pendentes:', err);
    }
  }, [activeRepo]);

  const loadTree = useCallback(async () => {
    if (!activeRepo) return;
    try {
      const data = await API.getProjectTree();
      setTree(data.tree || []);
    } catch (err) {
      console.error('[WorkspaceContext] Erro ao buscar árvore:', err);
    }
  }, [activeRepo]);

  const loadFile = useCallback(async (filePath: string) => {
    if (!activeRepo) return;
    setIsLoadingFile(true);
    setActiveFile(filePath);
    try {
      const data = await API.getProjectFile(filePath);
      const draft = DraftStore.getDocDraft(activeRepo.name, filePath);
      
      const content = draft ? draft.rawContent : (data.content || '');
      setFileContentState(content);
      setOriginalContent(data.content || '');
    } catch (err) {
      console.error('[WorkspaceContext] Erro ao carregar arquivo:', err);
    } finally {
      setIsLoadingFile(false);
    }
  }, [activeRepo]);

  const setFileContent = (content: string) => {
    setFileContentState(content);
    if (activeRepo && activeFile) {
      DraftStore.saveDocDraft(activeRepo.name, activeFile, { body: content, rawContent: content });
    }
  };

  const selectRepo = async (repo: Repo) => {
    setActiveRepo(repo);
    await API.selectRepo(repo);
    await loadTree();
    await refreshPendingChanges();
    await loadFile('index.md');
  };

  const saveCurrentFile = async () => {
    if (!activeRepo || !activeFile) return { success: false, error: 'Nenhum arquivo ativo' };
    setIsSaving(true);
    try {
      const res = await API.saveWorkspaceFile({ path: activeFile, content: fileContent });
      if (res.ok) {
        setOriginalContent(fileContent);
        DraftStore.clearDocDraft(activeRepo.name, activeFile);
        await refreshPendingChanges();
        return { success: true };
      }
      return { success: false, error: 'Falha ao salvar no workspace' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao salvar' };
    } finally {
      setIsSaving(false);
    }
  };

  const discardChanges = async (path?: string) => {
    if (!activeRepo) return;
    await API.discardWorkspaceChanges(path || null);
    if (path && activeRepo) {
      DraftStore.clearDocDraft(activeRepo.name, path);
    }
    await refreshPendingChanges();
    if (path === activeFile || !path) {
      await loadFile(activeFile);
    }
  };

  // Carrega status inicial e eventos SSE de Fast Refresh
  useEffect(() => {
    if (!isAuthenticated) return;

    loadRepos();

    // EventSource para SSE Fast Refresh do servidor Python
    let evtSource: EventSource | null = null;
    try {
      evtSource = new EventSource('/api/events');
      evtSource.addEventListener('refresh', () => {
        refreshPendingChanges();
        loadTree();
      });
    } catch (e) {
      console.warn('[WorkspaceContext] SSE não disponível:', e);
    }

    return () => {
      if (evtSource) evtSource.close();
    };
  }, [isAuthenticated, loadRepos, refreshPendingChanges, loadTree]);

  return (
    <WorkspaceContext.Provider
      value={{
        activeRepo,
        repos,
        tree,
        activeFile,
        fileContent,
        pendingChanges,
        guardrailStatus,
        isSaving,
        isLoadingFile,
        isLoading,
        hasUnsavedChanges,
        loadRepos,
        selectRepo,
        loadTree,
        loadFile,
        setFileContent,
        saveCurrentFile,
        refreshPendingChanges,
        discardChanges
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace deve ser utilizado dentro de um WorkspaceProvider');
  }
  return context;
};
