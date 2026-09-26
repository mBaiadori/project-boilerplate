export const DEFAULT_HIDDEN_FILES = [
  ".git",
  ".gitignore",
  ".DS_Store",
  "node_modules",
  ".project.config.json",
  ".docs.metadata.json",
  ".dictionary.json",
  ".templates.json",
  ".templates.metadata.json",
  ".spec-memory",
  ".skills",
  ".agents",
  ".tools",
  ".mcp.json",
  ".hidden_files.json",
];

export function isPathHidden(filePath: string, customHiddenList?: string[]): boolean {
  if (!filePath) return false;
  const list = customHiddenList && customHiddenList.length > 0 ? customHiddenList : DEFAULT_HIDDEN_FILES;
  const cleanPath = filePath.trim().replace(/^\/+/, "").replace(/\\/g, "/");
  if (!cleanPath) return false;

  const segments = cleanPath.split("/").filter(Boolean);

  for (const item of list) {
    const cleanItem = item.trim().replace(/^\.?\//, "").replace(/\/+$/, "");
    if (!cleanItem) continue;

    if (
      cleanPath === cleanItem ||
      cleanPath.startsWith(cleanItem + "/") ||
      segments.includes(cleanItem)
    ) {
      return true;
    }
  }

  for (const item of DEFAULT_HIDDEN_FILES) {
    const cleanItem = item.trim().replace(/^\.?\//, "").replace(/\/+$/, "");
    if (!cleanItem) continue;

    if (
      cleanPath === cleanItem ||
      cleanPath.startsWith(cleanItem + "/") ||
      segments.includes(cleanItem)
    ) {
      return true;
    }
  }

  for (const seg of segments) {
    if (seg.startsWith(".") && seg !== "." && seg !== "..") {
      return true;
    }
  }

  return false;
}
