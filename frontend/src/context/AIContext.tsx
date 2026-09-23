import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { AISettingsState, ChatMessage } from '../types';
import { API } from '../services/api';
import { useWorkspace } from './WorkspaceContext';

export interface DynamicContext {
  filePath: string;
  content: string;
  badge?: string;
}

interface AIContextType {
  aiSettings: AISettingsState | null;
  isSettingsModalOpen: boolean;
  messages: ChatMessage[];
  isThinking: boolean;
  dynamicContext: DynamicContext | null;
  setDynamicContext: (ctx: DynamicContext | null) => void;
  openSettingsModal: () => void;
  closeSettingsModal: () => void;
  loadAISettings: () => Promise<void>;
  saveAISettings: (provider: string, model: string, apiKey?: string, customEndpoint?: string) => Promise<boolean>;
  saveSettings: (payload: { active_provider: string; active_model: string; api_keys?: Record<string, string>; custom_endpoint?: string }) => Promise<boolean>;
  sendMessage: (prompt: string, contextBadges?: string[]) => Promise<void>;
  clearMessages: () => void;
  resetMemory: (scope: string) => Promise<void>;

  // Template Prompt Context & Toggles
  templatePrompt: string | null;
  templateTitle: string | null;
  templateId: string | null;
  isTemplatePromptEnabled: boolean;
  toggleTemplatePrompt: () => void;

  // Document Prompt Context & Toggles
  docPrompt: string | null;
  isDocPromptEnabled: boolean;
  toggleDocPrompt: () => void;

