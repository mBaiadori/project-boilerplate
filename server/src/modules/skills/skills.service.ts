import fs from 'node:fs';
import path from 'node:path';
import { PROJECTS_DIR } from '../../config/constants.js';
import { loadConfig, recordChange } from '../../config/storage.js';
import { SkillDefinition, ProjectSkillsManifest, SkillMetadata } from './skills.types.js';
import { ECC_SEED_SKILLS } from './seeds/seeds.data.js';

function getSafeRepo(repoName?: string): string {
  if (repoName) return repoName.replace(/[^a-zA-Z0-9_-]/g, '') || 'local';
  const cfg = loadConfig();
  return (cfg.active_repo?.name || 'local').replace(/[^a-zA-Z0-9_-]/g, '');
}

export class SkillsService {
  private getRepoDir(repoName: string): string {
    return path.join(PROJECTS_DIR, getSafeRepo(repoName));
  }

  private getSkillsDir(repoName: string): string {
    return path.join(this.getRepoDir(repoName), '.skills');
  }

  private getManifestPath(repoName: string): string {
    return path.join(this.getSkillsDir(repoName), '.skills.manifest.json');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Hub Global de Skills (Catálogo ECC + Sementes)
  // ──────────────────────────────────────────────────────────────────────────

  getHubSkills(): SkillDefinition[] {
    const hubMap = new Map<string, SkillDefinition>();

    // 1. Sementes oficiais compiladas
    for (const seed of ECC_SEED_SKILLS) {
      hubMap.set(seed.id, seed);
    }

    // 2. Tenta carregar skills adicionais de ECC-main/skills se a pasta existir na raiz
    const eccMainSkillsDir = path.resolve(process.cwd(), 'ECC-main', 'skills');
    if (fs.existsSync(eccMainSkillsDir)) {
      try {
        const skillFolders = fs.readdirSync(eccMainSkillsDir, { withFileTypes: true });
        for (const folder of skillFolders) {
          if (!folder.isDirectory() || hubMap.has(folder.name)) continue;

          const skillMdPath = path.join(eccMainSkillsDir, folder.name, 'SKILL.md');
          if (fs.existsSync(skillMdPath)) {
            const rawContent = fs.readFileSync(skillMdPath, 'utf-8');
            const parsed = this.parseSkillMarkdown(rawContent, folder.name);
            hubMap.set(parsed.id, parsed);
          }
        }
      } catch (err) {
        console.warn('[SkillsService] Aviso ao ler ECC-main/skills:', err);
      }
    }

    return Array.from(hubMap.values());
  }

  getHubSkill(id: string): SkillDefinition | null {
    const all = this.getHubSkills();
    return all.find((s) => s.id === id) || null;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Skills Instaladas no Projeto
  // ──────────────────────────────────────────────────────────────────────────

  getProjectManifest(repoName: string): ProjectSkillsManifest {
    const manifestPath = this.getManifestPath(repoName);
    if (fs.existsSync(manifestPath)) {
      try {
        return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      } catch {}
    }

    return {
      version: '1.0.0',
      project_repo: getSafeRepo(repoName),
      installed_skills: [],
    };
  }

  saveProjectManifest(repoName: string, manifest: ProjectSkillsManifest) {
    const manifestPath = this.getManifestPath(repoName);
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  }

  getProjectSkills(repoName: string): SkillDefinition[] {
    const safeRepo = getSafeRepo(repoName);
    const skillsDir = this.getSkillsDir(safeRepo);
    const manifest = this.getProjectManifest(safeRepo);
    const result: SkillDefinition[] = [];

    if (!fs.existsSync(skillsDir)) return result;

    for (const item of manifest.installed_skills) {
      const skillMdPath = path.join(skillsDir, item.id, 'SKILL.md');
      if (fs.existsSync(skillMdPath)) {
        try {
          const raw = fs.readFileSync(skillMdPath, 'utf-8');
          const parsed = this.parseSkillMarkdown(raw, item.id);
          parsed.installed_at = item.installed_at;
          parsed.updated_at = item.updated_at;
          parsed.is_customized = item.is_customized || false;
          parsed.source = 'project';
          result.push(parsed);
        } catch {}
      }
    }

    return result;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Instalação, Desinstalação e Customização (Fork)
  // ──────────────────────────────────────────────────────────────────────────

  installSkill(repoName: string, skillId: string): { success: boolean; skill: SkillDefinition } {
    const safeRepo = getSafeRepo(repoName);
    const targetSkill = this.getHubSkill(skillId);

    if (!targetSkill) {
      throw new Error(`Skill '${skillId}' não encontrada no catálogo global.`);
    }

    const skillsDir = this.getSkillsDir(safeRepo);
    const targetDir = path.join(skillsDir, skillId);
    fs.mkdirSync(targetDir, { recursive: true });

    const skillMdPath = path.join(targetDir, 'SKILL.md');
    const fileContent = this.formatSkillMarkdown(targetSkill);
    fs.writeFileSync(skillMdPath, fileContent, 'utf-8');

    // Atualiza manifesto
    const manifest = this.getProjectManifest(safeRepo);
    const existingIdx = manifest.installed_skills.findIndex((s) => s.id === skillId);
    const now = new Date().toISOString();

    if (existingIdx >= 0) {
      manifest.installed_skills[existingIdx] = {
        id: skillId,
        version: targetSkill.version,
        source: targetSkill.sourceUrl || targetSkill.source,
        installed_at: manifest.installed_skills[existingIdx].installed_at || now,
        updated_at: now,
        is_customized: false,
      };
    } else {
      manifest.installed_skills.push({
        id: skillId,
        version: targetSkill.version,
        source: targetSkill.sourceUrl || targetSkill.source,
        installed_at: now,
        updated_at: now,
        is_customized: false,
      });
    }

    this.saveProjectManifest(safeRepo, manifest);
    recordChange(safeRepo, `.skills/${skillId}/SKILL.md`, 'ADDED', '', fileContent);

    return {
      success: true,
      skill: {
        ...targetSkill,
        installed_at: now,
        updated_at: now,
        is_customized: false,
      },
    };
  }

  uninstallSkill(repoName: string, skillId: string): { success: boolean; message: string } {
    const safeRepo = getSafeRepo(repoName);
    const skillDir = path.join(this.getSkillsDir(safeRepo), skillId);

    if (fs.existsSync(skillDir)) {
      fs.rmSync(skillDir, { recursive: true, force: true });
    }

    const manifest = this.getProjectManifest(safeRepo);
    manifest.installed_skills = manifest.installed_skills.filter((s) => s.id !== skillId);
    this.saveProjectManifest(safeRepo, manifest);

    recordChange(safeRepo, `.skills/${skillId}`, 'DELETED', '', '');

    return {
      success: true,
      message: `Skill '${skillId}' desinstalada com sucesso do projeto '${safeRepo}'.`,
    };
  }

  customizeSkill(
    repoName: string,
    skillId: string,
    data: { content?: string; title?: string; description?: string; tools?: string[]; tags?: string[] }
  ): { success: boolean; skill: SkillDefinition } {
    const safeRepo = getSafeRepo(repoName);
    const skillDir = path.join(this.getSkillsDir(safeRepo), skillId);
    const skillMdPath = path.join(skillDir, 'SKILL.md');

    if (!fs.existsSync(skillMdPath)) {
      throw new Error(`Skill '${skillId}' não está instalada no projeto. Instale-a antes de customizar.`);
    }

    const current = this.parseSkillMarkdown(fs.readFileSync(skillMdPath, 'utf-8'), skillId);
    const updated: SkillDefinition = {
      ...current,
      title: data.title || current.title,
      description: data.description || current.description,
      tools: data.tools || current.tools,
      tags: data.tags || current.tags,
      content: data.content !== undefined ? data.content : current.content,
      is_customized: true,
      updated_at: new Date().toISOString(),
    };

    const newContent = this.formatSkillMarkdown(updated);
    fs.writeFileSync(skillMdPath, newContent, 'utf-8');

    const manifest = this.getProjectManifest(safeRepo);
    const item = manifest.installed_skills.find((s) => s.id === skillId);
    if (item) {
      item.is_customized = true;
      item.updated_at = updated.updated_at || new Date().toISOString();
      this.saveProjectManifest(safeRepo, manifest);
    }

    return { success: true, skill: updated };
  }

  /**
   * Resolve a skill ativa: Busca no projeto instalado; se não encontrar, tenta no Hub ECC.
   */
  resolveSkill(skillId: string, repoName?: string): SkillDefinition | null {
    if (!skillId) return null;
    const safeRepo = getSafeRepo(repoName);
    const projectSkills = this.getProjectSkills(safeRepo);
    const foundLocal = projectSkills.find((s) => s.id === skillId);
    if (foundLocal) return foundLocal;

    return this.getHubSkill(skillId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Utilitários de Markdown e Frontmatter
  // ──────────────────────────────────────────────────────────────────────────

  private parseSkillMarkdown(fileContent: string, defaultId: string): SkillDefinition {
    const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
    const match = fileContent.match(frontmatterRegex);

    let metadata: Partial<SkillMetadata> = {};
    let content = fileContent;

    if (match) {
      const yamlBlock = match[1];
      content = match[2];

      const lines = yamlBlock.split('\n');
      for (const line of lines) {
        const [key, ...rest] = line.split(':');
        if (key && rest.length > 0) {
          const k = key.trim();
          const val = rest.join(':').trim().replace(/^["']|["']$/g, '');
          if (k === 'tools' || k === 'suggested_templates' || k === 'tags') {
            try {
              metadata[k] = JSON.parse(val.replace(/'/g, '"'));
            } catch {
              metadata[k] = val ? [val] : [];
            }
          } else {
            (metadata as any)[k] = val;
          }
        }
      }
    }

    return {
      id: metadata.id || defaultId,
      name: metadata.name || defaultId,
      title: metadata.title || metadata.name || defaultId,
      description: metadata.description || 'Instruções de agente para o projeto.',
      category: (metadata.category as any) || 'governance',
      version: metadata.version || '1.0.0',
      source: (metadata.source as any) || 'community',
      sourceUrl: metadata.sourceUrl || 'https://github.com/affaan-m/everything-claude-code',
      license: metadata.license || 'MIT',
      author: metadata.author || 'Comunidade (ECC • Licença MIT)',
      tools: Array.isArray(metadata.tools) ? metadata.tools : [],
      suggested_templates: Array.isArray(metadata.suggested_templates) ? metadata.suggested_templates : [],
      tags: Array.isArray(metadata.tags) ? metadata.tags : [],
      icon: metadata.icon || 'Sparkles',
      content: content.trim(),
    };
  }

  private formatSkillMarkdown(skill: SkillDefinition): string {
    const toolsJson = JSON.stringify(skill.tools || []);
    const templatesJson = JSON.stringify(skill.suggested_templates || []);
    const tagsJson = JSON.stringify(skill.tags || []);

    return `---
id: "${skill.id}"
name: "${skill.name}"
title: "${skill.title || skill.name}"
description: "${skill.description.replace(/"/g, '\\"')}"
category: "${skill.category}"
version: "${skill.version}"
source: "${skill.source}"
sourceUrl: "${skill.sourceUrl || ''}"
author: "${skill.author || ''}"
license: "${skill.license || ''}"
tools: ${toolsJson}
suggested_templates: ${templatesJson}
tags: ${tagsJson}
icon: "${skill.icon || 'Sparkles'}"
---

${skill.content}
`;
  }
}

export const skillsService = new SkillsService();
