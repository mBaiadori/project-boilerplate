export type TabType = "whats-new" | "drafts" | "system";
export type WhatsNewFilterType = "all" | "new" | "modified" | "proposals";

export interface DraftItem {
  path: string;
  repoName: string;
  status?: string;
  type?: string;
  additions?: number;
  deletions?: number;
  diff_text?: string;
}

export interface VersionsSubViewProps {
  onOpenFile?: (path: string) => void;
  onOpenDiffModal?: () => void;
}
