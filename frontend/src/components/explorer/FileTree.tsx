import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Folder,
  FolderOpen,
  ChevronRight,
  FilePlus,
  FolderPlus,
  Trash2,
  Edit3,
  RefreshCw,
  ChevronLeft,
  X,
  FileText,
  FileCode,
  FileSpreadsheet,
  Image as ImageIcon,
  AlertCircle,
  ChevronsDownUp,
  ChevronsUpDown,
  Search,
  Upload,
  Laptop,
  Shield,
  Lock,
  Building2,
  Copy,
  AlertTriangle,
  FolderGit2,
} from "lucide-react";
import type { TreeNode, TemplateItem, Repo } from "../../types";
import { useWorkspace } from "../../context/WorkspaceContext";
import { useSecurity } from "../../context/SecurityContext";
import { useAuth } from "../../context/AuthContext";
import { API } from "../../services/api";
import { Modal, Button } from "../ui";
import { TemplatePickerModal } from "../modals/TemplatePickerModal";
import { LockedRepoModal } from "../modals/LockedRepoModal";
import { CreateRepoModal } from "../modals/CreateRepoModal";
import { DeleteRepoModal } from "../modals/DeleteRepoModal";
import { RepoGovernanceModal } from "../modals/RepoGovernanceModal";

interface FileTreeProps {
  onOpenFile: (path: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  width?: number;
}

interface InlineCreatingState {
  parentPath: string;
  isFolder: boolean;
}

interface DraggedItem {
  path: string;
  name: string;
  isFolder: boolean;
  repo?: string;
}

interface ScannedFile {
  file: File;
  relativePath: string;
}

// Utility: Recursively scan files and folders dropped from OS / Finder
const scanDataTransferItems = async (
  items: DataTransferItemList,
): Promise<ScannedFile[]> => {
  const result: ScannedFile[] = [];

  const traverseEntry = async (entry: any, currentPath: string = "") => {
    if (!entry) return;
    if (entry.isFile) {
      try {
        const file = await new Promise<File>((resolve, reject) => {
          entry.file(resolve, reject);
        });
        const rel = currentPath ? `${currentPath}/${entry.name}` : entry.name;
        result.push({ file, relativePath: rel });
      } catch (err) {
        console.warn(
          "[FileTree] Falha ao ler arquivo de entrada:",
          entry.name,
          err,
        );
      }
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      const readAllEntries = async (): Promise<any[]> => {
        let allEntries: any[] = [];
        let batch: any[] = [];
        do {
          batch = await new Promise<any[]>((resolve, reject) => {
            dirReader.readEntries(resolve, reject);
          });
          allEntries = allEntries.concat(batch);
        } while (batch && batch.length > 0);
        return allEntries;
      };

      try {
        const entries = await readAllEntries();
        const nextPath = currentPath
          ? `${currentPath}/${entry.name}`
          : entry.name;
        for (const childEntry of entries) {
          await traverseEntry(childEntry, nextPath);
        }
      } catch (err) {
        console.warn("[FileTree] Falha ao ler pasta:", entry.name, err);
      }
    }
  };

  const promises: Promise<any>[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === "file") {
      const entry = (item as any).webkitGetAsEntry
        ? (item as any).webkitGetAsEntry()
        : null;
      if (entry) {
        promises.push(traverseEntry(entry));
      } else {
        const file = item.getAsFile();
        if (file) {
          result.push({ file, relativePath: file.name });
        }
      }
    }
  }

  await Promise.all(promises);
  return result;
};

// Utility: Process FileList from input
const filesToScannedList = (fileList: FileList): ScannedFile[] => {
  const result: ScannedFile[] = [];
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    const rel = (file as any).webkitRelativePath || file.name;
    result.push({ file, relativePath: rel });
  }
  return result;
};

// Utility: Convert files into Text or Base64 payloads
const processFilesForUpload = async (scannedFiles: ScannedFile[]) => {
  const textExts = [
    "md",
    "markdown",
    "txt",
    "json",
    "yaml",
    "yml",
    "csv",
    "tsv",
    "js",
    "ts",
    "jsx",
    "tsx",
    "html",
    "css",
    "scss",
    "svg",
    "xml",
    "env",
    "sh",
    "py",
    "sql",
    "gitignore",
    "conf",
    "ini",
    "toml",
  ];

  const payload: Array<{
    name: string;
    relativePath: string;
    content?: string;
    base64?: string;
  }> = [];

  for (const item of scannedFiles) {
    const file = item.file;
    const name = file.name;
    const ext = name.includes(".")
      ? name.split(".").pop()?.toLowerCase() || ""
      : "";
    const isText = textExts.includes(ext) || file.type.startsWith("text/");

    if (isText) {
      try {
        const text = await file.text();
        payload.push({
          name,
          relativePath: item.relativePath,
          content: text,
        });
      } catch (err) {
        const b64 = await readFileAsBase64(file);
        payload.push({
          name,
          relativePath: item.relativePath,
          base64: b64,
        });
      }
    } else {
      const b64 = await readFileAsBase64(file);
      payload.push({
        name,
        relativePath: item.relativePath,
        base64: b64,
      });
    }
  }

  return payload;
};

const readFileAsBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      const commaIdx = res.indexOf(",");
      resolve(commaIdx >= 0 ? res.substring(commaIdx + 1) : res);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const getExpandedStorageKey = (repoName?: string) =>
  `spec_tree_expanded_folders_${repoName || "default"}`;
const getSelectedFolderStorageKey = (repoName?: string) =>
  `spec_tree_selected_folder_${repoName || "default"}`;
const getScrollStorageKey = (repoName?: string) =>
  `spec_tree_scroll_${repoName || "default"}`;

