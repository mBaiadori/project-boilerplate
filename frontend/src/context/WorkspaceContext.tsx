import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { Repo, WorkspaceChange, TreeNode, GitStatus, GitCommitInfo, DocumentMetadataItem, ProjectMetadataOptions, WhatsNewSummary } from '../types';
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

export type AutoSaveStatus = 'Pronto' | 'Salvando...' | 'Salvo no disco' | 'Erro';

interface WorkspaceContextType {
  activeRepo: Repo | null;
  repos: Repo[];
  tree: TreeNode[];
  activeFile: string;
  fileContent: string;
  originalContent: string;
  fileMetadata: Record<string, any>;
  pendingChanges: WorkspaceChange[];
  guardrailStatus: string;
  isSaving: boolean;
  saveStatus: AutoSaveStatus;
  isLoadingFile: boolean;
  isLoading: boolean;
  isLoadingWorkspace: boolean;
  isLoadingTree: boolean;
  hasUnsavedChanges: boolean;
  gitStatus: GitStatus | null;
  gitLog: GitCommitInfo[];
  whatsNewSummary: WhatsNewSummary | null;
  hasUnreadWhatsNew: boolean;
  refreshWhatsNew: () => Promise<void>;
  markWhatsNewAsSeen: () => void;
  loadRepos: () => Promise<void>;
  selectRepo: (repo: Repo, initialFile?: string) => Promise<void>;
  selectRepoByName: (repoName: string, initialFile?: string) => Promise<boolean>;
  loadTree: (targetRepo?: string) => Promise<void>;
  loadFile: (filePath: string) => Promise<void>;
  setFileContent: (content: string) => void;
  setFileMetadata: (meta: Record<string, any>) => void;
  updateFileMetadata: (partialMeta: Partial<DocumentMetadataItem>) => Promise<void>;
  updateDocumentTitle: (newTitle: string) => Promise<void>;
  projectMetaOptions: ProjectMetadataOptions | null;
  loadProjectMetadataOptions: () => Promise<void>;
  projectConfig: any;
  loadProjectConfig: () => Promise<any>;
  saveProjectConfig: (configData: any) => Promise<{ success: boolean; error?: string }>;
  saveCurrentFile: (meta?: Record<string, any>) => Promise<{ success: boolean; error?: string }>;
  flushPendingSave: () => Promise<void>;
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
  const [saveStatus, setSaveStatus] = useState<AutoSaveStatus>('Pronto');
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(false);
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [gitLog, setGitLog] = useState<GitCommitInfo[]>([]);
  const [whatsNewSummary, setWhatsNewSummary] = useState<WhatsNewSummary | null>(null);
  const [hasUnreadWhatsNew, setHasUnreadWhatsNew] = useState<boolean>(false);
  const [projectMetaOptions, setProjectMetaOptions] = useState<ProjectMetadataOptions | null>(null);
  const [projectConfig, setProjectConfig] = useState<any>(null);

