import fs from 'node:fs';
import path from 'node:path';
import { PROJECTS_DIR, extractFrontmatter } from '../../config/constants.js';
import { loadConfig, saveConfig, recordChange, ensureDefaultRepoFiles } from '../../config/storage.js';
import { computeDiff } from '../../utils/diff.js';

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

export class WorkspaceService {
  private getRepoDir(repoName: string): string {
    return path.join(PROJECTS_DIR, repoName || 'local');
  }

  buildTree(dir: string, baseDir: string): TreeNode[] {
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const nodes: TreeNode[] = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        nodes.push({
          name: entry.name,
          path: relPath,
          type: 'directory',
          children: this.buildTree(fullPath, baseDir),
        });
      } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.json') || entry.name.endsWith('.yaml') || entry.name.endsWith('.yml'))) {
        let meta: Record<string, any> = {};
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          meta = extractFrontmatter(content).meta;
        } catch {}

        const stat = fs.statSync(fullPath);

        nodes.push({
          name: entry.name,
          path: relPath,
          type: 'file',
          title: meta.title || entry.name.replace('.md', ''),
          category: meta.category || meta.layer || '',
          layer: meta.layer || '',
          badge: meta.badge || '',
          status: meta.status || '',
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

    const tree = this.buildTree(repoDir, repoDir);
    return {
      repo: repoName,
      tree,
    };
  }

  getFile(filePath: string) {
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || 'local';
    const cleanPath = (filePath || 'index.md').trim().replace(/^\/+/, '');
    const fullPath = path.join(this.getRepoDir(repoName), cleanPath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Arquivo '${cleanPath}' não encontrado.`);
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const { meta } = extractFrontmatter(content);

    return {
      path: cleanPath,
      content,
      meta,
      repo: repoName,
    };
  }

  saveFile(filePath: string, content: string) {
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || 'local';
    const cleanPath = (filePath || 'index.md').trim().replace(/^\/+/, '');
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

    const repoDir = this.getRepoDir(repoName);
    const newTree = this.buildTree(repoDir, repoDir);

    return {
      success: true,
      path: cleanPath,
      tree: newTree,
    };
  }

  createFile(filePath: string, initialContent: string = '') {
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || 'local';
    let cleanPath = (filePath || '').trim().replace(/^\/+/, '');
    if (!cleanPath.endsWith('.md') && !cleanPath.endsWith('.json')) {
      cleanPath += '.md';
    }

    const fullPath = path.join(this.getRepoDir(repoName), cleanPath);
    if (fs.existsSync(fullPath)) {
      throw new Error(`Arquivo '${cleanPath}' já existe.`);
    }

    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    const content = initialContent || `# ${path.basename(cleanPath, '.md')}\n\nNovo documento criado.`;
    fs.writeFileSync(fullPath, content, 'utf-8');

    recordChange(repoName, cleanPath, 'ADDED', '', content);

    const repoDir = this.getRepoDir(repoName);
    const newTree = this.buildTree(repoDir, repoDir);

    return {
      success: true,
      path: cleanPath,
      tree: newTree,
    };
  }

  renameFile(oldPath: string, newPath: string) {
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || 'local';
    const cleanOld = (oldPath || '').trim().replace(/^\/+/, '');
    let cleanNew = (newPath || '').trim().replace(/^\/+/, '');
    if (!cleanNew.endsWith('.md') && !cleanNew.endsWith('.json')) {
      cleanNew += '.md';
    }

    const fullOld = path.join(this.getRepoDir(repoName), cleanOld);
    const fullNew = path.join(this.getRepoDir(repoName), cleanNew);

    if (!fs.existsSync(fullOld)) {
      throw new Error(`Arquivo de origem '${cleanOld}' não existe.`);
    }
    if (fs.existsSync(fullNew)) {
      throw new Error(`Destino '${cleanNew}' já existe.`);
    }

    const oldContent = fs.readFileSync(fullOld, 'utf-8');
    fs.mkdirSync(path.dirname(fullNew), { recursive: true });
    fs.renameSync(fullOld, fullNew);

    recordChange(repoName, cleanOld, 'DELETED', oldContent, '');
    recordChange(repoName, cleanNew, 'ADDED', '', oldContent);

    const repoDir = this.getRepoDir(repoName);
    const newTree = this.buildTree(repoDir, repoDir);

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

    if (!cleanPath || cleanPath === 'index.md') {
      throw new Error('O arquivo raiz index.md não pode ser removido.');
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

    const repoDir = this.getRepoDir(repoName);
    const newTree = this.buildTree(repoDir, repoDir);

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

    const newTree = this.buildTree(repoDir, repoDir);
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
            const { meta } = extractFrontmatter(content);
            contextItems.push({
              path: rel,
              title: meta.title || entry.name.replace('.md', ''),
              layer: meta.layer || '',
              badge: meta.badge || '',
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
