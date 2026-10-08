import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import type {
  Repo,
  Organization,
  RepoDiagnosis,
  WorkspaceChange,
  TreeNode,
  GitStatus,
  GitCommitInfo,
  DocumentMetadataItem,
  ProjectMetadataOptions,
  WhatsNewSummary,
  DictionaryTerm,
  EffectiveUserPermission,
} from "../types";
import { API } from "../services/api";
import { DraftStore } from "../services/draft-store";
import { useAuth } from "./AuthContext";
import { isPathHidden, isSystemPath } from "../utils/hidden-files";

function findFirstMdFile(nodes: TreeNode[]): string | null {
  for (const node of nodes) {
    if (node.type === "file" && node.path.endsWith(".md")) {
      return node.path;
    }
    if (node.children && node.children.length > 0) {
      const found = findFirstMdFile(node.children);
      if (found) return found;
    }
  }
  return null;
}

export type AutoSaveStatus =
  | "Pronto"
  | "Salvando..."
  | "Salvo no disco"
  | "Erro";

interface WorkspaceContextType {
  activeOrg: Organization | null;
  orgs: Organization[];
  loadOrgs: () => Promise<void>;
  selectOrg: (orgLogin: string) => Promise<void>;
  activeRepo: Repo | null;
  repos: Repo[];
  tree: TreeNode[];
  treesByRepo: Record<string, TreeNode[]>;
  activeFile: string;
  activeDocRepo: string;
  fileContent: string;
  originalContent: string;
  fileMetadata: Record<string, any>;
  pendingChanges: WorkspaceChange[];
  systemPendingChanges: WorkspaceChange[];
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
  hasRemoteUpdates: boolean;
  remoteUpdateInfo: { localHash: string; remoteHash?: string; branch?: string } | null;
  checkRemoteUpdates: (targetRepoName?: string) => Promise<boolean>;
  refreshWhatsNew: () => Promise<void>;
  markWhatsNewAsSeen: () => void;
  loadRepos: () => Promise<void>;
  selectRepo: (
    repo: Repo,
    initialFile?: string,
  ) => Promise<{ success: boolean; is_ready?: boolean; diagnosis?: RepoDiagnosis }>;
  selectRepoByName: (
    repoName: string,
    initialFile?: string,
  ) => Promise<boolean>;
  loadTree: (targetRepo?: string) => Promise<void>;
  loadFile: (filePath: string, targetRepo?: string) => Promise<void>;
  reloadActiveFile: (forceDisk?: boolean) => Promise<void>;
  setFileContent: (content: string) => void;
  setFileMetadata: (meta: Record<string, any>) => void;
  updateFileMetadata: (
    partialMeta: Partial<DocumentMetadataItem>,
  ) => Promise<void>;
  updateDocumentTitle: (newTitle: string) => Promise<void>;
  projectMetaOptions: ProjectMetadataOptions | null;
  loadProjectMetadataOptions: () => Promise<void>;
  projectConfig: any;
  loadProjectConfig: () => Promise<any>;
  saveProjectConfig: (
    configData: any,
  ) => Promise<{ success: boolean; error?: string }>;
  dictionaryTerms: DictionaryTerm[];
  loadDictionaryTerms: () => Promise<DictionaryTerm[]>;
  saveDictionaryTerms: (
    terms: DictionaryTerm[],
  ) => Promise<{ success: boolean; error?: string }>;
  addDictionaryTerm: (
    term: DictionaryTerm,
  ) => Promise<{ success: boolean; error?: string }>;
  addDictionarySynonym: (
    termIdOrCodename: string,
    synonym: string,
  ) => Promise<{ success: boolean; error?: string }>;
  saveCurrentFile: (
    meta?: Record<string, any>,
    content?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  flushPendingSave: () => Promise<void>;
  refreshPendingChanges: (targetRepoName?: string) => Promise<void>;
  discardChanges: (path?: string, targetRepo?: string) => Promise<void>;
  refreshGitStatus: (targetRepoName?: string) => Promise<void>;
  refreshGitLog: (limit?: number) => Promise<void>;
  commitGit: (
    message: string,
    files?: string[],
  ) => Promise<{ success: boolean; message: string; commitHash?: string }>;
  syncGit: (branch?: string) => Promise<{ success: boolean; message: string }>;
  createOrSwitchBranch: (
    branch: string,
  ) => Promise<{ success: boolean; message: string }>;
  moveFileOrFolder: (
    sourcePath: string,
    targetPath: string,
    sourceRepo?: string,
    targetRepo?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  duplicateFile: (
    filePath: string,
    targetRepo?: string,
  ) => Promise<{ success: boolean; newPath?: string; error?: string }>;
  effectivePermission: EffectiveUserPermission | null;
  isLoadingPermission: boolean;
  refreshEffectivePermission: (repo?: Repo) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(
  undefined,
);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, isAuthenticated } = useAuth();
  const [activeOrg, setActiveOrg] = useState<Organization | null>(() => {
    try {
      const saved = localStorage.getItem("spec_active_org_login");
      if (saved) {
        return { login: saved, full_name: saved };
      }
    } catch {}
    return null;
  });
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [activeRepo, setActiveRepo] = useState<Repo | null>(null);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [treesByRepo, setTreesByRepo] = useState<Record<string, TreeNode[]>>({});
  const [activeFile, setActiveFile] = useState<string>("");
  const [activeDocRepo, setActiveDocRepo] = useState<string>("");
  const activeDocRepoRef = useRef<string>("");
  const [fileContent, setFileContentState] = useState<string>("");
  const [fileMetadata, setFileMetadataState] = useState<Record<string, any>>(
    {},
  );
  const [originalContent, setOriginalContent] = useState<string>("");
  const [pendingChanges, setPendingChanges] = useState<WorkspaceChange[]>([]);
  const [systemPendingChanges, setSystemPendingChanges] = useState<WorkspaceChange[]>([]);
  const [guardrailStatus, setGuardrailStatus] = useState<string>("CLEAN");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<AutoSaveStatus>("Pronto");
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingWorkspace] = useState(false);
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [isLoadingPermission, setIsLoadingPermission] = useState(false);
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [gitLog, setGitLog] = useState<GitCommitInfo[]>([]);
  const [whatsNewSummary, setWhatsNewSummary] =
    useState<WhatsNewSummary | null>(null);
  const [hasUnreadWhatsNew, setHasUnreadWhatsNew] = useState<boolean>(false);
  const [hasRemoteUpdates, setHasRemoteUpdates] = useState<boolean>(false);
  const [remoteUpdateInfo, setRemoteUpdateInfo] = useState<{ localHash: string; remoteHash?: string; branch?: string } | null>(null);
  const [projectMetaOptions, setProjectMetaOptions] =
    useState<ProjectMetadataOptions | null>(null);
  const [projectConfig, setProjectConfig] = useState<any>(null);
  const [dictionaryTerms, setDictionaryTerms] = useState<DictionaryTerm[]>([]);
  const dictionaryTermsRef = useRef<DictionaryTerm[]>([]);
  useEffect(() => {
    dictionaryTermsRef.current = dictionaryTerms;
  }, [dictionaryTerms]);

