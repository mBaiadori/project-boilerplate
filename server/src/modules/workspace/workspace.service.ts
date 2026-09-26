import fs from "node:fs";
import path from "node:path";
import { execFile, exec } from "node:child_process";
import { PROJECTS_DIR } from "../../config/constants.js";
import {
  loadConfig,
  saveConfig,
  recordChange,
  ensureDefaultRepoFiles,
} from "../../config/storage.js";
import { computeDiff } from "../../utils/diff.js";
import { isGitRepo, executeGitCommand } from "../../utils/git.js";
import {
  docsMetadataService,
  generateDocId,
  extractDocLinksFromMarkdown,
  type DocumentMetadataItem,
} from "./docs-metadata.service.js";

export interface TreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: TreeNode[];
  title?: string;
  categories?: string;
  category?: string;
  status?: string;
  last_modified?: number;
}

export { generateDocId, extractDocLinksFromMarkdown };
export type { DocumentMetadataItem };

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
        `[WorkspaceService] Erro ao ler .hidden_files.json em ${repoDir}:`,
        e,
      );
    }
  }
  return DEFAULT_HIDDEN_FILES;
}

export class WorkspaceService {
  private getRepoDir(repoName: string): string {
    return path.join(PROJECTS_DIR, repoName || "local");
  }

  loadDocsMetadata(repoName: string): DocumentMetadataItem[] {
    return docsMetadataService.loadDocsMetadata(repoName);
  }

  saveDocsMetadata(repoName: string, metaList: DocumentMetadataItem[]): void {
    docsMetadataService.saveDocsMetadata(repoName, metaList);
  }

