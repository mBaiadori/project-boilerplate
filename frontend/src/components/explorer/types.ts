export interface FileTreeProps {
  onOpenFile: (path: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  width?: number;
}

export interface InlineCreatingState {
  parentPath: string;
  isFolder: boolean;
}

export interface InlineRenamingState {
  path: string;
  originalName: string;
  isFolder: boolean;
}

export interface DraggedItem {
  path: string;
  name: string;
  isFolder: boolean;
  repo?: string;
}

export interface ScannedFile {
  file: File;
  relativePath: string;
}

export interface DeleteItemTarget {
  path: string;
  name: string;
  isFolder: boolean;
  repoName?: string;
}

export interface FileTreeToast {
  message: string;
  type: "info" | "warning";
}
