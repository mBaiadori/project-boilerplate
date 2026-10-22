import { useState, useEffect, useRef, useCallback } from "react";
import type { TreeNode } from "../../../types";
import {
  getExpandedStorageKey,
  getSelectedFolderStorageKey,
  getScrollStorageKey,
} from "../utils/fileTreeUtils";

interface UseFileTreeStateProps {
  repoName: string;
  activeFile: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  showToast: (message: string, type?: "info" | "warning") => void;
}

export const useFileTreeState = ({
  repoName,
  activeFile,
  isCollapsed,
  onToggleCollapse,
  showToast,
}: UseFileTreeStateProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(getExpandedStorageKey(repoName));
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  const [selectedFolder, setSelectedFolder] = useState<string>(() => {
    try {
      return sessionStorage.getItem(getSelectedFolderStorageKey(repoName)) || "";
    } catch {
      return "";
    }
  });

  const treeScrollRef = useRef<HTMLDivElement>(null);
  const isRestoringScrollRef = useRef(false);
  const scrollDebounceTimerRef = useRef<any>(null);
  const expandedSaveTimerRef = useRef<any>(null);

  // Sincroniza pastas expandidas e selecionadas ao trocar de repositório
  useEffect(() => {
    try {
      const savedExpanded = localStorage.getItem(getExpandedStorageKey(repoName));
      setExpandedFolders(savedExpanded ? JSON.parse(savedExpanded) : {});
      const savedFolder = sessionStorage.getItem(getSelectedFolderStorageKey(repoName));
      setSelectedFolder(savedFolder || "");
    } catch {
      setExpandedFolders({});
    }
  }, [repoName]);

  // Auto-expande pastas ancestrais do activeFile
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

  // Persiste pastas expandidas com leve debounce para não bloquear a thread principal
  useEffect(() => {
    if (expandedSaveTimerRef.current) clearTimeout(expandedSaveTimerRef.current);
    expandedSaveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(
          getExpandedStorageKey(repoName),
          JSON.stringify(expandedFolders),
        );
      } catch {}
    }, 200);
    return () => {
      if (expandedSaveTimerRef.current) clearTimeout(expandedSaveTimerRef.current);
    };
  }, [expandedFolders, repoName]);

  // Persiste pasta selecionada
  useEffect(() => {
    try {
      if (selectedFolder) {
        sessionStorage.setItem(getSelectedFolderStorageKey(repoName), selectedFolder);
      } else {
        sessionStorage.removeItem(getSelectedFolderStorageKey(repoName));
      }
    } catch {}
  }, [selectedFolder, repoName]);

  // Scroll handler com throttle/debounce para ZERO jank / 60fps
  const handleTreeScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (isRestoringScrollRef.current) return;
      const top = e.currentTarget.scrollTop;
      if (scrollDebounceTimerRef.current) clearTimeout(scrollDebounceTimerRef.current);
      scrollDebounceTimerRef.current = setTimeout(() => {
        try {
          sessionStorage.setItem(getScrollStorageKey(repoName), String(top));
          localStorage.setItem(getScrollStorageKey(repoName), String(top));
        } catch {}
      }, 100);
    },
    [repoName],
  );

  // Restaura posição de scroll
  const restoreScrollPosition = useCallback(() => {
    if (treeScrollRef.current) {
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
      } catch {}
    }
  }, [repoName]);

  // Evento spec:reveal-in-tree
  useEffect(() => {
    const handleReveal = (e: Event) => {
      const customEvent = e as CustomEvent<{ path: string }>;
      const targetPath = customEvent.detail?.path;
      if (!targetPath) return;

      if (isCollapsed) {
        onToggleCollapse();
      }

      if (searchTerm) {
        setSearchTerm("");
      }

      const parts = targetPath.split("/");
      parts.pop();
      const parentPaths: string[] = [];
      let currentAcc = "";
      for (const part of parts) {
        currentAcc = currentAcc ? `${currentAcc}/${part}` : part;
        parentPaths.push(currentAcc);
      }

      if (parentPaths.length > 0) {
        setExpandedFolders((prev) => {
          const updated = { ...prev };
          for (const p of parentPaths) {
            updated[p] = true;
          }
          return updated;
        });
      }

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

  const toggleFolder = useCallback((folderPath: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedFolder(folderPath);
    setExpandedFolders((prev) => ({
      ...prev,
      [folderPath]: !prev[folderPath],
    }));
  }, []);

  const handleCollapseAllFolders = useCallback(() => {
    setExpandedFolders({});
    showToast("Todas as pastas foram recolhidas.", "info");
  }, [showToast]);

  const handleExpandAllFolders = useCallback(
    (
      tree: TreeNode[],
      treesByRepo: Record<string, TreeNode[]>,
      setCollapsedRepos: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
    ) => {
      const allFolderPaths: Record<string, boolean> = {};
      const collectDirs = (nodes: TreeNode[]) => {
        for (const n of nodes) {
          const isDir = n.type === "dir" || n.type === "directory" || n.is_directory;
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
      showToast("Todas as pastas e repositórios foram expandidos.", "info");
    },
    [showToast],
  );

  return {
    searchTerm,
    setSearchTerm,
    expandedFolders,
    setExpandedFolders,
    selectedFolder,
    setSelectedFolder,
    treeScrollRef,
    handleTreeScroll,
    restoreScrollPosition,
    toggleFolder,
    handleCollapseAllFolders,
    handleExpandAllFolders,
  };
};