  const [effectivePermission, setEffectivePermission] = useState<EffectiveUserPermission | null>(null);
  const fileCacheRef = useRef<Map<string, { content: string; originalContent: string; meta: any }>>(new Map());
  const activeFileRef = useRef<string>("");
  const fileContentRef = useRef<string>("");
  const originalContentRef = useRef<string>("");
  const fileMetadataRef = useRef<Record<string, any>>({});
  const activeRepoRef = useRef<Repo | null>(null);
  const reposRef = useRef<Repo[]>([]);
  useEffect(() => {
    reposRef.current = repos;
  }, [repos]);
  const inFlightRepoRef = useRef<string | null>(null);
  const inFlightFileRef = useRef<string | null>(null);
  const treesByRepoRef = useRef<Record<string, TreeNode[]>>({});
  const pendingChangesByRepoRef = useRef<Record<string, any[]>>({});
  const remoteUpdatesByRepoRef = useRef<Record<string, boolean>>({});
  const effectivePermissionsByRepoRef = useRef<Record<string, EffectiveUserPermission>>({});
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getRepoOwnerOrOrg = useCallback((r?: Repo | null): string | undefined => {
    if (!r) return undefined;
    if (typeof r.owner === "string" && r.owner && r.owner !== "local") return r.owner;
    if ((r.owner as any)?.login && (r.owner as any).login !== "local") return (r.owner as any).login;
    if (r.full_name && r.full_name.includes("/")) {
      const orgPart = r.full_name.split("/")[0];
      if (orgPart && orgPart !== "local") return orgPart;
    }
    const match = window.location.pathname.match(/\/org\/([^\/]+)/);
    if (match && match[1]) {
      const decoded = decodeURIComponent(match[1]);
      if (decoded !== "local") return decoded;
    }
    if (activeOrg?.login && activeOrg.login !== "local") return activeOrg.login;
    try {
      const saved = localStorage.getItem("spec_active_org_login");
      if (saved && saved !== "local") return saved;
    } catch {}
    if (user?.login && user.login !== "local") return user.login;
    return undefined;
  }, [activeOrg?.login, user?.login]);

  const refreshEffectivePermission = useCallback(async (targetRepo?: Repo) => {
    const r = targetRepo || activeRepoRef.current;
    if (!r?.name) return;
    const cached = effectivePermissionsByRepoRef.current[r.name];
    if (cached) {
      setEffectivePermission(cached);
      setIsLoadingPermission(false);
    } else {
      setEffectivePermission(null);
      setIsLoadingPermission(true);
    }

    try {
      const ownerLogin = getRepoOwnerOrOrg(r);
      const res = await API.getEffectiveUserPermission(r.name, ownerLogin);
      if (res.ok && res.data) {
        effectivePermissionsByRepoRef.current[r.name] = res.data;
        if (activeRepoRef.current?.name === r.name) {
          setEffectivePermission(res.data);
        }
      }
    } catch {} finally {
      if (activeRepoRef.current?.name === r.name) {
        setIsLoadingPermission(false);
      }
    }
  }, [user?.login, getRepoOwnerOrOrg]);

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

  const loadOrgs = useCallback(async () => {
    try {
      const res = await API.getOrgs();
      if (res.ok && res.data?.orgs) {
        setOrgs(res.data.orgs);
        const savedLogin = localStorage.getItem("spec_active_org_login");
        if (savedLogin) {
          const found = res.data.orgs.find(
            (o) => o.login.toLowerCase() === savedLogin.toLowerCase(),
          );
          if (found) {
            setActiveOrg(found);
            return;
          }
        }
        if (res.data.orgs.length > 0) {
          setActiveOrg((prev) => {
            if (prev) return prev;
            localStorage.setItem("spec_active_org_login", res.data.orgs[0].login);
            return res.data.orgs[0];
          });
        }
      }
    } catch (e) {
      console.warn("[WorkspaceContext] Erro ao carregar organizações:", e);
    }
  }, []);

