export interface SkillMetadata {
  id: string;
  name: string;
  title?: string;
  description: string;
  category: 'governance' | 'architecture' | 'quality' | 'engineering' | 'memory' | 'general';
  version: string;
  source: 'ecc' | 'community' | 'project';
  sourceUrl?: string;
  tools: string[];
  suggested_templates?: string[];
  author?: string;
  tags?: string[];
  icon?: string;
}

export interface SkillDefinition extends SkillMetadata {
  content: string; // The markdown body instructions for the agent
  instincts?: string; // Optional behavioral heuristics
  installed_at?: string;
  updated_at?: string;
  is_customized?: boolean; // True if user modified the original ECC seed
}

export interface ProjectSkillsManifest {
  version: string;
  project_repo: string;
  installed_skills: {
    id: string;
    version: string;
    source: string;
    installed_at: string;
    updated_at: string;
    is_customized?: boolean;
  }[];
}

export interface AgentDefinition {
  id: string;
  name: string;
  title: string;
  role: string;
  description: string;
  system_prompt: string;
  skills: string[];
  tools: string[];
  category: 'architecture' | 'governance' | 'quality' | 'engineering' | 'review';
  recommended_model?: string;
  temperature?: number;
  source: 'ecc' | 'project' | 'custom';
  installed_at?: string;
  icon?: string;
}

export interface MCPServerDefinition {
  id: string;
  name: string;
  description: string;
  type: 'sse' | 'stdio';
  endpoint?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
  status?: 'connected' | 'disconnected' | 'error';
  discovered_tools?: { name: string; description: string }[];
  category?: string;
}

