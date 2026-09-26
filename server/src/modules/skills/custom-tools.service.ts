import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { PROJECTS_DIR } from '../../config/constants.js';
import { loadConfig, recordChange } from '../../config/storage.js';
import { CustomToolDefinition, ProjectToolsManifest } from './skills.types.js';
import { ToolResult } from '../ai/tools/tool.types.js';

const execAsync = promisify(exec);

function getSafeRepo(repoName?: string): string {
  if (repoName) return repoName.replace(/[^a-zA-Z0-9_-]/g, '') || 'local';
  const cfg = loadConfig();
  return (cfg.active_repo?.name || 'local').replace(/[^a-zA-Z0-9_-]/g, '') || 'local';
}

export class CustomToolsService {
  private getRepoDir(repoName: string): string {
    return path.join(PROJECTS_DIR, getSafeRepo(repoName));
  }

  private getToolsDir(repoName: string): string {
    return path.join(this.getRepoDir(repoName), '.tools');
  }

  private getManifestPath(repoName: string): string {
    return path.join(this.getToolsDir(repoName), 'tools.manifest.json');
  }

  public getProjectManifest(repoName: string): ProjectToolsManifest {
    const manifestPath = this.getManifestPath(repoName);
    if (fs.existsSync(manifestPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        if (Array.isArray(data.tools)) {
          return data;
        }
      } catch (e) {
        console.warn(`[CustomToolsService] Erro ao ler ${manifestPath}:`, e);
      }
    }

    return {
      version: '1.0.0',
      project_repo: getSafeRepo(repoName),
      tools: [],
    };
  }

  private saveManifest(repoName: string, manifest: ProjectToolsManifest) {
    const toolsDir = this.getToolsDir(repoName);
    if (!fs.existsSync(toolsDir)) {
      fs.mkdirSync(toolsDir, { recursive: true });
    }
    const manifestPath = this.getManifestPath(repoName);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  }

  public getProjectTools(repoName: string): CustomToolDefinition[] {
    const manifest = this.getProjectManifest(repoName);
    return manifest.tools || [];
  }

  public getProjectTool(repoName: string, idOrName: string): CustomToolDefinition | null {
    const tools = this.getProjectTools(repoName);
    return (
      tools.find(
        (t) =>
          t.id === idOrName ||
          t.name.toLowerCase() === idOrName.toLowerCase()
      ) || null
    );
  }

  public saveCustomTool(
    repoName: string,
    toolData: Partial<CustomToolDefinition> & { name: string; description: string }
  ): { success: boolean; tool: CustomToolDefinition } {
    const safeRepo = getSafeRepo(repoName);
    const manifest = this.getProjectManifest(safeRepo);

    const toolName = toolData.name.trim().replace(/[^a-zA-Z0-9_]/g, '_');
    const toolId = toolData.id || toolName.toLowerCase().replace(/_/g, '-');
    const now = new Date().toISOString();

    const existingIndex = manifest.tools.findIndex(
      (t) => t.id === toolId || t.name.toLowerCase() === toolName.toLowerCase()
    );

    const cleanTool: CustomToolDefinition = {
      id: toolId,
      name: toolName,
      title: toolData.title || toolData.name,
      description: toolData.description,
      category: toolData.category || 'utility',
      parameters: toolData.parameters || {
        type: 'object',
        properties: {},
        required: [],
      },
      handler_type: toolData.handler_type || 'javascript',
      handler_code: toolData.handler_code || '',
      handler_config: toolData.handler_config || {},
      is_active: toolData.is_active !== undefined ? toolData.is_active : true,
      source: 'project',
      created_at: existingIndex >= 0 ? manifest.tools[existingIndex].created_at : now,
      updated_at: now,
    };

    if (existingIndex >= 0) {
      manifest.tools[existingIndex] = cleanTool;
    } else {
      manifest.tools.push(cleanTool);
    }

    this.saveManifest(safeRepo, manifest);

    // Persist tool folder for ease of inspection
    const toolDir = path.join(this.getToolsDir(safeRepo), toolId);
    if (!fs.existsSync(toolDir)) {
      fs.mkdirSync(toolDir, { recursive: true });
    }
    fs.writeFileSync(path.join(toolDir, 'tool.json'), JSON.stringify(cleanTool, null, 2), 'utf-8');
    if (cleanTool.handler_type === 'javascript' && cleanTool.handler_code) {
      fs.writeFileSync(path.join(toolDir, 'handler.js'), cleanTool.handler_code, 'utf-8');
    }

    recordChange(
      safeRepo,
      `.tools/${toolId}/tool.json`,
      existingIndex >= 0 ? 'MODIFIED' : 'ADDED',
      '',
      JSON.stringify(cleanTool, null, 2)
    );

    return { success: true, tool: cleanTool };
  }

  public deleteCustomTool(repoName: string, toolId: string): { success: boolean; message: string } {
    const safeRepo = getSafeRepo(repoName);
    const manifest = this.getProjectManifest(safeRepo);

    manifest.tools = manifest.tools.filter((t) => t.id !== toolId && t.name !== toolId);
    this.saveManifest(safeRepo, manifest);

    const toolDir = path.join(this.getToolsDir(safeRepo), toolId);
    if (fs.existsSync(toolDir)) {
      try {
        fs.rmSync(toolDir, { recursive: true, force: true });
      } catch {}
    }

    recordChange(safeRepo, `.tools/${toolId}`, 'DELETED', '', '');

    return { success: true, message: `Ferramenta customizada '${toolId}' removida com sucesso.` };
  }

