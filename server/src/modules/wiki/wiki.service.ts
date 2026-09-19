import fs from 'node:fs';
import path from 'node:path';
import { PROJECTS_DIR } from '../../config/constants.js';
import { loadConfig } from '../../config/storage.js';

export interface WikiPage {
  slug: string;
  title: string;
  category: string;
  content: string;
  updated_at: string;
}

export class WikiService {
  private getWikiDir(repoName: string): string {
    return path.join(PROJECTS_DIR, repoName || 'local', '.spec-memory', 'wiki');
  }

  getWikiPages(): WikiPage[] {
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || 'local';
    const wikiDir = this.getWikiDir(repoName);
    const pages: WikiPage[] = [];

    if (fs.existsSync(wikiDir)) {
      const files = fs.readdirSync(wikiDir);
      for (const f of files) {
        if (f.endsWith('.md')) {
          const fullPath = path.join(wikiDir, f);
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const slug = f.replace('.md', '');
            const titleMatch = content.match(/^#\s+(.*)$/m);
            const title = titleMatch ? titleMatch[1] : slug;
            const stat = fs.statSync(fullPath);

            pages.push({
              slug,
              title,
              category: 'Geral',
              content,
              updated_at: stat.mtime.toISOString(),
            });
          } catch {}
        }
      }
    }

    return pages;
  }

  saveWikiPage(slug: string, title: string, content: string, category: string = 'Geral') {
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || 'local';
    const wikiDir = this.getWikiDir(repoName);
    fs.mkdirSync(wikiDir, { recursive: true });

    const cleanSlug = (slug || title || 'page').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const fullPath = path.join(wikiDir, `${cleanSlug}.md`);

    const finalContent = content.startsWith('# ') ? content : `# ${title || cleanSlug}\n\n${content}`;
    fs.writeFileSync(fullPath, finalContent, 'utf-8');

    return {
      success: true,
      page: {
        slug: cleanSlug,
        title: title || cleanSlug,
        category,
        content: finalContent,
        updated_at: new Date().toISOString(),
      },
    };
  }

  deleteWikiPage(slug: string) {
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || 'local';
    const wikiDir = this.getWikiDir(repoName);
    const cleanSlug = (slug || '').replace('.md', '');
    const fullPath = path.join(wikiDir, `${cleanSlug}.md`);

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    return { success: true };
  }
}

export const wikiService = new WikiService();
