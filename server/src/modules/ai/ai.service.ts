import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { PROJECTS_DIR, DEFAULT_GLOBAL_SYSTEM_PROMPT } from '../../config/constants.js';
import { loadConfig } from '../../config/storage.js';

export interface ChatMessage {
  role: 'user' | 'model' | 'assistant' | 'system';
  content?: string;
  text?: string;
}

export class AIService {
  private getMemoryDir(repoName: string): string {
    return path.join(PROJECTS_DIR, repoName || 'local', '.spec-memory');
  }

  private getSessionsDir(repoName: string): string {
    return path.join(this.getMemoryDir(repoName), 'sessions');
  }

  getBriefing(repoName: string, filePath: string): string {
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
    aiSettings: { provider?: string; model?: string; api_key?: string; custom_endpoint?: string },
    prompt: string,
    docContext: string = '',
    filePath: string = 'index.md',
    history: ChatMessage[] = [],
    customSystemPrompt?: string
  ): Promise<{ reply: string; provider: string; model: string }> {
    const provider = (aiSettings.provider || 'gemini').toLowerCase();
    const model = aiSettings.model || 'gemini-2.5-flash';
    const apiKey = aiSettings.api_key || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || '';

    const systemPrompt = customSystemPrompt || DEFAULT_GLOBAL_SYSTEM_PROMPT;
    const contextPrompt = docContext
      ? `\n\n--- DOCUMENTO ATUAL (${filePath}) ---\n${docContext}\n--- FIM DO DOCUMENTO ---`
      : '';

    const fullUserPrompt = `${prompt}${contextPrompt}`;

    // 1. Google Gemini
    if (provider === 'gemini') {
      if (!apiKey) {
        return {
          reply: `⚠️ Chave da API do Google Gemini não configurada. Defina sua chave nas Configurações do Sistema ou via variável GEMINI_API_KEY.\n\n*Prompt recebido:* ${prompt}`,
          provider: 'gemini',
          model,
        };
      }

      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const geminiModel = genAI.getGenerativeModel({
          model: model.includes('gemini') ? model : 'gemini-2.5-flash',
          systemInstruction: systemPrompt,
        });

        // Format history for Gemini SDK
        const contents = history
          .filter((h) => (h.content || h.text) && h.role !== 'system')
          .map((h) => ({
            role: h.role === 'model' || h.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: h.content || h.text || '' }],
          }));

        contents.push({
          role: 'user',
          parts: [{ text: fullUserPrompt }],
        });

        const result = await geminiModel.generateContent({ contents });
        const responseText = result.response.text();

        return {
          reply: responseText,
          provider: 'gemini',
          model,
        };
      } catch (err: any) {
        return {
          reply: `Erro ao comunicar com Google Gemini: ${err.message || String(err)}`,
          provider: 'gemini',
          model,
        };
      }
    }

    // 2. OpenAI
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
          model: model || 'gpt-4o',
          messages,
        });

        return {
          reply: response.choices[0]?.message?.content || '',
          provider: 'openai',
          model: model || 'gpt-4o',
        };
      } catch (err: any) {
        return {
          reply: `Erro OpenAI: ${err.message || String(err)}`,
          provider: 'openai',
          model,
        };
      }
    }

    // 3. Anthropic Claude
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
        const messages: Anthropic.MessageParam[] = [
          ...history
            .filter((h) => (h.content || h.text) && h.role !== 'system')
            .map((h) => ({
              role: (h.role === 'model' ? 'assistant' : 'user') as 'user' | 'assistant',
              content: h.content || h.text || '',
            })),
          { role: 'user', content: fullUserPrompt },
        ];

        const response = await client.messages.create({
          model: model || 'claude-3-5-sonnet-20241022',
          max_tokens: 4096,
          system: systemPrompt,
          messages,
        });

        const textBlock = response.content.find((c: any) => c.type === 'text') as any;
        return {
          reply: textBlock?.text || '',
          provider: 'anthropic',
          model: model || 'claude-3-5-sonnet',
        };
      } catch (err: any) {
        return {
          reply: `Erro Anthropic: ${err.message || String(err)}`,
          provider: 'anthropic',
          model,
        };
      }
    }

    // 4. Ollama / OpenAI Compatible Local Endpoint
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

  appendChatEvent(repoName: string, filePath: string, sessionId: string, role: string, text: string) {
    const sessionsDir = this.getSessionsDir(repoName);
    fs.mkdirSync(sessionsDir, { recursive: true });

    const sessionFile = path.join(sessionsDir, `${sessionId}.json`);
    let sessionData: any = { session_id: sessionId, path: filePath, events: [] };

    if (fs.existsSync(sessionFile)) {
      try {
        sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
      } catch {}
    }

    sessionData.events.push({
      role,
      text,
      timestamp: new Date().toISOString(),
    });

    fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2), 'utf-8');
  }

  getChatHistory(repoName: string, sessionId?: string) {
    const sessionsDir = this.getSessionsDir(repoName);
    if (!fs.existsSync(sessionsDir)) return { sessions: [] };

    if (sessionId) {
      const sessionFile = path.join(sessionsDir, `${sessionId}.json`);
      if (fs.existsSync(sessionFile)) {
        try {
          return JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
        } catch {}
      }
    }

    const files = fs.readdirSync(sessionsDir).filter((f) => f.endsWith('.json'));
    const sessions = [];

    for (const f of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(sessionsDir, f), 'utf-8'));
        sessions.push({
          session_id: data.session_id || f.replace('.json', ''),
          path: data.path || '',
          event_count: data.events?.length || 0,
          created_at: data.events?.[0]?.timestamp,
        });
      } catch {}
    }

    return { sessions };
  }

  finalizeSession(repoName: string, filePath: string, sessionId: string, summary?: string) {
    const handoffsDir = path.join(this.getMemoryDir(repoName), 'handoffs');
    fs.mkdirSync(handoffsDir, { recursive: true });

    const handoffFile = path.join(handoffsDir, 'latest.md');
    const content = `# Handoff de Sessão (${new Date().toLocaleDateString()})\n\n**Arquivo:** \`${filePath}\`\n**Sessão:** \`${sessionId}\`\n\n### Resumo:\n${summary || 'Sessão finalizada com sucesso.'}\n`;

    fs.writeFileSync(handoffFile, content, 'utf-8');

    return {
      success: true,
      message: 'Sessão finalizada e Handoff gerado com sucesso.',
      handoff_path: handoffFile,
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
