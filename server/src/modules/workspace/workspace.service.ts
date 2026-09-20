import fs from 'node:fs';
import path from 'node:path';
import { PROJECTS_DIR } from '../../config/constants.js';
import { loadConfig, saveConfig, recordChange, ensureDefaultRepoFiles } from '../../config/storage.js';
import { computeDiff } from '../../utils/diff.js';
import { validateJsonSchema } from '../../utils/schema.validator.js';

export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
  title?: string;
  category?: string;
  layer?: string;
  badge?: string;
  status?: string;
  last_modified?: number;
}

export interface DocumentMetadataItem {
  id: string;
  name: string;
  title?: string;
  ext: string;
  path: string;
  status: string;
  category: string;
  layer: string;
  badge: string;
  tags: string[];
  updated_at: string;
  approvers: string[];
  links: string[];
  templateId: string;
  [key: string]: any;
}

export function generateDocId(filePath: string): string {
  const clean = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
  const dir = path.dirname(clean);
  const base = path.basename(clean, path.extname(clean));
  if (dir === '.' || !dir) {
    return base;
  }
  return `${dir.replace(/\//g, '-')}-${base}`;
}

export class WorkspaceService {
  private getRepoDir(repoName: string): string {
    return path.join(PROJECTS_DIR, repoName || 'local');
  }

  private getDocsMetadataPath(repoName: string): string {
    const hiddenPath = path.join(this.getRepoDir(repoName), '.docs.metadata.json');
    const legacyPath = path.join(this.getRepoDir(repoName), 'project', 'docs.metadata.json');
    if (!fs.existsSync(hiddenPath) && fs.existsSync(legacyPath)) {
      return legacyPath;
    }
    return hiddenPath;
  }

  loadDocsMetadata(repoName: string): DocumentMetadataItem[] {
    const metaPath = this.getDocsMetadataPath(repoName);
    if (fs.existsSync(metaPath)) {
      try {
        const raw = fs.readFileSync(metaPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
        // Migração de formato legado ({ version: "...", documents: { ... } })
        if (parsed && typeof parsed === 'object' && parsed.documents) {
          const migrated: DocumentMetadataItem[] = [];
          for (const [relPath, meta] of Object.entries(parsed.documents)) {
            const m = (meta as any) || {};
            const ext = path.extname(relPath).replace(/^\./, '') || 'md';
            const name = path.basename(relPath, path.extname(relPath));
            const id = generateDocId(relPath);
            migrated.push({
              id,
              name,
              title: m.title || name,
              ext,
              path: relPath,
              status: m.status || 'draft',
              category: m.category || '',
              layer: m.layer || '',
              badge: m.badge || '',
              tags: Array.isArray(m.tags) ? m.tags : [],
              updated_at: m.updated_at || new Date().toISOString(),
              approvers: Array.isArray(m.approvers) ? m.approvers : [],
              links: Array.isArray(m.links) ? m.links : [],
              templateId: m.templateId || '',
              ...m,
            });
          }
          this.saveDocsMetadata(repoName, migrated);
          return migrated;
        }
      } catch (err) {
        console.error(`[Workspace] Erro ao ler docs.metadata.json em ${metaPath}:`, err);
      }
    }
    return [];
  }

  saveDocsMetadata(repoName: string, metaList: DocumentMetadataItem[]): void {
    const metaPath = this.getDocsMetadataPath(repoName);
    const valRes = validateJsonSchema('docs.metadata', metaList);
    if (!valRes.valid) {
      console.warn(`[Workspace] Aviso de validação docs.metadata.json:`, valRes.errors);
    }

    fs.mkdirSync(path.dirname(metaPath), { recursive: true });
    fs.writeFileSync(metaPath, JSON.stringify(metaList, null, 2), 'utf-8');
  }

  buildTree(dir: string, baseDir: string, docsMetadata?: DocumentMetadataItem[]): TreeNode[] {
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const nodes: TreeNode[] = [];

    const metaList = docsMetadata || [];

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        nodes.push({
          name: entry.name,
          path: relPath,
          type: 'directory',
          children: this.buildTree(fullPath, baseDir, metaList),
        });
      } else if (entry.isFile()) {
        const docMeta = metaList.find((d) => d.path === relPath) || ({} as Partial<DocumentMetadataItem>);
        const stat = fs.statSync(fullPath);

        nodes.push({
          name: entry.name,
          path: relPath,
          type: 'file',
          title: docMeta.title || docMeta.name || entry.name.replace(/\.[^/.]+$/, ''),
          category: docMeta.category || docMeta.layer || '',
          layer: docMeta.layer || '',
          badge: docMeta.badge || '',
          status: docMeta.status || '',
          last_modified: stat.mtimeMs,
        });
      }
    }

