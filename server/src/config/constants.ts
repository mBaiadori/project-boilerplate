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
export const FRONTEND_DIR = path.join(BASE_DIR, 'frontend');
export const UI_DIST_DIR = path.join(FRONTEND_DIR, 'dist');
export const UI_DIR = UI_DIST_DIR;
export const TEMPLATES_DIR = path.join(BASE_DIR, 'templates');
export const DOCS_DIR = path.join(BASE_DIR, 'docs');

export const DEFAULT_TEMPLATE_CREATOR_PROMPT = `Você é o Especialista em Criação e Curadoria de Templates Técnicos e de Produto para Equipes.`;
export const DEFAULT_GLOBAL_SYSTEM_PROMPT = `Você é um Assistente Especialista em Documentação Técnica, Engenharia de Software e Colaboração de Equipes.
Sua missão é ajudar os membros da equipe a redigir, estruturar, revisar e refinar documentos técnicos, especificações, RFCs, atas e guias com clareza, concisão e alto padrão técnico.`;

export const DEFAULT_PROJECT_ABOUT_PROMPT = `Você é o Assistente de Definição e Setup de Projeto da Equipe.
Sua missão é ajudar os líderes técnicos e gerentes de produto a estruturar a identidade, escopo, visão estratégica e diretrizes do projeto.

DIRETRIZES:
1. Auxilie na redação do Nome do Projeto, 'Por que fazemos?' (dores e justificativa de negócio), 'O que é o produto?' (escopo e valor), 'Onde se aplica?' e 'Como construímos?' (arquitetura e boas práticas).
2. Sugira melhorias de clareza, objetividade e alinhamento entre produto e engenharia.
3. Forneça textos diretos e prontos para uso nos campos do projeto.`;

export interface ProjectTemplate {
  id: string;
  templateName: string;
  title: string;
  ext: string; // 'md'
  category: string;
  tags: string[];
  updated_at: string;
  content: string;
  prompt: string;
  source: 'community' | 'local' | string;
  description?: string;
  badge?: string;
  skills?: string[]; // Attached ECC skills (e.g. ['living-docs-governance', 'architecture-adr-guardian'])
  // Compatibility fields
  systemPrompt?: string;
  assistant_prompt?: string;
}

export type CanonicalTemplate = ProjectTemplate;

export interface TemplatesMetadataItem {
  id: string;
  templateName?: string;
  title: string;
  description?: string;
  category: string;
  tags: string[];
  badge?: string;
  path?: string;
  source: 'local' | 'community' | string;
  created_at?: string;
  updated_at: string;
}

export function getProjectTemplatesPath(repoName: string): string {
  const primaryPath = path.join(PROJECTS_DIR, repoName, '.templates.json');
  const legacyMetaPath = path.join(PROJECTS_DIR, repoName, '.templates.metadata.json');
  if (!fs.existsSync(primaryPath) && fs.existsSync(legacyMetaPath)) {
    return legacyMetaPath;
  }
  return primaryPath;
}

export function getCommunityTemplatesPath(): string {
  const insideTemplatesDir = path.join(TEMPLATES_DIR, '.templates.json');
  const insideBaseDir = path.join(BASE_DIR, '.templates.json');
  if (fs.existsSync(insideTemplatesDir)) return insideTemplatesDir;
  if (fs.existsSync(insideBaseDir)) return insideBaseDir;
  return insideTemplatesDir;
}

function sanitizeTemplateItem(item: any, defaultSource: 'local' | 'community' = 'local'): ProjectTemplate {
  const id = item.id || (item.templateName ? String(item.templateName).toLowerCase().replace(/\s+/g, '-') : `tpl-${Date.now()}`);
  const templateName = item.templateName || item.name || id;
  const title = item.title || templateName;
  const ext = item.ext || 'md';
  const category = item.category || item.categories || 'geral';
  const tags = Array.isArray(item.tags) ? item.tags : (item.tags ? [item.tags] : []);
  const updated_at = item.updated_at || item.created_at || new Date().toISOString();
  const content = item.content || '';
  const prompt = item.prompt || item.systemPrompt || item.assistant_prompt || '';
  const source = item.source || defaultSource;
  const description = item.description || '';
  const badge = item.badge || (source === 'community' ? 'Comunidade' : 'Local');
  const skills = Array.isArray(item.skills) ? item.skills : [];

  return {
    id,
    templateName,
    title,
    ext,
    category,
    tags,
    skills,
    updated_at,
    content,
    prompt,
    source,
    description,
    badge,
    systemPrompt: prompt,
    assistant_prompt: prompt,
  };
}

export function loadProjectTemplates(repoName: string): ProjectTemplate[] {
  const filePath = getProjectTemplatesPath(repoName);
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, 'utf-8').trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((t) => sanitizeTemplateItem(t, 'local'));
  } catch (err) {
    console.error(`[loadProjectTemplates] Erro ao carregar templates de ${filePath}:`, err);
    return [];
  }
}

export function saveProjectTemplates(repoName: string, items: ProjectTemplate[]): void {
  const filePath = path.join(PROJECTS_DIR, repoName, '.templates.json');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const sanitized = items.map((t) => sanitizeTemplateItem(t, (t.source as any) || 'local'));
  fs.writeFileSync(filePath, JSON.stringify(sanitized, null, 2), 'utf-8');
}

export function loadCommunityTemplates(): ProjectTemplate[] {
  const filePath = getCommunityTemplatesPath();
  if (!fs.existsSync(filePath)) {
    // Check fallback old_templates if available to auto-populate community templates
    return [];
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8').trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((t) => sanitizeTemplateItem(t, 'community'));
  } catch (err) {
    console.error(`[loadCommunityTemplates] Erro ao carregar templates da comunidade:`, err);
    return [];
  }
}

export function saveCommunityTemplates(items: ProjectTemplate[]): void {
  const filePath = getCommunityTemplatesPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const sanitized = items.map((t) => sanitizeTemplateItem(t, 'community'));
  fs.writeFileSync(filePath, JSON.stringify(sanitized, null, 2), 'utf-8');
}

export function loadProjectTemplatesMetadata(repoName: string): TemplatesMetadataItem[] {
  return loadProjectTemplates(repoName);
}

export function saveProjectTemplatesMetadata(repoName: string, items: TemplatesMetadataItem[]): void {
  saveProjectTemplates(repoName, items as any);
}

export function loadCanonicalTemplates(): ProjectTemplate[] {
  return loadCommunityTemplates();
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
