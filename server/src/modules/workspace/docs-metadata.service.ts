import fs from 'node:fs';
import path from 'node:path';
import { PROJECTS_DIR } from '../../config/constants.js';
import { validateJsonSchema } from '../../utils/schema.validator.js';

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
  [key: string]: any;
}

export interface ProjectMetadataOptions {
  categories: string[];
  statuses: Array<{ key: string; label: string; badge?: string }>;
  tags: string[];
}

export function generateDocId(filePath: string): string {
  return filePath
    .replace(/\.md$/, '')
    .replace(/[\/\\]/g, '-')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

export function extractDocLinksFromMarkdown(content: string): string[] {
  if (!content) return [];
  const links: string[] = [];
  const regex = /\[.*?\]\(([^)]+)\)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const rawTarget = match[1].trim();
    if (!rawTarget.startsWith('http://') && !rawTarget.startsWith('https://') && !rawTarget.startsWith('mailto:')) {
      const cleanTarget = rawTarget.split('#')[0].replace(/^\.?\//, '');
      if (
        cleanTarget.endsWith('.md') ||
        cleanTarget.endsWith('.markdown') ||
        cleanTarget.length > 0 ||
        rawTarget.startsWith('#') ||
        rawTarget.startsWith(':~:text=')
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
    return match[1].trim().replace(/^[\uD800-\uDBFF\uDC00-\uDFFF\s]+/g, ''); // remove initial emojis if any
  }
  return null;
}

export class DocsMetadataService {
  private getRepoDir(repoName: string): string {
    return path.join(PROJECTS_DIR, repoName || 'local');
  }

  getDocsMetadataPath(repoName: string): string {
    const hiddenPath = path.join(this.getRepoDir(repoName), '.docs.metadata.json');
    const legacyPath = path.join(this.getRepoDir(repoName), 'project', 'docs.metadata.json');
    if (!fs.existsSync(hiddenPath) && fs.existsSync(legacyPath)) {
      return legacyPath;
    }
    return hiddenPath;
  }

  getProjectConfigPath(repoName: string): string {
    const hiddenPath = path.join(this.getRepoDir(repoName), '.project.config.json');
    const legacyPath = path.join(this.getRepoDir(repoName), 'project.config.json');
    if (!fs.existsSync(hiddenPath) && fs.existsSync(legacyPath)) {
      return legacyPath;
    }
    return hiddenPath;
  }

  getProjectConfig(repoName: string): Record<string, any> {
    const cfgPath = this.getProjectConfigPath(repoName);
    if (fs.existsSync(cfgPath)) {
      try {
        return JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
      } catch (err) {
        console.error(`[DocsMetadataService] Erro ao ler project.config.json:`, err);
      }
    }
    return {};
  }

  saveProjectConfig(repoName: string, configData: any): { success: boolean; config: any } {
    const cfgPath = this.getProjectConfigPath(repoName);
    const valRes = validateJsonSchema('project.config', configData);
    if (!valRes.valid) {
      console.warn(`[DocsMetadataService] Aviso de validação project.config.json:`, valRes.errors);
    }
    fs.mkdirSync(path.dirname(cfgPath), { recursive: true });
    fs.writeFileSync(cfgPath, JSON.stringify(configData, null, 2), 'utf-8');
    return { success: true, config: configData };
  }

  getProjectMetadataOptions(repoName: string): ProjectMetadataOptions {
    const config = this.getProjectConfig(repoName);
    const defaultStatuses = [
      { key: 'draft', label: 'Rascunho (DRAFT)', badge: 'badge-neutral' },
      { key: 'proposed', label: 'Proposto (PROPOSED)', badge: 'badge-warning' },
      { key: 'review', label: 'Em Revisão (REVIEW)', badge: 'badge-info' },
      { key: 'approved', label: 'Aprovado (APPROVED)', badge: 'badge-success' },
      { key: 'superseded', label: 'Substituído (SUPERSEDED)', badge: 'badge-secondary' },
      { key: 'deprecated', label: 'Obsoleto (DEPRECATED)', badge: 'badge-danger' },
    ];
    const defaultCategories = ['geral', 'arquitetura', 'engenharia', 'produto', 'segurança', 'infraestrutura', 'dados'];
    const defaultTags = ['backend', 'frontend', 'api', 'database', 'security', 'core', 'auth', 'mobile', 'spec'];

    const statuses = Array.isArray(config.statuses) && config.statuses.length > 0
      ? config.statuses
      : defaultStatuses;

    const categories = Array.isArray(config.categories) && config.categories.length > 0
      ? config.categories
      : defaultCategories;

    const tags = Array.isArray(config.tags) && config.tags.length > 0
      ? config.tags
      : defaultTags;

    return { statuses, categories, tags };
  }

  loadDocsMetadata(repoName: string): DocumentMetadataItem[] {
    const metaPath = this.getDocsMetadataPath(repoName);
    const repoDir = this.getRepoDir(repoName);
    let metaList: DocumentMetadataItem[] = [];

    if (fs.existsSync(metaPath)) {
      try {
        const raw = fs.readFileSync(metaPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          metaList = parsed.map((item) => this.sanitizeMetaItem(item));
        } else if (parsed && typeof parsed === 'object' && parsed.documents) {
          // Migração de formato legado
          for (const [relPath, meta] of Object.entries(parsed.documents)) {
            const m = (meta as any) || {};
            const ext = path.extname(relPath).replace(/^\./, '') || 'md';
            const name = path.basename(relPath, path.extname(relPath));
            const id = generateDocId(relPath);
            metaList.push(
              this.sanitizeMetaItem({
                id,
                name,
                title: m.title || name,
                ext,
                path: relPath,
                status: m.status || 'draft',
                categories: m.categories || m.category || '',
                tags: Array.isArray(m.tags) ? m.tags : [],
                updated_at: m.updated_at || new Date().toISOString(),
                approvers: Array.isArray(m.approvers) ? m.approvers : [],
                links: Array.isArray(m.links) ? m.links : [],
                templateId: m.templateId || '',
              })
            );
          }
        }
      } catch (err) {
        console.error(`[DocsMetadataService] Erro ao ler docs.metadata.json em ${metaPath}:`, err);
      }
    }

    // Auto-Reconciliação com o disco
    let changed = false;
    if (fs.existsSync(repoDir)) {
      const diskFiles: string[] = [];
      const scanDir = (dir: string) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            scanDir(full);
          } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.markdown'))) {
            diskFiles.push(path.relative(repoDir, full).replace(/\\/g, '/'));
          }
        }
      };
      try {
        scanDir(repoDir);
      } catch {}

      // 1. Garantir que todo documento existente no workspace tenha metadados e links sincronizados
      for (const relPath of diskFiles) {
        const existingIdx = metaList.findIndex((d) => d.path === relPath);
        const full = path.join(repoDir, relPath);
        let content = '';
        try {
          content = fs.readFileSync(full, 'utf-8');
        } catch {}
        const extractedLinks = extractDocLinksFromMarkdown(content);
        const extractedTitle = extractDocTitleFromMarkdown(content);

        if (existingIdx >= 0) {
          const item = metaList[existingIdx];
          let itemModified = false;
          if (!Array.isArray(item.links) || (item.links.length === 0 && extractedLinks.length > 0)) {
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
          const ext = path.extname(relPath).replace(/^\./, '') || 'md';
          metaList.push(
            this.sanitizeMetaItem({
              id: generateDocId(relPath),
              name,
              title: extractedTitle || name,
              ext,
              path: relPath,
              status: 'draft',
              categories: 'geral',
              tags: [],
              updated_at: new Date().toISOString(),
              approvers: [],
              links: extractedLinks,
              templateId: '',
            })
          );
          changed = true;
        }
      }

      // 2. Remover entradas órfãs (arquivos apagados manualmente no disco)
      const validMetaList = metaList.filter((d) => diskFiles.includes(d.path));
      if (validMetaList.length !== metaList.length) {
        metaList = validMetaList;
        changed = true;
      }
    }

    if (changed || (!fs.existsSync(metaPath) && metaList.length > 0)) {
      this.saveDocsMetadata(repoName, metaList);
    }

    return metaList;
  }

  saveDocsMetadata(repoName: string, metaList: DocumentMetadataItem[]): void {
    const metaPath = this.getDocsMetadataPath(repoName);
    const sanitizedList = metaList.map((item) => this.sanitizeMetaItem(item));
    const valRes = validateJsonSchema('docs.metadata', sanitizedList);
    if (!valRes.valid) {
      console.warn(`[DocsMetadataService] Aviso de validação docs.metadata.json:`, valRes.errors);
    }

    fs.mkdirSync(path.dirname(metaPath), { recursive: true });
    fs.writeFileSync(metaPath, JSON.stringify(sanitizedList, null, 2), 'utf-8');
  }

  getDocMetadata(repoName: string, filePath: string): DocumentMetadataItem {
    const cleanPath = (filePath || '').trim().replace(/^\/+/, '');
    const metaList = this.loadDocsMetadata(repoName);
    const existing = metaList.find((d) => d.path === cleanPath);
    if (existing) return existing;

    const ext = path.extname(cleanPath).replace(/^\./, '') || 'md';
    const name = path.basename(cleanPath, path.extname(cleanPath));
    return this.sanitizeMetaItem({
      id: generateDocId(cleanPath),
      name,
      title: name,
      ext,
      path: cleanPath,
      status: 'draft',
      categories: 'geral',
      tags: [],
      updated_at: new Date().toISOString(),
      approvers: [],
      links: [],
      templateId: '',
    });
  }

  updateDocMetadataItem(repoName: string, filePath: string, partialMeta: Partial<DocumentMetadataItem>): { success: boolean; meta: DocumentMetadataItem } {
    const cleanPath = (filePath || '').trim().replace(/^\/+/, '');
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
      const ext = path.extname(cleanPath).replace(/^\./, '') || 'md';
      const name = path.basename(cleanPath, path.extname(cleanPath));
      updatedItem = this.sanitizeMetaItem({
        id: generateDocId(cleanPath),
        name,
        title: partialMeta.title || name,
        ext,
        path: cleanPath,
        status: partialMeta.status || 'draft',
        categories: partialMeta.categories || 'geral',
        tags: Array.isArray(partialMeta.tags) ? partialMeta.tags : [],
        updated_at: new Date().toISOString(),
        approvers: Array.isArray(partialMeta.approvers) ? partialMeta.approvers : [],
        links: Array.isArray(partialMeta.links) ? partialMeta.links : [],
        templateId: partialMeta.templateId || '',
        ...partialMeta,
      });
      metaList.push(updatedItem);
    }

    this.saveDocsMetadata(repoName, metaList);
    return { success: true, meta: updatedItem };
  }

  deleteDocMetadata(repoName: string, filePath: string): void {
    const cleanPath = (filePath || '').trim().replace(/^\/+/, '');
    const metaList = this.loadDocsMetadata(repoName);
    const filtered = metaList.filter((d) => d.path !== cleanPath);
    if (filtered.length !== metaList.length) {
      this.saveDocsMetadata(repoName, filtered);
    }
  }

  renameDocMetadata(repoName: string, oldPath: string, newPath: string): void {
    const cleanOld = (oldPath || '').trim().replace(/^\/+/, '');
    const cleanNew = (newPath || '').trim().replace(/^\/+/, '');
    const metaList = this.loadDocsMetadata(repoName);
    const existingIdx = metaList.findIndex((d) => d.path === cleanOld);

    if (existingIdx >= 0) {
      const ext = path.extname(cleanNew).replace(/^\./, '') || 'md';
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

  private sanitizeMetaItem(item: any): DocumentMetadataItem {
    const cleanItem = { ...item };
    // Remove layer e badge se existirem
    delete cleanItem.layer;
    delete cleanItem.badge;

    // Normaliza category para categories
    if (cleanItem.category && !cleanItem.categories) {
      cleanItem.categories = cleanItem.category;
      delete cleanItem.category;
    }

    return {
      id: cleanItem.id || generateDocId(cleanItem.path || 'doc'),
      name: cleanItem.name || path.basename(cleanItem.path || 'doc', path.extname(cleanItem.path || '')),
      title: cleanItem.title || cleanItem.name || '',
      ext: cleanItem.ext || 'md',
      path: cleanItem.path || '',
      status: cleanItem.status || 'draft',
      categories: cleanItem.categories || '',
      tags: Array.isArray(cleanItem.tags) ? cleanItem.tags : [],
      updated_at: cleanItem.updated_at || new Date().toISOString(),
      approvers: Array.isArray(cleanItem.approvers) ? cleanItem.approvers : [],
      links: Array.isArray(cleanItem.links) ? cleanItem.links : [],
      templateId: cleanItem.templateId || '',
    };
  }
}

export const docsMetadataService = new DocsMetadataService();
