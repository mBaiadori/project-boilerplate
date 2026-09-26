import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { PROJECTS_DIR, DEFAULT_GLOBAL_SYSTEM_PROMPT } from '../../config/constants.js';
import { loadConfig } from '../../config/storage.js';
import { toolRegistry } from './tools/ToolRegistry.js';
import { ToolCallExecutionRecord } from './tools/tool.types.js';

export interface ChatMessage {
  role: 'user' | 'model' | 'assistant' | 'system';
  content?: string;
  text?: string;
}

export interface AIServiceCallOptions {
  provider?: string;
  model?: string;
  api_key?: string;
  custom_endpoint?: string;
  allowed_tools?: string[];
  repoName?: string;
  max_steps?: number;
}

export interface AIExecutionResult {
  reply: string;
  provider: string;
  model: string;
  tool_calls?: ToolCallExecutionRecord[];
  steps_count?: number;
}

export class AIService {
  private getMemoryDir(repoName: string): string {
    return path.join(PROJECTS_DIR, repoName || 'local', '.spec-memory');
  }

  private getSessionsDir(repoName: string): string {
    return path.join(this.getMemoryDir(repoName), 'sessions');
  }

  getBriefing(repoName: string, _filePath: string): string {
    const memDir = this.getMemoryDir(repoName);
    const handoffPath = path.join(memDir, 'handoffs', 'latest.md');
    let briefing = '';

    if (fs.existsSync(handoffPath)) {
      try {
        const handoff = fs.readFileSync(handoffPath, 'utf-8');
        briefing += `### Último Handoff de Contexto:\n${handoff}\n\n`;
      } catch {}
    }

    return briefing;
  }