  buildTree(
    dir: string,
    baseDir: string,
    docsMetadata?: DocumentMetadataItem[],
    hiddenFiles?: string[],
  ): TreeNode[] {
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const nodes: TreeNode[] = [];

    const metaList = docsMetadata || [];
    const hiddenList = hiddenFiles || loadHiddenFiles(baseDir);

    for (const entry of entries) {
      if (hiddenList.includes(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, "/");

      if (entry.isDirectory()) {
        nodes.push({
          name: entry.name,
          path: relPath,
          type: "directory",
          children: this.buildTree(fullPath, baseDir, metaList, hiddenList),
        });
      } else if (entry.isFile()) {
        const docMeta =
          metaList.find((d) => d.path === relPath) ||
          ({} as Partial<DocumentMetadataItem>);
        const stat = fs.statSync(fullPath);

        nodes.push({
          name: entry.name,
          path: relPath,
          type: "file",
          title:
            docMeta.title ||
            docMeta.name ||
            entry.name.replace(/\.[^/.]+$/, ""),
          categories: docMeta.categories || "",
          category: docMeta.categories || "",
          status: docMeta.status || "",
          last_modified: stat.mtimeMs,
        });
      }
    }

    return nodes.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === "directory" ? -1 : 1;
    });
  }

  getTree(targetRepoName?: string) {
    const cfg = loadConfig();
    const repoName = targetRepoName || cfg.active_repo?.name || "local";
    ensureDefaultRepoFiles(repoName);
    const repoDir = this.getRepoDir(repoName);

    const docsMetadata = docsMetadataService.loadDocsMetadata(repoName);
    const tree = this.buildTree(repoDir, repoDir, docsMetadata);
    return {
      repo: repoName,
      tree,
    };
  }

  getFile(filePath: string) {
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || "local";
    const cleanPath = (filePath || "").trim().replace(/^\/+/, "");
    const fullPath = path.join(this.getRepoDir(repoName), cleanPath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Arquivo '${cleanPath}' não encontrado.`);
    }

    const stat = fs.statSync(fullPath);
    const ext = path.extname(cleanPath).replace(".", "").toLowerCase();
    const isBinary = [
      "pdf",
      "xlsx",
      "xls",
      "docx",
      "doc",
      "png",
      "jpg",
      "jpeg",
      "gif",
      "webp",
      "ico",
      "zip",
      "gz",
      "tar",
      "exe",
      "bin",
      "mp4",
      "mp3",
    ].includes(ext);

    let content = "";
    if (!isBinary) {
      try {
        content = fs.readFileSync(fullPath, "utf-8");
      } catch (e) {
        content = "";
      }
    }

    const meta = docsMetadataService.getDocMetadata(repoName, cleanPath);

    return {
      path: cleanPath,
      content,
      isBinary,
      size: stat.size,
      meta,
      repo: repoName,
    };
  }

  getRawFile(filePath: string) {
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || "local";
    const cleanPath = (filePath || "").trim().replace(/^\/+/, "");
    const fullPath = path.join(this.getRepoDir(repoName), cleanPath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Arquivo '${cleanPath}' não encontrado.`);
    }

    const ext = path.extname(cleanPath).replace(".", "").toLowerCase();
    const mimeTypes: Record<string, string> = {
      pdf: "application/pdf",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      xls: "application/vnd.ms-excel",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      doc: "application/msword",
      csv: "text/csv; charset=utf-8",
      tsv: "text/tab-separated-values; charset=utf-8",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      svg: "image/svg+xml",
      webp: "image/webp",
      json: "application/json; charset=utf-8",
      yaml: "text/yaml; charset=utf-8",
      yml: "text/yaml; charset=utf-8",
      txt: "text/plain; charset=utf-8",
      md: "text/markdown; charset=utf-8",
      html: "text/html; charset=utf-8",
      css: "text/css; charset=utf-8",
      js: "application/javascript; charset=utf-8",
      ts: "text/plain; charset=utf-8",
    };

    const mimeType = mimeTypes[ext] || "application/octet-stream";
    const buffer = fs.readFileSync(fullPath);
    return {
      buffer,
      mimeType,
      filename: path.basename(cleanPath),
      size: buffer.length,
    };
  }

  saveFile(filePath: string, content: string, meta?: any) {
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || "local";
    const cleanPath = (filePath || "").trim().replace(/^\/+/, "");
    const fullPath = path.join(this.getRepoDir(repoName), cleanPath);

    let oldContent = "";
    let changeType: "ADDED" | "MODIFIED" = "ADDED";

    if (fs.existsSync(fullPath)) {
      oldContent = fs.readFileSync(fullPath, "utf-8");
      changeType = "MODIFIED";
    } else {
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    }

    fs.writeFileSync(fullPath, content, "utf-8");
    recordChange(repoName, cleanPath, changeType, oldContent, content);

    // Extrair links automaticamente do conteúdo markdown para enriquecer o .docs.metadata.json
    const extractedLinks = extractDocLinksFromMarkdown(content);

    const metaUpdatePayload = {
      ...(meta && typeof meta === "object" ? meta : {}),
      links: extractedLinks,
    };

    const { meta: updatedMetaItem } = docsMetadataService.updateDocMetadataItem(
      repoName,
      cleanPath,
      metaUpdatePayload,
    );

    const repoDir = this.getRepoDir(repoName);
    const docsMetadata = docsMetadataService.loadDocsMetadata(repoName);
    const newTree = this.buildTree(repoDir, repoDir, docsMetadata);

    return {
      success: true,
      path: cleanPath,
      meta: updatedMetaItem,
      tree: newTree,
    };
  }

  createFile(
    filePath: string,
    initialContent: string = "",
    isFolder: boolean = false,
    meta?: any,
  ) {
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || "local";
    let cleanPath = (filePath || "")
      .trim()
      .replace(/^\/+/, "")
      .replace(/\/+$/, "");

    if (!cleanPath) {
      throw new Error("Caminho não pode ser vazio.");
    }

    const repoDir = this.getRepoDir(repoName);

    if (isFolder) {
      const fullPath = path.join(repoDir, cleanPath);
      if (fs.existsSync(fullPath)) {
        throw new Error(`Pasta '${cleanPath}' já existe.`);
      }
      fs.mkdirSync(fullPath, { recursive: true });
      recordChange(repoName, cleanPath, "ADDED", "", "");

      const docsMetadata = docsMetadataService.loadDocsMetadata(repoName);
      const newTree = this.buildTree(repoDir, repoDir, docsMetadata);
      return {
        success: true,
        path: cleanPath,
        is_folder: true,
        tree: newTree,
      };
    }

    const fullPath = path.join(repoDir, cleanPath);
    if (fs.existsSync(fullPath)) {
      throw new Error(`Arquivo '${cleanPath}' já existe.`);
    }

    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, initialContent, "utf-8");

    recordChange(repoName, cleanPath, "ADDED", "", initialContent);

    const extractedLinks = extractDocLinksFromMarkdown(initialContent);
    const metaPayload = {
      ...(meta && typeof meta === "object" ? meta : {}),
      links: extractedLinks,
    };

    const { meta: newItem } = docsMetadataService.updateDocMetadataItem(
      repoName,
      cleanPath,
      metaPayload,
    );

    const docsMetadata = docsMetadataService.loadDocsMetadata(repoName);
    const newTree = this.buildTree(repoDir, repoDir, docsMetadata);

    return {
      success: true,
      path: cleanPath,
      is_folder: false,
      meta: newItem,
      tree: newTree,
    };
  }

  importFiles(
    targetFolder: string = "",
    filesToImport: Array<{
      name: string;
      relativePath?: string;
      content?: string;
      base64?: string;
      meta?: any;
    }>,
    targetRepoName?: string,
  ) {
    const cfg = loadConfig();
    const repoName = targetRepoName || cfg.active_repo?.name || "local";
    const repoDir = this.getRepoDir(repoName);
    const cleanTarget = (targetFolder || "")
      .trim()
      .replace(/^\/+/, "")
      .replace(/\/+$/, "");

    const importedFiles: Array<{
      path: string;
      name: string;
      isBinary: boolean;
      size: number;
    }> = [];
    const errors: string[] = [];

    for (const item of filesToImport) {
      try {
        const itemRel = (item.relativePath || item.name || "")
          .trim()
          .replace(/^\/+/, "");
        if (!itemRel) continue;

        const fullRelPath = cleanTarget ? `${cleanTarget}/${itemRel}` : itemRel;
        const fullDiskPath = path.join(repoDir, fullRelPath);

        // Security check against directory traversal
        const resolvedPath = path.resolve(fullDiskPath);
        const resolvedRepoDir = path.resolve(repoDir);
        if (!resolvedPath.startsWith(resolvedRepoDir)) {
          errors.push(`Caminho inválido: ${fullRelPath}`);
          continue;
        }

        fs.mkdirSync(path.dirname(fullDiskPath), { recursive: true });

        let oldContent = "";
        const exists = fs.existsSync(fullDiskPath);
        if (exists) {
          try {
            oldContent = fs.readFileSync(fullDiskPath, "utf-8");
          } catch {
            oldContent = "";
          }
        }

        let isBinary = false;
        let fileSize = 0;

        if (item.base64) {
          const buffer = Buffer.from(item.base64, "base64");
          fs.writeFileSync(fullDiskPath, buffer);
          fileSize = buffer.length;
          isBinary = true;
        } else {
          const textContent = item.content ?? "";
          fs.writeFileSync(fullDiskPath, textContent, "utf-8");
          fileSize = Buffer.byteLength(textContent, "utf-8");
        }

        const isMd =
          fullRelPath.toLowerCase().endsWith(".md") ||
          fullRelPath.toLowerCase().endsWith(".markdown");
        const textForLinks = isMd && !item.base64 ? item.content || "" : "";
        const extractedLinks = textForLinks
          ? extractDocLinksFromMarkdown(textForLinks)
          : [];

        const defaultTitle = item.name.replace(/\.[^/.]+$/, "");
        const metaPayload = {
          title: defaultTitle,
          status: "draft",
          categories: "geral",
          ...(item.meta && typeof item.meta === "object" ? item.meta : {}),
          links: extractedLinks,
        };

        docsMetadataService.updateDocMetadataItem(
          repoName,
          fullRelPath,
          metaPayload,
        );
        recordChange(
          repoName,
          fullRelPath,
          exists ? "MODIFIED" : "ADDED",
          oldContent,
          item.content || "",
        );

        importedFiles.push({
          path: fullRelPath,
          name: item.name,
          isBinary,
          size: fileSize,
        });
      } catch (err: any) {
        errors.push(`Erro ao importar ${item.name}: ${err.message}`);
      }
    }

    const docsMetadata = docsMetadataService.loadDocsMetadata(repoName);
    const newTree = this.buildTree(repoDir, repoDir, docsMetadata);

    return {
      success: importedFiles.length > 0,
      importedFiles,
      errors,
      tree: newTree,
    };
  }

  renameFile(oldPath: string, newPath: string) {
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || "local";
    const cleanOld = (oldPath || "")
      .trim()
      .replace(/^\/+/, "")
      .replace(/\/+$/, "");
    let cleanNew = (newPath || "")
      .trim()
      .replace(/^\/+/, "")
      .replace(/\/+$/, "");

    const fullOld = path.join(this.getRepoDir(repoName), cleanOld);
    if (!fs.existsSync(fullOld)) {
      throw new Error(`Origem '${cleanOld}' não existe.`);
    }

    const isDir = fs.statSync(fullOld).isDirectory();
    if (!isDir && !path.extname(cleanNew)) {
      cleanNew += ".md";
    }

    const fullNew = path.join(this.getRepoDir(repoName), cleanNew);
    if (fs.existsSync(fullNew)) {
      throw new Error(`Destino '${cleanNew}' já existe.`);
    }

    fs.mkdirSync(path.dirname(fullNew), { recursive: true });
    fs.renameSync(fullOld, fullNew);

    let oldContent = "";
    if (!isDir) {
      if (fs.existsSync(fullNew)) {
        oldContent = fs.readFileSync(fullNew, "utf-8");
      }
      recordChange(repoName, cleanOld, "DELETED", oldContent, "");
      recordChange(repoName, cleanNew, "ADDED", "", oldContent);
    }

    docsMetadataService.renameDocMetadata(repoName, cleanOld, cleanNew);

    const repoDir = this.getRepoDir(repoName);
    const docsMetadata = docsMetadataService.loadDocsMetadata(repoName);
    const newTree = this.buildTree(repoDir, repoDir, docsMetadata);

    return {
      success: true,
      oldPath: cleanOld,
      newPath: cleanNew,
      tree: newTree,
    };
  }

  deleteFile(filePath: string) {
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || "local";
    const cleanPath = (filePath || "").trim().replace(/^\/+/, "");

    if (!cleanPath) {
      throw new Error("Caminho de arquivo inválido.");
    }

    const fullPath = path.join(this.getRepoDir(repoName), cleanPath);
    let oldContent = "";

    if (fs.existsSync(fullPath)) {
      if (fs.statSync(fullPath).isDirectory()) {
        fs.rmSync(fullPath, { recursive: true, force: true });
      } else {
        oldContent = fs.readFileSync(fullPath, "utf-8");
        fs.unlinkSync(fullPath);
      }
    }

    recordChange(repoName, cleanPath, "DELETED", oldContent, "");

    docsMetadataService.deleteDocMetadata(repoName, cleanPath);

    const repoDir = this.getRepoDir(repoName);
    const docsMetadata = docsMetadataService.loadDocsMetadata(repoName);
    const newTree = this.buildTree(repoDir, repoDir, docsMetadata);

    return {
      success: true,
      path: cleanPath,
      tree: newTree,
    };
  }

  getWorkspaceChanges() {
    const cfg = loadConfig();
    const activeRepo = cfg.active_repo;
    if (!activeRepo) {
      return {
        changes: [],
        total_additions: 0,
        total_deletions: 0,
        guardrail: "CLEAN",
      };
    }

    const repoName = activeRepo.name || "local";
    const rawChanges = cfg.workspace_changes?.[repoName] || [];

    const detailedChanges = [];
    let totalAdditions = 0;
    let totalDeletions = 0;

    for (const c of rawChanges) {
      const diffData = computeDiff(
        c.old_content || "",
        c.new_content || "",
        c.path,
      );
      totalAdditions += diffData.additions;
      totalDeletions += diffData.deletions;
      detailedChanges.push({
        path: c.path,
        type: c.type,
        timestamp: c.timestamp,
        additions: diffData.additions,
        deletions: diffData.deletions,
        diff_text: diffData.diff_text,
        old_content: c.old_content,
        new_content: c.new_content,
      });
    }

    const totalLines = totalAdditions + totalDeletions;
    const guardrail =
      totalLines < 120
        ? "PEQUENO (Ideal)"
        : totalLines < 350
          ? "MÉDIO"
          : "GRANDE (Atenção)";

    return {
      repo: activeRepo,
      changes: detailedChanges,
      total_additions: totalAdditions,
      total_deletions: totalDeletions,
      total_files: detailedChanges.length,
      guardrail,
    };
  }

  async discardChanges(paths?: string[]) {
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || "local";
    const repoDir = this.getRepoDir(repoName);
    const rawChanges = cfg.workspace_changes?.[repoName] || [];

    const targetPaths = paths && paths.length > 0 ? new Set(paths) : null;
    const remainingChanges = [];

    for (const change of rawChanges) {
      if (!targetPaths || targetPaths.has(change.path)) {
        const fullPath = path.join(repoDir, change.path);
        try {
          if (change.type === "ADDED") {
            if (fs.existsSync(fullPath)) {
              if (fs.statSync(fullPath).isDirectory()) {
                fs.rmSync(fullPath, { recursive: true, force: true });
              } else {
                fs.unlinkSync(fullPath);
              }
            }
          } else if (change.type === "MODIFIED" || change.type === "DELETED") {
            if (change.old_content !== undefined) {
              fs.mkdirSync(path.dirname(fullPath), { recursive: true });
              fs.writeFileSync(fullPath, change.old_content, "utf-8");
            }
          }
        } catch (e) {
          console.error(`Erro ao descartar mudança em ${change.path}:`, e);
        }
      } else {
        remainingChanges.push(change);
      }
    }

    // Se o diretório for um repositório git, descartar alterações no git também
    if (await isGitRepo(repoDir)) {
      try {
        if (targetPaths) {
          for (const p of targetPaths) {
            await executeGitCommand(`git checkout -- "${p}"`, repoDir);
            await executeGitCommand(`git clean -fd "${p}"`, repoDir);
          }
        } else {
          await executeGitCommand("git checkout -- .", repoDir);
          await executeGitCommand("git clean -fd", repoDir);
        }
      } catch (e) {
        console.warn(
          `[WorkspaceService] Aviso ao descartar alterações no git:`,
          e,
        );
      }
    }

    cfg.workspace_changes[repoName] = remainingChanges;
    saveConfig(cfg);

    const docsMetadata = docsMetadataService.loadDocsMetadata(repoName);
    const newTree = this.buildTree(repoDir, repoDir, docsMetadata);
    return {
      success: true,
      message: "Alterações descartadas com sucesso.",
      tree: newTree,
    };
  }

  getDocumentContext(filePath: string) {
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || "local";
    const cleanPath = (filePath || "").trim().replace(/^\/+/, "");
    const repoDir = this.getRepoDir(repoName);
    const docsMetadata = docsMetadataService.loadDocsMetadata(repoName);

    const docMeta =
      docsMetadata.find((d) => d.path === cleanPath) ||
      ({} as Partial<DocumentMetadataItem>);

    // Ler o arquivo ativo para extrair links diretos
    const fullActive = path.join(repoDir, cleanPath);
    let activeContent = "";
    if (fs.existsSync(fullActive) && fs.statSync(fullActive).isFile()) {
      try {
        activeContent = fs.readFileSync(fullActive, "utf-8");
      } catch {}
    }

    const extractedActiveLinks = extractDocLinksFromMarkdown(activeContent);
    const rawOutgoingLinks = extractedActiveLinks;

    // 1. Dependencies (Outgoing links from this document)
    const dependencies: any[] = [];
    for (const link of rawOutgoingLinks) {
      const linkFilePath = link.split("#")[0].replace(/^\.?\//, "");
      const hash = link.includes("#") ? link.slice(link.indexOf("#")) : "";
      const matchedMeta = docsMetadata.find(
        (d) =>
          d.path === linkFilePath ||
          d.name === linkFilePath ||
          d.id === linkFilePath,
      );

      dependencies.push({
        path: link,
        filePath: linkFilePath,
        hash,
        title:
          matchedMeta?.title ||
          matchedMeta?.name ||
          path.basename(linkFilePath, path.extname(linkFilePath)) ||
          link,
        categories: matchedMeta?.categories || "",
        category: matchedMeta?.categories || "",
        status: matchedMeta?.status || "draft",
      });
    }

    // 2. Consumers (Backlinks - other documents that link to this file)
    const consumers: any[] = [];
    const thisFileBase = path.basename(cleanPath);
    const thisFileNoExt = path.basename(cleanPath, path.extname(cleanPath));

    for (const doc of docsMetadata) {
      if (doc.path === cleanPath) continue;

      let hasLink = false;
      if (Array.isArray(doc.links)) {
        hasLink = doc.links.some((l) => {
          const lClean = l.split("#")[0].replace(/^\.?\//, "");
          return (
            lClean === cleanPath ||
            lClean === thisFileBase ||
            lClean === thisFileNoExt ||
            l === docMeta.id
          );
        });
      }

      if (!hasLink) {
        const docFull = path.join(repoDir, doc.path);
        if (fs.existsSync(docFull)) {
          try {
            const c = fs.readFileSync(docFull, "utf-8");
            if (c.includes(cleanPath) || c.includes(thisFileBase)) {
              hasLink = true;
            }
          } catch {}
        }
      }

      if (hasLink) {
        consumers.push({
          path: doc.path,
          filePath: doc.path,
          title: doc.title || doc.name || doc.path,
          categories: doc.categories || "",
          category: doc.categories || "",
          status: doc.status || "draft",
        });
      }
    }

    const contextItems: any[] = [];
    const collectDocs = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;
        const full = path.join(dir, entry.name);
        const rel = path.relative(repoDir, full).replace(/\\/g, "/");
        if (entry.isDirectory()) {
          collectDocs(full);
        } else if (entry.isFile() && entry.name.endsWith(".md")) {
          try {
            const content = fs.readFileSync(full, "utf-8");
            const itemMeta =
              docsMetadata.find((d) => d.path === rel) ||
              ({} as Partial<DocumentMetadataItem>);
            contextItems.push({
              path: rel,
              title:
                itemMeta.title ||
                itemMeta.name ||
                entry.name.replace(".md", ""),
              categories: itemMeta.categories || "",
              category: itemMeta.categories || "",
              summary: content.slice(0, 300),
            });
          } catch {}
        }
      }
    };

    collectDocs(repoDir);

    return {
      active_file: cleanPath,
      repo: repoName,
      title: docMeta.title || docMeta.name || cleanPath,
      categories: docMeta.categories || "",
      category: docMeta.categories || "",
      status: docMeta.status || "draft",
      dependencies,
      consumers,
      documents: contextItems,
    };
  }

  revealInOS(
    relPath?: string,
    repoName?: string,
  ): { success: boolean; message: string; fullPath: string } {
    const cfg = loadConfig();
    const repo = repoName || cfg.active_repo?.name || "local";
    const repoDir = this.getRepoDir(repo);
    const cleanRel = (relPath || "").trim().replace(/^\/+/, "");
    const targetPath = cleanRel ? path.join(repoDir, cleanRel) : repoDir;

    if (!fs.existsSync(targetPath)) {
      throw new Error(
        `Arquivo ou diretório não encontrado no disco: ${cleanRel || targetPath}`,
      );
    }

    const platform = process.platform;
    const isDirectory = fs.statSync(targetPath).isDirectory();

    try {
      if (platform === "darwin") {
        if (isDirectory) {
          execFile("open", [targetPath], (err) => {
            if (err)
              console.error(
                "[revealInOS] Error opening directory on macOS:",
                err,
              );
          });
        } else {
          execFile("open", ["-R", targetPath], (err) => {
            if (err)
              console.error("[revealInOS] Error revealing file on macOS:", err);
          });
        }
      } else if (platform === "win32") {
        if (isDirectory) {
          execFile("explorer.exe", [targetPath], (err) => {
            if (err)
              console.error(
                "[revealInOS] Error opening folder on Windows:",
                err,
              );
          });
        } else {
          // On Windows, explorer /select,path highlights the file
          exec(
            `explorer.exe /select,"${targetPath.replace(/\//g, "\\")}"`,
            (err) => {
              if (err)
                console.error(
                  "[revealInOS] Error selecting file in Windows Explorer:",
                  err,
                );
            },
          );
        }
      } else {
        // Linux / other Unix
        const openDir = isDirectory ? targetPath : path.dirname(targetPath);
        execFile("xdg-open", [openDir], (err) => {
          if (err)
            console.error("[revealInOS] Error opening via xdg-open:", err);
        });
      }
    } catch (err: any) {
      console.error("[revealInOS] Execution failure:", err);
      throw new Error(
        `Falha ao abrir gerenciador de arquivos do sistema: ${err.message}`,
      );
    }

    return {
      success: true,
      message: `Aberto no gerenciador de arquivos do SO: ${cleanRel || "Raiz do projeto"}`,
      fullPath: targetPath,
    };
  }
}

export const workspaceService = new WorkspaceService();