    return nodes.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'directory' ? -1 : 1;
    });
  }

  getTree() {
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || 'local';
    const repoDir = this.getRepoDir(repoName);
    ensureDefaultRepoFiles(repoName);

    const docsMetadata = this.loadDocsMetadata(repoName);
    const tree = this.buildTree(repoDir, repoDir, docsMetadata);
    return {
      repo: repoName,
      tree,
    };
  }

  getFile(filePath: string) {
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || 'local';
    const cleanPath = (filePath || '').trim().replace(/^\/+/, '');
    const fullPath = path.join(this.getRepoDir(repoName), cleanPath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Arquivo '${cleanPath}' não encontrado.`);
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const docsMetadata = this.loadDocsMetadata(repoName);
    const meta = docsMetadata.find((d) => d.path === cleanPath) || {
      id: generateDocId(cleanPath),
      name: path.basename(cleanPath, path.extname(cleanPath)),
      title: path.basename(cleanPath, path.extname(cleanPath)),
      ext: path.extname(cleanPath).replace(/^\./, '') || 'md',
      path: cleanPath,
      status: 'draft',
      category: '',
      layer: '',
      badge: '',
      tags: [],
      updated_at: new Date().toISOString(),
      approvers: [],
      links: [],
      templateId: '',
    };

    return {
      path: cleanPath,
      content,
      meta,
      repo: repoName,
    };
  }

  saveFile(filePath: string, content: string, meta?: any) {
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || 'local';
    const cleanPath = (filePath || '').trim().replace(/^\/+/, '');
    const fullPath = path.join(this.getRepoDir(repoName), cleanPath);

    let oldContent = '';
    let changeType: 'ADDED' | 'MODIFIED' = 'ADDED';

    if (fs.existsSync(fullPath)) {
      oldContent = fs.readFileSync(fullPath, 'utf-8');
      changeType = 'MODIFIED';
    } else {
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    }

    fs.writeFileSync(fullPath, content, 'utf-8');
    recordChange(repoName, cleanPath, changeType, oldContent, content);

    // Update centralized metadata list
    const docsMetadata = this.loadDocsMetadata(repoName);
    const existingIdx = docsMetadata.findIndex((d) => d.path === cleanPath);
    const ext = path.extname(cleanPath).replace(/^\./, '') || 'md';
    const name = path.basename(cleanPath, path.extname(cleanPath));

    let updatedMetaItem: DocumentMetadataItem;

    if (existingIdx >= 0) {
      updatedMetaItem = {
        ...docsMetadata[existingIdx],
        ...(meta && typeof meta === 'object' ? meta : {}),
        updated_at: new Date().toISOString(),
      };
      docsMetadata[existingIdx] = updatedMetaItem;
    } else {
      updatedMetaItem = {
        id: generateDocId(cleanPath),
        name,
        title: meta?.title || name,
        ext,
        path: cleanPath,
        status: meta?.status || 'draft',
        category: meta?.category || '',
        layer: meta?.layer || '',
        badge: meta?.badge || '',
        tags: Array.isArray(meta?.tags) ? meta.tags : [],
        updated_at: new Date().toISOString(),
        approvers: Array.isArray(meta?.approvers) ? meta.approvers : [],
        links: Array.isArray(meta?.links) ? meta.links : [],
        templateId: meta?.templateId || '',
        ...(meta && typeof meta === 'object' ? meta : {}),
      };
      docsMetadata.push(updatedMetaItem);
    }

    this.saveDocsMetadata(repoName, docsMetadata);

    const repoDir = this.getRepoDir(repoName);
    const newTree = this.buildTree(repoDir, repoDir, docsMetadata);

    return {
      success: true,
      path: cleanPath,
      meta: updatedMetaItem,
      tree: newTree,
    };
  }

  createFile(filePath: string, initialContent: string = '', isFolder: boolean = false, meta?: any) {
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || 'local';
    let cleanPath = (filePath || '').trim().replace(/^\/+/, '').replace(/\/+$/, '');

    if (!cleanPath) {
      throw new Error('Caminho não pode ser vazio.');
    }

    const repoDir = this.getRepoDir(repoName);

    if (isFolder) {
      const fullPath = path.join(repoDir, cleanPath);
      if (fs.existsSync(fullPath)) {
        throw new Error(`A pasta '${cleanPath}' já existe.`);
      }
      fs.mkdirSync(fullPath, { recursive: true });
      const docsMetadata = this.loadDocsMetadata(repoName);
      const newTree = this.buildTree(repoDir, repoDir, docsMetadata);
      return {
        success: true,
        path: cleanPath,
        is_folder: true,
        tree: newTree,
      };
    }

    if (!path.extname(cleanPath)) {
      cleanPath += '.md';
    }

    const fullPath = path.join(repoDir, cleanPath);
    if (fs.existsSync(fullPath)) {
      throw new Error(`Arquivo '${cleanPath}' já existe.`);
    }

    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    const content = initialContent || `# ${path.basename(cleanPath, path.extname(cleanPath))}\n\nNovo documento criado.`;
    fs.writeFileSync(fullPath, content, 'utf-8');

    recordChange(repoName, cleanPath, 'ADDED', '', content);

    // Central metadata entry (flat array)
    const ext = path.extname(cleanPath).replace(/^\./, '') || 'md';
    const name = path.basename(cleanPath, path.extname(cleanPath));
    const newItem: DocumentMetadataItem = {
      id: generateDocId(cleanPath),
      name,
      title: meta?.title || name,
      ext,
      path: cleanPath,
      status: meta?.status || 'draft',
      category: meta?.category || '',
      layer: meta?.layer || '',
      badge: meta?.badge || '',
      tags: Array.isArray(meta?.tags) ? meta.tags : [],
      updated_at: new Date().toISOString(),
      approvers: Array.isArray(meta?.approvers) ? meta.approvers : [],
      links: Array.isArray(meta?.links) ? meta.links : [],
      templateId: meta?.templateId || '',
      ...(meta && typeof meta === 'object' ? meta : {}),
    };

    let docsMetadata = this.loadDocsMetadata(repoName).filter((d) => d.path !== cleanPath);
    docsMetadata.push(newItem);
    this.saveDocsMetadata(repoName, docsMetadata);

    const newTree = this.buildTree(repoDir, repoDir, docsMetadata);

    return {
      success: true,
      path: cleanPath,
      is_folder: false,
      meta: newItem,
      tree: newTree,
    };
  }

  renameFile(oldPath: string, newPath: string) {
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || 'local';
    const cleanOld = (oldPath || '').trim().replace(/^\/+/, '').replace(/\/+$/, '');
    let cleanNew = (newPath || '').trim().replace(/^\/+/, '').replace(/\/+$/, '');

    const fullOld = path.join(this.getRepoDir(repoName), cleanOld);
    if (!fs.existsSync(fullOld)) {
      throw new Error(`Origem '${cleanOld}' não existe.`);
    }

    const isDir = fs.statSync(fullOld).isDirectory();
    if (!isDir && !path.extname(cleanNew)) {
      cleanNew += '.md';
    }

    const fullNew = path.join(this.getRepoDir(repoName), cleanNew);
    if (fs.existsSync(fullNew)) {
      throw new Error(`Destino '${cleanNew}' já existe.`);
    }

    fs.mkdirSync(path.dirname(fullNew), { recursive: true });
    fs.renameSync(fullOld, fullNew);

    let oldContent = '';
    if (!isDir) {
      if (fs.existsSync(fullNew)) {
        oldContent = fs.readFileSync(fullNew, 'utf-8');
      }
      recordChange(repoName, cleanOld, 'DELETED', oldContent, '');
      recordChange(repoName, cleanNew, 'ADDED', '', oldContent);
    }

    // Update metadata list
    const docsMetadata = this.loadDocsMetadata(repoName);
    let changed = false;

    if (!isDir) {
      const found = docsMetadata.find((d) => d.path === cleanOld);
      if (found) {
        found.path = cleanNew;
        found.name = path.basename(cleanNew, path.extname(cleanNew));
        found.ext = path.extname(cleanNew).replace(/^\./, '') || 'md';
        found.id = generateDocId(cleanNew);
        found.updated_at = new Date().toISOString();
        changed = true;
      }
    } else {
      // Renomear pasta: atualiza todos os caminhos filhos
      for (const item of docsMetadata) {
        if (item.path === cleanOld || item.path.startsWith(cleanOld + '/')) {
          const rest = item.path.slice(cleanOld.length);
          item.path = `${cleanNew}${rest}`;
          item.name = path.basename(item.path, path.extname(item.path));
          item.ext = path.extname(item.path).replace(/^\./, '') || 'md';
          item.id = generateDocId(item.path);
          item.updated_at = new Date().toISOString();
          changed = true;
        }
      }
    }

    if (changed) {
      this.saveDocsMetadata(repoName, docsMetadata);
    }

    const repoDir = this.getRepoDir(repoName);
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
    const repoName = cfg.active_repo?.name || 'local';
    const cleanPath = (filePath || '').trim().replace(/^\/+/, '');

    if (!cleanPath) {
      throw new Error('Caminho de arquivo inválido.');
    }

    const fullPath = path.join(this.getRepoDir(repoName), cleanPath);
    let oldContent = '';

    if (fs.existsSync(fullPath)) {
      if (fs.statSync(fullPath).isDirectory()) {
        fs.rmSync(fullPath, { recursive: true, force: true });
      } else {
        oldContent = fs.readFileSync(fullPath, 'utf-8');
        fs.unlinkSync(fullPath);
      }
    }

    recordChange(repoName, cleanPath, 'DELETED', oldContent, '');

    // Remove from metadata list (including nested files if folder)
    let docsMetadata = this.loadDocsMetadata(repoName);
    const initialLen = docsMetadata.length;
    docsMetadata = docsMetadata.filter((d) => d.path !== cleanPath && !d.path.startsWith(cleanPath + '/'));

    if (docsMetadata.length !== initialLen) {
      this.saveDocsMetadata(repoName, docsMetadata);
    }

    const repoDir = this.getRepoDir(repoName);
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
      return { changes: [], total_additions: 0, total_deletions: 0, guardrail: 'CLEAN' };
    }

    const repoName = activeRepo.name || 'local';
    const rawChanges = cfg.workspace_changes?.[repoName] || [];

    const detailedChanges = [];
    let totalAdditions = 0;
    let totalDeletions = 0;

    for (const c of rawChanges) {
      const diffData = computeDiff(c.old_content || '', c.new_content || '', c.path);
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
    const guardrail = totalLines < 120 ? 'PEQUENO (Ideal)' : totalLines < 350 ? 'MÉDIO' : 'GRANDE (Atenção)';

    return {
      repo: activeRepo,
      changes: detailedChanges,
      total_additions: totalAdditions,
      total_deletions: totalDeletions,
      total_files: detailedChanges.length,
      guardrail,
    };
  }

  discardChanges(paths?: string[]) {
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || 'local';
    const repoDir = this.getRepoDir(repoName);
    const rawChanges = cfg.workspace_changes?.[repoName] || [];

    const targetPaths = paths && paths.length > 0 ? new Set(paths) : null;
    const remainingChanges = [];

    for (const change of rawChanges) {
      if (!targetPaths || targetPaths.has(change.path)) {
        const fullPath = path.join(repoDir, change.path);
        try {
          if (change.type === 'ADDED') {
            if (fs.existsSync(fullPath)) {
              if (fs.statSync(fullPath).isDirectory()) {
                fs.rmSync(fullPath, { recursive: true, force: true });
              } else {
                fs.unlinkSync(fullPath);
              }
            }
          } else if (change.type === 'MODIFIED' || change.type === 'DELETED') {
            if (change.old_content) {
              fs.mkdirSync(path.dirname(fullPath), { recursive: true });
              fs.writeFileSync(fullPath, change.old_content, 'utf-8');
            }
          }
        } catch (e) {
          console.error(`Erro ao descartar mudança em ${change.path}:`, e);
        }
      } else {
        remainingChanges.push(change);
      }
    }

    cfg.workspace_changes[repoName] = remainingChanges;
    saveConfig(cfg);

    const docsMetadata = this.loadDocsMetadata(repoName);
    const newTree = this.buildTree(repoDir, repoDir, docsMetadata);
    return {
      success: true,
      message: 'Alterações descartadas com sucesso.',
      tree: newTree,
    };
  }

  getDocumentContext(filePath: string) {
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || 'local';
    const cleanPath = (filePath || '').trim().replace(/^\/+/, '');
    const repoDir = this.getRepoDir(repoName);
    const docsMetadata = this.loadDocsMetadata(repoName);

    const contextItems: any[] = [];
    const collectDocs = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const full = path.join(dir, entry.name);
        const rel = path.relative(repoDir, full).replace(/\\/g, '/');
        if (entry.isDirectory()) {
          collectDocs(full);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          try {
            const content = fs.readFileSync(full, 'utf-8');
            const docMeta = docsMetadata.find((d) => d.path === rel) || ({} as Partial<DocumentMetadataItem>);
            contextItems.push({
              path: rel,
              title: docMeta.title || docMeta.name || entry.name.replace('.md', ''),
              layer: docMeta.layer || '',
              badge: docMeta.badge || '',
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
      documents: contextItems,
    };
  }
}

export const workspaceService = new WorkspaceService();
