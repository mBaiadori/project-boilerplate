import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root path of the project (2 levels up from server/src/config)
export const BASE_DIR = path.resolve(__dirname, '../../../');
export const PROJECTS_DIR = path.join(BASE_DIR, 'projects');
export const CONFIG_PATH = path.join(BASE_DIR, 'config.json');
export const PROJECTS_CONFIG_PATH = path.join(PROJECTS_DIR, 'project.config.json');
export const UI_DIR = path.join(BASE_DIR, 'ui');
export const UI_DIST_DIR = path.join(UI_DIR, 'dist');
export const TEMPLATES_DIR = path.join(BASE_DIR, 'templates');
export const DOCS_DIR = path.join(BASE_DIR, 'docs');

export const DEFAULT_TEMPLATE_CREATOR_PROMPT = `Você é o Arquiteto de Templates do Framework Context OS.`;
export const DEFAULT_GLOBAL_SYSTEM_PROMPT = `Você é o Arquiteto de Software & Assistente de Governança do Spec-Driven Context OS.`;

export const DEFAULT_PROJECT_ABOUT_PROMPT = `Você é o Arquiteto de Fundação & Setup do Framework Context OS / Agentic SDLC.
Sua missão é ajudar o arquiteto e o líder técnico a preencher, refinar, estruturar e evoluir a constituição e identidade do projeto (Sobre o Projeto / Definições Estratégicas).

DIRETRIZES FUNDAMENTAIS:
1. Auxilie na redação precisa do Nome do Projeto, 'Por que fazemos?' (dores e justificativa de negócio), 'O que é o produto?' (escopo funcional e proposta de valor), 'Onde se aplica?' (canais e ecossistema), 'Quando?' (marcos e releases) e 'Como construímos?' (padrões arquiteturais e metodologia).
2. Seja proativo em sugerir melhorias de clareza, alinhamento aos princípios de Domain-Driven Design (DDD) e consistência técnica.
3. Forneça respostas estruturadas e textos prontos para serem aplicados nos campos correspondentes da tela.`;

export interface CanonicalTemplate {
  id: string;
  title: string;
  category: string;
  badge: string;
  description: string;
  default_filename: string;
  suggested_folder: string;
  assistant_prompt: string;
  content: string;
  source_file: string;
}

export function extractFrontmatter(content: string): { meta: Record<string, any>; body: string } {
  if (!content || typeof content !== 'string') return { meta: {}, body: '' };
  if (content.startsWith('---')) {
    const parts = content.split('---');
    if (parts.length >= 3) {
      const rawYaml = parts[1];
      const body = parts.slice(2).join('---');
      const meta: Record<string, any> = {};
      
      // Simple parser for YAML key-values without external dep issues
      const lines = rawYaml.split('\n');
      for (const line of lines) {
        const match = line.match(/^\s*([\w_-]+)\s*:\s*(.*)$/);
        if (match) {
          const key = match[1].trim();
          let val = match[2].trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          meta[key] = val;
        }
      }
      return { meta, body };
    }
  }
  return { meta: {}, body: content };
}

export function loadCanonicalTemplates(): CanonicalTemplate[] {
  const templates: CanonicalTemplate[] = [];
  if (fs.existsSync(TEMPLATES_DIR)) {
    try {
      const files = fs.readdirSync(TEMPLATES_DIR).sort();
      for (const f of files) {
        if (f.endsWith('.md')) {
          const fpath = path.join(TEMPLATES_DIR, f);
          try {
            const content = fs.readFileSync(fpath, 'utf-8');
            const { meta } = extractFrontmatter(content);
            let cleanId = f.replace(/^\d+-/, '').replace('.md', '');
            const idAliases: Record<string, string> = {
              domain: 'domain-context',
              ideacao: 'feature-ideacao',
              'behavior-specs': 'feature-behavior',
            };
            cleanId = idAliases[cleanId] || cleanId;
            const rawId = meta.id || '';
            const tplId = rawId && !String(rawId).includes('{{') ? String(rawId) : cleanId;

            let title = meta.title;
            if (!title || String(title).includes('{{')) {
              title = cleanId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
            }

            const category = meta.category || (cleanId.includes('domain') ? 'Domain-Driven Design' : 'Esteira SDLC');
            const badge = meta.badge || meta.layer || 'Template';
            const description = meta.description || `Template oficial ${f}`;
            const defaultFilename = meta.default_filename || `${cleanId}.md`;
            const suggestedFolder = meta.suggested_folder || 'domains';
            const assistantPrompt = meta.assistant_prompt || '';

            templates.push({
              id: tplId,
              title,
              category,
              badge,
              description,
              default_filename: defaultFilename,
              suggested_folder: suggestedFolder,
              assistant_prompt: assistantPrompt,
              content,
              source_file: f,
            });
          } catch (err) {
            console.error(`Erro ao carregar template ${f}:`, err);
          }
        }
      }
    } catch (err) {
      console.error('Erro ao ler diretório de templates:', err);
    }
  }
  return templates;
}

export interface CanonicalTutorial {
  id: string;
  title: string;
  category: string;
  badge: string;
  read_time: string;
  content: string;
}

export function loadCanonicalTutorials(): CanonicalTutorial[] {
  const tutorials: CanonicalTutorial[] = [];
  const docFiles = [
    {
      id: 'spec-driven-governance',
      file: 'spec-driven-governance-vision.md',
      title: 'Governança Orientada a Especificação (Spec-Driven SDLC)',
      category: 'Fundamentos SDLC',
      badge: 'Arquitetura',
      read_time: '5 min',
    },
    {
      id: 'architectural-patterns',
      file: 'architectural-patterns.md',
      title: 'Padrões Arquiteturais & Domain-Driven Design (DDD)',
      category: 'Domain-Driven Design',
      badge: 'DDD',
      read_time: '4 min',
    },
    {
      id: 'memory-ai',
      file: 'memory-ai.md',
      title: 'Memória Viva, Continuidade de Contexto & IA',
      category: 'Inteligência Artificial',
      badge: 'AI Memory',
      read_time: '5 min',
    },
    {
      id: 'agents-instruction',
      file: 'agents-instruction.md',
      title: 'Protocolos de Operação e Instruções para Agentes',
      category: 'Agentes & Automação',
      badge: 'Agentes',
      read_time: '3 min',
    },
  ];

  for (const item of docFiles) {
    const fpath = path.join(BASE_DIR, item.file);
    if (fs.existsSync(fpath)) {
      try {
        const content = fs.readFileSync(fpath, 'utf-8');
        tutorials.push({
          id: item.id,
          title: item.title,
          category: item.category,
          badge: item.badge,
          read_time: item.read_time,
          content,
        });
      } catch (err) {
        console.error(`Erro ao carregar tutorial ${item.file}:`, err);
      }
    }
  }
  return tutorials;
}