  const activeFileRef = useRef<string>('');
  const fileContentRef = useRef<string>('');
  const originalContentRef = useRef<string>('');
  const fileMetadataRef = useRef<Record<string, any>>({});
  const activeRepoRef = useRef<Repo | null>(null);
  const inFlightRepoRef = useRef<string | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    activeFileRef.current = activeFile;
  }, [activeFile]);

  useEffect(() => {
    fileContentRef.current = fileContent;
  }, [fileContent]);

  useEffect(() => {
    originalContentRef.current = originalContent;
  }, [originalContent]);

  useEffect(() => {
    fileMetadataRef.current = fileMetadata;
  }, [fileMetadata]);

  useEffect(() => {
    activeRepoRef.current = activeRepo;
  }, [activeRepo]);

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
    if (!activeRepoRef.current) return;
    try {
      const res = await API.getGitStatus();
      if (res.ok && res.data) {
        setGitStatus(res.data);
      }
    } catch (err) {
      console.warn('[WorkspaceContext] Erro ao buscar status do Git:', err);
    }
  }, []);

  const refreshGitLog = useCallback(async (limit = 20) => {
    if (!activeRepoRef.current) return;
    try {
      const res = await API.getGitLog(limit);
      if (res.ok && res.data?.commits) {
        setGitLog(res.data.commits);
      }
    } catch (err) {
      console.warn('[WorkspaceContext] Erro ao buscar histórico Git:', err);
    }
  }, []);

  const refreshPendingChanges = useCallback(async () => {
    if (!activeRepoRef.current) return;
    try {
      const data = await API.getWorkspaceChanges();
      setPendingChanges(data.changes || []);
      setGuardrailStatus(data.guardrail || 'CLEAN');
      await refreshGitStatus();
    } catch (err) {
      console.error('[WorkspaceContext] Erro ao buscar alterações pendentes:', err);
    }
  }, [refreshGitStatus]);

  const performDiskSave = useCallback(async (
    targetPath?: string,
    contentToSave?: string,
    metaToSave?: Record<string, any>
  ): Promise<{ success: boolean; error?: string }> => {
    const file = targetPath || activeFileRef.current;
    const content = contentToSave !== undefined ? contentToSave : fileContentRef.current;
    const meta = metaToSave !== undefined ? metaToSave : fileMetadataRef.current;
    const repo = activeRepoRef.current;

    if (!repo || !file) {
      return { success: false, error: 'Nenhum documento ativo para salvar' };
    }

    setIsSaving(true);
    setSaveStatus('Salvando...');
    try {
      const res = await API.saveWorkspaceFile({ path: file, content, meta });
      if (res.ok) {
        if (file === activeFileRef.current) {
          setOriginalContent(content);
          originalContentRef.current = content;
          if (res.data?.meta) {
            setFileMetadataState(res.data.meta);
            fileMetadataRef.current = res.data.meta;
          }
        }
        DraftStore.clearDocDraft(repo.name, file);
        setSaveStatus('Salvo no disco');
        window.dispatchEvent(new CustomEvent('workspace:document-saved', {
          detail: { filePath: file, meta: res.data?.meta }
        }));
        if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
        statusTimerRef.current = setTimeout(() => {
          setSaveStatus('Pronto');
        }, 2200);

        refreshPendingChanges().catch(() => {});
        return { success: true };
      } else {
        setSaveStatus('Erro');
        return { success: false, error: 'Falha ao gravar no workspace' };
      }
    } catch (err: any) {
      console.error('[WorkspaceContext] Erro ao gravar arquivo no disco:', err);
      setSaveStatus('Erro');
      return { success: false, error: err.message || 'Erro ao gravar no disco' };
    } finally {
      setIsSaving(false);
    }
  }, [refreshPendingChanges]);

  const flushPendingSave = useCallback(async () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    if (activeFileRef.current && fileContentRef.current !== originalContentRef.current) {
      await performDiskSave(activeFileRef.current, fileContentRef.current, fileMetadataRef.current);
    }
  }, [performDiskSave]);

  const loadTree = useCallback(async (targetRepo?: string) => {
    const repo = targetRepo || activeRepoRef.current?.name;
    if (!repo) return;
    setIsLoadingTree(true);
    try {
      const data = await API.getProjectTree(repo);
      setTree(data.tree || []);
    } catch (err) {
      console.error('[WorkspaceContext] Erro ao buscar árvore:', err);
    } finally {
      setIsLoadingTree(false);
    }
  }, []);

  const loadFile = useCallback(async (rawFilePath: string) => {
    if (!activeRepoRef.current || !rawFilePath) return;

    const hashIndex = rawFilePath.indexOf('#');
    const cleanPath = hashIndex !== -1 ? rawFilePath.slice(0, hashIndex) : rawFilePath;
    const hash = hashIndex !== -1 ? rawFilePath.slice(hashIndex) : '';

    if (hash) {
      try {
        window.location.hash = hash;
      } catch (e) {}
    }

    // Se o arquivo já for o ativo atual, apenas disparar a navegação de fragmento sem recarregar o arquivo do zero
    if (cleanPath === activeFileRef.current) {
      if (hash) {
        window.dispatchEvent(new CustomEvent('workspace:navigate-fragment', {
          detail: { hash, filePath: cleanPath }
        }));
      }
      return;
    }

    // 1. Flush de segurança se o arquivo anterior possuía alterações não salvas
    await flushPendingSave();

    setIsLoadingFile(true);
    setActiveFile(cleanPath);
    activeFileRef.current = cleanPath;
    setFileContentState('');
    fileContentRef.current = '';
    setOriginalContent('');
    originalContentRef.current = '';
    setFileMetadataState({});
    fileMetadataRef.current = {};
    try {
      const data = await API.getProjectFile(cleanPath);
      if (!data || (data as any).error) {
        throw new Error((data as any).error || 'Arquivo não encontrado');
      }
      const draft = DraftStore.getDocDraft(activeRepoRef.current.name, cleanPath);
      
      const content = draft ? draft.rawContent : (data.content || '');
      setFileContentState(content);
      fileContentRef.current = content;
      setOriginalContent(data.content || '');
      originalContentRef.current = data.content || '';
      setFileMetadataState(data.meta || {});
      fileMetadataRef.current = data.meta || {};
      setSaveStatus('Pronto');

      if (hash) {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('workspace:navigate-fragment', {
            detail: { hash, filePath: cleanPath }
          }));
        }, 150);
      }
    } catch (err: any) {
      console.error('[WorkspaceContext] Erro ao carregar arquivo:', err);
      window.dispatchEvent(new CustomEvent('workspace:file-load-error', {
        detail: {
          path: cleanPath,
          message: `Documento "${cleanPath}" não foi encontrado no workspace.`
        }
      }));
    } finally {
      setIsLoadingFile(false);
    }
  }, [flushPendingSave]);

  const setFileContent = useCallback((content: string) => {
    setFileContentState(content);
    fileContentRef.current = content;

    const currentRepo = activeRepoRef.current;
    const currentFile = activeFileRef.current;

    if (currentRepo && currentFile) {
      DraftStore.saveDocDraft(currentRepo.name, currentFile, { body: content, rawContent: content });

      if (content !== originalContentRef.current) {
        setSaveStatus('Salvando...');
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
        }
        autoSaveTimerRef.current = setTimeout(() => {
          performDiskSave(currentFile, content, fileMetadataRef.current);
        }, 600);
      }
    }
  }, [performDiskSave]);

  const loadProjectMetadataOptions = useCallback(async () => {
    if (!activeRepoRef.current) return;
    try {
      const res = await API.getProjectMetadataOptions(activeRepoRef.current.name);
      if (res.ok && res.data) {
        setProjectMetaOptions(res.data);
      }
    } catch (err) {
      console.warn('[WorkspaceContext] Erro ao carregar opções de metadados:', err);
    }
  }, []);

  const loadProjectConfig = useCallback(async () => {
    if (!activeRepoRef.current) return null;
    try {
      const res = await API.getProjectConfig(activeRepoRef.current.name);
      if (res.ok && res.data) {
        setProjectConfig(res.data);
        return res.data;
      }
    } catch (err) {
      console.warn('[WorkspaceContext] Erro ao carregar project.config:', err);
    }
    return null;
  }, []);

  const saveProjectConfig = useCallback(async (configData: any) => {
    if (!activeRepoRef.current) return { success: false, error: 'Nenhum repositório ativo' };
    try {
      const res = await API.saveProjectConfig(configData, activeRepoRef.current.name);
      if (res.ok) {
        setProjectConfig(configData);
        await loadProjectMetadataOptions();
        return { success: true };
      }
      return { success: false, error: 'Falha ao salvar configurações do projeto' };
    } catch (err: any) {
      console.error('[WorkspaceContext] Erro ao salvar project.config:', err);
      return { success: false, error: err.message || 'Erro ao salvar configurações' };
    }
  }, [loadProjectMetadataOptions]);

  const updateFileMetadata = useCallback(async (partialMeta: Partial<DocumentMetadataItem>) => {
    const currentFile = activeFileRef.current;
    const currentRepo = activeRepoRef.current;
    if (!currentFile || !currentRepo) return;

    const merged = {
      ...fileMetadataRef.current,
      ...partialMeta,
    };
    setFileMetadataState(merged);
    fileMetadataRef.current = merged;

    try {
      const res = await API.updateDocumentMetadataItem({
        path: currentFile,
        meta: partialMeta,
        repo: currentRepo.name
      });
      if (res.ok && res.data?.meta) {
        setFileMetadataState(res.data.meta);
        fileMetadataRef.current = res.data.meta;
        if (res.data.tree) {
          setTree(res.data.tree);
        }
        window.dispatchEvent(new CustomEvent('workspace:document-saved', {
          detail: { filePath: currentFile, meta: res.data.meta }
        }));
      }
    } catch (err) {
      console.error('[WorkspaceContext] Erro ao atualizar metadados:', err);
    }
  }, []);

  const updateDocumentTitle = useCallback(async (newTitle: string) => {
    await updateFileMetadata({ title: newTitle });
  }, [updateFileMetadata]);

  const refreshWhatsNew = useCallback(async () => {
    const repoName = activeRepoRef.current?.name || 'default';
    const lastSeenKey = `spec_whats_new_seen_${repoName}`;
    const lastSeenHash = localStorage.getItem(lastSeenKey) || undefined;

    try {
      const res = await API.getWhatsNew(lastSeenHash);
      if (res.ok && res.data) {
        setWhatsNewSummary(res.data);
        if (res.data.hasNewUpdates && res.data.latestHash && res.data.latestHash !== lastSeenHash) {
          setHasUnreadWhatsNew(true);
        } else {
          setHasUnreadWhatsNew(false);
        }
      }
    } catch (e) {
      console.warn('[WorkspaceContext] Erro ao carregar novidades da equipe:', e);
    }
  }, []);

  const markWhatsNewAsSeen = useCallback(() => {
    const repoName = activeRepoRef.current?.name || 'default';
    const lastSeenKey = `spec_whats_new_seen_${repoName}`;
    if (whatsNewSummary?.latestHash) {
      localStorage.setItem(lastSeenKey, whatsNewSummary.latestHash);
    }
    setHasUnreadWhatsNew(false);
    refreshWhatsNew();
  }, [whatsNewSummary, refreshWhatsNew]);

  const selectRepo = useCallback(async (repo: Repo, initialFile?: string) => {
    if (!repo || !repo.name) return;
    if (inFlightRepoRef.current === repo.name) {
      return;
    }
    inFlightRepoRef.current = repo.name;
    setIsLoadingWorkspace(true);
    setIsLoadingTree(true);
    try {
      await flushPendingSave();
      setActiveRepo(repo);
      activeRepoRef.current = repo;

      // Clear previous document states if changing to a different repo
      setActiveFile('');
      activeFileRef.current = '';
      setFileContentState('');
      fileContentRef.current = '';
      setOriginalContent('');
      originalContentRef.current = '';
      setFileMetadataState({});
      fileMetadataRef.current = {};

      await API.selectRepo(repo);
      const data = await API.getProjectTree(repo.name);
      setTree(data.tree || []);

      await Promise.all([
        loadProjectMetadataOptions(),
        loadProjectConfig(),
        refreshPendingChanges(),
        refreshGitStatus(),
        refreshGitLog(15),
        refreshWhatsNew()
      ]);

      const fileToOpen = initialFile || findFirstMdFile(data.tree || []);
      if (fileToOpen) {
        await loadFile(fileToOpen);
      }
    } finally {
      inFlightRepoRef.current = null;
      setIsLoadingTree(false);
      setIsLoadingWorkspace(false);
    }
  }, [
    flushPendingSave,
    loadProjectMetadataOptions,
    loadProjectConfig,
    refreshPendingChanges,
    refreshGitStatus,
    refreshGitLog,
    refreshWhatsNew,
    loadFile
  ]);

  const selectRepoByName = useCallback(async (repoName: string, initialFile?: string): Promise<boolean> => {
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
  }, [repos, selectRepo]);

  const saveCurrentFile = async (metaOverride?: Record<string, any>) => {
    const meta = metaOverride !== undefined ? metaOverride : fileMetadataRef.current;
    return performDiskSave(activeFileRef.current, fileContentRef.current, meta);
  };

  const discardChanges = async (path?: string) => {
    if (!activeRepo) return;
    await API.discardWorkspaceChanges(path || null);
    if (path && activeRepo) {
      DraftStore.clearDocDraft(activeRepo.name, path);
    } else if (!path && activeRepo) {
      DraftStore.clearDocDraft(activeRepo.name, activeFileRef.current);
    }
    await Promise.all([
      refreshPendingChanges(),
      refreshGitStatus(),
      loadTree()
    ]);
    if (path === activeFileRef.current || (!path && activeFileRef.current)) {
      await loadFile(activeFileRef.current);
    }
  };

  const commitGit = async (message: string, files?: string[]) => {
    const res = await API.commitGitChanges({ message, files });
    if (res.ok && res.data.success) {
      await refreshPendingChanges();
      await refreshGitStatus();
      await refreshGitLog(15);
      await refreshWhatsNew();
    }
    return res.data;
  };

  const syncGit = async (branch?: string) => {
    const res = await API.syncGit(branch);
    if (res.ok) {
      await refreshPendingChanges();
      await refreshGitStatus();
      await refreshGitLog(15);
      await refreshWhatsNew();
      await loadTree();
    }
    return res.data;
  };

  const createOrSwitchBranch = async (branch: string) => {
    const res = await API.createOrSwitchBranch(branch);
    if (res.ok) {
      await refreshGitStatus();
      await refreshGitLog(15);
      await refreshWhatsNew();
      await loadTree();
    }
    return res.data;
  };

  // Lifecycle: Flush de alterações pendentes ao fechar aba, recarregar ou ocultar janela
  useEffect(() => {
    const handleUnloadOrHide = () => {
      if (
        activeRepoRef.current &&
        activeFileRef.current &&
        fileContentRef.current !== originalContentRef.current
      ) {
        try {
          const payload = JSON.stringify({
            path: activeFileRef.current,
            content: fileContentRef.current,
            meta: fileMetadataRef.current
          });
          fetch('/api/workspace/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true
          });
        } catch (e) {
          console.warn('[WorkspaceContext] Falha no flush de fechamento de página:', e);
        }
      }
    };

    window.addEventListener('beforeunload', handleUnloadOrHide);
    window.addEventListener('pagehide', handleUnloadOrHide);
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleUnloadOrHide();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleUnloadOrHide);
      window.removeEventListener('pagehide', handleUnloadOrHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

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
        refreshWhatsNew();
      });
    } catch (e) {
      console.warn('[WorkspaceContext] SSE não disponível:', e);
    }

    return () => {
      if (evtSource) evtSource.close();
    };
  }, [isAuthenticated, loadRepos, refreshPendingChanges, loadTree, refreshGitStatus, refreshWhatsNew]);

  return (
    <WorkspaceContext.Provider
      value={{
        activeRepo,
        repos,
        tree,
        activeFile,
        fileContent,
        originalContent,
        fileMetadata,
        pendingChanges,
        guardrailStatus,
        isSaving,
        saveStatus,
        isLoadingFile,
        isLoading,
        isLoadingWorkspace,
        isLoadingTree,
        hasUnsavedChanges,
        gitStatus,
        gitLog,
        whatsNewSummary,
        hasUnreadWhatsNew,
        refreshWhatsNew,
        markWhatsNewAsSeen,
        loadRepos,
        selectRepo,
        selectRepoByName,
        loadTree,
        loadFile,
        setFileContent,
        setFileMetadata: (meta: Record<string, any>) => {
          setFileMetadataState(meta);
          fileMetadataRef.current = meta;
        },
        updateFileMetadata,
        updateDocumentTitle,
        projectMetaOptions,
        loadProjectMetadataOptions,
        projectConfig,
        loadProjectConfig,
        saveProjectConfig,
        saveCurrentFile,
        flushPendingSave,
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