  const loadRepos = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await API.getRepos();
      if (res.ok && res.data.repos) {
        const cleanRepos = res.data.repos.filter((r) => r.name !== 'default' && r.name !== '_default');
        setRepos(cleanRepos);
      }
    } catch (err) {
      console.error("[WorkspaceContext] Erro ao carregar repositórios:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const selectOrg = useCallback(
    async (orgLogin: string) => {
      const found = orgs.find(
        (o) => o.login.toLowerCase() === orgLogin.toLowerCase(),
      );
      const orgToSet = found || { login: orgLogin, full_name: orgLogin };
      setActiveOrg(orgToSet);
      try {
        localStorage.setItem("spec_active_org_login", orgToSet.login);
      } catch {}
      await loadRepos();
    },
    [orgs, loadRepos],
  );

  useEffect(() => {
    loadOrgs().catch(() => {});
  }, [loadOrgs]);

  const refreshGitStatus = useCallback(async (targetRepoName?: string) => {
    const repo = targetRepoName || activeRepoRef.current?.name;
    if (!repo) return;
    try {
      const res = await API.getGitStatus(repo);
      if (res.ok && res.data) {
        const filteredFiles = (res.data.files || []).filter(
          (f) => f?.path && !isPathHidden(f.path),
        );
        const sysFiles = [
          ...(res.data.systemFiles || []),
          ...(res.data.files || []).filter((f) => f?.path && isSystemPath(f.path)),
        ];
        const sysMap = new Map<string, any>();
        for (const sf of sysFiles) {
          if (sf?.path) sysMap.set(sf.path, sf);
        }
        const uniqueSysFiles = Array.from(sysMap.values());
        if (activeRepoRef.current?.name === repo) {
          setGitStatus({
            ...res.data,
            files: filteredFiles,
            systemFiles: uniqueSysFiles,
            isClean: filteredFiles.length === 0 && uniqueSysFiles.length === 0,
          });
        }
      }
    } catch (err) {
      console.warn("[WorkspaceContext] Erro ao buscar status do Git:", err);
    }
  }, []);

  const refreshGitLog = useCallback(async (limit = 20, targetRepoName?: string) => {
    const repo = targetRepoName || activeRepoRef.current?.name;
    if (!repo) return;
    try {
      const res = await API.getGitLog(limit, repo);
      if (res.ok && res.data?.commits) {
        if (activeRepoRef.current?.name === repo) {
          setGitLog(res.data.commits);
        }
      }
    } catch (err) {
      console.warn("[WorkspaceContext] Erro ao buscar histórico Git:", err);
    }
  }, []);

  const refreshPendingChanges = useCallback(async (targetRepoName?: string) => {
    const repo = targetRepoName || activeRepoRef.current?.name;
    if (!repo) return;
    try {
      const data = await API.getWorkspaceChanges(repo);
      const filtered = (data.changes || []).filter(
        (c: any) => c?.path && !isPathHidden(c.path),
      );
      const sysFiltered = (data.system_changes || []).filter(
        (c: any) => c?.path && isSystemPath(c.path),
      );
      pendingChangesByRepoRef.current[repo] = filtered;
      if (activeRepoRef.current?.name === repo) {
        setPendingChanges(filtered);
        setSystemPendingChanges(sysFiltered);
        setGuardrailStatus(filtered.length === 0 ? "CLEAN" : data.guardrail || "CLEAN");
      }
      await refreshGitStatus(repo);
    } catch (err) {
      console.error(
        "[WorkspaceContext] Erro ao buscar alterações pendentes:",
        err,
      );
    }
  }, [refreshGitStatus]);

  const performDiskSave = useCallback(
    async (
      targetPath?: string,
      contentToSave?: string,
      metaToSave?: Record<string, any>,
      targetRepo?: string,
    ): Promise<{ success: boolean; error?: string }> => {
      const file = targetPath || activeFileRef.current;
      const content =
        contentToSave !== undefined ? contentToSave : fileContentRef.current;
      const meta =
        metaToSave !== undefined ? metaToSave : fileMetadataRef.current;
      const repoName = targetRepo || activeDocRepoRef.current || activeRepoRef.current?.name;

      if (!repoName || !file) {
        return { success: false, error: "Nenhum documento ativo para salvar" };
      }

      setIsSaving(true);
      setSaveStatus("Salvando...");
      try {
        const res = await API.saveWorkspaceFile({ path: file, content, meta, repo: repoName });
        if (res.ok) {
          if (file === activeFileRef.current && (!targetRepo || targetRepo === activeRepoRef.current?.name)) {
            setOriginalContent(content);
            originalContentRef.current = content;
            if (res.data?.meta) {
              setFileMetadataState(res.data.meta);
              fileMetadataRef.current = res.data.meta;
            }
          }
          DraftStore.clearDocDraft(repoName, file);
          setSaveStatus("Salvo no disco");
          window.dispatchEvent(
            new CustomEvent("workspace:document-saved", {
              detail: { filePath: file, meta: res.data?.meta },
            }),
          );
          if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
          statusTimerRef.current = setTimeout(() => {
            setSaveStatus("Pronto");
          }, 2200);

          refreshPendingChanges().catch(() => {});
          return { success: true };
        } else {
          setSaveStatus("Erro");
          return { success: false, error: "Falha ao gravar no workspace" };
        }
      } catch (err: any) {
        console.error(
          "[WorkspaceContext] Erro ao gravar arquivo no disco:",
          err,
        );
        setSaveStatus("Erro");
        return {
          success: false,
          error: err.message || "Erro ao gravar no disco",
        };
      } finally {
        setIsSaving(false);
      }
    },
    [refreshPendingChanges],
  );

  const flushPendingSave = useCallback(async () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    if (
      activeFileRef.current &&
      fileContentRef.current !== originalContentRef.current
    ) {
      await performDiskSave(
        activeFileRef.current,
        fileContentRef.current,
        fileMetadataRef.current,
      );
    }
  }, [performDiskSave]);

  const loadTree = useCallback(async (targetRepo?: string) => {
    const repo = targetRepo || activeRepoRef.current?.name;
    if (!repo) return;
    setIsLoadingTree(true);
    try {
      const data = await API.getProjectTree(repo);
      treesByRepoRef.current[repo] = data.tree || [];
      setTreesByRepo((prev) => ({ ...prev, [repo]: data.tree || [] }));
      if (activeRepoRef.current?.name === repo) {
        setTree(data.tree || []);
      }
    } catch (err) {
      console.error("[WorkspaceContext] Erro ao buscar árvore:", err);
    } finally {
      setIsLoadingTree(false);
    }
  }, []);

  const loadFile = useCallback(
    async (rawFilePath: string, targetRepo?: string) => {
      const currentRepoName = targetRepo || activeRepoRef.current?.name;
      if (!rawFilePath) {
        activeFileRef.current = "";
        setActiveFile("");
        setFileContentState("");
        setOriginalContent("");
        setFileMetadataState({});
        fileCacheRef.current.clear();
        return;
      }
      if (!currentRepoName) return;

      const hashIndex = rawFilePath.indexOf("#");
      const cleanPath =
        hashIndex !== -1 ? rawFilePath.slice(0, hashIndex) : rawFilePath;
      const hash = hashIndex !== -1 ? rawFilePath.slice(hashIndex) : "";

      if (hash) {
        if (window.location.hash !== hash) {
          try {
            window.history.replaceState(
              window.history.state,
              "",
              window.location.pathname + window.location.search + hash,
            );
          } catch (e) {}
        }
      } else {
        // Limpa qualquer hash anterior na URL sem criar entrada duplicada no histórico
        if (window.location.hash) {
          try {
            window.history.replaceState(
              window.history.state,
              "",
              window.location.pathname + window.location.search,
            );
          } catch (e) {}
        }
      }

      // Se o arquivo já for o ativo atual, apenas disparar a navegação de fragmento sem recarregar o arquivo do zero
      if (cleanPath === activeFileRef.current) {
        if (hash) {
          window.dispatchEvent(
            new CustomEvent("workspace:navigate-fragment", {
              detail: { hash, filePath: cleanPath },
            }),
          );
        }
        return;
      }

      const cacheKey = `${currentRepoName}:${cleanPath}`;
      if (inFlightFileRef.current === cacheKey) {
        return;
      }
      inFlightFileRef.current = cacheKey;

      // 1. Flush de segurança se o arquivo anterior possuía alterações não salvas
      await flushPendingSave();

      const cached = fileCacheRef.current.get(cacheKey);
      const draft = DraftStore.getDocDraft(currentRepoName, cleanPath);

      // Mostra a barra de progresso linear no topo enquanto carrega, mantendo o arquivo anterior 100% visível na tela
      setIsLoadingFile(true);

      try {
        let content = "";
        let original = "";
        let meta: Record<string, any> = {};

        if (draft) {
          content = draft.rawContent;
          original = cached ? cached.originalContent : draft.rawContent;
          meta = cached ? cached.meta : {};
        } else if (cached) {
          content = cached.content;
          original = cached.originalContent;
          meta = cached.meta;
        }

        // Se não tiver cache em memória, busca na API antes de trocar de arquivo
        if (!draft && !cached) {
          const data = await API.getProjectFile(cleanPath, currentRepoName);
          if (!data || (data as any).error) {
            throw new Error((data as any).error || "Arquivo não encontrado");
          }
          const activeDraft = DraftStore.getDocDraft(
            currentRepoName,
            cleanPath,
          );
          content = activeDraft ? activeDraft.rawContent : data.content || "";
          original = data.content || "";
          meta = data.meta || {};

          fileCacheRef.current.set(cacheKey, {
            content,
            originalContent: original,
            meta,
          });
        }

        // Transição atômica de repositório, caminho, conteúdo e metadados no mesmo ciclo de render
        setActiveDocRepo(currentRepoName);
        activeDocRepoRef.current = currentRepoName;
        setActiveFile(cleanPath);
        activeFileRef.current = cleanPath;
        setFileContentState(content);
        fileContentRef.current = content;
        setOriginalContent(original);
        originalContentRef.current = original;
        setFileMetadataState(meta);
        fileMetadataRef.current = meta;
        setSaveStatus("Pronto");

        // Atualização em background se veio de cache/draft para garantir integridade com o backend
        if (draft || cached) {
          API.getProjectFile(cleanPath, currentRepoName)
            .then((data) => {
              if (
                data &&
                !(data as any).error &&
                activeFileRef.current === cleanPath
              ) {
                const freshOriginal = data.content || "";
                setOriginalContent(freshOriginal);
                originalContentRef.current = freshOriginal;
                if (data.meta) {
                  setFileMetadataState(data.meta);
                  fileMetadataRef.current = data.meta;
                }
                fileCacheRef.current.set(cacheKey, {
                  content: fileContentRef.current,
                  originalContent: freshOriginal,
                  meta: data.meta || meta,
                });
              }
            })
            .catch(() => {});
        }

        if (hash) {
          setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent("workspace:navigate-fragment", {
                detail: { hash, filePath: cleanPath },
              }),
            );
          }, 150);
        }
      } catch (err: any) {
        console.error("[WorkspaceContext] Erro ao carregar arquivo:", err);
        window.dispatchEvent(
          new CustomEvent("workspace:file-load-error", {
            detail: {
              path: cleanPath,
              message: `Documento "${cleanPath}" não foi encontrado no workspace.`,
            },
          }),
        );
      } finally {
        setIsLoadingFile(false);
        inFlightFileRef.current = null;
      }
    },
    [flushPendingSave],
  );

  const reloadActiveFile = useCallback(
    async (forceDisk: boolean = true) => {
      const currentFile = activeFileRef.current;
      const currentRepo = activeRepoRef.current;
      if (!currentFile || !currentRepo) return;

      try {
        if (forceDisk) {
          DraftStore.clearDocDraft(currentRepo.name, currentFile);
        }
        const data = await API.getProjectFile(currentFile, currentRepo.name);
        if (data && !(data as any).error) {
          const content = data.content || "";
          setFileContentState(content);
          fileContentRef.current = content;
          setOriginalContent(content);
          originalContentRef.current = content;
          setFileMetadataState(data.meta || {});
          fileMetadataRef.current = data.meta || {};
          setSaveStatus("Pronto");
        }
      } catch (err) {
        console.warn("[WorkspaceContext] Erro ao recarregar arquivo ativo:", err);
      }
    },
    [],
  );

  const setFileContent = useCallback(
    (content: string) => {
      setFileContentState(content);
      fileContentRef.current = content;

      const currentRepo = activeRepoRef.current;
      const currentFile = activeFileRef.current;

      if (currentRepo && currentFile) {
        DraftStore.saveDocDraft(currentRepo.name, currentFile, {
          body: content,
          rawContent: content,
        });

        if (content !== originalContentRef.current) {
          setSaveStatus("Salvando...");
          if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
          }
          autoSaveTimerRef.current = setTimeout(() => {
            performDiskSave(currentFile, content, fileMetadataRef.current);
          }, 600);
        }
      }
    },
    [performDiskSave],
  );

  const loadProjectMetadataOptions = useCallback(async () => {
    if (!activeRepoRef.current) return;
    try {
      const res = await API.getProjectMetadataOptions(
        activeRepoRef.current.name,
      );
      if (res.ok && res.data) {
        setProjectMetaOptions(res.data);
      }
    } catch (err) {
      console.warn(
        "[WorkspaceContext] Erro ao carregar opções de metadados:",
        err,
      );
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
      console.warn("[WorkspaceContext] Erro ao carregar project.config:", err);
    }
    return null;
  }, []);

  const saveProjectConfig = useCallback(
    async (configData: any) => {
      if (!activeRepoRef.current)
        return { success: false, error: "Nenhum repositório ativo" };
      try {
        const res = await API.saveProjectConfig(
          configData,
          activeRepoRef.current.name,
        );
        if (res.ok) {
          setProjectConfig(configData);
          await loadProjectMetadataOptions();
          return { success: true };
        }
        return {
          success: false,
          error: "Falha ao salvar configurações do projeto",
        };
      } catch (err: any) {
        console.error("[WorkspaceContext] Erro ao salvar project.config:", err);
        return {
          success: false,
          error: err.message || "Erro ao salvar configurações",
        };
      }
    },
    [loadProjectMetadataOptions],
  );

  const loadDictionaryTerms = useCallback(async (): Promise<DictionaryTerm[]> => {
    try {
      const res = await API.getDictionary();
      if (res.ok && res.data && Array.isArray(res.data.terms)) {
        setDictionaryTerms(res.data.terms);
        return res.data.terms;
      }
    } catch (err) {
      console.warn("[WorkspaceContext] Erro ao carregar dicionário:", err);
    }
    return [];
  }, []);

  const saveDictionaryTerms = useCallback(
    async (
      termsToSave: DictionaryTerm[],
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const res = await API.saveDictionary(termsToSave);
        if (res.ok) {
          setDictionaryTerms(termsToSave);
          return { success: true };
        }
        return {
          success: false,
          error: res.data?.error || "Erro ao salvar dicionário",
        };
      } catch (err: any) {
        return {
          success: false,
          error: err.message || "Erro de rede ao salvar dicionário",
        };
      }
    },
    [],
  );

  const addDictionaryTerm = useCallback(
    async (
      newTerm: DictionaryTerm,
    ): Promise<{ success: boolean; error?: string }> => {
      const current = dictionaryTermsRef.current;
      const normalizedCodename = (
        newTerm.codename ||
        newTerm.code_name ||
        newTerm.term
      )
        .toUpperCase()
        .replace(/[\s-]+/g, "_")
        .replace(/[^A-Z0-9_]/g, "");

      const normalizedTerm: DictionaryTerm = {
        ...newTerm,
        id:
          newTerm.id ||
          normalizedCodename.toLowerCase().replace(/_/g, "-"),
        codename: normalizedCodename,
        definition: (newTerm.definition || "").trim() || "Sem definição registrada.",
        synonyms: Array.from(
          new Set(
            [...(newTerm.synonyms || []), ...(newTerm.aliases || [])].filter(
              Boolean,
            ),
          ),
        ),
      };

      const updated = [
        ...current.filter(
          (t) =>
            t.codename !== normalizedTerm.codename &&
            t.term.toLowerCase() !== normalizedTerm.term.toLowerCase(),
        ),
        normalizedTerm,
      ];
      return await saveDictionaryTerms(updated);
    },
    [saveDictionaryTerms],
  );

  const addDictionarySynonym = useCallback(
    async (
      termIdOrCodename: string,
      synonym: string,
    ): Promise<{ success: boolean; error?: string }> => {
      const cleanSyn = synonym.trim();
      if (!cleanSyn) return { success: false, error: "Sinônimo vazio" };
      const current = dictionaryTermsRef.current;
      const termIdx = current.findIndex(
        (t) =>
          (t.id && t.id === termIdOrCodename) ||
          t.codename.toLowerCase() === termIdOrCodename.toLowerCase() ||
          t.term.toLowerCase() === termIdOrCodename.toLowerCase(),
      );
      if (termIdx === -1) {
        return { success: false, error: "Termo não encontrado no dicionário" };
      }
      const targetTerm = current[termIdx];
      const existingSyns = Array.from(
        new Set([
          ...(targetTerm.synonyms || []),
          ...(targetTerm.aliases || []),
        ]),
      );
      if (
        !existingSyns.some((s) => s.toLowerCase() === cleanSyn.toLowerCase())
      ) {
        existingSyns.push(cleanSyn);
      }
      const updatedTerm: DictionaryTerm = {
        ...targetTerm,
        synonyms: existingSyns,
      };
      const updated = [...current];
      updated[termIdx] = updatedTerm;
      return await saveDictionaryTerms(updated);
    },
    [saveDictionaryTerms],
  );

  const updateFileMetadata = useCallback(
    async (partialMeta: Partial<DocumentMetadataItem>) => {
      const currentFile = activeFileRef.current;
      const repoName = activeDocRepoRef.current || activeRepoRef.current?.name;
      if (!currentFile || !repoName) return;

      const merged = {
        ...fileMetadataRef.current,
        ...partialMeta,
      };
      setFileMetadataState(merged);
      fileMetadataRef.current = merged;

      // Optimistic tree node update for instant visual feedback
      const updateNodeInTree = (nodes: TreeNode[]): TreeNode[] => {
        const cleanCurrent = currentFile.replace(/^\/+/, "");
        return nodes.map((n) => {
          const cleanN = n.path.replace(/^\/+/, "");
          if (cleanN === cleanCurrent) {
            return {
              ...n,
              title: partialMeta.title !== undefined ? partialMeta.title : n.title,
              status: partialMeta.status !== undefined ? partialMeta.status : n.status,
              department: partialMeta.department !== undefined ? partialMeta.department : (n as any).department,
            };
          }
          if (n.children && n.children.length > 0) {
            return {
              ...n,
              children: updateNodeInTree(n.children),
            };
          }
          return n;
        });
      };
      setTree((prev) => updateNodeInTree(prev));

      try {
        const res = await API.updateDocumentMetadataItem({
          path: currentFile,
          meta: partialMeta,
          repo: repoName,
        });
        if (res.ok && res.data?.meta) {
          setFileMetadataState(res.data.meta);
          fileMetadataRef.current = res.data.meta;
          if (res.data.tree) {
            setTree(res.data.tree);
          }
          window.dispatchEvent(
            new CustomEvent("workspace:document-saved", {
              detail: { filePath: currentFile, meta: res.data.meta },
            }),
          );
        }
      } catch (err) {
        console.error("[WorkspaceContext] Erro ao atualizar metadados:", err);
      }
    },
    [],
  );

  const updateDocumentTitle = useCallback(
    async (newTitle: string) => {
      await updateFileMetadata({ title: newTitle });
    },
    [updateFileMetadata],
  );

  const refreshWhatsNew = useCallback(async () => {
    const repoName = activeRepoRef.current?.name || "default";
    const lastSeenKey = `spec_whats_new_seen_${repoName}`;
    const lastSeenHash = localStorage.getItem(lastSeenKey) || undefined;

    try {
      const res = await API.getWhatsNew(lastSeenHash);
      if (res.ok && res.data) {
        const filteredFiles = (res.data.files || []).filter(
          (f: any) => f?.path && !isPathHidden(f.path),
        );
        const filteredSummary = {
          ...res.data,
          files: filteredFiles,
        };
        setWhatsNewSummary(filteredSummary);
        if (
          res.data.hasNewUpdates &&
          res.data.latestHash &&
          res.data.latestHash !== lastSeenHash
        ) {
          setHasUnreadWhatsNew(true);
        } else {
          setHasUnreadWhatsNew(false);
        }
      }
    } catch (e) {
      console.warn("[WorkspaceContext] Erro ao carregar novidades d:", e);
    }
  }, []);

  const markWhatsNewAsSeen = useCallback(() => {
    const repoName = activeRepoRef.current?.name || "default";
    const lastSeenKey = `spec_whats_new_seen_${repoName}`;
    if (whatsNewSummary?.latestHash) {
      localStorage.setItem(lastSeenKey, whatsNewSummary.latestHash);
    }
    setHasUnreadWhatsNew(false);
    refreshWhatsNew();
  }, [whatsNewSummary, refreshWhatsNew]);

  const checkRemoteUpdates = useCallback(
    async (targetRepoName?: string): Promise<boolean> => {
      const repoName = targetRepoName || activeRepoRef.current?.name;
      if (!repoName || repoName === "local" || repoName === "default" || repoName === "_default") {
        if (repoName) remoteUpdatesByRepoRef.current[repoName] = false;
        if (!targetRepoName || activeRepoRef.current?.name === repoName) {
          setHasRemoteUpdates(false);
          setRemoteUpdateInfo(null);
        }
        return false;
      }
      try {
        const res = await API.checkRemoteGitUpdates(repoName);
        if (res.ok && res.data) {
          const hasUp = Boolean(res.data.hasUpdates);
          remoteUpdatesByRepoRef.current[repoName] = hasUp;
          if (!targetRepoName || activeRepoRef.current?.name === repoName) {
            setHasRemoteUpdates(hasUp);
            setRemoteUpdateInfo(hasUp ? res.data : null);
          }
          return hasUp;
        }
      } catch (err) {
        console.warn("[WorkspaceContext] Erro ao verificar atualizações remotas:", err);
      }
      return false;
    },
    [],
  );

  const selectRepo = useCallback(
    async (
      repo: Repo,
      initialFile?: string,
    ): Promise<{ success: boolean; is_ready?: boolean; diagnosis?: RepoDiagnosis }> => {
      if (!repo || !repo.name) return { success: false, is_ready: false };
      if (inFlightRepoRef.current === repo.name) {
        return { success: true, is_ready: true };
      }
      if (activeRepoRef.current?.name.toLowerCase() === repo.name.toLowerCase() && !initialFile) {
        return { success: true, is_ready: true };
      }
      inFlightRepoRef.current = repo.name;

      const cachedTree = treesByRepoRef.current[repo.name];
      const hasCachedTree = Array.isArray(cachedTree) && cachedTree.length > 0;

      // Não ativa skeleton de carregamento do workspace inteiro (header) para evitar blink na troca de repositório
      if (!hasCachedTree && !repo.is_local) {
        setIsLoadingTree(true);
      }

      // Aplica imediatamente estados cacheados deste repositório para evitar flashes e saltos visuais
      const cachedPending = pendingChangesByRepoRef.current[repo.name] || [];
      setPendingChanges(cachedPending);

      const cachedRemote = remoteUpdatesByRepoRef.current[repo.name] || false;
      setHasRemoteUpdates(cachedRemote);

      const cachedPerm = effectivePermissionsByRepoRef.current[repo.name];
      if (cachedPerm) {
        setEffectivePermission(cachedPerm);
        setIsLoadingPermission(false);
      } else {
        setEffectivePermission(null);
        setIsLoadingPermission(true);
      }

      try {
        const prevRepo = activeRepoRef.current;
        const prevFile = activeFileRef.current;
        const prevContent = fileContentRef.current;
        const prevOriginal = originalContentRef.current;
        const prevMeta = fileMetadataRef.current;

        // Persist current repo tree in cache before switching
        if (prevRepo?.name) {
          treesByRepoRef.current[prevRepo.name] = tree;
        }

        // Cancel any pending debounced autosave
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
          autoSaveTimerRef.current = null;
        }

        // If the previous repo had unsaved changes, flush them explicitly to the OLD repo
        if (prevRepo && prevFile && prevContent !== prevOriginal) {
          try {
            await API.saveWorkspaceFile({
              path: prevFile,
              content: prevContent,
              meta: prevMeta,
              repo: prevRepo.name,
            });
            DraftStore.clearDocDraft(prevRepo.name, prevFile);
          } catch (err) {
            console.warn("[WorkspaceContext] Erro ao salvar alterações do repo anterior:", err);
          }
        }

        // Atualiza repositório ativo e árvore de forma fluida
        setActiveRepo(repo);
        activeRepoRef.current = repo;

        if (hasCachedTree) {
          setTree(cachedTree);
        } else {
          setTree([]);
        }

        // Atualiza permissão refinada em segundo plano
        const cachedPerm = effectivePermissionsByRepoRef.current[repo.name];
        if (cachedPerm) {
          setEffectivePermission(cachedPerm);
          setIsLoadingPermission(false);
        } else {
          setEffectivePermission(null);
          setIsLoadingPermission(true);
        }

        const ownerLogin = getRepoOwnerOrOrg(repo);
        API.getEffectiveUserPermission(repo.name, ownerLogin)
          .then((res) => {
            if (res.ok && res.data) {
              effectivePermissionsByRepoRef.current[repo.name] = res.data;
              if (activeRepoRef.current?.name === repo.name) {
                setEffectivePermission(res.data);
              }
            }
          })
          .catch(() => {})
          .finally(() => {
            if (activeRepoRef.current?.name === repo.name) {
              setIsLoadingPermission(false);
            }
          });

        const selectRes = await API.selectRepo(repo);
        const isReady = selectRes.data?.is_ready !== false;
        const diagnosis = selectRes.data?.diagnosis;

        if (!isReady) {
          setIsLoadingTree(false);
          return { success: true, is_ready: false, diagnosis };
        }

        const data = await API.getProjectTree(repo.name);
        treesByRepoRef.current[repo.name] = data.tree || [];
        setTreesByRepo((prev) => ({ ...prev, [repo.name]: data.tree || [] }));
        if (activeRepoRef.current?.name === repo.name) {
          setTree(data.tree || []);
        }

        setIsLoadingTree(false);

        // Mantém o editor no último documento selecionado.
        // Só altera se um arquivo inicial foi explicitamente solicitado,
        // ou se o editor estiver completamente vazio na primeira inicialização.
        const fileToOpen =
          initialFile !== undefined
            ? initialFile
            : (!activeFileRef.current ? findFirstMdFile(data.tree || []) : null);

        if (fileToOpen) {
          loadFile(fileToOpen, repo.name).catch((e) =>
            console.warn("[WorkspaceContext] Erro ao carregar arquivo inicial:", e)
          );
        }

        // Executa carregamentos secundários e verificação de commits remotos em segundo plano sem bloquear a árvore/editor
        Promise.allSettled([
          loadProjectMetadataOptions(),
          loadProjectConfig(),
          loadDictionaryTerms(),
          refreshPendingChanges(repo.name),
          refreshGitStatus(repo.name),
          refreshGitLog(15, repo.name),
          refreshWhatsNew(),
          checkRemoteUpdates(repo.name),
        ]).catch(() => {});

        return { success: true, is_ready: true, diagnosis };
      } finally {
        inFlightRepoRef.current = null;
        setIsLoadingTree(false);
      }
    },
    [
      user?.login,
      tree,
      getRepoOwnerOrOrg,
      loadProjectMetadataOptions,
      loadProjectConfig,
      loadDictionaryTerms,
      refreshPendingChanges,
      refreshGitStatus,
      refreshGitLog,
      refreshWhatsNew,
      checkRemoteUpdates,
      loadFile,
    ],
  );

  const selectRepoByName = useCallback(
    async (repoName: string, initialFile?: string): Promise<boolean> => {
      if (!repoName) return false;
      if (activeRepoRef.current?.name.toLowerCase() === repoName.toLowerCase()) {
        if (initialFile && initialFile !== activeFileRef.current) {
          await loadFile(initialFile, repoName);
        }
        return true;
      }
      if (inFlightRepoRef.current?.toLowerCase() === repoName.toLowerCase()) {
        return true;
      }

      let currentRepos = repos;
      if (currentRepos.length === 0) {
        try {
          const res = await API.getRepos();
          if (res.ok && res.data.repos) {
            currentRepos = res.data.repos;
            setRepos(currentRepos);
          }
        } catch (err) {
          console.error("[WorkspaceContext] Erro ao carregar repos:", err);
        }
      }

      const found = currentRepos.find(
        (r) => r.name.toLowerCase() === repoName.toLowerCase(),
      );
      if (found) {
        await selectRepo(found, initialFile);
        return true;
      }
      const detectedOrg = getRepoOwnerOrOrg();
      const fallbackRepo: Repo = {
        id: 0,
        name: repoName,
        owner: detectedOrg,
        full_name: detectedOrg ? `${detectedOrg}/${repoName}` : repoName,
        is_local: false,
      };
      await selectRepo(fallbackRepo, initialFile);
      return true;
    },
    [repos, selectRepo, loadFile],
  );

  const saveCurrentFile = async (
    metaOverride?: Record<string, any>,
    contentOverride?: string,
  ) => {
    const meta =
      metaOverride !== undefined ? metaOverride : fileMetadataRef.current;
    const content =
      contentOverride !== undefined ? contentOverride : fileContentRef.current;
    return performDiskSave(activeFileRef.current, content, meta);
  };

  const discardChanges = async (path?: string, targetRepo?: string) => {
    const repo = activeRepoRef.current;
    const repoName = targetRepo || repo?.name || "local";
    const cleanPath = path ? path.replace(/^\/+/, "") : null;

    await API.discardWorkspaceChanges(cleanPath, repoName);

    if (cleanPath) {
      DraftStore.clearDocDraft(repoName, cleanPath);
      fileCacheRef.current.delete(`${repoName}:${cleanPath}`);
    } else {
      DraftStore.clearDocDraft(repoName, activeFileRef.current);
      if (activeFileRef.current) {
        fileCacheRef.current.delete(`${repoName}:${activeFileRef.current}`);
      }
    }

    await Promise.all([
      refreshPendingChanges(repoName),
      refreshGitStatus(repoName),
      loadTree(repoName),
      refreshWhatsNew(),
    ]);

    const activeClean = activeFileRef.current ? activeFileRef.current.replace(/^\/+/, "") : null;
    if (!cleanPath || cleanPath === activeClean) {
      await reloadActiveFile(true);
    }
  };

  const commitGit = async (message: string, files?: string[]) => {
    const repo = activeRepoRef.current;
    const res = await API.commitGitChanges({ message, files, repo: repo?.name });
    if (res.ok && res.data.success) {
      await refreshPendingChanges();
      await refreshGitStatus();
      await refreshGitLog(15);
      await refreshWhatsNew();
    }
    return res.data;
  };

  const syncGit = async (branch?: string) => {
    const repo = activeRepoRef.current;
    const res = await API.syncGit(branch, repo?.name);
    if (res.ok) {
      setHasRemoteUpdates(false);
      setRemoteUpdateInfo(null);
      await refreshPendingChanges();
      await refreshGitStatus();
      await refreshGitLog(15);
      await refreshWhatsNew();
      if (repo) await loadTree(repo.name);
    }
    return res.data;
  };

  const createOrSwitchBranch = async (branch: string) => {
    const repo = activeRepoRef.current;
    const res = await API.createOrSwitchBranch(branch, repo?.name);
    if (res.ok) {
      await refreshGitStatus();
      await refreshGitLog(15);
      await refreshWhatsNew();
      if (repo) await loadTree(repo.name);
    }
    return res.data;
  };

  const moveFileOrFolder = useCallback(
    async (
      sourcePath: string,
      targetPath: string,
      sourceRepo?: string,
      targetRepo?: string
    ): Promise<{ success: boolean; error?: string }> => {
      const srcRepo = sourceRepo || activeRepoRef.current?.name;
      const dstRepo = targetRepo || srcRepo;
      if (!srcRepo || !dstRepo || !sourcePath || !targetPath) {
        return { success: false, error: 'Parâmetros inválidos para mover arquivo.' };
      }

      await flushPendingSave();

      try {
        const res = await API.moveProjectFile({
          source_path: sourcePath,
          target_path: targetPath,
          source_repo: srcRepo,
          target_repo: dstRepo,
        });

        if (res.ok && res.data?.success) {
          // Se o servidor já retornou as árvores atualizadas, aplica de imediato
          if (res.data.sourceTree) {
            treesByRepoRef.current[srcRepo] = res.data.sourceTree;
            setTreesByRepo((prev) => ({ ...prev, [srcRepo]: res.data.sourceTree! }));
            if (activeRepoRef.current?.name.toLowerCase() === srcRepo.toLowerCase()) {
              setTree(res.data.sourceTree);
            }
          } else {
            await loadTree(srcRepo);
          }

          if (res.data.targetTree && srcRepo !== dstRepo) {
            treesByRepoRef.current[dstRepo] = res.data.targetTree;
            setTreesByRepo((prev) => ({ ...prev, [dstRepo]: res.data.targetTree! }));
            if (activeRepoRef.current?.name.toLowerCase() === dstRepo.toLowerCase()) {
              setTree(res.data.targetTree);
            }
          } else if (srcRepo !== dstRepo) {
            await loadTree(dstRepo);
          }

          fileCacheRef.current.delete(`${srcRepo}:${sourcePath}`);
          await Promise.all([
            refreshPendingChanges(),
            refreshGitStatus(),
          ]);

          // Se o arquivo movido era o activeFile
          const cleanOld = sourcePath.trim().replace(/^\/+/, '').replace(/\/+$/, '');
          const cleanNew = targetPath.trim().replace(/^\/+/, '').replace(/\/+$/, '');
          const currentActive = activeFileRef.current;

          if (currentActive === cleanOld || (currentActive && currentActive.startsWith(`${cleanOld}/`))) {
            const finalPath = currentActive === cleanOld
              ? cleanNew
              : `${cleanNew}${currentActive.slice(cleanOld.length)}`;

            if (srcRepo !== dstRepo) {
              const targetRepoObj = reposRef.current.find(
                (r) => r.name.toLowerCase() === dstRepo.toLowerCase()
              ) || {
                id: 0,
                name: dstRepo,
                full_name: dstRepo,
                is_local: true,
              };
              await selectRepo(targetRepoObj, finalPath);
            } else {
              await loadFile(finalPath, dstRepo);
            }
          }

          return { success: true };
        } else {
          return { success: false, error: res.data?.error || 'Falha ao mover arquivo/pasta.' };
        }
      } catch (err: any) {
        console.error('[WorkspaceContext] Erro ao mover arquivo:', err);
        return { success: false, error: err.message || 'Erro de conexão ao mover arquivo.' };
      }
    },
    [flushPendingSave, loadTree, refreshPendingChanges, refreshGitStatus, selectRepo, loadFile],
  );

  const duplicateFile = useCallback(
    async (
      filePath: string,
      targetRepo?: string,
    ): Promise<{ success: boolean; newPath?: string; error?: string }> => {
      const currentRepoName = targetRepo || activeRepoRef.current?.name;
      if (!currentRepoName || !filePath) {
        return { success: false, error: "Parâmetros inválidos para duplicar arquivo." };
      }

      await flushPendingSave();

      try {
        const res = await API.duplicateProjectFile(filePath, currentRepoName);
        if (res.ok && res.data?.success && res.data.newPath) {
          const newPath = res.data.newPath;
          if (res.data.tree) {
            treesByRepoRef.current[currentRepoName] = res.data.tree;
            setTreesByRepo((prev) => ({ ...prev, [currentRepoName]: res.data.tree! }));
            if (activeRepoRef.current?.name.toLowerCase() === currentRepoName.toLowerCase()) {
              setTree(res.data.tree);
            }
          } else {
            await loadTree(currentRepoName);
          }

          await Promise.all([refreshPendingChanges(), refreshGitStatus()]);
          await loadFile(newPath, currentRepoName);

          return { success: true, newPath };
        } else {
          return { success: false, error: res.data?.error || "Falha ao duplicar arquivo." };
        }
      } catch (err: any) {
        console.error("[WorkspaceContext] Erro ao duplicar arquivo:", err);
        return { success: false, error: err.message || "Erro de conexão ao duplicar arquivo." };
      }
    },
    [flushPendingSave, loadTree, refreshPendingChanges, refreshGitStatus, loadFile],
  );

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
            meta: fileMetadataRef.current,
          });
          fetch("/api/workspace/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
            keepalive: true,
          });
        } catch (e) {
          console.warn(
            "[WorkspaceContext] Falha no flush de fechamento de página:",
            e,
          );
        }
      }
    };

    window.addEventListener("beforeunload", handleUnloadOrHide);
    window.addEventListener("pagehide", handleUnloadOrHide);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        handleUnloadOrHide();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleUnloadOrHide);
      window.removeEventListener("pagehide", handleUnloadOrHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Carrega status inicial e eventos SSE de Fast Refresh
  useEffect(() => {
    if (!isAuthenticated) return;

    loadRepos();

    let evtSource: EventSource | null = null;
    try {
      evtSource = new EventSource("/api/events");
      
      const handleWorkspaceRefresh = () => {
        refreshPendingChanges();
        loadTree();
        refreshGitStatus();
        refreshWhatsNew();
        if (activeFileRef.current) {
          reloadActiveFile(true);
        }
      };

      evtSource.addEventListener("refresh", handleWorkspaceRefresh);
      evtSource.addEventListener("file_changed", (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          const changedPath = data?.file;
          const currentFile = activeFileRef.current;
          if (currentFile && changedPath && (changedPath.endsWith(currentFile) || currentFile.endsWith(changedPath))) {
            reloadActiveFile(true);
          }
        } catch {}
        refreshPendingChanges();
        loadTree();
      });
    } catch (e) {
      console.warn("[WorkspaceContext] SSE não disponível:", e);
    }

    return () => {
      if (evtSource) evtSource.close();
    };
  }, [
    isAuthenticated,
    user?.login,
    loadRepos,
    refreshPendingChanges,
    loadTree,
    refreshGitStatus,
    refreshWhatsNew,
    reloadActiveFile,
  ]);

  return (
    <WorkspaceContext.Provider
      value={{
        activeOrg,
        orgs,
        loadOrgs,
        selectOrg,
        activeRepo,
        repos,
        tree,
        treesByRepo,
        activeFile,
        activeDocRepo,
        fileContent,
        originalContent,
        fileMetadata,
        pendingChanges,
        systemPendingChanges,
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
        hasRemoteUpdates,
        remoteUpdateInfo,
        checkRemoteUpdates,
        refreshWhatsNew,
        markWhatsNewAsSeen,
        loadRepos,
        selectRepo,
        selectRepoByName,
        loadTree,
        loadFile,
        reloadActiveFile,
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
        dictionaryTerms,
        loadDictionaryTerms,
        saveDictionaryTerms,
        addDictionaryTerm,
        addDictionarySynonym,
        saveCurrentFile,
        flushPendingSave,
        refreshPendingChanges,
        discardChanges,
        refreshGitStatus,
        refreshGitLog,
        commitGit,
        syncGit,
        createOrSwitchBranch,
        moveFileOrFolder,
        duplicateFile,
        effectivePermission,
        isLoadingPermission,
        refreshEffectivePermission,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error(
      "useWorkspace deve ser utilizado dentro de um WorkspaceProvider",
    );
  }
  return context;
};
