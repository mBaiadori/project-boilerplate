import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Repo, WorkspaceChange, TreeNode, GitStatus, GitCommitInfo } from '../types';
import { API } from '../services/api';
import { DraftStore } from '../services/draft-store';
import { useAuth } from './AuthContext';

function findFirstMdFile(nodes: TreeNode[]): string | null {
  for (const node of nodes) {
    if (node.type === 'file' && node.path.endsWith('.md')) {
      return node.path;
    }
    if (node.children && node.children.length > 0) {
      const found = findFirstMdFile(node.children);
      if (found) return found;
    }
  }
  return null;
}

interface WorkspaceContextType {
  activeRepo: Repo | null;
  repos: Repo[];
  tree: TreeNode[];
  activeFile: string;
  fileContent: string;
  fileMetadata: Record<string, any>;
  pendingChanges: WorkspaceChange[];
  guardrailStatus: string;
  isSaving: boolean;
  isLoadingFile: boolean;
  isLoading: boolean;
  hasUnsavedChanges: boolean;
  gitStatus: GitStatus | null;
  gitLog: GitCommitInfo[];
  loadRepos: () => Promise<void>;
  selectRepo: (repo: Repo, initialFile?: string) => Promise<void>;
  selectRepoByName: (repoName: string, initialFile?: string) => Promise<boolean>;
  loadTree: () => Promise<void>;
  loadFile: (filePath: string) => Promise<void>;
  setFileContent: (content: string) => void;
  setFileMetadata: (meta: Record<string, any>) => void;
  saveCurrentFile: (meta?: Record<string, any>) => Promise<{ success: boolean; error?: string }>;
  refreshPendingChanges: () => Promise<void>;
  discardChanges: (path?: string) => Promise<void>;
  refreshGitStatus: () => Promise<void>;
  refreshGitLog: (limit?: number) => Promise<void>;
  commitGit: (message: string, files?: string[]) => Promise<{ success: boolean; message: string; commitHash?: string }>;
  syncGit: (branch?: string) => Promise<{ success: boolean; message: string }>;
  createOrSwitchBranch: (branch: string) => Promise<{ success: boolean; message: string }>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [activeRepo, setActiveRepo] = useState<Repo | null>(null);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [activeFile, setActiveFile] = useState<string>('');
  const [fileContent, setFileContentState] = useState<string>('');
  const [fileMetadata, setFileMetadataState] = useState<Record<string, any>>({});
  const [originalContent, setOriginalContent] = useState<string>('');
  const [pendingChanges, setPendingChanges] = useState<WorkspaceChange[]>([]);
  const [guardrailStatus, setGuardrailStatus] = useState<string>('CLEAN');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [gitLog, setGitLog] = useState<GitCommitInfo[]>([]);

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

  const refreshGitStatus = useCallback(async () => {
    if (!activeRepo) return;
    try {
      const res = await API.getGitStatus();
      if (res.ok && res.data) {
        setGitStatus(res.data);
      }
    } catch (err) {
      console.warn('[WorkspaceContext] Erro ao buscar status do Git:', err);
    }
  }, [activeRepo]);

  const refreshGitLog = useCallback(async (limit = 20) => {
    if (!activeRepo) return;
    try {
      const res = await API.getGitLog(limit);
      if (res.ok && res.data?.commits) {
        setGitLog(res.data.commits);
      }
    } catch (err) {
      console.warn('[WorkspaceContext] Erro ao buscar histórico Git:', err);
    }
  }, [activeRepo]);

