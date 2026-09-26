import fs from "node:fs";
import path from "node:path";

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

export function loadHiddenFiles(repoDir: string): string[] {
  const hiddenPath = path.join(repoDir, ".hidden_files.json");
  if (fs.existsSync(hiddenPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(hiddenPath, "utf-8"));
      if (Array.isArray(data)) return data;
    } catch (e) {
      console.warn(
        `[HiddenFiles] Erro ao ler .hidden_files.json em ${repoDir}:`,
        e
      );
    }
  }
  return DEFAULT_HIDDEN_FILES;
}

export function isPathHidden(filePath: string, hiddenList?: string[]): boolean {
  if (!filePath) return false;
  const list =
    hiddenList && hiddenList.length > 0 ? hiddenList : DEFAULT_HIDDEN_FILES;
  const cleanPath = filePath.trim().replace(/^\/+/, "").replace(/\\/g, "/");
  if (!cleanPath) return false;

  const segments = cleanPath.split("/").filter(Boolean);

  // 1. Direct match with configured hidden list (files or directory prefixes)
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

  // 2. Safety check against default hidden files/folders
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

  // 3. Any segment that starts with a dot (e.g. .hidden, .config, etc.)
  for (const seg of segments) {
    if (seg.startsWith(".") && seg !== "." && seg !== "..") {
      return true;
    }
  }

  return false;
}
