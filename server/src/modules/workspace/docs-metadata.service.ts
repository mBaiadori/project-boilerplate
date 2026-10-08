import fs from "node:fs";
import path from "node:path";
import { PROJECTS_DIR } from "../../config/constants.js";
import { validateJsonSchema } from "../../utils/schema.validator.js";
import {
  DEFAULT_DEPARTMENTS,
  DepartmentConfig,
} from "../governance/governance.types.js";

export interface DocumentMetadataItem {
  id: string;
  name: string;
  title?: string;
  ext: string;
  path: string;
  status: string;
  categories: string;
  tags: string[];
  updated_at: string;
  approvers: string[];
  links: string[];
  templateId: string;
  prompt: string;
  department?: string; // id do departamento (e.g. "engineering", "finance", "legal")
  [key: string]: any;
}

export interface ProjectMetadataOptions {
  categories: Array<string | { name: string; color?: string }>;
  statuses: Array<{
    key?: string;
    name?: string;
    label: string;
    badge?: string;
    color?: string;
  }>;
  tags: Array<string | { name: string; color?: string }>;
  badges?: Array<
    string | { name: string; color?: string; description?: string }
  >;
  departments?: DepartmentConfig[];
}

export function generateDocId(filePath: string): string {
  return filePath
    .replace(/\.md$/, "")
    .replace(/[\/\\]/g, "-")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

export function extractFrontmatterMeta(content: string): {
  title?: string;
  status?: string;
  categories?: string;
  tags?: string[];
  [key: string]: any;
} {
  if (!content) return {};
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return {};
  const result: Record<string, any> = {};
  for (const line of match[1].split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    let val = trimmed.slice(colonIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key === "status") {
      result.status = val;
    } else if (key === "title") {
      result.title = val;
    } else if (key === "categories" || key === "category") {
      result.categories = val;
    }
  }
  return result;
}

export function updateFrontmatterInMarkdown(
  content: string,
  meta: Record<string, any>,
): string {
  if (!content) content = "";
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  let existingMeta: Record<string, any> = {};
  let body = content;

  if (match) {
    const rawFm = match[1];
    body = content.slice(match[0].length);
    for (const line of rawFm.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const colonIdx = trimmed.indexOf(":");
      if (colonIdx === -1) continue;
      const k = trimmed.slice(0, colonIdx).trim();
      let v = trimmed.slice(colonIdx + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      existingMeta[k] = v;
    }
  }

  const merged = { ...existingMeta, ...meta };
  Object.keys(merged).forEach((k) => {
    if (merged[k] === undefined || merged[k] === null || merged[k] === "") {
      delete merged[k];
    }
  });

  if (Object.keys(merged).length === 0) {
    return body;
  }

  const lines = ["---"];
  for (const [k, v] of Object.entries(merged)) {
    if (typeof v === "number" || typeof v === "boolean") {
      lines.push(`${k}: ${v}`);
    } else if (Array.isArray(v)) {
      lines.push(`${k}: [${v.map((item) => `"${item}"`).join(", ")}]`);
    } else {
      lines.push(`${k}: "${v}"`);
    }
  }
  lines.push("---");
  lines.push("");
  return lines.join("\n") + body.replace(/^\r?\n/, "");
}

export function extractDocLinksFromMarkdown(content: string): string[] {
  if (!content) return [];
  const links: string[] = [];
  const regex = /\[.*?\]\(([^)]+)\)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const rawTarget = match[1].trim();
    if (
      !rawTarget.startsWith("http://") &&
      !rawTarget.startsWith("https://") &&
      !rawTarget.startsWith("mailto:")
    ) {
      const cleanTarget = rawTarget.split("#")[0].replace(/^\.?\//, "");
      if (
        cleanTarget.endsWith(".md") ||
        cleanTarget.endsWith(".markdown") ||
        cleanTarget.length > 0 ||
        rawTarget.startsWith("#") ||
        rawTarget.startsWith(":~:text=")
      ) {
        if (!links.includes(rawTarget)) {
          links.push(rawTarget);
        }
      }
    }
  }
  return links;
}

export function extractDocTitleFromMarkdown(content: string): string | null {
  if (!content) return null;
  const match = content.match(/^#\s+(.+)$/m);
  if (match && match[1]) {
    return match[1].trim().replace(/^[\uD800-\uDBFF\uDC00-\uDFFF\s]+/g, ""); // remove initial emojis if any
  }
  return null;
}

export class DocsMetadataService {
  private getRepoDir(repoName: string): string {
    return path.join(PROJECTS_DIR, repoName || "local");
  }

  getDocsMetadataPath(repoName: string): string {
    const hiddenPath = path.join(
      this.getRepoDir(repoName),
      ".docs.metadata.json",
    );
    const legacyPath = path.join(
      this.getRepoDir(repoName),
      "project",
      "docs.metadata.json",
    );
    if (!fs.existsSync(hiddenPath) && fs.existsSync(legacyPath)) {
      return legacyPath;
    }
    return hiddenPath;
  }

  getProjectConfigPath(repoName: string): string {
    const hiddenPath = path.join(
      this.getRepoDir(repoName),
      ".project.config.json",
    );
    const legacyPath = path.join(
      this.getRepoDir(repoName),
      "project.config.json",
    );
    if (!fs.existsSync(hiddenPath) && fs.existsSync(legacyPath)) {
      return legacyPath;
    }
    return hiddenPath;
  }

  getProjectConfig(repoName: string): Record<string, any> {
    const cfgPath = this.getProjectConfigPath(repoName);
    if (fs.existsSync(cfgPath)) {
      try {
        return JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
      } catch (err) {
        console.error(
          `[DocsMetadataService] Erro ao ler project.config.json:`,
          err,
        );
      }
    }
    return {};
  }

  saveProjectConfig(
    repoName: string,
    configData: any,
  ): { success: boolean; config: any } {
    const existing = this.getProjectConfig(repoName);
    const merged = { ...existing, ...configData };
    const cfgPath = this.getProjectConfigPath(repoName);
    const valRes = validateJsonSchema("project.config", merged);
    if (!valRes.valid) {
      console.warn(
        `[DocsMetadataService] Aviso de validação project.config.json:`,
        valRes.errors,
      );
    }
    fs.mkdirSync(path.dirname(cfgPath), { recursive: true });
    fs.writeFileSync(cfgPath, JSON.stringify(merged, null, 2), "utf-8");
    return { success: true, config: merged };
  }

  getProjectMetadataOptions(repoName: string): ProjectMetadataOptions {
    const config = this.getProjectConfig(repoName);

    const statuses = Array.isArray(config.statuses) ? config.statuses : [];
    const categories = Array.isArray(config.categories)
      ? config.categories
      : [];
    const tags = Array.isArray(config.tags) ? config.tags : [];
    const badges = Array.isArray(config.badges) ? config.badges : [];

    const departments: DepartmentConfig[] =
      Array.isArray(config.departments) && config.departments.length > 0
        ? config.departments
        : DEFAULT_DEPARTMENTS;

    return { statuses, categories, tags, badges, departments };
  }

  inferDepartmentFromPath(
    filePath: string,
    repoName?: string,
  ): { department?: string } {
    if (!filePath) return {};
    const clean = filePath.replace(/\\/g, "/").replace(/^\/+/, "");
    const parts = clean.split("/");
    const targetFolder = (
      parts[0] === "docs" && parts.length > 1 ? parts[1] : parts[0]
    ).toLowerCase();

    let departments: DepartmentConfig[] = DEFAULT_DEPARTMENTS;
    try {
      const config = this.getProjectConfig(repoName || "local");
      if (Array.isArray(config.departments) && config.departments.length > 0) {
        departments = config.departments;
      }
    } catch {}

    const matched = departments.find(
      (d) =>
        d.folder.toLowerCase() === targetFolder ||
        d.id.toLowerCase() === targetFolder,
    );

    if (matched) {
      return {
        department: matched.id,
      };
    }
    return {};
  }

  private metaCache = new Map<
    string,
    { data: DocumentMetadataItem[]; timestamp: number }
  >();
  private reconciliationInProgress = new Set<string>();

  clearCache(repoName?: string): void {
    if (repoName) {
      this.metaCache.delete(repoName);
    } else {
      this.metaCache.clear();
    }
  }

  loadDocsMetadata(
    repoName: string,
    forceDiskScan = false,
  ): DocumentMetadataItem[] {
    const cleanRepo = repoName || "local";
    const cached = this.metaCache.get(cleanRepo);

    // Return cached metadata if available (valid for 30s or until invalidated)
    if (cached && !forceDiskScan && Date.now() - cached.timestamp < 30000) {
      return cached.data;
    }

    const metaPath = this.getDocsMetadataPath(cleanRepo);
    const repoDir = this.getRepoDir(cleanRepo);
    let metaList: DocumentMetadataItem[] = [];

    if (fs.existsSync(metaPath)) {
      try {
        const raw = fs.readFileSync(metaPath, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          metaList = parsed.map((item) => this.sanitizeMetaItem(item));
        } else if (parsed && typeof parsed === "object" && parsed.documents) {
          // Migração de formato legado
          for (const [relPath, meta] of Object.entries(parsed.documents)) {
            const m = (meta as any) || {};
            const ext = path.extname(relPath).replace(/^\./, "") || "md";
            const name = path.basename(relPath, path.extname(relPath));
            const id = generateDocId(relPath);
            metaList.push(
              this.sanitizeMetaItem({
                id,
                name,
                title: m.title || name,
                ext,
                path: relPath,
                status: m.status || "-ð",
                categories: m.categories || m.category || "",
                tags: Array.isArray(m.tags) ? m.tags : [],
                updated_at: m.updated_at || new Date().toISOString(),
                approvers: Array.isArray(m.approvers) ? m.approvers : [],
                links: Array.isArray(m.links) ? m.links : [],
                templateId: m.templateId || "",
              }),
            );
          }
        }
      } catch (err) {
        console.error(
          `[DocsMetadataService] Erro ao ler docs.metadata.json em ${metaPath}:`,
          err,
        );
      }
    }

    // Save in cache immediately
    this.metaCache.set(cleanRepo, { data: metaList, timestamp: Date.now() });

    // Schedule background reconciliation without blocking the current request
    if (fs.existsSync(repoDir)) {
      this.scheduleBackgroundReconciliation(cleanRepo);
    }

    return metaList;
  }

  /**
   * Executa reconciliação de metadados em segundo plano para não travar a Event Loop em repositórios grandes
   */
  scheduleBackgroundReconciliation(repoName: string): void {
    const cleanRepo = repoName || "local";
    if (this.reconciliationInProgress.has(cleanRepo)) return;

    this.reconciliationInProgress.add(cleanRepo);
    setImmediate(async () => {
      try {
        const repoDir = this.getRepoDir(cleanRepo);
        if (!fs.existsSync(repoDir)) return;

        const diskFiles: string[] = [];
        const scanDir = (dir: string) => {
          try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              if (entry.name.startsWith(".") || entry.name === "node_modules")
                continue;
              const full = path.join(dir, entry.name);
              if (entry.isDirectory()) {
                scanDir(full);
              } else if (
                entry.isFile() &&
                (entry.name.endsWith(".md") || entry.name.endsWith(".markdown"))
              ) {
                diskFiles.push(
                  path.relative(repoDir, full).replace(/\\/g, "/"),
                );
              }
            }
          } catch {}
        };
        scanDir(repoDir);

        const currentCached = this.metaCache.get(cleanRepo)?.data || [];
        let metaList = [...currentCached];
        let changed = false;

        for (const relPath of diskFiles) {
          const existingIdx = metaList.findIndex((d) => d.path === relPath);
          const full = path.join(repoDir, relPath);
          let content = "";
          try {
            content = fs.readFileSync(full, "utf-8");
          } catch {}
          const extractedLinks = extractDocLinksFromMarkdown(content);
          const extractedTitle = extractDocTitleFromMarkdown(content);
          const frontmatterMeta = extractFrontmatterMeta(content);

          if (existingIdx >= 0) {
            const item = metaList[existingIdx];
            let itemModified = false;
            const currentLinksJson = JSON.stringify(
              Array.isArray(item.links) ? item.links : [],
            );
            const extractedLinksJson = JSON.stringify(extractedLinks);
            if (currentLinksJson !== extractedLinksJson) {
              item.links = extractedLinks;
              itemModified = true;
            }
            if (!item.title && extractedTitle) {
              item.title = extractedTitle;
              itemModified = true;
            }
            if (itemModified) {
              changed = true;
            }
          } else {
            const name = path.basename(relPath, path.extname(relPath));
            const ext = path.extname(relPath).replace(/^\./, "") || "md";
            metaList.push(
              this.sanitizeMetaItem({
                id: generateDocId(relPath),
                name,
                title: frontmatterMeta.title || extractedTitle || name,
                ext,
                path: relPath,
                status: frontmatterMeta.status || "",
                categories: frontmatterMeta.categories || "",
                tags: frontmatterMeta.tags || [],
                updated_at: new Date().toISOString(),
                approvers: [],
                links: extractedLinks,
                templateId: "",
              }),
            );
            changed = true;
          }
        }

        const validMetaList = metaList.filter((d) =>
          diskFiles.includes(d.path),
        );
        if (validMetaList.length !== metaList.length) {
          metaList = validMetaList;
          changed = true;
        }

        if (changed) {
          this.saveDocsMetadata(cleanRepo, metaList);
        }
      } catch (err) {
        console.warn(
          `[DocsMetadataService] Erro na reconciliação de segundo plano em ${cleanRepo}:`,
          err,
        );
      } finally {
        this.reconciliationInProgress.delete(cleanRepo);
      }
    });
  }

  saveDocsMetadata(repoName: string, metaList: DocumentMetadataItem[]): void {
    const cleanRepo = repoName || "local";
    const metaPath = this.getDocsMetadataPath(cleanRepo);
    const sanitizedList = metaList.map((item) => this.sanitizeMetaItem(item));
    this.metaCache.set(cleanRepo, {
      data: sanitizedList,
      timestamp: Date.now(),
    });

    const valRes = validateJsonSchema("docs.metadata", sanitizedList);
    if (!valRes.valid) {
      console.warn(
        `[DocsMetadataService] Aviso de validação docs.metadata.json:`,
        valRes.errors,
      );
    }

    fs.mkdirSync(path.dirname(metaPath), { recursive: true });
    fs.writeFileSync(metaPath, JSON.stringify(sanitizedList, null, 2), "utf-8");
  }

  getDocMetadata(repoName: string, filePath: string): DocumentMetadataItem {
    const cleanPath = (filePath || "").trim().replace(/^\/+/, "");
    const metaList = this.loadDocsMetadata(repoName);
    const existing = metaList.find((d) => d.path === cleanPath);
    if (existing) return existing;

    const ext = path.extname(cleanPath).replace(/^\./, "") || "md";
    const name = path.basename(cleanPath, path.extname(cleanPath));
    return this.sanitizeMetaItem({
      id: generateDocId(cleanPath),
      name,
      title: name,
      ext,
      path: cleanPath,
      status: "",
      categories: "",
      tags: [],
      updated_at: new Date().toISOString(),
      approvers: [],
      links: [],
      templateId: "",
    });
  }

  updateDocMetadataItem(
    repoName: string,
    filePath: string,
    partialMeta: Partial<DocumentMetadataItem>,
  ): { success: boolean; meta: DocumentMetadataItem } {
    const cleanPath = (filePath || "").trim().replace(/^\/+/, "");
    const metaList = this.loadDocsMetadata(repoName);
    const existingIdx = metaList.findIndex((d) => d.path === cleanPath);

    let updatedItem: DocumentMetadataItem;
    if (existingIdx >= 0) {
      updatedItem = this.sanitizeMetaItem({
        ...metaList[existingIdx],
        ...partialMeta,
        path: cleanPath,
        updated_at: new Date().toISOString(),
      });
      metaList[existingIdx] = updatedItem;
    } else {
      const ext = path.extname(cleanPath).replace(/^\./, "") || "md";
      const name = path.basename(cleanPath, path.extname(cleanPath));
      updatedItem = this.sanitizeMetaItem({
        id: generateDocId(cleanPath),
        name,
        title: partialMeta.title || name,
        ext,
        path: cleanPath,
        status: partialMeta.status || "",
        categories: partialMeta.categories || "",
        tags: Array.isArray(partialMeta.tags) ? partialMeta.tags : [],
        updated_at: new Date().toISOString(),
        approvers: Array.isArray(partialMeta.approvers)
          ? partialMeta.approvers
          : [],
        links: Array.isArray(partialMeta.links) ? partialMeta.links : [],
        templateId: partialMeta.templateId || "",
        ...partialMeta,
      });
      metaList.push(updatedItem);
    }

    this.saveDocsMetadata(repoName, metaList);

    // Se o arquivo físico existir e for markdown, sincroniza o Frontmatter no arquivo .md
    try {
      const fullPath = path.join(this.getRepoDir(repoName), cleanPath);
      if (
        fs.existsSync(fullPath) &&
        (cleanPath.endsWith(".md") || cleanPath.endsWith(".markdown"))
      ) {
        const fileContent = fs.readFileSync(fullPath, "utf-8");
        const frontmatterSyncPayload: Record<string, any> = {};
        if (partialMeta.title !== undefined) frontmatterSyncPayload.title = partialMeta.title;
        if (partialMeta.status !== undefined) frontmatterSyncPayload.status = partialMeta.status;
        if (partialMeta.categories !== undefined) frontmatterSyncPayload.categories = partialMeta.categories;
        if (partialMeta.category !== undefined) frontmatterSyncPayload.categories = partialMeta.category;
        if (partialMeta.tags !== undefined) frontmatterSyncPayload.tags = partialMeta.tags;
        if (partialMeta.department !== undefined) frontmatterSyncPayload.department = partialMeta.department;

        const updatedMarkdown = updateFrontmatterInMarkdown(fileContent, frontmatterSyncPayload);
        if (updatedMarkdown !== fileContent) {
          fs.writeFileSync(fullPath, updatedMarkdown, "utf-8");
        }
      }
    } catch (e) {
      console.warn("[DocsMetadataService] Erro ao sincronizar frontmatter no disco:", e);
    }

    return { success: true, meta: updatedItem };
  }

  deleteDocMetadata(repoName: string, filePath: string): void {
    const cleanPath = (filePath || "").trim().replace(/^\/+/, "");
    const metaList = this.loadDocsMetadata(repoName);
    const filtered = metaList.filter((d) => d.path !== cleanPath);
    if (filtered.length !== metaList.length) {
      this.saveDocsMetadata(repoName, filtered);
    }
  }

  renameDocMetadata(repoName: string, oldPath: string, newPath: string): void {
    const cleanOld = (oldPath || "").trim().replace(/^\/+/, "");
    const cleanNew = (newPath || "").trim().replace(/^\/+/, "");
    const metaList = this.loadDocsMetadata(repoName);
    const existingIdx = metaList.findIndex((d) => d.path === cleanOld);

    if (existingIdx >= 0) {
      const ext = path.extname(cleanNew).replace(/^\./, "") || "md";
      const name = path.basename(cleanNew, path.extname(cleanNew));
      metaList[existingIdx] = this.sanitizeMetaItem({
        ...metaList[existingIdx],
        id: generateDocId(cleanNew),
        name,
        path: cleanNew,
        ext,
        updated_at: new Date().toISOString(),
      });
      this.saveDocsMetadata(repoName, metaList);
    }
  }

  migrateDocMetadata(
    sourceRepo: string,
    targetRepo: string,
    oldPath: string,
    newPath: string,
  ): void {
    const cleanOld = (oldPath || "").trim().replace(/^\/+/, "");
    const cleanNew = (newPath || "").trim().replace(/^\/+/, "");
    const sourceList = this.loadDocsMetadata(sourceRepo);
    const targetList = this.loadDocsMetadata(targetRepo);

    const itemsToMigrate = sourceList.filter(
      (d) => d.path === cleanOld || d.path.startsWith(`${cleanOld}/`),
    );

    if (itemsToMigrate.length === 0) return;

    // Remove from source
    const updatedSource = sourceList.filter(
      (d) => !(d.path === cleanOld || d.path.startsWith(`${cleanOld}/`)),
    );
    this.saveDocsMetadata(sourceRepo, updatedSource);

    // Add/update in target
    for (const item of itemsToMigrate) {
      let migratedPath = cleanNew;
      if (item.path.startsWith(`${cleanOld}/`)) {
        migratedPath = `${cleanNew}${item.path.slice(cleanOld.length)}`;
      }
      const ext = path.extname(migratedPath).replace(/^\./, "") || "md";
      const name = path.basename(migratedPath, path.extname(migratedPath));

      const existingTargetIdx = targetList.findIndex(
        (d) => d.path === migratedPath,
      );
      const migratedItem = this.sanitizeMetaItem({
        ...item,
        id: generateDocId(migratedPath),
        name,
        path: migratedPath,
        ext,
        updated_at: new Date().toISOString(),
      });

      if (existingTargetIdx >= 0) {
        targetList[existingTargetIdx] = migratedItem;
      } else {
        targetList.push(migratedItem);
      }
    }

    this.saveDocsMetadata(targetRepo, targetList);
  }

  detachTemplateFromDocs(repoName: string, templateId: string): number {
    const cleanRepo = repoName || "local";
    const targetSlug = (templateId || "")
      .toLowerCase()
      .trim()
      .replace(/\.md$/, "");
    if (!targetSlug) return 0;

    const metaList = this.loadDocsMetadata(cleanRepo);
    let count = 0;
    for (const doc of metaList) {
      const docTplSlug = (doc.templateId || "")
        .toLowerCase()
        .trim()
        .replace(/\.md$/, "");
      if (docTplSlug && docTplSlug === targetSlug) {
        doc.templateId = "";
        doc.updated_at = new Date().toISOString();
        count++;
      }
    }

    if (count > 0) {
      this.saveDocsMetadata(cleanRepo, metaList);
    }
    return count;
  }

  /**
   * Resolução de Vizinhança de Grafo (1º e 2º graus)
   */
  getDocumentNeighborhood(repoName: string, filePath: string, depth = 1) {
    const cleanRepo = repoName || "local";
    const cleanPath = (filePath || "").replace(/^\/+/, "");
    const metaList = this.loadDocsMetadata(cleanRepo);
    const targetDoc = metaList.find(
      (d) => d.path === cleanPath || d.id === generateDocId(cleanPath),
    );

    if (!targetDoc)
      return { target: null, outgoing: [], incoming: [], second_degree: [] };

    // 1º Grau: Outgoing (Links que este documento aponta)
    const outgoingDocs = (targetDoc.links || [])
      .map((targetLink) => {
        const cleanTarget = targetLink.split("#")[0].replace(/^\.?\//, "");
        return metaList.find(
          (d) =>
            d.path === cleanTarget ||
            d.id === cleanTarget ||
            d.path.endsWith(cleanTarget),
        );
      })
      .filter((d): d is DocumentMetadataItem => Boolean(d));

    // 1º Grau: Incoming (Documentos que apontam para este)
    const incomingDocs = metaList.filter(
      (d) =>
        d.path !== targetDoc.path &&
        Array.isArray(d.links) &&
        d.links.some(
          (l) =>
            l.includes(cleanPath) ||
            l.includes(targetDoc.id) ||
            (targetDoc.name && l.includes(targetDoc.name)),
        ),
    );

    // 2º Grau (se solicitado)
    const secondDegreeDocs: DocumentMetadataItem[] = [];
    if (depth >= 2) {
      const firstDegreePaths = new Set([
        targetDoc.path,
        ...outgoingDocs.map((d) => d.path),
        ...incomingDocs.map((d) => d.path),
      ]);
      for (const firstDoc of [...outgoingDocs, ...incomingDocs]) {
        for (const link of firstDoc.links || []) {
          const cleanL = link.split("#")[0].replace(/^\.?\//, "");
          const match = metaList.find(
            (d) => d.path === cleanL || d.id === cleanL,
          );
          if (
            match &&
            !firstDegreePaths.has(match.path) &&
            !secondDegreeDocs.some((d) => d.path === match.path)
          ) {
            secondDegreeDocs.push(match);
          }
        }
      }
    }

    return {
      target: targetDoc,
      outgoing: outgoingDocs.map((d) => ({
        id: d.id,
        path: d.path,
        title: d.title || d.name,
        status: d.status,
        categories: d.categories,
      })),
      incoming: incomingDocs.map((d) => ({
        id: d.id,
        path: d.path,
        title: d.title || d.name,
        status: d.status,
        categories: d.categories,
      })),
      second_degree: secondDegreeDocs.map((d) => ({
        id: d.id,
        path: d.path,
        title: d.title || d.name,
        status: d.status,
      })),
    };
  }

  /**
   * Monta o Context Bundle completo para o Agente e Editor
   */
  buildDocumentContextBundle(
    repoName: string,
    filePath: string,
  ): {
    filePath: string;
    neighborhood: any;
    relevantApprovedSpecs: any[];
    contextPromptSnippet: string;
  } {
    const cleanRepo = repoName || "local";
    const cleanPath = (filePath || "").replace(/^\/+/, "");
    const neighborhood = this.getDocumentNeighborhood(cleanRepo, cleanPath, 2);
    const metaList = this.loadDocsMetadata(cleanRepo);

    // Specs aprovadas relevantes
    const approvedSpecs = metaList
      .filter(
        (d) => d.status?.toLowerCase() === "approved" && d.path !== cleanPath,
      )
      .slice(0, 5)
      .map((d) => ({
        id: d.id,
        path: d.path,
        title: d.title || d.name,
        categories: d.categories,
      }));

    let snippet = `\n### Contexto do Grafo de Documentação Viva (${cleanPath}):\n`;
    if (neighborhood.target) {
      snippet += `- **Status do Doc:** ${neighborhood.target.status || "-"} | **Categoria:** ${neighborhood.target.categories || "geral"}\n`;
    }
    if (neighborhood.outgoing.length > 0) {
      snippet += `- **Dependências (Links de Saída):** ${neighborhood.outgoing.map((d: any) => `[${d.title}](${d.path}) [${d.status}]`).join(", ")}\n`;
    }
    if (neighborhood.incoming.length > 0) {
      snippet += `- **Documentos que dependem deste:** ${neighborhood.incoming.map((d: any) => `[${d.title}](${d.path}) [${d.status}]`).join(", ")}\n`;
    }
    if (approvedSpecs.length > 0) {
      snippet += `- **Specs Canônicas Aprovadas:** ${approvedSpecs.map((s) => `[${s.title}](${s.path})`).join(", ")}\n`;
    }

    return {
      filePath: cleanPath,
      neighborhood,
      relevantApprovedSpecs: approvedSpecs,
      contextPromptSnippet: snippet,
    };
  }

  private sanitizeMetaItem(item: any, repoName?: string): DocumentMetadataItem {
    const cleanItem = { ...item };
    // Remove layer e badge se existirem
    delete cleanItem.layer;
    delete cleanItem.badge;

    // Normaliza category para categories
    if (cleanItem.category && !cleanItem.categories) {
      cleanItem.categories = cleanItem.category;
      delete cleanItem.category;
    }

    const inferred = cleanItem.path
      ? this.inferDepartmentFromPath(cleanItem.path, repoName)
      : {};
    const resolvedDept = cleanItem.department || inferred.department;

    return {
      id: cleanItem.id || generateDocId(cleanItem.path || "doc"),
      name:
        cleanItem.name ||
        path.basename(
          cleanItem.path || "doc",
          path.extname(cleanItem.path || ""),
        ),
      title: cleanItem.title || cleanItem.name || "",
      ext: cleanItem.ext || "md",
      path: cleanItem.path || "",
      status: cleanItem.status || "",
      categories: cleanItem.categories || "",
      tags: Array.isArray(cleanItem.tags) ? cleanItem.tags : [],
      updated_at: cleanItem.updated_at || new Date().toISOString(),
      approvers: Array.isArray(cleanItem.approvers) ? cleanItem.approvers : [],
      links: Array.isArray(cleanItem.links) ? cleanItem.links : [],
      templateId: cleanItem.templateId || "",
      prompt: cleanItem.prompt || "",
      department: resolvedDept,
    };
  }
}

export const docsMetadataService = new DocsMetadataService();