  const refreshPendingChanges = useCallback(async () => {
    if (!activeRepo) return;
    try {
      const data = await API.getWorkspaceChanges();
      setPendingChanges(data.changes || []);
      setGuardrailStatus(data.guardrail || 'CLEAN');
      await refreshGitStatus();
    } catch (err) {
      console.error('[WorkspaceContext] Erro ao buscar alterações pendentes:', err);
    }
  }, [activeRepo, refreshGitStatus]);

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
    if (!activeRepo || !filePath) return;
    const isMd = filePath.endsWith('.md') || filePath.endsWith('.markdown');
    if (!isMd) {
      console.warn('[WorkspaceContext] Arquivo não é markdown, abertura ignorada:', filePath);
      return;
    }
    setIsLoadingFile(true);
    setActiveFile(filePath);
    try {
      const data = await API.getProjectFile(filePath);
      const draft = DraftStore.getDocDraft(activeRepo.name, filePath);
      
      const content = draft ? draft.rawContent : (data.content || '');
      setFileContentState(content);
      setOriginalContent(data.content || '');
      setFileMetadataState(data.meta || {});
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

  const setFileMetadata = (meta: Record<string, any>) => {
    setFileMetadataState(meta);
  };

  const selectRepo = async (repo: Repo, initialFile?: string) => {
    setActiveRepo(repo);
    await API.selectRepo(repo);
    const data = await API.getProjectTree();
    setTree(data.tree || []);
    await refreshPendingChanges();
    await refreshGitStatus();
    await refreshGitLog(15);

    const fileToOpen = initialFile || findFirstMdFile(data.tree || []);
    if (fileToOpen) {
      await loadFile(fileToOpen);
    } else {
      setActiveFile('');
      setFileContentState('');
      setOriginalContent('');
      setFileMetadataState({});
    }
  };

  const selectRepoByName = async (repoName: string, initialFile?: string): Promise<boolean> => {
    let currentRepos = repos;
    if (currentRepos.length === 0) {
      try {
        const res = await API.getRepos();
        if (res.ok && res.data.repos) {
          currentRepos = res.data.repos;
          setRepos(currentRepos);
        }
      } catch (err) {
        console.error('[WorkspaceContext] Erro ao carregar repos:', err);
      }
    }

    const found = currentRepos.find(r => r.name.toLowerCase() === repoName.toLowerCase());
    if (found) {
      await selectRepo(found, initialFile);
      return true;
    }
    const fallbackRepo: Repo = { id: 0, name: repoName, full_name: repoName, is_local: true };
    await selectRepo(fallbackRepo, initialFile);
    return true;
  };

  const saveCurrentFile = async (metaOverride?: Record<string, any>) => {
    if (!activeRepo || !activeFile) return { success: false, error: 'Nenhum arquivo ativo' };
    setIsSaving(true);
    try {
      const meta = metaOverride !== undefined ? metaOverride : fileMetadata;
      const res = await API.saveWorkspaceFile({ path: activeFile, content: fileContent, meta });
      if (res.ok) {
        setOriginalContent(fileContent);
        if (res.data?.meta) {
          setFileMetadataState(res.data.meta);
        }
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
    if (path === activeFile || (!path && activeFile)) {
      await loadFile(activeFile);
    }
  };

  const commitGit = async (message: string, files?: string[]) => {
    const res = await API.commitGitChanges({ message, files });
    if (res.ok && res.data.success) {
      await refreshPendingChanges();
      await refreshGitStatus();
      await refreshGitLog(15);
    }
    return res.data;
  };

  const syncGit = async (branch?: string) => {
    const res = await API.syncGit(branch);
    if (res.ok) {
      await refreshPendingChanges();
      await refreshGitStatus();
      await refreshGitLog(15);
      await loadTree();
    }
    return res.data;
  };

  const createOrSwitchBranch = async (branch: string) => {
    const res = await API.createOrSwitchBranch(branch);
    if (res.ok) {
      await refreshGitStatus();
      await refreshGitLog(15);
      await loadTree();
    }
    return res.data;
  };

  // Carrega status inicial e eventos SSE de Fast Refresh
  useEffect(() => {
    if (!isAuthenticated) return;

    loadRepos();

    let evtSource: EventSource | null = null;
    try {
      evtSource = new EventSource('/api/events');
      evtSource.addEventListener('refresh', () => {
        refreshPendingChanges();
        loadTree();
        refreshGitStatus();
      });
    } catch (e) {
      console.warn('[WorkspaceContext] SSE não disponível:', e);
    }

    return () => {
      if (evtSource) evtSource.close();
    };
  }, [isAuthenticated, loadRepos, refreshPendingChanges, loadTree, refreshGitStatus]);

  return (
    <WorkspaceContext.Provider
      value={{
        activeRepo,
        repos,
        tree,
        activeFile,
        fileContent,
        fileMetadata,
        pendingChanges,
        guardrailStatus,
        isSaving,
        isLoadingFile,
        isLoading,
        hasUnsavedChanges,
        gitStatus,
        gitLog,
        loadRepos,
        selectRepo,
        selectRepoByName,
        loadTree,
        loadFile,
        setFileContent,
        setFileMetadata,
        saveCurrentFile,
        refreshPendingChanges,
        discardChanges,
        refreshGitStatus,
        refreshGitLog,
        commitGit,
        syncGit,
        createOrSwitchBranch
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