  // Template Creator Mode & Project Level Prompts
  isTemplateEditorMode: boolean;
  setIsTemplateEditorMode: (val: boolean) => void;
  projectTemplatePrompt: string;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

export const AIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeRepo, activeFile, fileContent, fileMetadata, loadFile, refreshPendingChanges, projectConfig } = useWorkspace();
  const [aiSettings, setAiSettings] = useState<AISettingsState | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [dynamicContext, setDynamicContext] = useState<DynamicContext | null>(null);
  const [isTemplateEditorMode, setIsTemplateEditorMode] = useState<boolean>(false);

  const projectTemplatePrompt = projectConfig?.ai_template_prompt || 'Você é o Arquiteto Especialista em Criação e Padronização de Templates de Engenharia.\nAjude o usuário a definir uma estrutura lógica e rigorosa de seções (H1, H2, H3), criar placeholders dinâmicos {{CAMPO}} e redigir o system instruction do Copilot para este novo template.';

  // Template Prompt State
  const [templatePrompt, setTemplatePrompt] = useState<string | null>(null);
  const [templateTitle, setTemplateTitle] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [isTemplatePromptEnabled, setIsTemplatePromptEnabled] = useState<boolean>(true);

  // Document Prompt State
  const docPrompt = fileMetadata?.prompt || null;
  const [isDocPromptEnabled, setIsDocPromptEnabled] = useState<boolean>(true);

  const activeRepoRef = useRef<string>('local');
  useEffect(() => { activeRepoRef.current = activeRepo?.name || 'local'; }, [activeRepo]);

  // Load Template Prompt when activeFile metadata has templateId
  useEffect(() => {
    const currentTemplateId = fileMetadata?.templateId || null;
    setTemplateId(currentTemplateId);

    if (currentTemplateId) {
      API.getTemplate(currentTemplateId).then((res) => {
        if (res.ok && res.data?.template) {
          const tpl = res.data.template;
          setTemplatePrompt(tpl.prompt || tpl.systemPrompt || null);
          setTemplateTitle(tpl.title || tpl.templateName || currentTemplateId);
          setIsTemplatePromptEnabled(true);
        } else {
          setTemplatePrompt(null);
          setTemplateTitle(null);
        }
      }).catch(() => {
        setTemplatePrompt(null);
        setTemplateTitle(null);
      });
    } else {
      setTemplatePrompt(null);
      setTemplateTitle(null);
    }
  }, [activeFile, fileMetadata?.templateId]);

  // Enable doc prompt by default if docPrompt has text
  useEffect(() => {
    if (docPrompt && docPrompt.trim().length > 0) {
      setIsDocPromptEnabled(true);
    }
  }, [activeFile, docPrompt]);

  const toggleTemplatePrompt = useCallback(() => {
    setIsTemplatePromptEnabled((prev) => !prev);
  }, []);

  const toggleDocPrompt = useCallback(() => {
    setIsDocPromptEnabled((prev) => !prev);
  }, []);

  const loadAISettings = useCallback(async () => {
    try {
      const res = await API.getAISettings();
      if (res.ok && res.data) {
        setAiSettings(res.data);
      }
    } catch (err) {
      console.error('[AIContext] Erro ao carregar configurações de IA:', err);
    }
  }, []);

  useEffect(() => {
    loadAISettings();
  }, [loadAISettings]);

  const saveAISettings = async (provider: string, model: string, apiKey?: string, customEndpoint?: string) => {
    try {
      const res = await API.saveAISettings({ provider, model, api_key: apiKey, custom_endpoint: customEndpoint });
      if (res.ok) {
        await loadAISettings();
        return true;
      }
      return false;
    } catch (err) {
      console.error('[AIContext] Erro ao salvar configurações de IA:', err);
      return false;
    }
  };

  const sendMessage = async (prompt: string, contextBadges: string[] = []) => {
    if (!prompt.trim()) return;

    const effectivePath = dynamicContext?.filePath || activeFile || 'index.md';
    const effectiveContent = dynamicContext?.content !== undefined ? dynamicContext.content : (fileContent || '');
    const effectiveBadges = contextBadges.length > 0
      ? contextBadges
      : dynamicContext?.badge
      ? [dynamicContext.badge]
      : activeFile
      ? [`📄 ${activeFile}`]
      : [];

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      content: prompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      contextBadges: effectiveBadges
    };

    setMessages(prev => [...prev, userMessage]);
    setIsThinking(true);

    try {
      const historyPayload = messages.map(m => ({
        sender: m.sender,
        text: m.content
      }));

      // Combine active prompts based on context and user toggles
      const promptInstructions: string[] = [];

      if (isTemplateEditorMode) {
        // In template editor mode, assume the specialized template creator prompt
        promptInstructions.push(`[Instruções do Especialista em Criação de Templates (ai_template_prompt)]:\n${projectTemplatePrompt}`);
      } else {
        if (isTemplatePromptEnabled && templatePrompt && templatePrompt.trim()) {
          promptInstructions.push(`[Instruções do Template "${templateTitle || 'Template'}"]:\n${templatePrompt.trim()}`);
        }
        if (isDocPromptEnabled && docPrompt && docPrompt.trim()) {
          promptInstructions.push(`[Instruções Específicas deste Documento]:\n${docPrompt.trim()}`);
        }
      }

      const assistantPrompt = promptInstructions.length > 0 ? promptInstructions.join('\n\n---\n\n') : undefined;

      const res = await API.sendChatMessage({
        prompt,
        content: effectiveContent,
        path: effectivePath,
        history: historyPayload,
        repo: activeRepo?.name || 'local',
        assistant_prompt: assistantPrompt,
      });

      if (res.ok && res.data) {
        const assistantMessage: ChatMessage = {
          id: `msg-ai-${Date.now()}`,
          sender: 'assistant',
          content: res.data.reply || 'Operação concluída com sucesso.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          diff: res.data.diff ? {
            path: effectivePath,
            old_content: effectiveContent,
            new_content: res.data.diff.new_content || ''
          } : undefined
        };
        setMessages(prev => [...prev, assistantMessage]);

        if (res.data.diff && res.data.diff.new_content && effectivePath === activeFile) {
          await loadFile(activeFile);
          await refreshPendingChanges();
        }
      } else {
        const errorMessage: ChatMessage = {
          id: `msg-err-${Date.now()}`,
          sender: 'system',
          content: 'Desculpe, ocorreu um erro ao se comunicar com o modelo de IA. Verifique as configurações de provedor.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (err) {
      console.error('[AIContext] Erro no envio de mensagem para IA:', err);
      const errorMessage: ChatMessage = {
        id: `msg-err-${Date.now()}`,
        sender: 'system',
        content: 'Falha na conexão com o servidor de IA.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsThinking(false);
    }
  };

  const clearMessages = () => {
    setMessages([]);
  };

  const resetMemory = async (scope: string) => {
    if (!activeRepo) return;
    try {
      await API.resetMemoryScope({ repo: activeRepo.name, scope });
      clearMessages();
    } catch (err) {
      console.error('[AIContext] Erro ao resetar memória:', err);
    }
  };

  const saveSettings = async (payload: { active_provider: string; active_model: string; api_keys?: Record<string, string>; custom_endpoint?: string }) => {
    const key = payload.api_keys ? payload.api_keys[payload.active_provider] : undefined;
    return saveAISettings(payload.active_provider, payload.active_model, key, payload.custom_endpoint);
  };

  return (
    <AIContext.Provider
      value={{
        aiSettings,
        isSettingsModalOpen,
        messages,
        isThinking,
        dynamicContext,
        setDynamicContext,
        openSettingsModal: () => setIsSettingsModalOpen(true),
        closeSettingsModal: () => setIsSettingsModalOpen(false),
        loadAISettings,
        saveAISettings,
        saveSettings,
        sendMessage,
        clearMessages,
        resetMemory,
        templatePrompt,
        templateTitle,
        templateId,
        isTemplatePromptEnabled,
        toggleTemplatePrompt,
        docPrompt,
        isDocPromptEnabled,
        toggleDocPrompt,
        isTemplateEditorMode,
        setIsTemplateEditorMode,
        projectTemplatePrompt,
      }}
    >
      {children}
    </AIContext.Provider>
  );
};

export const useAI = () => {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error('useAI deve ser utilizado dentro de um AIProvider');
  }
  return context;
};
