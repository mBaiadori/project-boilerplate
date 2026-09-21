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
  return filePath
    .replace(/\.md$/, '')
    .replace(/[\/\\]/g, '-')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

function extractDocLinksFromMarkdown(content: string): string[] {
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
    const repoDir = this.getRepoDir(repoName);
    let metaList: DocumentMetadataItem[] = [];

    if (fs.existsSync(metaPath)) {
      try {
        const raw = fs.readFileSync(metaPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          metaList = parsed;
        } else if (parsed && typeof parsed === 'object' && parsed.documents) {
          // Migração de formato legado ({ version: "...", documents: { ... } })
          for (const [relPath, meta] of Object.entries(parsed.documents)) {
            const m = (meta as any) || {};
            const ext = path.extname(relPath).replace(/^\./, '') || 'md';
            const name = path.basename(relPath, path.extname(relPath));
            const id = generateDocId(relPath);
            metaList.push({
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
        }
      } catch (err) {
        console.error(`[Workspace] Erro ao ler docs.metadata.json em ${metaPath}:`, err);
      }
    }

    // Auto-Reconciliation: .docs.metadata.json como fonte centralizada de persistência
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

        if (existingIdx >= 0) {
          const item = metaList[existingIdx];
          // Atualiza links se estiver vazio ou diferente dos links extraídos do markdown
          if (!Array.isArray(item.links) || (item.links.length === 0 && extractedLinks.length > 0)) {
            item.links = extractedLinks;
            changed = true;
          }
        } else {
          const name = path.basename(relPath, path.extname(relPath));
          const ext = path.extname(relPath).replace(/^\./, '') || 'md';
          metaList.push({
            id: generateDocId(relPath),
            name,
            title: name,
            ext,
            path: relPath,
            status: 'draft',
            category: '',
            layer: '',
            badge: '',
            tags: [],
            updated_at: new Date().toISOString(),
            approvers: [],
            links: extractedLinks,
            templateId: '',
          });
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
    // Extrair links automaticamente do conteúdo markdown para enriquecer o .docs.metadata.json
    const extractedLinks = extractDocLinksFromMarkdown(content);
    const finalLinks = Array.from(new Set([...extractedLinks, ...(Array.isArray(meta?.links) ? meta.links : [])]));

    if (existingIdx >= 0) {
      updatedMetaItem = {
        ...docsMetadata[existingIdx],
        ...(meta && typeof meta === 'object' ? meta : {}),
        links: finalLinks,
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
        links: finalLinks,
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
        throw new Error(`Pasta '${cleanPath}' já existe.`);
      }
      fs.mkdirSync(fullPath, { recursive: true });
      recordChange(repoName, cleanPath, 'ADDED', '', '');

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
    fs.writeFileSync(fullPath, initialContent, 'utf-8');

    recordChange(repoName, cleanPath, 'ADDED', '', initialContent);

    // Central metadata entry (flat array)
    const ext = path.extname(cleanPath).replace(/^\./, '') || 'md';
    const name = path.basename(cleanPath, path.extname(cleanPath));
    const extractedLinks = extractDocLinksFromMarkdown(initialContent);

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
      links: Array.isArray(meta?.links) ? meta.links : extractedLinks,
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

    // Atualizar referências de links em outros documentos que apontavam para oldPath
    for (const doc of docsMetadata) {
      if (Array.isArray(doc.links)) {
        doc.links = doc.links.map(l => {
          const hash = l.includes('#') ? l.slice(l.indexOf('#')) : '';
          const lClean = l.split('#')[0].replace(/^\.?\//, '');
          if (lClean === cleanOld) {
            changed = true;
            return `${cleanNew}${hash}`;
          }
          return l;
        });
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

    // Limpar links órfãos que apontavam para o arquivo apagado
    const deletedBase = path.basename(cleanPath);
    const deletedNoExt = path.basename(cleanPath, path.extname(cleanPath));
    for (const doc of docsMetadata) {
      if (Array.isArray(doc.links)) {
        doc.links = doc.links.filter(l => {
          const lClean = l.split('#')[0].replace(/^\.?\//, '');
          return lClean !== cleanPath && lClean !== deletedBase && lClean !== deletedNoExt;
        });
      }
    }

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

    const docMeta = docsMetadata.find((d) => d.path === cleanPath) || ({} as Partial<DocumentMetadataItem>);
    
    // Ler o arquivo ativo para extrair links diretos
    const fullActive = path.join(repoDir, cleanPath);
    let activeContent = '';
    if (fs.existsSync(fullActive) && fs.statSync(fullActive).isFile()) {
      try {
        activeContent = fs.readFileSync(fullActive, 'utf-8');
      } catch {}
    }
    
    const extractedActiveLinks = extractDocLinksFromMarkdown(activeContent);
    const rawOutgoingLinks = Array.from(new Set([...(docMeta.links || []), ...extractedActiveLinks]));

    // 1. Dependencies (Outgoing links from this document)
    const dependencies: any[] = [];
    for (const link of rawOutgoingLinks) {
      const linkFilePath = link.split('#')[0].replace(/^\.?\//, '');
      const hash = link.includes('#') ? link.slice(link.indexOf('#')) : '';
      const matchedMeta = docsMetadata.find((d) => d.path === linkFilePath || d.name === linkFilePath || d.id === linkFilePath);
      
      dependencies.push({
        path: link,
        filePath: linkFilePath,
        hash,
        title: matchedMeta?.title || matchedMeta?.name || path.basename(linkFilePath, path.extname(linkFilePath)) || link,
        layer: matchedMeta?.layer || '',
        status: matchedMeta?.status || 'draft',
        badge: matchedMeta?.badge || ''
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
        hasLink = doc.links.some(l => {
          const lClean = l.split('#')[0].replace(/^\.?\//, '');
          return lClean === cleanPath || lClean === thisFileBase || lClean === thisFileNoExt || l === docMeta.id;
        });
      }

      if (!hasLink) {
        const docFull = path.join(repoDir, doc.path);
        if (fs.existsSync(docFull)) {
          try {
            const c = fs.readFileSync(docFull, 'utf-8');
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
          layer: doc.layer || '',
          status: doc.status || 'draft',
          badge: doc.badge || ''
        });
      }
    }

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
            const itemMeta = docsMetadata.find((d) => d.path === rel) || ({} as Partial<DocumentMetadataItem>);
            contextItems.push({
              path: rel,
              title: itemMeta.title || itemMeta.name || entry.name.replace('.md', ''),
              layer: itemMeta.layer || '',
              badge: itemMeta.badge || '',
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
      layer: docMeta.layer || '',
      status: docMeta.status || 'draft',
      dependencies,
      consumers,
      documents: contextItems,
    };
  }
}

export const workspaceService = new WorkspaceService();
