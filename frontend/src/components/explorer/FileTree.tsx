import React, { useState, useMemo, useRef, useEffect } from "react";
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
} from "lucide-react";
import type { TreeNode, TemplateItem } from "../../types";
import { useWorkspace } from "../../context/WorkspaceContext";
import { API } from "../../services/api";
import { TemplatePickerModal } from "../modals/TemplatePickerModal";

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
}

interface ScannedFile {
  file: File;
  relativePath: string;
}

// Utility: Recursively scan files and folders dropped from OS / Finder
const scanDataTransferItems = async (items: DataTransferItemList): Promise<ScannedFile[]> => {
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
        console.warn("[FileTree] Falha ao ler arquivo de entrada:", entry.name, err);
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
        const nextPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
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
      const entry = (item as any).webkitGetAsEntry ? (item as any).webkitGetAsEntry() : null;
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
    "md", "markdown", "txt", "json", "yaml", "yml", "csv", "tsv",
    "js", "ts", "jsx", "tsx", "html", "css", "scss", "svg", "xml",
    "env", "sh", "py", "sql", "gitignore", "conf", "ini", "toml"
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
    const ext = name.includes(".") ? name.split(".").pop()?.toLowerCase() || "" : "";
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

export const FileTree: React.FC<FileTreeProps> = ({
  onOpenFile,
  isCollapsed,
  onToggleCollapse,
  width,
}) => {
  const {
    tree,
    activeFile,
    loadTree,
    gitStatus,
    pendingChanges,
    refreshPendingChanges,
    refreshGitStatus,
    isLoadingWorkspace,
    isLoadingTree,
  } = useWorkspace();
  const isTreeLoading = Boolean(isLoadingWorkspace || isLoadingTree);
  const [searchTerm, setSearchTerm] = useState("");
  const [collapsedFolders, setCollapsedFolders] = useState<
    Record<string, boolean>
  >({});
  const [selectedFolder, setSelectedFolder] = useState<string>("");

  // Drag and Drop State (Internal Move & External Import)
  const [draggedItem, setDraggedItem] = useState<DraggedItem | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [isDragOverRoot, setIsDragOverRoot] = useState(false);
  const [isExternalDragActive, setIsExternalDragActive] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgressMessage, setImportProgressMessage] = useState("");
  const [targetUploadFolder, setTargetUploadFolder] = useState<string>("");
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
        setCollapsedFolders((prev) => {
          const updated = { ...prev };
          for (const p of parentPaths) {
            updated[p] = false;
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
  ) => {
    if (!scannedFiles || scannedFiles.length === 0) return;

    setIsImporting(true);
    const count = scannedFiles.length;
    setImportProgressMessage(
      `Lendo e processando ${count} arquivo${count > 1 ? "s" : ""}...`,
    );

    try {
      const filesPayload = await processFilesForUpload(scannedFiles);
      setImportProgressMessage(
        `Importando para ${targetFolder ? `/${targetFolder}` : "a raiz"}...`,
      );

      const res = await API.importFiles({
        target_folder: targetFolder,
        files: filesPayload,
      });

      if (res.ok && res.data?.success) {
        await loadTree();
        await Promise.all([refreshPendingChanges(), refreshGitStatus()]);

        const imported = res.data.importedFiles || [];
        const destLabel = targetFolder ? `/${targetFolder}` : "a raiz do projeto";
        showToast(
          `${imported.length} arquivo${imported.length > 1 ? "s" : ""} importado${imported.length > 1 ? "s" : ""} com sucesso em ${destLabel}!`,
          "info",
        );

        if (targetFolder) {
          setCollapsedFolders((prev) => ({ ...prev, [targetFolder]: false }));
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
  ) => {
    e.stopPropagation();
    const item: DraggedItem = {
      path: node.path,
      name: node.name,
      isFolder,
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

      // If the folder is collapsed, auto-expand it after 400ms of hovering
      if (collapsedFolders[folderPath]) {
        dragHoverTimerRef.current = setTimeout(() => {
          setCollapsedFolders((prev) => ({ ...prev, [folderPath]: false }));
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
    const { path: sourcePath, name: itemName, isFolder } = draggedItem;
    setDraggedItem(null);

    if (sourcePath === targetFolderPath) return;
    if (isFolder && folderPathEqualOrChild(targetFolderPath, sourcePath)) {
      showToast(
        "Não é possível mover uma pasta para dentro de si mesma.",
        "warning",
      );
      return;
    }

    const targetPath = `${targetFolderPath}/${itemName}`;
    if (sourcePath === targetPath) return;

    await executeMove(sourcePath, targetPath, itemName, targetFolderPath);
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

    const { path: sourcePath, name: itemName, isFolder } = draggedItem;
    setDraggedItem(null);

    if (sourcePath === targetFilePath) return;

    if (
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
    if (sourcePath === targetPath) return;

    await executeMove(sourcePath, targetPath, itemName, parentDir || "raiz");
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

    await executeMove(sourcePath, targetPath, itemName, "raiz");
  };

  const executeMove = async (
    old_path: string,
    new_path: string,
    itemName: string,
    destinationLabel: string,
  ) => {
    try {
      const res = await API.renameProjectFile({ old_path, new_path });
      if (res.ok && res.data?.success) {
        await loadTree();
        await Promise.all([refreshPendingChanges(), refreshGitStatus()]);
        if (activeFile === old_path) {
          onOpenFile(new_path);
        } else if (activeFile && activeFile.startsWith(`${old_path}/`)) {
          const rel = activeFile.slice(old_path.length);
          onOpenFile(`${new_path}${rel}`);
        }
        showToast(
          `"${itemName}" movido para ${destinationLabel === "raiz" ? "a raiz" : `"${destinationLabel}"`}.`,
          "info",
        );
      } else {
        showToast(
          `Erro ao mover: ${res.data?.error || "Falha ao mover item"}`,
          "warning",
        );
      }
    } catch (err) {
      showToast("Erro ao conectar ao servidor para mover o item.", "warning");
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

    // Ensure parent folder is expanded so inline input is visible
    if (parentPath) {
      setCollapsedFolders((prev) => ({
        ...prev,
        [parentPath]: false,
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
        meta: !isFolder
          ? {
              title: docTitle,
              status: "draft",
              categories: "geral",
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

        await loadTree();
        await Promise.all([refreshPendingChanges(), refreshGitStatus()]);
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
  const handleOpenInOS = async (path: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const res = await API.openInOS(path);
      if (res.ok) {
        showToast("Aberto no gerenciador de arquivos do PC.", "info");
      } else {
        showToast(res.data?.error || "Erro ao abrir no sistema operacional.", "warning");
      }
    } catch {
      showToast("Erro ao conectar com o servidor.", "warning");
    }
  };

  // Cancel Inline Creation
  const handleCancelInlineCreate = () => {
    setInlineCreating(null);
    setInlineValue("");
    setSelectedTemplate(null);
  };

  // Collapse All Folders (VS Code action)
  const handleCollapseAllFolders = () => {
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
    setCollapsedFolders(allFolderPaths);
    showToast("Todas as pastas foram recolhidas.", "info");
  };

  // Expand All Folders (VS Code action)
  const handleExpandAllFolders = () => {
    setCollapsedFolders({});
    showToast("Todas as pastas foram expandidas.", "info");
  };

  // File Click Handler: Open any file in the workspace
  const handleFileClick = (path: string, _name: string) => {
    onOpenFile(path);
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
      const res = await API.renameProjectFile({ old_path: cleanOld, new_path });
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

  const handleDeletePath = async (
    path: string,
    isFolder: boolean,
    e?: React.MouseEvent,
  ) => {
    if (e) e.stopPropagation();
    const itemTypeLabel = isFolder ? "a pasta" : "o arquivo";
    if (
      confirm(
        `Tem certeza que deseja excluir ${itemTypeLabel} "${path}"? Esta alteração será registrada no workspace.`,
      )
    ) {
      try {
        const res = await API.deleteProjectFile(path);
        if (res.ok && res.data?.success) {
          await loadTree();
          await Promise.all([refreshPendingChanges(), refreshGitStatus()]);
          if (activeFile === path || activeFile.startsWith(`${path}/`)) {
            onOpenFile("");
          }
          showToast(`Item excluído com sucesso.`, "info");
        } else {
          alert("Erro ao excluir item.");
        }
      } catch (e) {
        alert("Erro ao conectar com o servidor para excluir.");
      }
    }
  };

  const toggleFolder = (folderPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFolder(folderPath);
    setCollapsedFolders((prev) => ({
      ...prev,
      [folderPath]: !prev[folderPath],
    }));
  };

  // Build display nodes based on search query (displaying ALL files, searching by name and title)
  const displayNodes = useMemo(() => {
    if (!tree || tree.length === 0) return [];

    const cleanNodes = (nodesList: TreeNode[]): TreeNode[] => {
      return nodesList.map((n) => {
        if (n.children && n.children.length > 0) {
          return {
            ...n,
            children: cleanNodes(n.children),
          };
        }
        return n;
      });
    };

    let nodes: TreeNode[] = cleanNodes(tree);

    // Filter by search term if present (matching specifically by name and document title, avoiding noisy path matches)
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      const matchNode = (node: TreeNode): TreeNode | null => {
        const nameMatch = Boolean(
          (node.name && node.name.toLowerCase().includes(q)) ||
          (node.title && node.title.toLowerCase().includes(q))
        );
        const isDir =
          node.type === "dir" || node.type === "directory" || node.is_directory;

        if (!isDir) {
          return nameMatch ? node : null;
        }

        const filteredChildren = (node.children || [])
          .map(matchNode)
          .filter((c): c is TreeNode => c !== null);

        if (nameMatch || filteredChildren.length > 0) {
          return {
            ...node,
            children: filteredChildren.length > 0 ? filteredChildren : node.children,
          };
        }
        return null;
      };

      return nodes.map(matchNode).filter((n): n is TreeNode => n !== null);
    }

    return nodes;
  }, [tree, searchTerm]);

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
  const renderTreeNode = (node: TreeNode) => {
    const isDir =
      node.type === "dir" || node.type === "directory" || node.is_directory;
    const isCollapsedFolder = !!collapsedFolders[node.path];
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
            onDragStart={(e) => handleDragStart(e, node, true)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOverFolder(e, node.path)}
            onDragLeave={(e) => handleDragLeaveFolder(e, node.path)}
            onDrop={(e) => handleDropOnFolder(e, node.path)}
            onClick={(e) => toggleFolder(node.path, e)}
          >
            <div className="tree-folder-left">
              <span
                className={`tree-caret ${!isCollapsedFolder ? "expanded" : ""}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transform: !isCollapsedFolder ? "rotate(90deg)" : "none",
                  transition: "transform 0.15s ease",
                }}
              >
                <ChevronRight size={12} />
              </span>
              {isCollapsedFolder ? (
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
                  fileInputRef.current?.click();
                }}
              >
                <Upload size={12} />
              </button>
              <button
                className="btn-tree-action"
                title={`Abrir pasta "${node.name}" no gerenciador de arquivos do PC`}
                onClick={(e) => handleOpenInOS(node.path, e)}
              >
                <Laptop size={12} />
              </button>
              <button
                className="btn-tree-action"
                title="Renomear pasta"
                onClick={(e) => startInlineRename(node.path, node.name, true, e)}
              >
                <Edit3 size={11} />
              </button>
              <button
                className="btn-tree-action delete"
                title="Excluir pasta"
                onClick={(e) => handleDeletePath(node.path, true, e)}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>

          {!isCollapsedFolder && (
            <div className="tree-children">
              {/* Inline input if creating inside this folder */}
              {renderInlineCreateInput(node.path)}

              {node.children &&
                node.children.map((child) => renderTreeNode(child))}
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

    const gitFile = gitStatus?.files?.find(
      (f) => f.path === node.path || f.path.endsWith(node.path),
    );
    const pendingChange = pendingChanges?.find((c) => c.path === node.path);
    const gitStatusCode = gitFile
      ? gitFile.status === "??"
        ? "U"
        : gitFile.status
      : pendingChange
        ? pendingChange.type === "ADDED"
          ? "A"
          : "M"
        : null;

    return (
      <div
        key={node.path}
        className={`tree-node ${isDraggingThis ? "is-dragging" : ""}`}
      >
        <div
          className={`tree-file-item ${isFileActive ? "active" : ""} ${!isMarkdown ? "non-markdown" : ""} ${isDraggingThis ? "is-dragging" : ""} ${isDragOverThis ? "drag-over" : ""}`}
          data-tree-path={node.path}
          draggable
          onDragStart={(e) => handleDragStart(e, node, false)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOverFile(e, node.path)}
          onDragLeave={(e) => handleDragLeaveFile(e, node.path)}
          onDrop={(e) => handleDropOnFile(e, node.path)}
          onClick={() => handleFileClick(node.path, node.name)}
          title={`Abrir ${node.name}`}
        >
          <div className="tree-file-left">
            {isMarkdown ? (
              <span className={`tree-dot ${dotClass}`}></span>
            ) : ['csv', 'tsv', 'xlsx', 'xls'].includes(fileExt.toLowerCase()) ? (
              <FileSpreadsheet size={13} color="#a6e3a1" style={{ flexShrink: 0 }} />
            ) : ['pdf'].includes(fileExt.toLowerCase()) ? (
              <FileText size={13} color="#f38ba8" style={{ flexShrink: 0 }} />
            ) : ['docx', 'doc'].includes(fileExt.toLowerCase()) ? (
              <FileText size={13} color="#89b4fa" style={{ flexShrink: 0 }} />
            ) : ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(fileExt.toLowerCase()) ? (
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
                onClick={(e) => handleOpenInOS(node.path, e)}
              >
                <Laptop size={11} />
              </button>
              <button
                className="btn-tree-action"
                title="Renomear"
                onClick={(e) => startInlineRename(node.path, node.name, false, e)}
              >
                <Edit3 size={11} />
              </button>
              <button
                className="btn-tree-action delete"
                title="Excluir"
                onClick={(e) => handleDeletePath(node.path, false, e)}
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
        {/* TOP SECTION: Search Bar on Top + Actions Toolbar Below */}
        <div
          className="tree-top-container"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Input Bar at Top */}
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
            <div
              className="tree-toolbar-label"
              title={
                selectedFolder
                  ? `Pasta selecionada: ${selectedFolder}`
                  : "Raiz do repositório"
              }
            >
              {selectedFolder ? `/${selectedFolderName}` : "ARQUIVOS"}
            </div>
            <div className="tree-toolbar-icons">
              <button
                id="btn-tree-new-file"
                className="btn-tree-tool"
                title={
                  selectedFolder
                    ? `Novo Arquivo em /${selectedFolderName}`
                    : "Novo Arquivo na raiz"
                }
                onClick={() => startInlineCreate(selectedFolder, false)}
              >
                <FilePlus size={14} />
              </button>
              <button
                id="btn-tree-new-folder"
                className="btn-tree-tool"
                title={
                  selectedFolder
                    ? `Nova Pasta em /${selectedFolderName}`
                    : "Nova Pasta na raiz"
                }
                onClick={() => startInlineCreate(selectedFolder, true)}
              >
                <FolderPlus size={14} />
              </button>
              <button
                id="btn-tree-import-file"
                className="btn-tree-tool"
                title={
                  selectedFolder
                    ? `Importar Documentos em /${selectedFolderName}`
                    : "Importar Documentos na raiz"
                }
                onClick={() => {
                  setTargetUploadFolder(selectedFolder || "");
                  fileInputRef.current?.click();
                }}
              >
                <Upload size={13} />
              </button>
              <button
                id="btn-tree-open-os"
                className="btn-tree-tool"
                title={
                  selectedFolder
                    ? `Abrir pasta /${selectedFolderName} no gerenciador de arquivos do PC`
                    : "Abrir pasta do projeto no gerenciador de arquivos do PC"
                }
                onClick={(e) => handleOpenInOS(selectedFolder || "", e)}
              >
                <Laptop size={13} />
              </button>
              <button
                id="btn-tree-expand-all"
                className="btn-tree-tool"
                title="Expandir Todas as Pastas"
                onClick={handleExpandAllFolders}
              >
                <ChevronsUpDown size={14} />
              </button>
              <button
                id="btn-tree-collapse-all"
                className="btn-tree-tool"
                title="Recolher Todas as Pastas"
                onClick={handleCollapseAllFolders}
              >
                <ChevronsDownUp size={14} />
              </button>
              <button
                id="btn-tree-refresh"
                className={`btn-tree-tool ${isTreeLoading ? "spinning" : ""}`}
                title={isTreeLoading ? "Carregando arquivos..." : "Atualizar Árvore"}
                onClick={() => loadTree()}
                disabled={isTreeLoading}
              >
                <RefreshCw size={13} className={isTreeLoading ? "spinning" : ""} />
              </button>
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
            <div className="tree-progress-track" title="Sincronizando arquivos com o disco...">
              <div className="tree-progress-bar"></div>
            </div>
          )}
        </div>

        {/* Tree Hierarchy Container */}
        <div
          className="tree-scroll-container"
          onDragOver={handleDragOverRoot}
          onDragLeave={handleDragLeaveRoot}
          onDrop={handleDropOnRoot}
        >
          <div
            id="tree-nodes-container"
            className={`agent-tree-root ${isDragOverRoot ? "drag-over-root" : ""}`}
          >
            {/* Inline input at Root Level */}
            {renderInlineCreateInput("")}

            {isTreeLoading && displayNodes.length === 0 ? (
              <div className="tree-skeleton-container" aria-label="Carregando estrutura de arquivos">
                <div className="tree-loading-pill">
                  <span className="material-symbols-outlined spinning" style={{ fontSize: "14px" }}>
                    progress_activity
                  </span>
                  <span>Carregando arquivos...</span>
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
                  <div className="tree-skeleton-row indent-1">
                    <div className="skeleton-icon" />
                    <div className="skeleton-line" style={{ width: "80%" }} />
                  </div>
                  <div className="tree-skeleton-row indent-2">
                    <div className="skeleton-icon" />
                    <div className="skeleton-line" style={{ width: "50%" }} />
                  </div>
                  <div className="tree-skeleton-row indent-0">
                    <div className="skeleton-icon" />
                    <div className="skeleton-line" style={{ width: "60%" }} />
                  </div>
                  <div className="tree-skeleton-row indent-0">
                    <div className="skeleton-icon" />
                    <div className="skeleton-line" style={{ width: "40%" }} />
                  </div>
                </div>
              </div>
            ) : displayNodes.length === 0 && !inlineCreating ? (
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
                  <FileText size={24} color="#94a3b8" />
                </div>
                <strong
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--text-normal)",
                    margin: 0,
                  }}
                >
                  Nenhum arquivo encontrado
                </strong>
                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--text-muted)",
                    margin: 0,
                    lineHeight: 1.4,
                  }}
                >
                  Crie ou arraste documentos para estruturar seu projeto.
                </p>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    width: "100%",
                    marginTop: "6px",
                  }}
                >
                  <div style={{ display: "flex", gap: "6px", width: "100%" }}>
                    <button
                      className="btn btn-primary btn-sm"
                      style={{
                        flex: 1,
                        fontSize: "11px",
                        padding: "6px 8px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "4px",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        startInlineCreate("", false);
                      }}
                    >
                      <FilePlus size={13} />
                      <span>Novo Arquivo</span>
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{
                        flex: 1,
                        fontSize: "11px",
                        padding: "6px 8px",
                        border: "1px solid var(--border)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "4px",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        startInlineCreate("", true);
                      }}
                    >
                      <FolderPlus size={13} />
                      <span>Nova Pasta</span>
                    </button>
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{
                      width: "100%",
                      fontSize: "11px",
                      padding: "6px 8px",
                      border: "1px dashed var(--primary, #2563eb)",
                      background: "rgba(37, 99, 235, 0.05)",
                      color: "var(--primary, #2563eb)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px",
                      cursor: "pointer",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setTargetUploadFolder("");
                      fileInputRef.current?.click();
                    }}
                  >
                    <Upload size={13} />
                    <span>Importar / Arrastar Documentos</span>
                  </button>
                </div>
              </div>
            ) : (
              displayNodes.map((node) => renderTreeNode(node))
            )}
          </div>

          {/* Drag Overlay Feedback - 100% transparent background with bottom floating pill */}
          {isExternalDragActive && (
            <div className="tree-drag-overlay" onClick={(e) => e.stopPropagation()}>
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
              await handleImportFiles(scanned, targetUploadFolder);
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
              await handleImportFiles(scanned, targetUploadFolder);
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
    </>
  );
};