export const FileTree: React.FC<FileTreeProps> = ({
  onOpenFile,
  isCollapsed,
  onToggleCollapse,
  width,
}) => {
  const {
    tree,
    treesByRepo,
    activeFile,
    activeRepo,
    repos,
    selectRepo,
    loadRepos,
    activeOrg,
    loadTree,
    gitStatus,
    pendingChanges,
    refreshPendingChanges,
    refreshGitStatus,
    isLoadingWorkspace,
    isLoadingTree,
    moveFileOrFolder,
    duplicateFile,
    cloneLocalRepo,
    pullLocalRepo,
    repoProgress,
  } = useWorkspace();
  const { user } = useAuth();
  const { canAccessDoc, departments } = useSecurity();
  const navigate = useNavigate();
  const { org, subview } = useParams<{ org?: string; subview?: string }>();
  const repoName = activeRepo?.name || "default";
  const isTreeLoading = Boolean(isLoadingWorkspace || isLoadingTree);
  const [searchTerm, setSearchTerm] = useState("");
  const [lockedRepoTarget, setLockedRepoTarget] = useState<Repo | null>(null);
  const [createRepoModalOpen, setCreateRepoModalOpen] = useState(false);
  const [deleteRepoTarget, setDeleteRepoTarget] = useState<Repo | null>(null);
  const [deleteItemTarget, setDeleteItemTarget] = useState<{
    path: string;
    name: string;
    isFolder: boolean;
    repoName?: string;
  } | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);
  const [governanceRepoTarget, setGovernanceRepoTarget] = useState<Repo | null>(
    null,
  );
  const [collapsedRepos, setCollapsedRepos] = useState<Record<string, boolean>>(
    {},
  );
  const [loadingRepos, setLoadingRepos] = useState<Record<string, boolean>>({});

  const canCreateRootRepo = useMemo(() => {
    if (!activeOrg) return true;
    if (activeOrg.role === "admin" || (activeOrg as any).is_owner) return true;
    if (
      user?.login &&
      activeOrg.login.toLowerCase() === user.login.toLowerCase()
    )
      return true;
    return false;
  }, [activeOrg, user]);

  const handleSelectRepo = async (r: Repo, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const isCurrentlyActive =
      r.name.toLowerCase() === activeRepo?.name.toLowerCase();

    // Se já é o repositório ativo e o usuário clica novamente, alterna entre expandido e colapsado
    if (isCurrentlyActive) {
      await toggleRepoCollapse(r, e);
      return;
    }

    setCollapsedRepos((prev) => ({ ...prev, [r.name]: false }));
    setLoadingRepos((prev) => ({ ...prev, [r.name]: true }));
    const fileQuery = activeFile
      ? `?file=${encodeURIComponent(activeFile)}`
      : "";
    const owner = r.owner || (r.full_name ? r.full_name.split("/")[0] : "");
    const isOrg =
      owner &&
      owner !== "local" &&
      !r.is_local &&
      owner.toLowerCase() !== (user?.login || "").toLowerCase();
    const repoPath = isOrg
      ? `/org/${encodeURIComponent(owner)}/repo/${encodeURIComponent(r.name)}/${subview || "editor"}${fileQuery}`
      : `/repo/${encodeURIComponent(r.name)}/${subview || "editor"}${fileQuery}`;
    navigate(repoPath);
    try {
      await selectRepo(r, activeFile || undefined);
    } finally {
      setLoadingRepos((prev) => ({ ...prev, [r.name]: false }));
    }
  };

  const toggleRepoCollapse = async (r: Repo, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const isCurrentlyActive =
      r.name.toLowerCase() === activeRepo?.name.toLowerCase();
    const isCurrentlyCollapsed = collapsedRepos[r.name] ?? !isCurrentlyActive;
    const willBeExpanded = isCurrentlyCollapsed;
    setCollapsedRepos((prev) => ({ ...prev, [r.name]: !willBeExpanded }));

    if (
      willBeExpanded &&
      (!treesByRepo[r.name] || treesByRepo[r.name].length === 0)
    ) {
      if (!r.is_cloned_locally) {
        await handleSelectRepo(r, e);
      } else {
        setLoadingRepos((prev) => ({ ...prev, [r.name]: true }));
        try {
          await loadTree(r.name);
        } finally {
          setLoadingRepos((prev) => ({ ...prev, [r.name]: false }));
        }
      }
    }
  };

  const [expandedFolders, setExpandedFolders] = useState<
    Record<string, boolean>
  >(() => {
    try {
      const saved = localStorage.getItem(
        getExpandedStorageKey(activeRepo?.name),
      );
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {};
  });
  const [selectedFolder, setSelectedFolder] = useState<string>(() => {
    try {
      return (
        sessionStorage.getItem(getSelectedFolderStorageKey(activeRepo?.name)) ||
        ""
      );
    } catch (e) {
      return "";
    }
  });

  const treeScrollRef = useRef<HTMLDivElement>(null);
  const isRestoringScrollRef = useRef(false);

  // Sync expanded folders & selected folder when switching repositories
  useEffect(() => {
    try {
      const savedExpanded = localStorage.getItem(
        getExpandedStorageKey(repoName),
      );
      setExpandedFolders(savedExpanded ? JSON.parse(savedExpanded) : {});
      const savedFolder = sessionStorage.getItem(
        getSelectedFolderStorageKey(repoName),
      );
      setSelectedFolder(savedFolder || "");
    } catch (e) {
      setExpandedFolders({});
    }
  }, [repoName]);

  // Auto-expand ancestor directories of activeFile so it's immediately visible
  useEffect(() => {
    if (!activeFile) return;
    const parts = activeFile.split("/").filter(Boolean);
    if (parts.length > 1) {
      const ancestors: Record<string, boolean> = {};
      let acc = "";
      for (let i = 0; i < parts.length - 1; i++) {
        acc = acc ? `${acc}/${parts[i]}` : parts[i];
        ancestors[acc] = true;
      }
      setExpandedFolders((prev) => ({ ...prev, ...ancestors }));
    }
  }, [activeFile]);

  // Persist expanded folders state changes
  useEffect(() => {
    try {
      localStorage.setItem(
        getExpandedStorageKey(repoName),
        JSON.stringify(expandedFolders),
      );
    } catch (e) {}
  }, [expandedFolders, repoName]);

  // Persist selected folder state changes
  useEffect(() => {
    try {
      if (selectedFolder) {
        sessionStorage.setItem(
          getSelectedFolderStorageKey(repoName),
          selectedFolder,
        );
      } else {
        sessionStorage.removeItem(getSelectedFolderStorageKey(repoName));
      }
    } catch (e) {}
  }, [selectedFolder, repoName]);

  // Drag and Drop State (Internal Move & External Import)
  const [draggedItem, setDraggedItem] = useState<DraggedItem | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [isDragOverRoot, setIsDragOverRoot] = useState(false);
  const [isExternalDragActive, setIsExternalDragActive] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgressMessage, setImportProgressMessage] = useState("");
  const [targetUploadFolder, setTargetUploadFolder] = useState<string>("");
  const [targetUploadRepo, setTargetUploadRepo] = useState<string>("");
  const dragHoverTimerRef = useRef<any>(null);
  const hoveredFolderForExpansionRef = useRef<string | null>(null);
  const externalDragCounterRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // VS Code Inline Creation State
  const [inlineCreating, setInlineCreating] =
    useState<InlineCreatingState | null>(null);
  const [inlineValue, setInlineValue] = useState("");
  const inlineInputRef = useRef<HTMLInputElement>(null);
  const isSubmittingInlineRef = useRef(false);

  // Template Picker State
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(
    null,
  );
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);

  // Toast Notification inside Tree
  const [toast, setToast] = useState<{
    message: string;
    type: "info" | "warning";
  } | null>(null);
  const toastTimerRef = useRef<any>(null);

  const showToast = (message: string, type: "info" | "warning" = "info") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // Listen for Spec/Document Reveal in Tree events
  useEffect(() => {
    const handleReveal = (e: Event) => {
      const customEvent = e as CustomEvent<{ path: string }>;
      const targetPath = customEvent.detail?.path;
      if (!targetPath) return;

      // 1. Uncollapse tree sidebar if collapsed
      if (isCollapsed) {
        onToggleCollapse();
      }

      // 2. Clear search filter if active to make sure full tree is rendered
      if (searchTerm) {
        setSearchTerm("");
      }

      // 3. Compute all ancestor folder paths
      const parts = targetPath.split("/");
      parts.pop(); // remove file name
      const parentPaths: string[] = [];
      let currentAcc = "";
      for (const part of parts) {
        currentAcc = currentAcc ? `${currentAcc}/${part}` : part;
        parentPaths.push(currentAcc);
      }

      // 4. Expand all ancestor folders
      if (parentPaths.length > 0) {
        setExpandedFolders((prev) => {
          const updated = { ...prev };
          for (const p of parentPaths) {
            updated[p] = true;
          }
          return updated;
        });
      }

      // 5. Smoothly scroll target element into center view and flash reveal animation
      setTimeout(() => {
        try {
          const safeSelector = `[data-tree-path="${CSS.escape(targetPath)}"]`;
          const element = document.querySelector(safeSelector) as HTMLElement;
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
            element.classList.add("is-revealed");
            setTimeout(() => {
              element.classList.remove("is-revealed");
            }, 2000);
          }
        } catch (err) {
          console.warn("[FileTree] Falha ao rolar para elemento:", err);
        }
      }, 150);
    };

    window.addEventListener("spec:reveal-in-tree", handleReveal);
    return () => {
      window.removeEventListener("spec:reveal-in-tree", handleReveal);
    };
  }, [isCollapsed, onToggleCollapse, searchTerm]);

  // Escape key & global drag cancel listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsExternalDragActive(false);
        setDraggedItem(null);
        setDragOverTarget(null);
        setIsDragOverRoot(false);
        externalDragCounterRef.current = 0;
        hoveredFolderForExpansionRef.current = null;
        if (dragHoverTimerRef.current) {
          clearTimeout(dragHoverTimerRef.current);
          dragHoverTimerRef.current = null;
        }
      }
    };

    const handleGlobalDragEnd = () => {
      setIsExternalDragActive(false);
      setDraggedItem(null);
      setDragOverTarget(null);
      setIsDragOverRoot(false);
      externalDragCounterRef.current = 0;
      hoveredFolderForExpansionRef.current = null;
      if (dragHoverTimerRef.current) {
        clearTimeout(dragHoverTimerRef.current);
        dragHoverTimerRef.current = null;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("dragend", handleGlobalDragEnd);
    window.addEventListener("drop", handleGlobalDragEnd);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("dragend", handleGlobalDragEnd);
      window.removeEventListener("drop", handleGlobalDragEnd);
    };
  }, []);

  // Helper to detect external OS file drag vs internal node drag
  const isExternalFileDrag = (e: React.DragEvent) => {
    return (
      !draggedItem &&
      e.dataTransfer &&
      (e.dataTransfer.types.includes("Files") ||
        Array.from(e.dataTransfer.types).includes("Files"))
    );
  };

  const handlePaneDragEnter = (e: React.DragEvent) => {
    if (isExternalFileDrag(e)) {
      e.preventDefault();
      externalDragCounterRef.current++;
      setIsExternalDragActive(true);
    }
  };

  const handlePaneDragLeave = (e: React.DragEvent) => {
    if (isExternalFileDrag(e)) {
      e.preventDefault();
      externalDragCounterRef.current--;
      if (externalDragCounterRef.current <= 0) {
        externalDragCounterRef.current = 0;
        setIsExternalDragActive(false);
        setDragOverTarget(null);
        setIsDragOverRoot(false);
      }
    }
  };

  // Import handler for single/multiple files or folders
  const handleImportFiles = async (
    scannedFiles: ScannedFile[],
    targetFolder: string = "",
    targetRepoName?: string,
  ) => {
    if (!scannedFiles || scannedFiles.length === 0) return;

    const targetRepo = targetRepoName || activeRepo?.name;
    setIsImporting(true);
    const count = scannedFiles.length;
    setImportProgressMessage(
      `Lendo e processando ${count} arquivo${count > 1 ? "s" : ""}...`,
    );

    try {
      const filesPayload = await processFilesForUpload(scannedFiles);
      const destLabel = targetFolder
        ? `/${targetFolder}`
        : targetRepo
          ? `a raiz de ${targetRepo}`
          : "a raiz do projeto";

      setImportProgressMessage(`Importando para ${destLabel}...`);

      const res = await API.importFiles({
        target_folder: targetFolder,
        files: filesPayload,
        repo: targetRepo,
      });

      if (res.ok && res.data?.success) {
        if (targetRepo) {
          await loadTree(targetRepo);
        } else {
          await loadTree();
        }
        await Promise.all([refreshPendingChanges(), refreshGitStatus()]);

        const imported = res.data.importedFiles || [];
        showToast(
          `${imported.length} arquivo${imported.length > 1 ? "s" : ""} importado${imported.length > 1 ? "s" : ""} com sucesso em ${destLabel}!`,
          "info",
        );

        if (targetFolder) {
          setExpandedFolders((prev) => ({ ...prev, [targetFolder]: true }));
        }

        // If a single file was imported, open it automatically
        if (imported.length === 1) {
          onOpenFile(imported[0].path);
        }
      } else {
        const errMsg =
          res.data?.errors?.join(", ") ||
          res.data?.error ||
          "Falha ao importar arquivos.";
        showToast(`Erro na importação: ${errMsg}`, "warning");
      }
    } catch (err: any) {
      showToast(
        `Erro ao conectar com o servidor: ${err.message || "Erro desconhecido"}`,
        "warning",
      );
    } finally {
      setIsImporting(false);
      setImportProgressMessage("");
    }
  };

  // Drag and Drop Handlers
  const handleDragStart = (
    e: React.DragEvent,
    node: TreeNode,
    isFolder: boolean,
    repoNameForNode?: string,
  ) => {
    e.stopPropagation();
    const itemRepo = repoNameForNode || activeRepo?.name || "default";
    const item: DraggedItem = {
      path: node.path,
      name: node.name,
      isFolder,
      repo: itemRepo,
    };
    setDraggedItem(item);
    e.dataTransfer.setData("text/plain", node.path);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.stopPropagation();
    setDraggedItem(null);
    setDragOverTarget(null);
    setIsDragOverRoot(false);
    setIsExternalDragActive(false);
    externalDragCounterRef.current = 0;
    hoveredFolderForExpansionRef.current = null;
    if (dragHoverTimerRef.current) {
      clearTimeout(dragHoverTimerRef.current);
      dragHoverTimerRef.current = null;
    }
  };

  const handleDragOverFolder = (e: React.DragEvent, folderPath: string) => {
    e.preventDefault();
    e.stopPropagation();

    const isExt = isExternalFileDrag(e);

    if (isExt) {
      e.dataTransfer.dropEffect = "copy";
      setDragOverTarget(folderPath);
      setIsDragOverRoot(false);
    } else {
      if (!draggedItem) return;
      if (draggedItem.path === folderPath) return;
      if (
        draggedItem.isFolder &&
        (folderPath === draggedItem.path ||
          folderPath.startsWith(`${draggedItem.path}/`))
      ) {
        return;
      }
      e.dataTransfer.dropEffect = "move";
      setDragOverTarget(folderPath);
      setIsDragOverRoot(false);
    }

    // Snappy auto-expand: start timer once when entering or hovering a folder
    if (hoveredFolderForExpansionRef.current !== folderPath) {
      hoveredFolderForExpansionRef.current = folderPath;
      if (dragHoverTimerRef.current) {
        clearTimeout(dragHoverTimerRef.current);
      }

      // If the folder is not yet expanded, auto-expand it after 400ms of hovering
      if (!expandedFolders[folderPath]) {
        dragHoverTimerRef.current = setTimeout(() => {
          setExpandedFolders((prev) => ({ ...prev, [folderPath]: true }));
        }, 400);
      }
    }
  };

  const handleDragLeaveFolder = (e: React.DragEvent, folderPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragOverTarget === folderPath) {
      setDragOverTarget(null);
    }
    if (hoveredFolderForExpansionRef.current === folderPath) {
      hoveredFolderForExpansionRef.current = null;
      if (dragHoverTimerRef.current) {
        clearTimeout(dragHoverTimerRef.current);
        dragHoverTimerRef.current = null;
      }
    }
  };

  const handleDropOnFolder = async (
    e: React.DragEvent,
    targetFolderPath: string,
    targetRepoName?: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTarget(null);
    setIsDragOverRoot(false);
    setIsExternalDragActive(false);
    externalDragCounterRef.current = 0;
    if (dragHoverTimerRef.current) clearTimeout(dragHoverTimerRef.current);

    // 1. External OS files dropped on folder
    if (
      isExternalFileDrag(e) ||
      (e.dataTransfer.files && e.dataTransfer.files.length > 0 && !draggedItem)
    ) {
      const scanned = e.dataTransfer.items
        ? await scanDataTransferItems(e.dataTransfer.items)
        : filesToScannedList(e.dataTransfer.files);
      if (scanned.length > 0) {
        await handleImportFiles(scanned, targetFolderPath);
      }
      return;
    }

    // 2. Internal tree item dropped on folder
    if (!draggedItem) return;
    const {
      path: sourcePath,
      name: itemName,
      isFolder,
      repo: sourceRepo,
    } = draggedItem;
    setDraggedItem(null);

    const srcRepo = sourceRepo || activeRepo?.name || "default";
    const dstRepo = targetRepoName || activeRepo?.name || "default";
    const isCrossRepo = srcRepo.toLowerCase() !== dstRepo.toLowerCase();

    if (!isCrossRepo && sourcePath === targetFolderPath) return;
    if (
      !isCrossRepo &&
      isFolder &&
      folderPathEqualOrChild(targetFolderPath, sourcePath)
    ) {
      showToast(
        "Não é possível mover uma pasta para dentro de si mesma.",
        "warning",
      );
      return;
    }

    const targetPath = `${targetFolderPath}/${itemName}`;
    if (!isCrossRepo && sourcePath === targetPath) return;

    await executeMove(
      sourcePath,
      targetPath,
      itemName,
      targetFolderPath,
      srcRepo,
      dstRepo,
    );
  };

  const folderPathEqualOrChild = (target: string, source: string) => {
    return target === source || target.startsWith(`${source}/`);
  };

  const handleDragOverFile = (e: React.DragEvent, filePath: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (isExternalFileDrag(e)) {
      e.dataTransfer.dropEffect = "copy";
      setDragOverTarget(filePath);
      setIsDragOverRoot(false);
      return;
    }

    if (!draggedItem) return;
    if (draggedItem.path === filePath) return;
    e.dataTransfer.dropEffect = "move";
    setDragOverTarget(filePath);
    setIsDragOverRoot(false);
  };

  const handleDragLeaveFile = (e: React.DragEvent, filePath: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragOverTarget === filePath) {
      setDragOverTarget(null);
    }
  };

  const handleDropOnFile = async (
    e: React.DragEvent,
    targetFilePath: string,
    targetRepoName?: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTarget(null);
    setIsDragOverRoot(false);
    setIsExternalDragActive(false);
    externalDragCounterRef.current = 0;

    const segments = targetFilePath.split("/");
    segments.pop();
    const parentDir = segments.join("/");

    // 1. External files dropped on file item (imports to containing folder)
    if (
      isExternalFileDrag(e) ||
      (e.dataTransfer.files && e.dataTransfer.files.length > 0 && !draggedItem)
    ) {
      const scanned = e.dataTransfer.items
        ? await scanDataTransferItems(e.dataTransfer.items)
        : filesToScannedList(e.dataTransfer.files);
      if (scanned.length > 0) {
        await handleImportFiles(scanned, parentDir);
      }
      return;
    }

    // 2. Internal item move
    if (!draggedItem) return;

    const {
      path: sourcePath,
      name: itemName,
      isFolder,
      repo: sourceRepo,
    } = draggedItem;
    setDraggedItem(null);

    const srcRepo = sourceRepo || activeRepo?.name || "default";
    const dstRepo = targetRepoName || activeRepo?.name || "default";
    const isCrossRepo = srcRepo.toLowerCase() !== dstRepo.toLowerCase();

    if (!isCrossRepo && sourcePath === targetFilePath) return;

    if (
      !isCrossRepo &&
      isFolder &&
      parentDir &&
      (parentDir === sourcePath || parentDir.startsWith(`${sourcePath}/`))
    ) {
      showToast(
        "Não é possível mover uma pasta para dentro de si mesma.",
        "warning",
      );
      return;
    }

    const targetPath = parentDir ? `${parentDir}/${itemName}` : itemName;
    if (!isCrossRepo && sourcePath === targetPath) return;

    await executeMove(
      sourcePath,
      targetPath,
      itemName,
      parentDir || "raiz",
      srcRepo,
      dstRepo,
    );
  };

  const handleDragOverRoot = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isExternalFileDrag(e)) {
      e.dataTransfer.dropEffect = "copy";
      setIsDragOverRoot(true);
      setDragOverTarget(null);
      return;
    }

    if (draggedItem) {
      setIsDragOverRoot(true);
      setDragOverTarget(null);
    }
  };

  const handleDragLeaveRoot = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverRoot(false);
  };

  const handleDropOnRoot = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsDragOverRoot(false);
    setDragOverTarget(null);
    setIsExternalDragActive(false);
    externalDragCounterRef.current = 0;

    // 1. External OS files dropped on root tree container
    if (
      isExternalFileDrag(e) ||
      (e.dataTransfer.files && e.dataTransfer.files.length > 0 && !draggedItem)
    ) {
      const scanned = e.dataTransfer.items
        ? await scanDataTransferItems(e.dataTransfer.items)
        : filesToScannedList(e.dataTransfer.files);
      if (scanned.length > 0) {
        await handleImportFiles(scanned, selectedFolder || "");
      }
      return;
    }

    // 2. Internal move to root
    if (!draggedItem) return;

    const sourcePath = draggedItem.path;
    const itemName = sourcePath.split("/").pop() || sourcePath;

    if (!sourcePath.includes("/")) return;

    const targetPath = itemName;
    if (sourcePath === targetPath) return;

    await executeMove(
      sourcePath,
      targetPath,
      itemName,
      "raiz",
      draggedItem.repo,
    );
  };

  const handleDragOverRepo = (e: React.DragEvent, targetRepoName: string) => {
    e.preventDefault();
    e.stopPropagation();

    const isExt = isExternalFileDrag(e);
    if (isExt) {
      e.dataTransfer.dropEffect = "copy";
    } else {
      e.dataTransfer.dropEffect = "move";
    }

    setDragOverTarget(`__repo__:${targetRepoName}`);
    setIsDragOverRoot(false);

    // Auto-expande o repositório se passar 400ms sobre ele
    if (hoveredFolderForExpansionRef.current !== `__repo__:${targetRepoName}`) {
      hoveredFolderForExpansionRef.current = `__repo__:${targetRepoName}`;
      if (dragHoverTimerRef.current) {
        clearTimeout(dragHoverTimerRef.current);
      }
      if (collapsedRepos[targetRepoName]) {
        dragHoverTimerRef.current = setTimeout(() => {
          setCollapsedRepos((prev) => ({ ...prev, [targetRepoName]: false }));
        }, 400);
      }
    }
  };

  const handleDragLeaveRepo = (e: React.DragEvent, targetRepoName: string) => {
    e.preventDefault();
    e.stopPropagation();

    // Se o cursor ainda estiver dentro do elemento ou de seus filhos, não limpa a drop zone
    if (e.currentTarget.contains(e.relatedTarget as Node)) {
      return;
    }

    if (dragOverTarget === `__repo__:${targetRepoName}`) {
      setDragOverTarget(null);
    }
    if (hoveredFolderForExpansionRef.current === `__repo__:${targetRepoName}`) {
      hoveredFolderForExpansionRef.current = null;
      if (dragHoverTimerRef.current) {
        clearTimeout(dragHoverTimerRef.current);
        dragHoverTimerRef.current = null;
      }
    }
  };

  const handleDropOnRepo = async (
    e: React.DragEvent,
    targetRepoName: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTarget(null);
    setIsDragOverRoot(false);
    setIsExternalDragActive(false);
    externalDragCounterRef.current = 0;
    if (dragHoverTimerRef.current) {
      clearTimeout(dragHoverTimerRef.current);
      dragHoverTimerRef.current = null;
    }

    // Auto-expande o repositório destino para exibir o item solto
    setCollapsedRepos((prev) => ({ ...prev, [targetRepoName]: false }));

    // 1. Arquivos externos do SO soltos na raiz do repositório
    if (
      isExternalFileDrag(e) ||
      (e.dataTransfer.files && e.dataTransfer.files.length > 0 && !draggedItem)
    ) {
      const scanned = e.dataTransfer.items
        ? await scanDataTransferItems(e.dataTransfer.items)
        : filesToScannedList(e.dataTransfer.files);
      if (scanned.length > 0) {
        await handleImportFiles(scanned, "", targetRepoName);
      }
      return;
    }

    // 2. Item interno da árvore movido para a raiz do repositório
    if (!draggedItem) return;
    const { path: sourcePath, name: itemName, repo: sourceRepo } = draggedItem;
    setDraggedItem(null);

    const srcRepo = sourceRepo || activeRepo?.name || "default";
    const targetPath = itemName;

    if (
      srcRepo.toLowerCase() === targetRepoName.toLowerCase() &&
      !sourcePath.includes("/")
    ) {
      return;
    }

    await executeMove(
      sourcePath,
      targetPath,
      itemName,
      "raiz",
      srcRepo,
      targetRepoName,
    );
  };

  const handleDuplicateFile = async (
    filePath: string,
    repoNameForNode?: string,
    e?: React.MouseEvent,
  ) => {
    if (e) e.stopPropagation();
    const targetRepo = repoNameForNode || activeRepo?.name || "default";
    try {
      const res = await duplicateFile(filePath, targetRepo);
      if (res.success && res.newPath) {
        const fileName = res.newPath.split("/").pop() || res.newPath;
        showToast(`"${fileName}" duplicado com sucesso!`, "info");
      } else {
        showToast(res.error || "Falha ao duplicar arquivo.", "warning");
      }
    } catch (err: any) {
      console.error("[FileTree] Erro ao duplicar arquivo:", err);
      showToast(
        err.message || "Erro inesperado ao duplicar arquivo.",
        "warning",
      );
    }
  };

  const executeMove = async (
    old_path: string,
    new_path: string,
    itemName: string,
    destinationLabel: string,
    sourceRepo?: string,
    targetRepo?: string,
  ) => {
    const srcRepo = sourceRepo || activeRepo?.name || "default";
    const dstRepo = targetRepo || srcRepo;
    try {
      const res = await moveFileOrFolder(old_path, new_path, srcRepo, dstRepo);
      if (res.success) {
        showToast(
          `"${itemName}" movido com sucesso para ${dstRepo === srcRepo ? destinationLabel : `${dstRepo}/${destinationLabel}`}.`,
          "info",
        );
      } else {
        showToast(
          `Erro ao mover: ${res.error || "Falha ao mover item"}`,
          "warning",
        );
      }
    } catch (err: any) {
      console.error("[FileTree] Falha ao mover item:", err);
      showToast(err.message || "Erro inesperado ao mover o item.", "warning");
    }
  };

  // Inline Renaming State (VS Code style in-place rename)
  const [inlineRenaming, setInlineRenaming] = useState<{
    path: string;
    originalName: string;
    isFolder: boolean;
  } | null>(null);
  const [inlineRenameValue, setInlineRenameValue] = useState("");
  const inlineRenameInputRef = useRef<HTMLInputElement>(null);
  const isSubmittingRenameRef = useRef(false);

  // Focus and select inline rename input
  useEffect(() => {
    if (inlineRenaming && inlineRenameInputRef.current) {
      inlineRenameInputRef.current.focus();
      const name = inlineRenaming.originalName;
      const dotIndex = name.lastIndexOf(".");
      if (!inlineRenaming.isFolder && dotIndex > 0) {
        inlineRenameInputRef.current.setSelectionRange(0, dotIndex);
      } else {
        inlineRenameInputRef.current.select();
      }
    }
  }, [inlineRenaming]);

  // Focus inline input when creation starts
  useEffect(() => {
    if (inlineCreating && inlineInputRef.current) {
      inlineInputRef.current.focus();
      inlineInputRef.current.select();
    }
  }, [inlineCreating]);

  // Start Inline Creation (VS Code style)
  const startInlineCreate = (
    parentPath: string = "",
    isFolder: boolean = false,
    e?: React.MouseEvent,
  ) => {
    if (e) e.stopPropagation();
    isSubmittingInlineRef.current = false;

    // Ensure parent folder is expanded so inline input is visible
    if (parentPath) {
      setExpandedFolders((prev) => ({
        ...prev,
        [parentPath]: true,
      }));
    }

    setSelectedTemplate(null);
    setInlineCreating({ parentPath, isFolder });
    setInlineValue("");
  };

  // Confirm Inline Creation
  const handleConfirmInlineCreate = async () => {
    if (!inlineCreating || isSubmittingInlineRef.current) return;
    const rawName = inlineValue.trim();
    if (!rawName) {
      setInlineCreating(null);
      return;
    }

    isSubmittingInlineRef.current = true;
    const { parentPath, isFolder } = inlineCreating;
    const fileName = rawName;

    const isMarkdown =
      !isFolder &&
      (fileName.toLowerCase().endsWith(".md") ||
        fileName.toLowerCase().endsWith(".markdown"));

    const targetPath = parentPath ? `${parentPath}/${fileName}` : fileName;

    const docTitle = rawName.replace(/\.[^/.]+$/, "");
    const templateId = selectedTemplate?.id || "";

    try {
      const res = await API.createProjectFile({
        path: targetPath,
        is_folder: isFolder,
        content: "",
        templateId: templateId || undefined,
        repo: activeRepo?.name,
        meta: !isFolder
          ? {
              title: docTitle,
              status: "",
              categories: "",
              tags: [],
              approvers: [],
              links: [],
              templateId,
            }
          : undefined,
      });

      if (res.ok) {
        const createdPath = res.data?.path || targetPath;
        setInlineCreating(null);
        setInlineValue("");
        setSelectedTemplate(null);
        isSubmittingInlineRef.current = false;

        if (isFolder) {
          showToast(`Pasta "${rawName}" criada com sucesso.`, "info");
          setSelectedFolder(targetPath);
        } else {
          onOpenFile(createdPath);
          // If a template was used, dispatch the systemPrompt so the copilot can pick it up
          if (isMarkdown) {
            const systemPrompt =
              res.data?.systemPrompt || selectedTemplate?.systemPrompt || "";
            if (systemPrompt) {
              window.dispatchEvent(
                new CustomEvent("template:applied", {
                  detail: { templateId, systemPrompt, filePath: createdPath },
                }),
              );
            }
            showToast(
              templateId
                ? `Documento criado com template "${selectedTemplate?.title || templateId}".`
                : "Documento criado e aberto no editor.",
              "info",
            );
          } else {
            showToast(`Arquivo "${rawName}" criado e aberto.`, "info");
          }
        }

        // Silent background refresh
        loadTree(activeRepo?.name).catch(() => {});
        Promise.all([refreshPendingChanges(), refreshGitStatus()]).catch(
          () => {},
        );
      } else {
        alert(res.data?.error || "Erro ao criar item na árvore.");
      }
    } catch (err) {
      alert("Erro ao conectar com o servidor para criar item.");
    } finally {
      isSubmittingInlineRef.current = false;
    }
  };

  // Open file or folder in OS File Manager (Finder / Explorer / File Manager)
  const handleOpenInOS = async (
    path: string,
    e?: React.MouseEvent,
    repoName?: string,
  ) => {
    e?.stopPropagation();
    try {
      const targetRepo = repoName || activeRepo?.name;
      const res = await API.openInOS(path, targetRepo);
      if (res.ok) {
        showToast("Aberto no gerenciador de arquivos do PC.", "info");
      } else {
        showToast(
          res.data?.error || "Erro ao abrir no sistema operacional.",
          "warning",
        );
      }
    } catch {
      showToast("Erro ao conectar com o servidor.", "warning");
    }
  };

  // Cancel Inline Creation
  const handleCancelInlineCreate = () => {
    isSubmittingInlineRef.current = false;
    setInlineCreating(null);
    setInlineValue("");
    setSelectedTemplate(null);
  };

  // Collapse All Folders (VS Code action)
  const handleCollapseAllFolders = () => {
    setExpandedFolders({});
    showToast("Todas as pastas foram recolhidas.", "info");
  };

  // Expand All Folders & Repos (VS Code action)
  const handleExpandAllFolders = () => {
    const allFolderPaths: Record<string, boolean> = {};
    const collectDirs = (nodes: TreeNode[]) => {
      for (const n of nodes) {
        const isDir =
          n.type === "dir" || n.type === "directory" || n.is_directory;
        if (isDir) {
          allFolderPaths[n.path] = true;
          if (n.children) collectDirs(n.children);
        }
      }
    };
    if (tree) collectDirs(tree);
    Object.values(treesByRepo).forEach((t) => {
      if (t) collectDirs(t);
    });
    setExpandedFolders(allFolderPaths);
    setCollapsedRepos({});
    const uninitializedRepos = orgRepos.filter((r) => !treesByRepo[r.name]);
    if (uninitializedRepos.length > 0) {
      Promise.allSettled(uninitializedRepos.map((r) => loadTree(r.name))).catch(
        () => {},
      );
    }
    showToast("Todas as pastas e repositórios foram expandidos.", "info");
  };

  // Refresh All Open Repos & Workspace
  const handleRefreshAll = async () => {
    try {
      await loadTree(activeRepo?.name);
      const openRepos = orgRepos.filter(
        (r) => !collapsedRepos[r.name] && r.name !== activeRepo?.name,
      );
      await Promise.allSettled(openRepos.map((r) => loadTree(r.name)));
      await Promise.allSettled([refreshPendingChanges(), refreshGitStatus()]);
      showToast("Árvore de arquivos atualizada.", "info");
    } catch {
      showToast("Falha ao atualizar árvore.", "warning");
    }
  };

  // File Click Handler: Open any file in the workspace
  const handleFileClick = async (
    path: string,
    _name: string,
    repoForNode?: string,
  ) => {
    if (
      repoForNode &&
      repoForNode.toLowerCase() !== activeRepo?.name.toLowerCase()
    ) {
      const targetRepoObj = repos.find(
        (r) => r.name.toLowerCase() === repoForNode.toLowerCase(),
      ) || {
        id: 0,
        name: repoForNode,
        full_name: repoForNode,
        is_local: true,
      };
      const targetOwner =
        targetRepoObj.owner ||
        (targetRepoObj.full_name ? targetRepoObj.full_name.split("/")[0] : "");
      const isOrg =
        targetOwner &&
        targetOwner !== "local" &&
        !targetRepoObj.is_local &&
        targetOwner.toLowerCase() !== (user?.login || "").toLowerCase();
      const targetUrl = isOrg
        ? `/org/${encodeURIComponent(targetOwner)}/repo/${encodeURIComponent(repoForNode)}/editor?file=${encodeURIComponent(path)}`
        : `/repo/${encodeURIComponent(repoForNode)}/editor?file=${encodeURIComponent(path)}`;
      navigate(targetUrl);
      await selectRepo(targetRepoObj, path);
    } else {
      onOpenFile(path);
    }
  };

  const startInlineRename = (
    itemPath: string,
    currentName: string,
    isFolder: boolean,
    e?: React.MouseEvent,
  ) => {
    if (e) e.stopPropagation();
    setInlineCreating(null);
    setInlineRenaming({ path: itemPath, originalName: currentName, isFolder });
    setInlineRenameValue(currentName);
  };

  const handleCancelInlineRename = () => {
    setInlineRenaming(null);
    setInlineRenameValue("");
    isSubmittingRenameRef.current = false;
  };

  const handleConfirmInlineRename = async () => {
    if (!inlineRenaming || isSubmittingRenameRef.current) return;
    const new_name = inlineRenameValue.trim();
    const old_path = inlineRenaming.path;
    const old_name = inlineRenaming.originalName;

    if (!new_name || new_name === old_name) {
      handleCancelInlineRename();
      return;
    }

    isSubmittingRenameRef.current = true;
    const cleanOld = old_path.replace(/^\/+/, "").replace(/\/+$/, "");
    const parts = cleanOld.split("/");
    parts.pop();
    const parentDir = parts.join("/");
    const new_path = parentDir ? `${parentDir}/${new_name}` : new_name;

    try {
      const res = await API.renameProjectFile({
        old_path: cleanOld,
        new_path,
        repo: activeRepo?.name,
      });
      if (res.ok && res.data?.success) {
        handleCancelInlineRename();
        await loadTree();
        await Promise.all([refreshPendingChanges(), refreshGitStatus()]);
        if (activeFile === cleanOld) {
          const isMd =
            new_path.endsWith(".md") || new_path.endsWith(".markdown");
          if (isMd) {
            onOpenFile(new_path);
          } else {
            onOpenFile("");
          }
        }
        showToast("Item renomeado com sucesso.", "info");
      } else {
        showToast(
          `Erro ao renomear: ${res.data?.error || "Falha na operação"}`,
          "warning",
        );
        handleCancelInlineRename();
      }
    } catch (err) {
      showToast("Erro ao conectar com o servidor para renomear.", "warning");
      handleCancelInlineRename();
    } finally {
      isSubmittingRenameRef.current = false;
    }
  };

  const promptDeleteItem = (
    path: string,
    name: string,
    isFolder: boolean,
    repoName?: string,
    e?: React.MouseEvent,
  ) => {
    if (e) e.stopPropagation();
    setDeleteItemTarget({ path, name, isFolder, repoName });
  };

  const handleConfirmDeleteItem = async () => {
    if (!deleteItemTarget) return;
    setIsDeletingItem(true);
    const { path, isFolder, repoName: targetRepo } = deleteItemTarget;
    const repoToUse = targetRepo || activeRepo?.name;
    try {
      const res = await API.deleteProjectFile(path, repoToUse);
      if (res.ok && res.data?.success) {
        setDeleteItemTarget(null);
        await loadTree(repoToUse);
        if (repoToUse === activeRepo?.name) {
          await Promise.allSettled([
            refreshPendingChanges(),
            refreshGitStatus(),
          ]);
          if (activeFile === path || activeFile.startsWith(`${path}/`)) {
            onOpenFile("");
          }
        }
        showToast(
          `${isFolder ? "Pasta" : "Arquivo"} excluído com sucesso.`,
          "info",
        );
      } else {
        showToast(
          res.data?.error || "Erro ao excluir item do repositório.",
          "warning",
        );
      }
    } catch {
      showToast("Erro ao conectar com o servidor para excluir.", "warning");
    } finally {
      setIsDeletingItem(false);
    }
  };

  const toggleFolder = (folderPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFolder(folderPath);
    setExpandedFolders((prev) => ({
      ...prev,
      [folderPath]: !prev[folderPath],
    }));
  };

  // Indexed Maps for O(1) status lookups during render
  const gitStatusMap = useMemo(() => {
    const map = new Map<string, any>();
    if (gitStatus?.files && Array.isArray(gitStatus.files)) {
      for (let i = 0; i < gitStatus.files.length; i++) {
        const f = gitStatus.files[i];
        if (f?.path) {
          const clean = f.path.replace(/^\/+/, "");
          map.set(clean, f);
          map.set(`/${clean}`, f);
        }
      }
    }
    return map;
  }, [gitStatus]);

  const pendingChangesMap = useMemo(() => {
    const map = new Map<string, any>();
    if (pendingChanges && Array.isArray(pendingChanges)) {
      for (let i = 0; i < pendingChanges.length; i++) {
        const c = pendingChanges[i];
        if (c?.path) {
          const clean = c.path.replace(/^\/+/, "");
          map.set(clean, c);
          map.set(`/${clean}`, c);
        }
      }
    }
    return map;
  }, [pendingChanges]);

  const departmentsMap = useMemo(() => {
    const map = new Map<string, any>();
    if (departments && Array.isArray(departments)) {
      for (let i = 0; i < departments.length; i++) {
        const d = departments[i];
        if (d?.id) map.set(String(d.id).toLowerCase(), d);
        if (d?.folder) map.set(String(d.folder).toLowerCase(), d);
      }
    }
    return map;
  }, [departments]);

  // Determina a organização em foco (URL :org, activeOrg ou owner do activeRepo)
  const currentOrgLogin = useMemo(() => {
    if (org && org.trim()) return org.toLowerCase().trim();
    if (activeOrg?.login && activeOrg.login !== "local")
      return activeOrg.login.toLowerCase().trim();
    if (activeRepo && !activeRepo.is_local) {
      const owner = (
        activeRepo.owner ||
        (activeRepo.full_name ? activeRepo.full_name.split("/")[0] : "")
      )
        .toLowerCase()
        .trim();
      if (
        owner &&
        owner !== "local" &&
        owner !== (user?.login || "").toLowerCase()
      ) {
        return owner;
      }
    }
    return "";
  }, [org, activeOrg?.login, activeRepo, user?.login]);

  // Repositórios do Workspace estritamente separados por Organização
  const orgRepos = useMemo(() => {
    if (!repos || repos.length === 0) {
      if (activeRepo) return [activeRepo];
      return [];
    }

    // Caso 1: Navegando em uma organização específica (ex: enursy)
    if (currentOrgLogin) {
      const filtered = repos.filter((r) => {
        const owner = (
          r.owner || (r.full_name ? r.full_name.split("/")[0] : "")
        )
          .toLowerCase()
          .trim();
        return owner === currentOrgLogin;
      });

      // Garante que o activeRepo esteja incluso se pertencer a esta mesma organização ou se for o repo ativo
      if (activeRepo) {
        const activeOwner = (
          activeRepo.owner ||
          (activeRepo.full_name ? activeRepo.full_name.split("/")[0] : "")
        )
          .toLowerCase()
          .trim();
        if (
          !filtered.some(
            (r) => r.name.toLowerCase() === activeRepo.name.toLowerCase(),
          )
        ) {
          if (
            activeOwner === currentOrgLogin ||
            !activeOwner ||
            activeOwner === "local" ||
            filtered.length === 0
          ) {
            filtered.push(activeRepo);
          }
        }
      }

      const orgList =
        filtered.length > 0 ? filtered : activeRepo ? [activeRepo] : [];
      return [...orgList].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, {
          sensitivity: "base",
          numeric: true,
        }),
      );
    }

    // Caso 2: Navegando em escopo local ou sem organização
    const localOrPersonalRepos = repos.filter((r) => {
      const owner = (r.owner || (r.full_name ? r.full_name.split("/")[0] : ""))
        .toLowerCase()
        .trim();
      return (
        r.is_local ||
        owner === "local" ||
        owner === (user?.login || "").toLowerCase() ||
        !owner
      );
    });

    if (
      activeRepo &&
      !localOrPersonalRepos.some(
        (r) => r.name.toLowerCase() === activeRepo.name.toLowerCase(),
      )
    ) {
      localOrPersonalRepos.push(activeRepo);
    }

    const baseList =
      localOrPersonalRepos.length > 0
        ? localOrPersonalRepos
        : activeRepo
          ? [activeRepo]
          : repos;

    // Ordenação fixa de A a Z
    return [...baseList].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, {
        sensitivity: "base",
        numeric: true,
      }),
    );
  }, [repos, activeRepo, currentOrgLogin, user?.login]);

  // Build display nodes for a given repository (or active repo)
  const getDisplayNodesForRepo = useCallback(
    (rName: string) => {
      const nodes =
        treesByRepo[rName] ||
        (rName.toLowerCase() === activeRepo?.name.toLowerCase() ? tree : []);
      if (!nodes || nodes.length === 0) return [];
      if (!searchTerm.trim()) return nodes;

      const q = searchTerm.trim().toLowerCase();
      const matchNode = (node: TreeNode): TreeNode | null => {
        const nameMatch = Boolean(
          (node.name && node.name.toLowerCase().includes(q)) ||
          (node.title && node.title.toLowerCase().includes(q)),
        );
        const isDir =
          node.type === "dir" ||
          node.type === "directory" ||
          (node as any).is_directory;

        if (!isDir) {
          return nameMatch ? node : null;
        }

        const filteredChildren = (node.children || [])
          .map(matchNode)
          .filter((c): c is TreeNode => c !== null);

        if (nameMatch || filteredChildren.length > 0) {
          return {
            ...node,
            children: filteredChildren,
          };
        }
        return null;
      };

      return nodes.map(matchNode).filter((n): n is TreeNode => n !== null);
    },
    [treesByRepo, tree, activeRepo, searchTerm],
  );

  const displayNodes = useMemo(() => {
    return getDisplayNodesForRepo(activeRepo?.name || repoName);
  }, [tree, treesByRepo, searchTerm, activeRepo, repoName]);

  // Handle tree scroll position tracking
  const handleTreeScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isRestoringScrollRef.current) return;
    const top = e.currentTarget.scrollTop;
    try {
      sessionStorage.setItem(getScrollStorageKey(repoName), String(top));
      localStorage.setItem(getScrollStorageKey(repoName), String(top));
    } catch (e) {}
  };

  // Restore scroll position when tree nodes are rendered / mounted / updated
  useEffect(() => {
    if (!isTreeLoading && displayNodes.length > 0 && treeScrollRef.current) {
      try {
        const savedScroll =
          sessionStorage.getItem(getScrollStorageKey(repoName)) ||
          localStorage.getItem(getScrollStorageKey(repoName));
        if (savedScroll !== null) {
          const top = parseInt(savedScroll, 10);
          if (!isNaN(top) && top > 0) {
            isRestoringScrollRef.current = true;
            treeScrollRef.current.scrollTop = top;
            const frameId = requestAnimationFrame(() => {
              if (treeScrollRef.current) {
                treeScrollRef.current.scrollTop = top;
              }
              setTimeout(() => {
                isRestoringScrollRef.current = false;
              }, 80);
            });
            return () => cancelAnimationFrame(frameId);
          }
        }
      } catch (e) {}
    }
  }, [isTreeLoading, displayNodes.length, repoName]);

  // Render Inline Input Row for VS Code creation
  const renderInlineCreateInput = (parentPath: string) => {
    if (!inlineCreating || inlineCreating.parentPath !== parentPath)
      return null;

    const { isFolder } = inlineCreating;
    return (
      <>
        <div
          className="tree-inline-create-row"
          onClick={(e) => e.stopPropagation()}
        >
          {isFolder ? (
            <Folder size={14} color="#2563eb" style={{ flexShrink: 0 }} />
          ) : (
            <FileText size={14} color="#2563eb" style={{ flexShrink: 0 }} />
          )}
          <input
            ref={inlineInputRef}
            type="text"
            className="tree-inline-input"
            placeholder={isFolder ? "nome-da-pasta" : "nome-do-arquivo"}
            value={inlineValue}
            onChange={(e) => setInlineValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                handleConfirmInlineCreate();
              } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                handleCancelInlineCreate();
              }
            }}
            onBlur={() => {
              // Don't react to blur while the template picker modal is open
              // (focus moves into the modal, which would otherwise cancel the input)
              if (templatePickerOpen) return;
              if (isSubmittingInlineRef.current) return;
              if (!inlineValue.trim()) {
                handleCancelInlineCreate();
              } else {
                handleConfirmInlineCreate();
              }
            }}
          />
          {/* Template picker button — only for markdown files */}
          {!isFolder && (
            <button
              type="button"
              title={
                selectedTemplate
                  ? `Template: ${selectedTemplate.title}`
                  : "Usar template"
              }
              onMouseDown={(e) => e.preventDefault()} // prevent input blur
              onClick={(e) => {
                e.stopPropagation();
                setTemplatePickerOpen(true);
              }}
              style={{
                flexShrink: 0,
                padding: "2px 6px",
                borderRadius: "4px",
                border: "1px solid",
                fontSize: "10px",
                cursor: "pointer",
                whiteSpace: "nowrap",
                background: selectedTemplate
                  ? "var(--color-primary-container)"
                  : "transparent",
                color: selectedTemplate
                  ? "var(--color-primary)"
                  : "var(--color-outline)",
                borderColor: selectedTemplate
                  ? "var(--color-primary)"
                  : "var(--color-outline-variant)",
                display: "flex",
                alignItems: "center",
                gap: "3px",
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "12px" }}
              >
                description
              </span>
              {selectedTemplate
                ? selectedTemplate.title.slice(0, 12)
                : "Template"}
            </button>
          )}
        </div>
        {/* Template picker modal — rendered at tree level to avoid z-index issues */}
        <TemplatePickerModal
          isOpen={templatePickerOpen}
          onClose={() => {
            setTemplatePickerOpen(false);
            // Re-focus the input after closing
            setTimeout(() => inlineInputRef.current?.focus(), 50);
          }}
          onSelect={(tpl) => {
            setSelectedTemplate(tpl);
            setTemplatePickerOpen(false);
            setTimeout(() => inlineInputRef.current?.focus(), 50);
          }}
        />
      </>
    );
  };

  // Node Renderer
  const renderTreeNode = (node: TreeNode, repoNameForNode?: string) => {
    const isDir =
      node.type === "dir" || node.type === "directory" || node.is_directory;
    const isFolderExpanded = Boolean(
      expandedFolders[node.path] || (searchTerm && searchTerm.trim()),
    );
    const isFolderSelected = selectedFolder === node.path;
    const isDraggingThis = draggedItem?.path === node.path;
    const isDragOverThis = dragOverTarget === node.path;

    if (isDir) {
      return (
        <div
          key={node.path}
          className={`tree-node ${isDraggingThis ? "is-dragging" : ""}`}
        >
          <div
            className={`tree-folder ${isFolderSelected ? "selected" : ""} ${isDraggingThis ? "is-dragging" : ""} ${isDragOverThis ? "drag-over" : ""}`}
            data-tree-path={node.path}
            draggable
            onDragStart={(e) => handleDragStart(e, node, true, repoNameForNode)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOverFolder(e, node.path)}
            onDragLeave={(e) => handleDragLeaveFolder(e, node.path)}
            onDrop={(e) => handleDropOnFolder(e, node.path, repoNameForNode)}
            onClick={(e) => toggleFolder(node.path, e)}
          >
            <div className="tree-folder-left">
              <span
                className={`tree-caret ${isFolderExpanded ? "expanded" : ""}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transform: isFolderExpanded ? "rotate(90deg)" : "none",
                  transition: "transform 0.15s ease",
                }}
              >
                <ChevronRight size={12} />
              </span>
              {!isFolderExpanded ? (
                <Folder size={14} color="#64748b" style={{ flexShrink: 0 }} />
              ) : (
                <FolderOpen
                  size={14}
                  color="#2563eb"
                  style={{ flexShrink: 0 }}
                />
              )}
              {inlineRenaming && inlineRenaming.path === node.path ? (
                <input
                  ref={inlineRenameInputRef}
                  type="text"
                  className="tree-inline-input"
                  value={inlineRenameValue}
                  onChange={(e) => setInlineRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.stopPropagation();
                      handleConfirmInlineRename();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      e.stopPropagation();
                      handleCancelInlineRename();
                    }
                  }}
                  onBlur={handleConfirmInlineRename}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="tree-folder-name">{node.name}</span>
              )}
            </div>
            <div
              className="tree-folder-actions"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="btn-tree-action"
                title="Novo Arquivo nesta pasta"
                onClick={(e) => startInlineCreate(node.path, false, e)}
              >
                <FilePlus size={12} />
              </button>
              <button
                className="btn-tree-action"
                title="Nova Pasta nesta pasta"
                onClick={(e) => startInlineCreate(node.path, true, e)}
              >
                <FolderPlus size={12} />
              </button>
              <button
                className="btn-tree-action"
                title={`Importar arquivos para ${node.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setTargetUploadFolder(node.path);
                  setTargetUploadRepo(
                    repoNameForNode || activeRepo?.name || "",
                  );
                  fileInputRef.current?.click();
                }}
              >
                <Upload size={12} />
              </button>
              <button
                className="btn-tree-action"
                title={`Abrir pasta "${node.name}" no gerenciador de arquivos do PC`}
                onClick={(e) => handleOpenInOS(node.path, e, repoNameForNode)}
              >
                <Laptop size={12} />
              </button>
              <button
                className="btn-tree-action"
                title="Renomear pasta"
                onClick={(e) =>
                  startInlineRename(node.path, node.name, true, e)
                }
              >
                <Edit3 size={11} />
              </button>
              <button
                className="btn-tree-action delete"
                title="Excluir pasta"
                onClick={(e) =>
                  promptDeleteItem(
                    node.path,
                    node.name,
                    true,
                    repoNameForNode,
                    e,
                  )
                }
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>

          {isFolderExpanded && (
            <div className="tree-children">
              {/* Inline input if creating inside this folder */}
              {renderInlineCreateInput(node.path)}

              {node.children && node.children.length > 0 ? (
                node.children.map((child) =>
                  renderTreeNode(child, repoNameForNode),
                )
              ) : inlineCreating?.parentPath !== node.path ? (
                <div
                  style={{
                    padding: "4px 12px 4px 28px",
                    fontSize: "11px",
                    color: "var(--color-outline, #a6adc8)",
                    fontStyle: "italic",
                    opacity: 0.6,
                    userSelect: "none",
                  }}
                >
                  Pasta vazia
                </div>
              ) : null}
            </div>
          )}
        </div>
      );
    }

    // File Node
    const isMarkdown =
      node.name.endsWith(".md") ||
      node.name.endsWith(".markdown") ||
      node.path.endsWith(".md") ||
      node.path.endsWith(".markdown");
    const isFileActive = activeFile === node.path;
    const fileExt = node.name.includes(".")
      ? (node.name.split(".").pop() || "").toLowerCase()
      : "";

    const dotClass =
      node.name.includes("kpi") || node.path.includes("kpi")
        ? "dot-t0"
        : node.name.includes("ideacao") || node.path.includes("ideacao")
          ? "dot-t1"
          : "dot-t2";

    const badgeClass = node.badge ? node.badge.toLowerCase() : "t1";

    const cleanNodePath = node.path ? node.path.replace(/^\/+/, "") : "";
    const gitFile =
      gitStatusMap.get(cleanNodePath) || gitStatusMap.get(node.path);
    const pendingChange =
      pendingChangesMap.get(cleanNodePath) || pendingChangesMap.get(node.path);
    const gitStatusCode = gitFile
      ? gitFile.status === "??"
        ? "U"
        : gitFile.status
      : pendingChange
        ? pendingChange.type === "ADDED"
          ? "A"
          : "M"
        : null;

    const deptObj = (node as any).department
      ? departmentsMap.get(String((node as any).department).toLowerCase())
      : undefined;
    const isAllowed = canAccessDoc(node as any);
    const isLocked = !isAllowed;
    const hasSecProtection = isLocked || deptObj !== undefined;

    return (
      <div
        key={node.path}
        className={`tree-node ${isDraggingThis ? "is-dragging" : ""}`}
      >
        <div
          className={`tree-file-item ${isFileActive ? "active" : ""} ${!isMarkdown ? "non-markdown" : ""} ${isDraggingThis ? "is-dragging" : ""} ${isDragOverThis ? "drag-over" : ""}`}
          data-tree-path={node.path}
          draggable
          onDragStart={(e) => handleDragStart(e, node, false, repoNameForNode)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOverFile(e, node.path)}
          onDragLeave={(e) => handleDragLeaveFile(e, node.path)}
          onDrop={(e) => handleDropOnFile(e, node.path, repoNameForNode)}
          onClick={() => handleFileClick(node.path, node.name, repoNameForNode)}
          title={`Abrir ${node.name}`}
        >
          <div className="tree-file-left">
            {isMarkdown ? (
              <span className={`tree-dot ${dotClass}`}></span>
            ) : ["csv", "tsv", "xlsx", "xls"].includes(
                fileExt.toLowerCase(),
              ) ? (
              <FileSpreadsheet
                size={13}
                color="#a6e3a1"
                style={{ flexShrink: 0 }}
              />
            ) : ["pdf"].includes(fileExt.toLowerCase()) ? (
              <FileText size={13} color="#f38ba8" style={{ flexShrink: 0 }} />
            ) : ["docx", "doc"].includes(fileExt.toLowerCase()) ? (
              <FileText size={13} color="#89b4fa" style={{ flexShrink: 0 }} />
            ) : ["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(
                fileExt.toLowerCase(),
              ) ? (
              <ImageIcon size={13} color="#fab387" style={{ flexShrink: 0 }} />
            ) : (
              <FileCode size={13} color="#89b4fa" style={{ flexShrink: 0 }} />
            )}
            {inlineRenaming && inlineRenaming.path === node.path ? (
              <input
                ref={inlineRenameInputRef}
                type="text"
                className="tree-inline-input"
                value={inlineRenameValue}
                onChange={(e) => setInlineRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    handleConfirmInlineRename();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCancelInlineRename();
                  }
                }}
                onBlur={handleConfirmInlineRename}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="tree-file-name">{node.name}</span>
            )}
            {gitStatusCode && (
              <span
                className="tree-git-status-badge"
                title={
                  gitStatusCode === "M"
                    ? "Documento Alterado (Rascunho)"
                    : gitStatusCode === "A"
                      ? "Documento Adicionado"
                      : gitStatusCode === "U"
                        ? "Novo Documento"
                        : "Alterado"
                }
                style={{
                  fontSize: "9.5px",
                  fontWeight: 800,
                  padding: "1px 4px",
                  borderRadius: "3px",
                  fontFamily: "var(--font-mono)",
                  background:
                    gitStatusCode === "M"
                      ? "rgba(234, 179, 8, 0.2)"
                      : gitStatusCode === "A" || gitStatusCode === "U"
                        ? "rgba(34, 197, 94, 0.2)"
                        : "rgba(239, 68, 68, 0.2)",
                  color:
                    gitStatusCode === "M"
                      ? "#d97706"
                      : gitStatusCode === "A" || gitStatusCode === "U"
                        ? "#16a34a"
                        : "#dc2626",
                  marginLeft: "4px",
                  lineHeight: "1.2",
                }}
              >
                {gitStatusCode}
              </span>
            )}
          </div>
          <div className="tree-file-right">
            {hasSecProtection && deptObj && (
              <span
                className="tree-badge-security"
                title={`Cofre: ${deptObj.name} - ${isLocked ? "Bloqueado por Chave de Cofre" : "Acesso Autorizado"}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "3px",
                  fontSize: "9px",
                  fontWeight: 700,
                  padding: "1px 5px",
                  borderRadius: "10px",
                  backgroundColor: `${deptObj.color}18`,
                  color: deptObj.color,
                  border: `1px solid ${deptObj.color}40`,
                  marginRight: "4px",
                  lineHeight: "1.2",
                  flexShrink: 0,
                }}
              >
                {isLocked ? (
                  <Lock size={9} style={{ flexShrink: 0 }} />
                ) : (
                  <Shield size={9} style={{ flexShrink: 0 }} />
                )}
                <span>{deptObj.name.split("/")[0].trim()}</span>
              </span>
            )}
            {!isMarkdown && fileExt && (
              <span className="tree-badge-unsupported">{fileExt}</span>
            )}
            {isMarkdown && node.badge && (
              <span className={`tree-badge-mini ${badgeClass}`}>
                {node.badge}
              </span>
            )}
            <div
              className="tree-file-actions"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="btn-tree-action"
                title={`Abrir "${node.name}" no gerenciador de arquivos do PC`}
                onClick={(e) => handleOpenInOS(node.path, e, repoNameForNode)}
              >
                <Laptop size={11} />
              </button>
              <button
                className="btn-tree-action"
                title={`Duplicar "${node.name}"`}
                onClick={(e) =>
                  handleDuplicateFile(node.path, repoNameForNode, e)
                }
              >
                <Copy size={11} />
              </button>
              <button
                className="btn-tree-action"
                title="Renomear"
                onClick={(e) =>
                  startInlineRename(node.path, node.name, false, e)
                }
              >
                <Edit3 size={11} />
              </button>
              <button
                className="btn-tree-action delete"
                title="Excluir"
                onClick={(e) =>
                  promptDeleteItem(
                    node.path,
                    node.name,
                    false,
                    repoNameForNode,
                    e,
                  )
                }
              >
                <Trash2 size={11} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isCollapsed) {
    return (
      <button
        id="btn-expand-tree-pane"
        className="btn-expand-sidebar"
        title="Expandir Árvore"
        onClick={onToggleCollapse}
      >
        <span>›</span>
      </button>
    );
  }

  const selectedFolderName = selectedFolder
    ? selectedFolder.split("/").pop() || selectedFolder
    : "";

  return (
    <>
      <aside
        className={`workbench-tree-pane ${isExternalDragActive ? "is-drag-active" : ""}`}
        id="workbench-tree-pane"
        style={{ width: width ? `${width}px` : undefined }}
        onClick={() => setSelectedFolder("")}
        onDragEnter={handlePaneDragEnter}
        onDragLeave={handlePaneDragLeave}
      >
        {/* TOP SECTION: Search Bar + Actions Toolbar */}
        <div
          className="tree-top-container"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Input Bar */}
          <div className="tree-search-wrapper">
            <span className="tree-search-icon">
              <Search size={13} color="#94a3b8" />
            </span>
            <input
              type="text"
              id="tree-search-input"
              className="tree-search-input"
              placeholder="Buscar arquivos..."
              spellCheck="false"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                className="tree-search-clear"
                title="Limpar busca"
                onClick={() => setSearchTerm("")}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Action Toolbar Below Search Bar */}
          <div className="tree-toolbar-row">
            <div className="tree-toolbar-icons">
              {/* Novo Repositório */}
              <button
                id="btn-tree-create-root-repo"
                className="btn-tree-tool btn-tree-tool-repo"
                title="Novo repositório"
                onClick={() => {
                  if (canCreateRootRepo) {
                    setCreateRepoModalOpen(true);
                  } else {
                    showToast(
                      "Apenas administradores ou proprietários da organização podem criar repositórios raiz.",
                      "warning",
                    );
                  }
                }}
              >
                <FolderGit2 size={14} color="#2563eb" />
              </button>

              {/* Novo Arquivo */}
              <button
                id="btn-tree-new-file"
                className="btn-tree-tool"
                title={
                  selectedFolder
                    ? `Novo Arquivo em /${selectedFolderName}`
                    : activeRepo?.name
                      ? `Novo Arquivo na raiz de ${activeRepo.name}`
                      : "Novo Arquivo no repositório ativo"
                }
                onClick={() => startInlineCreate(selectedFolder, false)}
              >
                <FilePlus size={14} />
              </button>

              {/* Nova Pasta */}
              <button
                id="btn-tree-new-folder"
                className="btn-tree-tool"
                title={
                  selectedFolder
                    ? `Nova Pasta em /${selectedFolderName}`
                    : activeRepo?.name
                      ? `Nova Pasta na raiz de ${activeRepo.name}`
                      : "Nova Pasta no repositório ativo"
                }
                onClick={() => startInlineCreate(selectedFolder, true)}
              >
                <FolderPlus size={14} />
              </button>

              {/* Importar Documentos */}
              <button
                id="btn-tree-import-file"
                className="btn-tree-tool"
                title={
                  selectedFolder
                    ? `Importar Documentos em /${selectedFolderName}`
                    : activeRepo?.name
                      ? `Importar Documentos na raiz de ${activeRepo.name}`
                      : "Importar Documentos"
                }
                onClick={() => {
                  setTargetUploadFolder(selectedFolder || "");
                  setTargetUploadRepo(activeRepo?.name || "");
                  fileInputRef.current?.click();
                }}
              >
                <Upload size={13} />
              </button>

              {/* Abrir no PC */}
              <button
                id="btn-tree-open-os"
                className="btn-tree-tool"
                title={
                  selectedFolder
                    ? `Abrir pasta /${selectedFolderName} no gerenciador de arquivos do PC`
                    : activeRepo?.name
                      ? `Abrir repositório "${activeRepo.name}" no gerenciador de arquivos do PC`
                      : "Abrir pasta do projeto no gerenciador de arquivos do PC"
                }
                onClick={(e) =>
                  handleOpenInOS(selectedFolder || "", e, activeRepo?.name)
                }
              >
                <Laptop size={13} />
              </button>

              {/* Expandir Todas as Pastas e Repositórios */}
              <button
                id="btn-tree-expand-all"
                className="btn-tree-tool"
                title="Expandir Todas as Pastas e Repositórios"
                onClick={handleExpandAllFolders}
              >
                <ChevronsUpDown size={14} />
              </button>

              {/* Recolher Todas as Pastas */}
              <button
                id="btn-tree-collapse-all"
                className="btn-tree-tool"
                title="Recolher Todas as Pastas"
                onClick={handleCollapseAllFolders}
              >
                <ChevronsDownUp size={14} />
              </button>

              {/* Atualizar Árvore */}
              <button
                id="btn-tree-refresh"
                className={`btn-tree-tool ${isTreeLoading ? "spinning" : ""}`}
                title={
                  isTreeLoading ? "Carregando arquivos..." : "Atualizar Árvore"
                }
                onClick={handleRefreshAll}
                disabled={isTreeLoading}
              >
                <RefreshCw
                  size={13}
                  className={isTreeLoading ? "spinning" : ""}
                />
              </button>

              {/* Recolher Painel Lateral */}
              <button
                id="btn-toggle-tree-pane"
                className="btn-tree-tool"
                title="Recolher Painel Lateral"
                onClick={onToggleCollapse}
              >
                <ChevronLeft size={14} />
              </button>
            </div>
          </div>
          {isTreeLoading && (
            <div
              className="tree-progress-track"
              title="Sincronizando arquivos com o disco..."
            >
              <div className="tree-progress-bar"></div>
            </div>
          )}
        </div>

        {/* Tree Hierarchy Container */}
        <div
          ref={treeScrollRef}
          className="tree-scroll-container"
          onScroll={handleTreeScroll}
          onDragOver={handleDragOverRoot}
          onDragLeave={handleDragLeaveRoot}
          onDrop={handleDropOnRoot}
        >
          <div
            id="tree-nodes-container"
            className={`agent-tree-root ${isDragOverRoot ? "drag-over-root" : ""}`}
          >
            {isTreeLoading &&
            displayNodes.length === 0 &&
            orgRepos.length === 0 ? (
              <div
                className="tree-skeleton-container"
                aria-label="Carregando estrutura de arquivos"
              >
                <div className="tree-loading-pill">
                  <span
                    className="material-symbols-outlined spinning"
                    style={{ fontSize: "14px" }}
                  >
                    progress_activity
                  </span>
                  <span>Carregando repositórios...</span>
                </div>
                <div className="tree-skeleton-list">
                  <div className="tree-skeleton-row indent-0">
                    <div className="skeleton-icon" />
                    <div className="skeleton-line" style={{ width: "65%" }} />
                  </div>
                  <div className="tree-skeleton-row indent-1">
                    <div className="skeleton-icon" />
                    <div className="skeleton-line" style={{ width: "45%" }} />
                  </div>
                  <div className="tree-skeleton-row indent-1">
                    <div className="skeleton-icon" />
                    <div className="skeleton-line" style={{ width: "70%" }} />
                  </div>
                  <div className="tree-skeleton-row indent-0">
                    <div className="skeleton-icon" />
                    <div className="skeleton-line" style={{ width: "55%" }} />
                  </div>
                </div>
              </div>
            ) : orgRepos.length === 0 && !inlineCreating ? (
              <div
                className="tree-empty-state"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  padding: "28px 14px",
                  gap: "8px",
                  width: "100%",
                  boxSizing: "border-box",
                }}
              >
                <div style={{ marginBottom: "4px" }}>
                  <Building2 size={24} color="#94a3b8" />
                </div>
                <strong
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--text-normal)",
                    margin: 0,
                  }}
                >
                  Nenhum repositório na organização
                </strong>
                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--text-muted)",
                    margin: 0,
                    lineHeight: 1.4,
                  }}
                >
                  {canCreateRootRepo
                    ? "Crie o primeiro repositório da organização para começar a documentar."
                    : "Você não possui repositórios visíveis nesta organização."}
                </p>
                {canCreateRootRepo && (
                  <button
                    className="btn btn-primary btn-sm"
                    style={{
                      marginTop: "6px",
                      fontSize: "11px",
                      padding: "6px 12px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                    onClick={() => setCreateRepoModalOpen(true)}
                  >
                    <FolderPlus size={13} />
                    <span>Novo Repositório</span>
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Árvore de Documentos Multi-Repo Unificada (Nível 0 = Repositórios) */}
                <div className="tree-repos-container">
                  {orgRepos.map((r) => {
                    const isActive =
                      r.name.toLowerCase() === activeRepo?.name.toLowerCase();
                    const isCollapsed = collapsedRepos[r.name] ?? !isActive;
                    const repoDisplayNodes = !isCollapsed
                      ? getDisplayNodesForRepo(r.name)
                      : [];
                    const isRepoLoading = Boolean(
                      loadingRepos[r.name] ||
                      (isActive &&
                        isTreeLoading &&
                        repoDisplayNodes.length === 0),
                    );
                    const isLocked =
                      Boolean(r.is_locked) ||
                      (r.permissions &&
                        !r.permissions.pull &&
                        !r.permissions.admin);
                    const canAdminRepo = Boolean(
                      r.permissions?.admin || r.is_owner || canCreateRootRepo,
                    );

                    if (isLocked) {
                      return (
                        <div
                          key={`org-repo-locked-${r.name}`}
                          onClick={() => setLockedRepoTarget(r)}
                          className="tree-repo-header"
                          style={{ opacity: 0.75 }}
                          title={`Repositório restrito: ${r.name}. Clique para detalhes.`}
                        >
                          <div className="tree-repo-left">
                            <Lock
                              size={13}
                              color="#ef4444"
                              style={{ flexShrink: 0 }}
                            />
                            <span
                              className="tree-repo-name"
                              style={{ color: "var(--text-heading)" }}
                            >
                              {r.name}
                            </span>
                          </div>
                          <span className="tree-repo-badge locked">
                            Sem Acesso
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={`org-repo-node-${r.name}`}
                        className="tree-repo-root-item"
                      >
                        {/* Linha da Pasta Raiz (Repositório) */}
                        <div
                          className={`tree-repo-header ${isActive ? "is-active" : ""} ${dragOverTarget === `__repo__:${r.name}` ? "drag-over" : ""}`}
                          onClick={(e) => handleSelectRepo(r, e)}
                          onDragOver={(e) => handleDragOverRepo(e, r.name)}
                          onDragLeave={(e) => handleDragLeaveRepo(e, r.name)}
                          onDrop={(e) => handleDropOnRepo(e, r.name)}
                        >
                          <div className="tree-repo-left">
                            <span
                              className="tree-caret"
                              style={{
                                transform: !isCollapsed
                                  ? "rotate(90deg)"
                                  : "none",
                              }}
                              onClick={(e) => toggleRepoCollapse(r, e)}
                            >
                              <ChevronRight size={12} />
                            </span>

                            <FolderGit2
                              size={14}
                              color={
                                isActive ? "var(--primary, #2563eb)" : "#64748b"
                              }
                              style={{ flexShrink: 0 }}
                            />

                            <span className="tree-repo-name">{r.name}</span>

                            {dragOverTarget === `__repo__:${r.name}` && (
                              <span
                                className="tree-repo-drop-hint"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "3px",
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  color: "var(--primary, #2563eb)",
                                  backgroundColor: "rgba(37, 99, 235, 0.14)",
                                  padding: "1px 6px",
                                  borderRadius: "4px",
                                  marginLeft: "6px",
                                }}
                              >
                                Soltar na raiz
                              </span>
                            )}

                            {isActive && (
                              <span
                                className="tree-repo-active-dot"
                                title="Repositório ativo"
                              />
                            )}
                          </div>

                          {/* Ações de Contexto no Nível Raiz do Repositório */}
                          <div
                            className="tree-repo-actions"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* 1. Governança & Acessos */}
                            <button
                              type="button"
                              className="btn-tree-action"
                              title="Governança & Acessos do Repositório"
                              onClick={() => setGovernanceRepoTarget(r)}
                            >
                              <Shield size={12} />
                            </button>

                            {/* 2. Sincronizar Git */}
                            <button
                              type="button"
                              className={`btn-tree-action ${loadingRepos[r.name] ? "is-loading" : ""}`}
                              title={
                                loadingRepos[r.name]
                                  ? "Sincronizando..."
                                  : "Sincronizar Repositório"
                              }
                              disabled={loadingRepos[r.name]}
                              onClick={async (e) => {
                                e.stopPropagation();
                                setLoadingRepos((prev) => ({
                                  ...prev,
                                  [r.name]: true,
                                }));
                                try {
                                  if (r.is_cloned_locally) {
                                    await pullLocalRepo(r);
                                  }
                                  if (isActive) {
                                    await refreshGitStatus();
                                  }
                                  await loadTree(r.name);
                                } finally {
                                  setLoadingRepos((prev) => ({
                                    ...prev,
                                    [r.name]: false,
                                  }));
                                }
                              }}
                            >
                              <RefreshCw
                                size={12}
                                className={
                                  loadingRepos[r.name] ? "spinning" : ""
                                }
                              />
                            </button>

                            {/* 3. Abrir Repositório no Gerenciador de Arquivos do PC */}
                            <button
                              type="button"
                              className="btn-tree-action"
                              title={`Abrir repositório "${r.name}" no gerenciador de arquivos do PC`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenInOS("", e, r.name);
                              }}
                            >
                              <Laptop size={12} />
                            </button>

                            {/* 4. Importar Arquivos na Raiz deste Repositório */}
                            <button
                              type="button"
                              className="btn-tree-action"
                              title={`Importar arquivos na raiz de "${r.name}"`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setTargetUploadFolder("");
                                setTargetUploadRepo(r.name);
                                fileInputRef.current?.click();
                              }}
                            >
                              <Upload size={12} />
                            </button>

                            {/* 5. Novo Arquivo na Raiz deste Repo */}
                            <button
                              type="button"
                              className="btn-tree-action"
                              title="Novo Arquivo neste repositório"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!isActive) await handleSelectRepo(r);
                                startInlineCreate("", false);
                              }}
                            >
                              <FilePlus size={12} />
                            </button>

                            {/* 6. Nova Pasta na Raiz deste Repo */}
                            <button
                              type="button"
                              className="btn-tree-action"
                              title="Nova Pasta neste repositório"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!isActive) await handleSelectRepo(r);
                                startInlineCreate("", true);
                              }}
                            >
                              <FolderPlus size={12} />
                            </button>

                            {/* 5. Excluir Repositório (Apenas Admin/Owner) */}
                            {canAdminRepo && (
                              <button
                                type="button"
                                className="btn-tree-action delete"
                                title="Excluir Repositório"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteRepoTarget(r);
                                }}
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Conteúdo Expandido do Repositório */}
                        {!isCollapsed && (
                          <div
                            className={`tree-repo-children-container ${dragOverTarget === `__repo__:${r.name}` ? "drag-over-repo-container" : ""}`}
                            onDragOver={(e) => handleDragOverRepo(e, r.name)}
                            onDragLeave={(e) => handleDragLeaveRepo(e, r.name)}
                            onDrop={(e) => handleDropOnRepo(e, r.name)}
                          >
                            {/* Indicador de Sincronização / Pull com Porcentagem Real */}
                            {(loadingRepos[r.name] ||
                              (repoProgress[r.name] &&
                                repoProgress[r.name].percent < 100)) && (
                              <div
                                className="tree-repo-sync-indicator"
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "4px",
                                  padding: "6px 10px",
                                  fontSize: "11px",
                                  fontWeight: 500,
                                  color: "var(--primary, #2563eb)",
                                  backgroundColor: "rgba(37, 99, 235, 0.08)",
                                  borderRadius: "6px",
                                  margin: "2px 8px 6px 8px",
                                  border: "1px solid rgba(37, 99, 235, 0.15)",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    width: "100%",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "6px",
                                    }}
                                  >
                                    <span
                                      className="material-symbols-outlined spinning"
                                      style={{ fontSize: "13px" }}
                                    >
                                      progress_activity
                                    </span>
                                    <span>
                                      {repoProgress[r.name]?.stage ||
                                        "Sincronizando..."}
                                    </span>
                                  </div>
                                  {repoProgress[r.name]?.percent !==
                                    undefined && (
                                    <span
                                      style={{
                                        fontWeight: 700,
                                        fontSize: "10.5px",
                                      }}
                                    >
                                      {repoProgress[r.name].percent}%
                                    </span>
                                  )}
                                </div>
                                <div
                                  style={{
                                    width: "100%",
                                    height: "3px",
                                    backgroundColor: "rgba(37, 99, 235, 0.2)",
                                    borderRadius: "2px",
                                    overflow: "hidden",
                                  }}
                                >
                                  <div
                                    style={{
                                      height: "100%",
                                      width:
                                        repoProgress[r.name]?.percent !==
                                        undefined
                                          ? `${repoProgress[r.name].percent}%`
                                          : "30%",
                                      backgroundColor:
                                        "var(--primary, #2563eb)",
                                      borderRadius: "2px",
                                      transition: "width 0.15s ease",
                                    }}
                                  />
                                </div>
                              </div>
                            )}

                            {isActive && renderInlineCreateInput("")}
                            {repoDisplayNodes.length > 0 ? (
                              repoDisplayNodes.map((node: TreeNode) =>
                                renderTreeNode(node, r.name),
                              )
                            ) : isRepoLoading ? (
                              <></>
                            ) : !r.is_cloned_locally ? (
                              <div
                                className="tree-repo-empty-hint"
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  gap: "8px",
                                  padding: "16px 12px",
                                  textAlign: "center",
                                  backgroundColor:
                                    "var(--md-sys-color-surface-container-low, #f8f9fa)",
                                  borderRadius: "8px",
                                  margin: "4px 8px 8px 8px",
                                  border:
                                    "1px dashed var(--md-sys-color-outline-variant, #dadce0)",
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: "12px",
                                    fontWeight: 500,
                                    color:
                                      "var(--md-sys-color-on-surface, #202124)",
                                  }}
                                >
                                  Repositório Remoto (GitHub)
                                </span>
                                <span
                                  style={{
                                    fontSize: "11px",
                                    color:
                                      "var(--md-sys-color-on-surface-variant, #5f6368)",
                                    lineHeight: 1.3,
                                  }}
                                >
                                  Clone os arquivos para editar e propor
                                  alterações.
                                </span>
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  style={{
                                    fontSize: "11.5px",
                                    fontWeight: 600,
                                    padding: "5px 10px",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "5px",
                                    borderRadius: "6px",
                                    marginTop: "2px",
                                  }}
                                  disabled={loadingRepos[r.name]}
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    setLoadingRepos((prev) => ({
                                      ...prev,
                                      [r.name]: true,
                                    }));
                                    try {
                                      await cloneLocalRepo(r);
                                    } finally {
                                      setLoadingRepos((prev) => ({
                                        ...prev,
                                        [r.name]: false,
                                      }));
                                    }
                                  }}
                                >
                                  {loadingRepos[r.name] ? (
                                    <span
                                      className="material-symbols-outlined spinning"
                                      style={{ fontSize: "14px" }}
                                    >
                                      progress_activity
                                    </span>
                                  ) : (
                                    <Upload size={12} />
                                  )}
                                  <span>Trabalhar localmente</span>
                                </button>
                              </div>
                            ) : !inlineCreating ? (
                              <div
                                className="tree-repo-empty-hint"
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  gap: "8px",
                                  padding: "16px 12px",
                                  textAlign: "center",
                                  border:
                                    dragOverTarget === `__repo__:${r.name}`
                                      ? "1.5px dashed var(--primary, #2563eb)"
                                      : undefined,
                                  backgroundColor:
                                    dragOverTarget === `__repo__:${r.name}`
                                      ? "rgba(37, 99, 235, 0.05)"
                                      : undefined,
                                  borderRadius: "6px",
                                  transition: "all 0.15s ease",
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: "12px",
                                    color: "var(--text-muted)",
                                  }}
                                >
                                  Nenhum arquivo encontrado neste repositório.
                                </span>
                                <div
                                  style={{
                                    display: "flex",
                                    gap: "6px",
                                    width: "100%",
                                    maxWidth: "220px",
                                  }}
                                >
                                  <button
                                    className="btn btn-primary btn-sm"
                                    style={{
                                      flex: 1,
                                      fontSize: "11px",
                                      padding: "4px 6px",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      gap: "4px",
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!isActive) handleSelectRepo(r);
                                      startInlineCreate("", false);
                                    }}
                                  >
                                    <FilePlus size={12} />
                                    <span>Novo Arquivo</span>
                                  </button>
                                  <button
                                    className="btn btn-ghost btn-sm"
                                    style={{
                                      flex: 1,
                                      fontSize: "11px",
                                      padding: "4px 6px",
                                      border: "1px solid var(--border)",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      gap: "4px",
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!isActive) handleSelectRepo(r);
                                      startInlineCreate("", true);
                                    }}
                                  >
                                    <FolderPlus size={12} />
                                    <span>Nova Pasta</span>
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Drag Overlay Feedback - 100% transparent background with bottom floating pill */}
          {isExternalDragActive && (
            <div
              className="tree-drag-overlay"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="tree-drag-overlay-card">
                <div className="tree-drag-overlay-icon">
                  <Upload size={12} color="#60a5fa" />
                </div>
                <div className="tree-drag-overlay-text">
                  <span>Soltar em:</span>
                  <code>
                    {dragOverTarget
                      ? `/${dragOverTarget}`
                      : selectedFolder
                        ? `/${selectedFolder}`
                        : "raiz"}
                  </code>
                </div>
              </div>
            </div>
          )}

          {/* Import Progress Loading Overlay - strictly bounded to tree scroll area */}
          {isImporting && (
            <div className="tree-import-loading-overlay">
              <div className="tree-import-loading-card">
                <RefreshCw size={18} className="spinning" color="#2563eb" />
                <span className="tree-import-loading-msg">
                  {importProgressMessage || "Importando arquivos..."}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Hidden File and Folder Input Elements */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={async (e) => {
            if (e.target.files && e.target.files.length > 0) {
              const scanned = filesToScannedList(e.target.files);
              await handleImportFiles(
                scanned,
                targetUploadFolder,
                targetUploadRepo,
              );
              e.target.value = "";
            }
          }}
        />
        <input
          ref={folderInputRef}
          type="file"
          // @ts-ignore
          webkitdirectory=""
          directory=""
          multiple
          style={{ display: "none" }}
          onChange={async (e) => {
            if (e.target.files && e.target.files.length > 0) {
              const scanned = filesToScannedList(e.target.files);
              await handleImportFiles(
                scanned,
                targetUploadFolder,
                targetUploadRepo,
              );
              e.target.value = "";
            }
          }}
        />

        {/* Tree Pane Floating Toast Notifications */}
        {toast && (
          <div className="tree-toast-container">
            <div className={`tree-toast ${toast.type}`}>
              {toast.type === "warning" && (
                <AlertCircle
                  size={14}
                  color="#fbbf24"
                  style={{ flexShrink: 0 }}
                />
              )}
              <span>{toast.message}</span>
            </div>
          </div>
        )}
      </aside>

      {/* Modal de Repositório Bloqueado */}
      <LockedRepoModal
        isOpen={Boolean(lockedRepoTarget)}
        onClose={() => setLockedRepoTarget(null)}
        repo={lockedRepoTarget}
        orgName={activeOrg?.login}
      />

      {/* Modal de Criação de Pasta Raiz (Repositório) */}
      <CreateRepoModal
        isOpen={createRepoModalOpen}
        onClose={() => setCreateRepoModalOpen(false)}
        defaultOwner={activeOrg?.login}
        onCreated={async (newRepo) => {
          await loadRepos();
          navigate(`/repo/${encodeURIComponent(newRepo.name)}/editor`);
          await selectRepo(newRepo);
          setCreateRepoModalOpen(false);
          showToast(`Repositório ${newRepo.name} criado com sucesso!`, "info");
        }}
      />

      {/* Modal de Exclusão de Repositório Raiz */}
      <DeleteRepoModal
        isOpen={Boolean(deleteRepoTarget)}
        onClose={() => setDeleteRepoTarget(null)}
        repo={deleteRepoTarget}
        onDeleted={async () => {
          const target = deleteRepoTarget;
          setDeleteRepoTarget(null);
          await loadRepos();
          showToast("Repositório removido.", "info");
          if (
            target &&
            activeRepo &&
            target.name.toLowerCase() === activeRepo.name.toLowerCase()
          ) {
            const remaining = repos.filter(
              (x) => x.name.toLowerCase() !== target.name.toLowerCase(),
            );
            if (remaining.length > 0) {
              const r = remaining[0];
              const rOwner =
                r.owner ||
                (r.full_name?.includes("/") ? r.full_name.split("/")[0] : "");
              const rName =
                r.name ||
                (r.full_name?.includes("/")
                  ? r.full_name.split("/")[1]
                  : r.full_name) ||
                "";
              if (rOwner && rOwner !== "local" && rOwner !== "personal") {
                navigate(
                  `/org/${encodeURIComponent(rOwner)}/repo/${encodeURIComponent(rName)}/editor`,
                );
              } else {
                navigate(`/repo/${encodeURIComponent(rName)}/editor`);
              }
              await selectRepo(r);
            } else {
              navigate("/");
            }
          }
        }}
      />

      {/* Modal de Confirmação de Exclusão de Arquivo / Pasta */}
      <Modal
        isOpen={Boolean(deleteItemTarget)}
        onClose={() => !isDeletingItem && setDeleteItemTarget(null)}
        title={deleteItemTarget?.isFolder ? "Excluir Pasta" : "Excluir Arquivo"}
        size="sm"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              padding: "12px 14px",
              borderRadius: "var(--radius-md, 8px)",
              backgroundColor: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
            }}
          >
            <AlertTriangle
              size={20}
              style={{ color: "#ef4444", flexShrink: 0, marginTop: 2 }}
            />
            <div
              style={{
                fontSize: "13px",
                lineHeight: "1.5",
                color: "var(--text-primary)",
              }}
            >
              Tem certeza que deseja excluir{" "}
              {deleteItemTarget?.isFolder ? "a pasta" : "o arquivo"}{" "}
              <strong>"{deleteItemTarget?.name}"</strong>?
              {deleteItemTarget?.isFolder && (
                <div
                  style={{
                    fontSize: "11.5px",
                    color: "var(--text-muted)",
                    marginTop: 4,
                  }}
                >
                  Todos os arquivos e subpastas internos também serão excluídos.
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              marginTop: 6,
            }}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteItemTarget(null)}
              disabled={isDeletingItem}
            >
              Cancelar
            </Button>
            <Button
              id="btn-confirm-delete-tree-item"
              variant="danger"
              size="sm"
              isLoading={isDeletingItem}
              icon={<Trash2 size={14} />}
              onClick={handleConfirmDeleteItem}
            >
              Excluir
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de Governança & Acessos do Repositório */}
      {governanceRepoTarget && (
        <RepoGovernanceModal
          isOpen={Boolean(governanceRepoTarget)}
          onClose={() => setGovernanceRepoTarget(null)}
          orgLogin={governanceRepoTarget.owner || activeOrg?.login || "local"}
          repoName={governanceRepoTarget.name}
        />
      )}
    </>
  );
};
