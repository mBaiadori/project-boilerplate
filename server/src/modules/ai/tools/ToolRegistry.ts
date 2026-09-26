import { AgentTool, ToolExecutionContext, ToolResult } from './tool.types.js';
import { nativeTools } from './native-tools.js';
import { customToolsService } from '../../skills/custom-tools.service.js';

function convertPropToGeminiSchema(prop: any): any {
  if (!prop) return { type: 'STRING' };
  const rawType = (prop.type || 'string').toLowerCase();
  let type = 'STRING';
  if (rawType === 'string') type = 'STRING';
  else if (rawType === 'number') type = 'NUMBER';
  else if (rawType === 'integer') type = 'INTEGER';
  else if (rawType === 'boolean') type = 'BOOLEAN';
  else if (rawType === 'array') type = 'ARRAY';
  else if (rawType === 'object') type = 'OBJECT';

  const schema: any = { type };
  if (prop.description) {
    schema.description = prop.description;
  }
  if (prop.enum && Array.isArray(prop.enum)) {
    schema.enum = prop.enum;
  }
  if (type === 'ARRAY') {
    schema.items = prop.items ? convertPropToGeminiSchema(prop.items) : { type: 'STRING' };
  }
  if (type === 'OBJECT' && prop.properties) {
    schema.properties = Object.entries(prop.properties).reduce((acc: any, [k, v]) => {
      acc[k] = convertPropToGeminiSchema(v);
      return acc;
    }, {});
    if (Array.isArray(prop.required) && prop.required.length > 0) {
      schema.required = prop.required;
    }
  }
  return schema;
}

export class ToolRegistry {
  private tools: Map<string, AgentTool> = new Map();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults() {
    for (const tool of nativeTools) {
      this.tools.set(tool.name, tool);
    }
  }

  registerTool(tool: AgentTool) {
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  getAllTools(repoName?: string): AgentTool[] {
    const nativeList = Array.from(this.tools.values());
    if (!repoName) return nativeList;

    const customList = customToolsService.getProjectTools(repoName)
      .filter((ct) => ct.is_active !== false)
      .map((ct): AgentTool => ({
        name: ct.name,
        description: `[Custom Tool] ${ct.description}`,
        parameters: ct.parameters as any,
        execute: async (args, ctx) => {
          return await customToolsService.executeCustomTool(ct, args, ctx);
        },
      }));

    return [...nativeList, ...customList];
  }

  getToolsForSkill(allowedToolNames?: string[], repoName?: string): AgentTool[] {
    const all = this.getAllTools(repoName);
    if (!allowedToolNames || allowedToolNames.length === 0) {
      return all;
    }
    return all.filter((t) => allowedToolNames.includes(t.name));
  }

  async executeTool(
    toolName: string,
    args: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const nativeTool = this.tools.get(toolName);
    if (nativeTool) {
      try {
        return await nativeTool.execute(args || {}, context);
      } catch (err: any) {
        return {
          success: false,
          error: `Erro ao executar ferramenta nativa '${toolName}': ${err.message || String(err)}`,
        };
      }
    }

    if (context.repoName) {
      const customTool = customToolsService.getProjectTool(context.repoName, toolName);
      if (customTool) {
        return await customToolsService.executeCustomTool(customTool, args || {}, context);
      }
    }

    return {
      success: false,
      error: `Ferramenta '${toolName}' não registrada no sistema ou no projeto ativo.`,
    };
  }

  /**
   * Converte ferramentas para o formato Gemini Function Declarations
   */
  toGeminiFunctionDeclarations(tools: AgentTool[]): any[] {
    return tools.map((t) => {
      const properties = Object.entries(t.parameters.properties || {}).reduce((acc: any, [key, prop]) => {
        acc[key] = convertPropToGeminiSchema(prop);
        return acc;
      }, {});

      return {
        name: t.name,
        description: t.description,
        parameters: {
          type: 'OBJECT',
          properties,
          required: t.parameters.required || [],
        },
      };
    });
  }

  /**
   * Converte ferramentas para o formato OpenAI Tools
   */
  toOpenAITools(tools: AgentTool[]): any[] {
    return tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: {
          type: 'object',
          properties: t.parameters.properties || {},
          required: t.parameters.required || [],
        },
      },
    }));
  }

  /**
   * Converte ferramentas para o formato Anthropic Tools
   */
  toAnthropicTools(tools: AgentTool[]): any[] {
    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: {
        type: 'object',
        properties: t.parameters.properties || {},
        required: t.parameters.required || [],
      },
    }));
  }
}

export const toolRegistry = new ToolRegistry();
