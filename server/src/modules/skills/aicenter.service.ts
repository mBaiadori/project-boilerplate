import fs from 'node:fs';
import path from 'node:path';
import { AgentDefinition, MCPServerDefinition } from './skills.types.js';
import { eccSeedAgents } from './seeds/agents.seeds.js';
import { eccSeedMcpTemplates } from './seeds/mcp.seeds.js';
import { PROJECTS_DIR } from '../../config/constants.js';
import { toolRegistry } from '../ai/tools/ToolRegistry.js';

class AICenterService {
  // =========================================================================
  // 1. AGENTS MANAGEMENT
  // =========================================================================
  public getHubAgents(): AgentDefinition[] {
    return eccSeedAgents;
  }

  public getProjectAgents(repoName: string): AgentDefinition[] {
    const safeRepo = repoName.replace(/[^a-zA-Z0-9_-]/g, '') || 'local';
    const agentsDir = path.join(PROJECTS_DIR, safeRepo, '.agents');
    const manifestPath = path.join(agentsDir, 'agents.manifest.json');

    if (!fs.existsSync(manifestPath)) {
      return [];
    }

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      return manifest.agents || [];
    } catch (e) {
      return [];
    }
  }

  public installAgent(repoName: string, agentId: string): { success: boolean; agent: AgentDefinition } {
    const hubAgent = eccSeedAgents.find((a) => a.id === agentId);
    if (!hubAgent) {
      throw new Error(`Agente '${agentId}' não encontrado no catálogo global.`);
    }

    const safeRepo = repoName.replace(/[^a-zA-Z0-9_-]/g, '') || 'local';
    const agentsDir = path.join(PROJECTS_DIR, safeRepo, '.agents');
    if (!fs.existsSync(agentsDir)) {
      fs.mkdirSync(agentsDir, { recursive: true });
    }

    const installedAgent: AgentDefinition = {
      ...hubAgent,
      source: 'project',
      installed_at: new Date().toISOString(),
    };

    const manifestPath = path.join(agentsDir, 'agents.manifest.json');
    let existingAgents: AgentDefinition[] = [];
    if (fs.existsSync(manifestPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        existingAgents = parsed.agents || [];
      } catch (e) {}
    }

    const filtered = existingAgents.filter((a) => a.id !== agentId);
    filtered.push(installedAgent);

    fs.writeFileSync(manifestPath, JSON.stringify({ version: '1.0.0', agents: filtered }, null, 2), 'utf-8');

    // Also write markdown definition
    const agentFolder = path.join(agentsDir, agentId);
    if (!fs.existsSync(agentFolder)) {
      fs.mkdirSync(agentFolder, { recursive: true });
    }
    const agentMd = `---
name: ${installedAgent.name}
title: ${installedAgent.title}
role: ${installedAgent.role}
category: ${installedAgent.category}
skills: [${installedAgent.skills.join(', ')}]
tools: [${installedAgent.tools.join(', ')}]
---

# ${installedAgent.title}

${installedAgent.description}

## Prompt de Persona
${installedAgent.system_prompt}
`;
    fs.writeFileSync(path.join(agentFolder, 'AGENT.md'), agentMd, 'utf-8');

    return { success: true, agent: installedAgent };
  }

  public uninstallAgent(repoName: string, agentId: string): { success: boolean; message: string } {
    const safeRepo = repoName.replace(/[^a-zA-Z0-9_-]/g, '') || 'local';
    const agentsDir = path.join(PROJECTS_DIR, safeRepo, '.agents');
    const manifestPath = path.join(agentsDir, 'agents.manifest.json');

    if (!fs.existsSync(manifestPath)) {
      return { success: true, message: 'Nenhum agente instalado.' };
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const updated = (manifest.agents || []).filter((a: AgentDefinition) => a.id !== agentId);
    fs.writeFileSync(manifestPath, JSON.stringify({ version: '1.0.0', agents: updated }, null, 2), 'utf-8');

    const agentFolder = path.join(agentsDir, agentId);
    if (fs.existsSync(agentFolder)) {
      fs.rmSync(agentFolder, { recursive: true, force: true });
    }

    return { success: true, message: `Agente '${agentId}' removido do projeto.` };
  }

  // =========================================================================
  // 2. TOOLS MANAGEMENT
  // =========================================================================
  public getAllTools() {
    return toolRegistry.getAllTools().map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
  }

  public async executeToolTest(toolName: string, args: Record<string, any>, repoName: string) {
    return toolRegistry.executeTool(toolName, args, { repoName });
  }

  // =========================================================================
  // 3. MCP CONNECTORS MANAGEMENT
  // =========================================================================
  public getMcpTemplates(): MCPServerDefinition[] {
    return eccSeedMcpTemplates;
  }

  public getProjectMcpServers(repoName: string): MCPServerDefinition[] {
    const safeRepo = repoName.replace(/[^a-zA-Z0-9_-]/g, '') || 'local';
    const mcpConfigPath = path.join(PROJECTS_DIR, safeRepo, '.mcp.json');

    if (!fs.existsSync(mcpConfigPath)) {
      return [];
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
      return parsed.mcpServers || [];
    } catch (e) {
      return [];
    }
  }

  public saveProjectMcpServer(repoName: string, server: MCPServerDefinition): { success: boolean; server: MCPServerDefinition } {
    const safeRepo = repoName.replace(/[^a-zA-Z0-9_-]/g, '') || 'local';
    const repoDir = path.join(PROJECTS_DIR, safeRepo);
    if (!fs.existsSync(repoDir)) {
      fs.mkdirSync(repoDir, { recursive: true });
    }

    const mcpConfigPath = path.join(repoDir, '.mcp.json');
    let existingServers: MCPServerDefinition[] = [];
    if (fs.existsSync(mcpConfigPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
        existingServers = parsed.mcpServers || [];
      } catch (e) {}
    }

    const filtered = existingServers.filter((s) => s.id !== server.id);
    filtered.push(server);

    fs.writeFileSync(mcpConfigPath, JSON.stringify({ mcpServers: filtered }, null, 2), 'utf-8');
    return { success: true, server };
  }

  public removeProjectMcpServer(repoName: string, serverId: string): { success: boolean; message: string } {
    const safeRepo = repoName.replace(/[^a-zA-Z0-9_-]/g, '') || 'local';
    const mcpConfigPath = path.join(PROJECTS_DIR, safeRepo, '.mcp.json');

    if (!fs.existsSync(mcpConfigPath)) {
      return { success: true, message: 'Nenhum MCP configurado.' };
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
      const filtered = (parsed.mcpServers || []).filter((s: MCPServerDefinition) => s.id !== serverId);
      fs.writeFileSync(mcpConfigPath, JSON.stringify({ mcpServers: filtered }, null, 2), 'utf-8');
      return { success: true, message: 'Servidor MCP removido com sucesso.' };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }
}

export const aiCenterService = new AICenterService();
