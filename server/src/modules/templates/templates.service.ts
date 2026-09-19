import fs from 'node:fs';
import path from 'node:path';
import { PROJECTS_DIR, TEMPLATES_DIR, loadCanonicalTemplates, CanonicalTemplate } from '../../config/constants.js';
import { loadConfig, saveConfig, recordChange } from '../../config/storage.js';

export class TemplatesService {
  getTemplates() {
    const cfg = loadConfig();
    return cfg.templates || loadCanonicalTemplates();
  }

  getInstalledTemplates() {
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || 'local';
    const installedDir = path.join(PROJECTS_DIR, repoName, 'templates');
    const installed: CanonicalTemplate[] = [];

    if (fs.existsSync(installedDir)) {
      const files = fs.readdirSync(installedDir);
      for (const f of files) {
        if (f.endsWith('.md')) {
          const fullPath = path.join(installedDir, f);
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            installed.push({
              id: f.replace('.md', ''),
              title: f.replace('.md', '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
              category: 'Instalados',
              badge: 'Local',
              description: `Template instalado em ${repoName}`,
              default_filename: f,
              suggested_folder: 'domains',
              assistant_prompt: '',
              content,
              source_file: f,
            });
          } catch {}
        }
      }
    }

    return {
      repo: repoName,
      templates: installed,
    };
  }

  saveTemplate(tpl: CanonicalTemplate) {
    if (!tpl || !tpl.id) {
      throw new Error('ID do template é obrigatório.');
    }

    const cfg = loadConfig();
    if (!cfg.templates) cfg.templates = loadCanonicalTemplates();

    const idx = cfg.templates.findIndex((t) => t.id === tpl.id);
    if (idx >= 0) {
      cfg.templates[idx] = tpl;
    } else {
      cfg.templates.push(tpl);
    }

    saveConfig(cfg);

    // Save to templates/ directory
    if (fs.existsSync(TEMPLATES_DIR)) {
      const targetFile = path.join(TEMPLATES_DIR, `${tpl.id}.md`);
      fs.writeFileSync(targetFile, tpl.content || `# ${tpl.title}\n\n${tpl.description}`, 'utf-8');
    }

    return {
      success: true,
      template: tpl,
      templates: cfg.templates,
    };
  }

  installTemplate(templateId: string, folder?: string) {
    const cfg = loadConfig();
    const repoName = cfg.active_repo?.name || 'local';
    const templates = this.getTemplates();
    const target = templates.find((t) => t.id === templateId);

    if (!target) {
      throw new Error(`Template '${templateId}' não encontrado.`);
    }

    const targetFolder = folder || target.suggested_folder || 'domains';
    const repoDir = path.join(PROJECTS_DIR, repoName);
    const destDir = path.join(repoDir, targetFolder);
    fs.mkdirSync(destDir, { recursive: true });

    const filename = target.default_filename || `${target.id}.md`;
    const destFile = path.join(destDir, filename);

    let oldContent = '';
    if (fs.existsSync(destFile)) {
      oldContent = fs.readFileSync(destFile, 'utf-8');
    }

    fs.writeFileSync(destFile, target.content, 'utf-8');
    recordChange(repoName, `${targetFolder}/${filename}`, oldContent ? 'MODIFIED' : 'ADDED', oldContent, target.content);

    return {
      success: true,
      message: `Template '${target.title}' instalado em '${targetFolder}/${filename}'.`,
      path: `${targetFolder}/${filename}`,
    };
  }

  deleteTemplate(templateId: string) {
    const cfg = loadConfig();
    if (!cfg.templates) cfg.templates = loadCanonicalTemplates();

    cfg.templates = cfg.templates.filter((t) => t.id !== templateId);
    saveConfig(cfg);

    const targetFile = path.join(TEMPLATES_DIR, `${templateId}.md`);
    if (fs.existsSync(targetFile)) {
      fs.unlinkSync(targetFile);
    }

    return {
      success: true,
      templates: cfg.templates,
      message: 'Template removido com sucesso.',
    };
  }

  getWorkflows() {
    const cfg = loadConfig();
    return {
      workflows: cfg.workflows || [],
    };
  }

  applyWorkflow(workflowId: string) {
    const cfg = loadConfig();
    const workflows = cfg.workflows || [];
    const wf = workflows.find((w: any) => w.id === workflowId);

    if (!wf) {
      throw new Error(`Workflow '${workflowId}' não encontrado.`);
    }

    const repoName = cfg.active_repo?.name || 'local';
    const steps = wf.steps || [];
    const createdFiles: string[] = [];

    for (const step of steps) {
      if (step.template_id) {
        try {
          const res = this.installTemplate(step.template_id, step.folder);
          createdFiles.push(res.path);
        } catch {}
      }
    }

    return {
      success: true,
      message: `Workflow '${wf.title || workflowId}' aplicado com sucesso!`,
      created_files: createdFiles,
    };
  }
}

export const templatesService = new TemplatesService();
