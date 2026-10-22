export const TREE_WIDTH_STORAGE_KEY = 'spec_tree_width';
export const TREE_COLLAPSED_STORAGE_KEY = 'spec_tree_collapsed';
export const DEFAULT_TREE_WIDTH = 260;

export interface EditorSubViewProps {
  onOpenScaffoldWizard: () => void;
  onOpenDiffModal: () => void;
  onToggleCopilot: () => void;
  onOpenFile?: (path: string) => void;
}