  async callLLM(
    aiSettings: { provider?: string; model?: string; api_key?: string; custom_endpoint?: string; allowed_tools?: string[] },
    prompt: string,
    docContext: string = '',
    filePath: string = 'index.md',
    history: ChatMessage[] = [],
    customSystemPrompt?: string,
    repoName: string = 'local'
  ): Promise<AIExecutionResult> {
    const provider = (aiSettings.provider || 'gemini').toLowerCase();
    const model = aiSettings.model || 'gemini-2.5-flash';
    const apiKey = aiSettings.api_key || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || '';

    const systemPrompt = customSystemPrompt || DEFAULT_GLOBAL_SYSTEM_PROMPT;
    const contextPrompt = docContext
      ? `\n\n--- DOCUMENTO ATUAL (${filePath}) ---\n${docContext}\n--- FIM DO DOCUMENTO ---`
      : '';

    const fullUserPrompt = `${prompt}${contextPrompt}`;
    const allowedTools = aiSettings.allowed_tools;
    const hasTools = Array.isArray(allowedTools) && allowedTools.length > 0;
    const activeTools = hasTools ? toolRegistry.getToolsForSkill(allowedTools) : [];
    const executionContext = { repoName, filePath };
    const executedToolRecords: ToolCallExecutionRecord[] = [];
    const maxSteps = 5;

    // ──────────────────────────────────────────────────────────────────────────
    // 1. Google Gemini (com suporte a Function Calling e Retry no modelo escolhido)
    // ──────────────────────────────────────────────────────────────────────────
    if (provider === 'gemini') {
      if (!apiKey) {
        return {
          reply: `⚠️ Chave da API do Google Gemini não configurada. Defina sua chave nas Configurações do Sistema ou via variável GEMINI_API_KEY.\n\n*Prompt recebido:* ${prompt}`,
          provider: 'gemini',
          model,
        };
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const geminiTools = activeTools.length > 0
        ? [{ functionDeclarations: toolRegistry.toGeminiFunctionDeclarations(activeTools) }]
        : undefined;

      const contents: any[] = history
        .filter((h) => (h.content || h.text) && h.role !== 'system')
        .map((h) => ({
          role: h.role === 'model' || h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content || h.text || '' }],
        }));

      contents.push({
        role: 'user',
        parts: [{ text: fullUserPrompt }],
      });

      const selectedModelName = model.includes('gemini') ? model : 'gemini-2.5-flash';
      const geminiModel = genAI.getGenerativeModel({
        model: selectedModelName,
        systemInstruction: systemPrompt,
        tools: geminiTools,
      });

      let lastError: any = null;
      const maxAttempts = 2;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          let currentStep = 0;
          let finalResponseText = '';
          const stepContents = [...contents];

          while (currentStep < maxSteps) {
            currentStep++;
            const result = await geminiModel.generateContent({ contents: stepContents });
            const response = result.response;
            const functionCalls = response.functionCalls();

            if (!functionCalls || functionCalls.length === 0) {
              finalResponseText = response.text();
              break;
            }

            // Grava a resposta do modelo no histórico do loop
            stepContents.push({
              role: 'model',
              parts: response.candidates?.[0]?.content?.parts || [],
            });

            const functionResponseParts = [];
            for (const call of functionCalls) {
              const toolResult = await toolRegistry.executeTool(call.name, call.args || {}, executionContext);
              executedToolRecords.push({
                tool: call.name,
                args: call.args as Record<string, any>,
                result: toolResult,
                timestamp: new Date().toISOString(),
              });

              functionResponseParts.push({
                functionResponse: {
                  name: call.name,
                  response: toolResult,
                },
              });
            }

            stepContents.push({
              role: 'user',
              parts: functionResponseParts,
            });
          }

          return {
            reply: finalResponseText || 'Tarefa processada pelo agente.',
            provider: 'gemini',
            model: selectedModelName,
            tool_calls: executedToolRecords,
            steps_count: currentStep,
          };
        } catch (err: any) {
          lastError = err;
          const errMsg = String(err?.message || err);
          const isOverloaded = errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('429') || errMsg.includes('ResourceExhausted');

          if (isOverloaded && attempt < maxAttempts) {
            // Espera 1.2s antes de tentar novamente o mesmo modelo
            await new Promise((resolve) => setTimeout(resolve, 1200));
            continue;
          }
          break;
        }
      }

      return {
        reply: `Erro ao comunicar com Google Gemini (${selectedModelName}): ${lastError?.message || String(lastError)}`,
        provider: 'gemini',
        model: selectedModelName,
      };
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. OpenAI
    // ──────────────────────────────────────────────────────────────────────────
    if (provider === 'openai') {
      if (!apiKey) {
        return {
          reply: '⚠️ Chave da API OpenAI não configurada.',
          provider: 'openai',
          model: model || 'gpt-4o',
        };
      }

      try {
        const client = new OpenAI({ apiKey });
        const openAITools = activeTools.length > 0 ? toolRegistry.toOpenAITools(activeTools) : undefined;
        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
          { role: 'system', content: systemPrompt },
          ...history
            .filter((h) => h.content || h.text)
            .map((h) => ({
              role: (h.role === 'model' ? 'assistant' : h.role) as any,
              content: h.content || h.text || '',
            })),
          { role: 'user', content: fullUserPrompt },
        ];

        let currentStep = 0;
        let finalReply = '';

        while (currentStep < maxSteps) {
          currentStep++;
          const response = await client.chat.completions.create({
            model: model || 'gpt-4o',
            messages,
            tools: openAITools,
          });

          const choice = response.choices[0];
          const msg = choice?.message;

          if (!msg?.tool_calls || msg.tool_calls.length === 0) {
            finalReply = msg?.content || '';
            break;
          }

          messages.push(msg);

          for (const tc of msg.tool_calls) {
            if (tc.type === 'function') {
              let parsedArgs = {};
              try {
                parsedArgs = JSON.parse(tc.function.arguments || '{}');
              } catch {}

              const toolResult = await toolRegistry.executeTool(tc.function.name, parsedArgs, executionContext);
              executedToolRecords.push({
                tool: tc.function.name,
                args: parsedArgs,
                result: toolResult,
                timestamp: new Date().toISOString(),
              });

              messages.push({
                role: 'tool',
                tool_call_id: tc.id,
                content: JSON.stringify(toolResult),
              });
            }
          }
        }

        return {
          reply: finalReply || 'Processamento concluído pelo agente.',
          provider: 'openai',
          model: model || 'gpt-4o',
          tool_calls: executedToolRecords,
          steps_count: currentStep,
        };
      } catch (err: any) {
        return {
          reply: `Erro OpenAI: ${err.message || String(err)}`,
          provider: 'openai',
          model,
        };
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 3. Anthropic Claude
    // ──────────────────────────────────────────────────────────────────────────
    if (provider === 'anthropic') {
      if (!apiKey) {
        return {
          reply: '⚠️ Chave da API Anthropic não configurada.',
          provider: 'anthropic',
          model: model || 'claude-3-5-sonnet',
        };
      }

      try {
        const client = new Anthropic({ apiKey });
        const anthropicTools = activeTools.length > 0 ? toolRegistry.toAnthropicTools(activeTools) : undefined;
        const messages: Anthropic.MessageParam[] = [
          ...history
            .filter((h) => (h.content || h.text) && h.role !== 'system')
            .map((h) => ({
              role: (h.role === 'model' ? 'assistant' : 'user') as 'user' | 'assistant',
              content: h.content || h.text || '',
            })),
          { role: 'user', content: fullUserPrompt },
        ];

        let currentStep = 0;
        let finalReply = '';

        while (currentStep < maxSteps) {
          currentStep++;
          const response = await client.messages.create({
            model: model || 'claude-3-5-sonnet-20241022',
            max_tokens: 4096,
            system: systemPrompt,
            messages,
            tools: anthropicTools,
          });

          if (response.stop_reason !== 'tool_use') {
            const textBlock = response.content.find((c: any) => c.type === 'text') as any;
            finalReply = textBlock?.text || '';
            break;
          }

          messages.push({
            role: 'assistant',
            content: response.content as any,
          });

          const toolResultBlocks: any[] = [];
          for (const block of response.content) {
            if (block.type === 'tool_use') {
              const toolResult = await toolRegistry.executeTool(block.name, (block.input as any) || {}, executionContext);
              executedToolRecords.push({
                tool: block.name,
                args: block.input as Record<string, any>,
                result: toolResult,
                timestamp: new Date().toISOString(),
              });

              toolResultBlocks.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: JSON.stringify(toolResult),
              });
            }
          }

          messages.push({
            role: 'user',
            content: toolResultBlocks,
          });
        }

        return {
          reply: finalReply || 'Processamento concluído.',
          provider: 'anthropic',
          model: model || 'claude-3-5-sonnet',
          tool_calls: executedToolRecords,
          steps_count: currentStep,
        };
      } catch (err: any) {
        return {
          reply: `Erro Anthropic: ${err.message || String(err)}`,
          provider: 'anthropic',
          model,
        };
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 4. Ollama / Local Endpoint
    // ──────────────────────────────────────────────────────────────────────────
    if (provider === 'ollama') {
      const endpoint = aiSettings.custom_endpoint || 'http://localhost:11434/v1';
      try {
        const client = new OpenAI({
          baseURL: endpoint,
          apiKey: apiKey || 'ollama',
        });

        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
          { role: 'system', content: systemPrompt },
          ...history
            .filter((h) => h.content || h.text)
            .map((h) => ({
              role: (h.role === 'model' ? 'assistant' : h.role) as any,
              content: h.content || h.text || '',
            })),
          { role: 'user', content: fullUserPrompt },
        ];

        const response = await client.chat.completions.create({
          model: model || 'llama3.3',
          messages,
        });

        return {
          reply: response.choices[0]?.message?.content || '',
          provider: 'ollama',
          model: model || 'llama3.3',
        };
      } catch (err: any) {
        return {
          reply: `Erro Ollama Local (${endpoint}): ${err.message || String(err)}`,
          provider: 'ollama',
          model,
        };
      }
    }

    return {
      reply: `Provedor de IA '${provider}' não suportado.`,
      provider,
      model,
    };
  }

  appendChatEvent(repoName: string, filePath: string, sessionId: string, role: string, text: string, metadata?: { model?: string; author?: string }) {
    const sessionsDir = this.getSessionsDir(repoName);
    fs.mkdirSync(sessionsDir, { recursive: true });

    const sessionFile = path.join(sessionsDir, `${sessionId}.json`);
    let sessionData: any = {
      session_id: sessionId,
      path: filePath,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      author: { name: metadata?.author || 'Developer', role: 'Developer' },
      model: metadata?.model || 'gemini',
      events: []
    };

    if (fs.existsSync(sessionFile)) {
      try {
        sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
      } catch {}
    }

    sessionData.updated_at = new Date().toISOString();
    if (metadata?.model) sessionData.model = metadata.model;
    if (filePath && !sessionData.path) sessionData.path = filePath;

    sessionData.events.push({
      role,
      text,
      timestamp: new Date().toISOString(),
    });

    // Calcula métricas
    const rounds = Math.ceil(sessionData.events.length / 2);
    const approxTokens = sessionData.events.reduce((acc: number, ev: any) => acc + Math.ceil((ev.text?.length || 0) / 4), 0);
    sessionData.metrics = {
      rounds,
      total_tokens: approxTokens,
      event_count: sessionData.events.length,
    };

    fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2), 'utf-8');
  }

  getChatHistory(repoName: string, sessionId?: string, filePath?: string) {
    const sessionsDir = this.getSessionsDir(repoName);
    if (!fs.existsSync(sessionsDir)) return { sessions: [] };

    if (sessionId) {
      const sessionFile = path.join(sessionsDir, `${sessionId}.json`);
      if (fs.existsSync(sessionFile)) {
        try {
          const session = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
          return { session, sessions: [session] };
        } catch {}
      }
    }

    const files = fs.readdirSync(sessionsDir).filter((f) => f.endsWith('.json'));
    const sessions = [];

    for (const f of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(sessionsDir, f), 'utf-8'));
        
        // Se foi solicitado filtro por filePath específico (e não for global/index), podemos ponderar
        if (filePath && data.path && data.path !== filePath && filePath !== 'index.md') {
          // Permite todas se não quiser filtro restritivo, mas aqui incluímos na lista
        }

        const lastEvent = data.events && data.events.length > 0 ? data.events[data.events.length - 1] : null;
        const firstUserEvent = data.events ? data.events.find((e: any) => e.role === 'user') : null;

        sessions.push({
          session_id: data.session_id || f.replace('.json', ''),
          path: data.path || 'Global',
          event_count: data.events?.length || 0,
          created_at: data.created_at || data.events?.[0]?.timestamp || new Date().toISOString(),
          updated_at: data.updated_at || lastEvent?.timestamp || data.created_at || new Date().toISOString(),
          model: data.model || 'AI Assistant',
          author: data.author || { name: 'Developer' },
          preview: firstUserEvent?.text ? (firstUserEvent.text.length > 90 ? firstUserEvent.text.slice(0, 90) + '...' : firstUserEvent.text) : 'Conversa com Copilot',
          metrics: data.metrics || {
            rounds: Math.ceil((data.events?.length || 1) / 2),
            total_tokens: 0,
          },
        });
      } catch {}
    }

    // Ordena da mais recente para a mais antiga
    sessions.sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime());

    return { sessions };
  }

  getSessionDetails(repoName: string, sessionId?: string) {
    if (!sessionId) return null;
    const sessionsDir = this.getSessionsDir(repoName);
    const sessionFile = path.join(sessionsDir, `${sessionId}.json`);
    if (fs.existsSync(sessionFile)) {
      try {
        return JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
      } catch {}
    }
    return null;
  }

  deleteSession(repoName: string, sessionId: string) {
    const sessionsDir = this.getSessionsDir(repoName);
    const sessionFile = path.join(sessionsDir, `${sessionId}.json`);
    if (fs.existsSync(sessionFile)) {
      try {
        fs.unlinkSync(sessionFile);
        return { success: true, message: 'Sessão removida com sucesso.' };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
    return { success: false, error: 'Sessão não encontrada.' };
  }

  finalizeSession(repoName: string, filePath: string, sessionId: string, summary?: string) {
    const memDir = this.getMemoryDir(repoName);
    const handoffsDir = path.join(memDir, 'handoffs');
    fs.mkdirSync(handoffsDir, { recursive: true });

    const sessionData = this.getSessionDetails(repoName, sessionId);
    const nowStr = new Date().toLocaleString('pt-BR');
    
    let generatedSummary = summary;
    if (!generatedSummary && sessionData && sessionData.events?.length > 0) {
      const userQuestions = sessionData.events
        .filter((e: any) => e.role === 'user')
        .map((e: any) => `- ${e.text.slice(0, 140)}`)
        .join('\n');
      generatedSummary = `### Decisões e Tópicos Discutidos:\n${userQuestions || 'Sessão de pareamento.'}`;
    }

    const content = `# Handoff de Sessão (${nowStr})\n\n**Arquivo / Escopo:** \`${filePath || 'Global'}\`\n**Sessão:** \`${sessionId}\`\n**Modelo:** \`${sessionData?.model || 'AI'}\`\n\n${generatedSummary || 'Sessão finalizada com sucesso.'}\n`;

    const handoffFile = path.join(handoffsDir, 'latest.md');
    fs.writeFileSync(handoffFile, content, 'utf-8');

    // Salva também com timestamp para histórico de handoffs
    const archiveHandoffFile = path.join(handoffsDir, `handoff-${sessionId}.md`);
    fs.writeFileSync(archiveHandoffFile, content, 'utf-8');

    return {
      success: true,
      message: 'Sessão finalizada e Handoff gerado com sucesso.',
      handoff_path: handoffFile,
      briefing: content,
    };
  }

  resetMemory(repoName: string) {
    const memDir = this.getMemoryDir(repoName);
    if (fs.existsSync(memDir)) {
      fs.rmSync(memDir, { recursive: true, force: true });
    }
    return { success: true, message: 'Memória de IA resetada com sucesso.' };
  }
}

export const aiService = new AIService();