  /**
   * Executa a ferramenta customizada com segurança de acordo com o handler_type
   */
  public async executeCustomTool(
    tool: CustomToolDefinition,
    args: Record<string, any>,
    context: { repoName: string; filePath?: string }
  ): Promise<ToolResult> {
    try {
      if (tool.handler_type === 'javascript') {
        return await this.executeJavaScriptHandler(tool, args, context);
      } else if (tool.handler_type === 'http') {
        return await this.executeHttpHandler(tool, args, context);
      } else if (tool.handler_type === 'shell') {
        return await this.executeShellHandler(tool, args, context);
      }

      return {
        success: false,
        error: `Tipo de handler desconhecido: ${tool.handler_type}`,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Falha na execução da ferramenta customizada '${tool.name}': ${err.message || String(err)}`,
      };
    }
  }

  private async executeJavaScriptHandler(
    tool: CustomToolDefinition,
    args: Record<string, any>,
    context: { repoName: string; filePath?: string }
  ): Promise<ToolResult> {
    const code = tool.handler_code || '';
    if (!code.trim()) {
      return {
        success: false,
        error: `A ferramenta '${tool.name}' não possui código JavaScript de execução configurado.`,
      };
    }

    const safeRepoDir = path.resolve(PROJECTS_DIR, getSafeRepo(context.repoName));

    // Sandbox helper functions exposed to the custom script
    const safeUtils = {
      fetch: globalThis.fetch,
      JSON,
      Math,
      Date,
      Buffer,
      readProjectFile: (relPath: string) => {
        const full = path.resolve(safeRepoDir, relPath.replace(/^\/+/, ''));
        if (!full.startsWith(safeRepoDir)) {
          throw new Error('Acesso negado: fora do diretório do projeto.');
        }
        if (!fs.existsSync(full)) return null;
        return fs.readFileSync(full, 'utf-8');
      },
      writeProjectFile: (relPath: string, content: string) => {
        const full = path.resolve(safeRepoDir, relPath.replace(/^\/+/, ''));
        if (!full.startsWith(safeRepoDir)) {
          throw new Error('Acesso negado: fora do diretório do projeto.');
        }
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, content, 'utf-8');
        return true;
      },
      listProjectFiles: (relDir = '') => {
        const full = path.resolve(safeRepoDir, relDir.replace(/^\/+/, ''));
        if (!full.startsWith(safeRepoDir)) {
          throw new Error('Acesso negado: fora do diretório do projeto.');
        }
        if (!fs.existsSync(full)) return [];
        return fs.readdirSync(full);
      },
    };

    // Construct an async wrapper around user code
    // User can either write `return { success: true, data: ... }` or write a handler function
    const wrappedFunction = new Function(
      'args',
      'context',
      'utils',
      `
      return (async () => {
        ${code}
      })();
      `
    );

    const result = await Promise.race([
      wrappedFunction(args, context, safeUtils),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout de execução excedido (15s)')), 15000)),
    ]);

    if (result && typeof result === 'object' && ('success' in result || 'data' in result)) {
      return {
        success: result.success !== undefined ? Boolean(result.success) : true,
        data: result.data !== undefined ? result.data : result,
        error: result.error,
      };
    }

    return {
      success: true,
      data: result,
    };
  }

  private async executeHttpHandler(
    tool: CustomToolDefinition,
    args: Record<string, any>,
    context: { repoName: string; filePath?: string }
  ): Promise<ToolResult> {
    const config = tool.handler_config || {};
    const url = config.url;
    if (!url) {
      return { success: false, error: `URL HTTP não configurada para a ferramenta '${tool.name}'.` };
    }

    const method = config.method || 'POST';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(config.headers || {}),
    };

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (method !== 'GET') {
      fetchOptions.body = JSON.stringify({
        args,
        context,
        tool: tool.name,
      });
    }

    const response = await fetch(url, fetchOptions);
    const contentType = response.headers.get('content-type') || '';
    let responseData: any = null;

    if (contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status} ${response.statusText}: ${JSON.stringify(responseData)}`,
      };
    }

    return {
      success: true,
      data: responseData,
    };
  }

  private async executeShellHandler(
    tool: CustomToolDefinition,
    args: Record<string, any>,
    context: { repoName: string; filePath?: string }
  ): Promise<ToolResult> {
    const config = tool.handler_config || {};
    let command = config.command || '';
    if (!command.trim()) {
      return { success: false, error: `Comando shell não configurado para a ferramenta '${tool.name}'.` };
    }

    // Replace parameter placeholders in command (e.g. {{file_path}}, {{query}})
    for (const [key, val] of Object.entries(args)) {
      command = command.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(val));
    }

    const safeRepoDir = path.resolve(PROJECTS_DIR, getSafeRepo(context.repoName));

    const { stdout, stderr } = await execAsync(command, {
      cwd: safeRepoDir,
      timeout: 20000,
      maxBuffer: 1024 * 1024 * 2,
    });

    return {
      success: true,
      data: {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        command,
      },
    };
  }
}

export const customToolsService = new CustomToolsService();
