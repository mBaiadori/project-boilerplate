import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AISettingsState, ChatMessage } from '../types';
import { API } from '../services/api';
import { useWorkspace } from './WorkspaceContext';
import { useTemplateStore } from '../stores/templateStore';
import { useCopilotStore, type DynamicContext } from '../stores/copilotStore';

export type { DynamicContext };

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
  
  // Zustand Stores
  const activeEditingTemplate = useTemplateStore((s) => s.activeEditingTemplate);
  const isTemplateEditorMode = useTemplateStore((s) => s.isTemplateEditorMode);
  const setIsTemplateEditorMode = useTemplateStore((s) => s.setIsTemplateEditorMode);
  const resolveTemplate = useTemplateStore((s) => s.resolveTemplate);

  const messages = useCopilotStore((s) => s.messages);
  const isThinking = useCopilotStore((s) => s.isThinking);
  const setIsThinking = useCopilotStore((s) => s.setIsThinking);
  const aiSettings = useCopilotStore((s) => s.aiSettings);
  const setAiSettings = useCopilotStore((s) => s.setAiSettings);
  const isSettingsModalOpen = useCopilotStore((s) => s.isSettingsModalOpen);
  const openSettingsModal = useCopilotStore((s) => s.openSettingsModal);
  const closeSettingsModal = useCopilotStore((s) => s.closeSettingsModal);
  const dynamicContext = useCopilotStore((s) => s.dynamicContext);
  const setDynamicContext = useCopilotStore((s) => s.setDynamicContext);

  const isTemplatePromptEnabled = useCopilotStore((s) => s.isTemplatePromptEnabled);
  const toggleTemplatePrompt = useCopilotStore((s) => s.toggleTemplatePrompt);
  const isDocPromptEnabled = useCopilotStore((s) => s.isDocPromptEnabled);
  const toggleDocPrompt = useCopilotStore((s) => s.toggleDocPrompt);

  const [docTemplatePrompt, setDocTemplatePrompt] = useState<string | null>(null);
  const [docTemplateTitle, setDocTemplateTitle] = useState<string | null>(null);
  const [docTemplateId, setDocTemplateId] = useState<string | null>(null);

  const projectTemplatePrompt = projectConfig?.ai_template_prompt || 'Você é o Arquiteto Especialista em Criação e Padronização de Templates de Engenharia.\nAjude o usuário a definir uma estrutura lógica e rigorosa de seções (H1, H2, H3), criar placeholders dinâmicos {{CAMPO}} e redigir o system instruction do Copilot para este novo template.';

  // Real-time Template Context: If user is actively editing a template in TemplatesSubView, use activeEditingTemplate
  const templatePrompt = isTemplateEditorMode && activeEditingTemplate
    ? (activeEditingTemplate.prompt || activeEditingTemplate.systemPrompt || null)
    : docTemplatePrompt;

  const templateTitle = isTemplateEditorMode && activeEditingTemplate
    ? (activeEditingTemplate.title || activeEditingTemplate.templateName || activeEditingTemplate.id || 'Template')
    : docTemplateTitle;

  const templateId = isTemplateEditorMode && activeEditingTemplate
    ? (activeEditingTemplate.id || null)
    : docTemplateId;

  // Document Prompt State
  const docPrompt = fileMetadata?.prompt || null;

  // Reactively resolve template when activeFile metadata has templateId
  useEffect(() => {
    const currentTemplateId = fileMetadata?.templateId || null;
    setDocTemplateId(currentTemplateId);

    if (currentTemplateId) {
      resolveTemplate(currentTemplateId).then((tpl) => {
        if (tpl) {
          setDocTemplatePrompt(tpl.prompt || tpl.systemPrompt || null);
          setDocTemplateTitle(tpl.title || tpl.templateName || currentTemplateId);
        } else {
          setDocTemplatePrompt(null);
          setDocTemplateTitle(null);
        }
      }).catch(() => {
        setDocTemplatePrompt(null);
        setDocTemplateTitle(null);
      });
    } else {
      setDocTemplatePrompt(null);
      setDocTemplateTitle(null);
    }
  }, [activeFile, fileMetadata?.templateId, resolveTemplate]);

  // Enable doc prompt by default if docPrompt has text
  useEffect(() => {
    if (docPrompt && docPrompt.trim().length > 0) {
      useCopilotStore.getState().setIsDocPromptEnabled(true);
    }
  }, [activeFile, docPrompt]);

  const loadAISettings = useCallback(async () => {
    try {
      const res = await API.getAISettings();
      if (res.ok && res.data) {
        setAiSettings(res.data);
      }
    } catch (err) {
      console.error('[AIContext] Erro ao carregar configurações de IA:', err);
    }
  }, [setAiSettings]);

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

    // Check if we are editing a template in real-time
    const currentTemplate = useTemplateStore.getState().activeEditingTemplate;
    const inTemplateMode = useTemplateStore.getState().isTemplateEditorMode && currentTemplate;

    const effectivePath = inTemplateMode
      ? (currentTemplate.templateName ? `templates/${currentTemplate.templateName}.md` : (currentTemplate.id ? `templates/${currentTemplate.id}.md` : 'templates/novo-template.md'))
      : (dynamicContext?.filePath || activeFile || 'index.md');

    const effectiveContent = inTemplateMode
      ? (currentTemplate.content !== undefined ? currentTemplate.content : (dynamicContext?.content || ''))
      : (dynamicContext?.content !== undefined ? dynamicContext.content : (fileContent || ''));

    const effectiveBadges = contextBadges.length > 0
      ? contextBadges
      : dynamicContext?.badge
      ? [dynamicContext.badge]
      : inTemplateMode
      ? [`🛠️ Template: ${currentTemplate.title || currentTemplate.id || 'Novo'}`]
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

    useCopilotStore.getState().addMessage(userMessage);
    setIsThinking(true);

    try {
      const historyPayload = useCopilotStore.getState().messages.map(m => ({
        sender: m.sender,
        text: m.content
      }));

      // Combine active prompts based on context and user toggles
      const promptInstructions: string[] = [];

      if (inTemplateMode) {
        promptInstructions.push(`[Instruções do Especialista em Criação de Templates (ai_template_prompt)]:\n${projectTemplatePrompt}`);
        if (currentTemplate.prompt && currentTemplate.prompt.trim()) {
          promptInstructions.push(`[Instruções do Template em Edição "${currentTemplate.title || 'Template'}"]:\n${currentTemplate.prompt.trim()}`);
        }
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
        useCopilotStore.getState().addMessage(assistantMessage);

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
        useCopilotStore.getState().addMessage(errorMessage);
      }
    } catch (err) {
      console.error('[AIContext] Erro no envio de mensagem para IA:', err);
      const errorMessage: ChatMessage = {
        id: `msg-err-${Date.now()}`,
        sender: 'system',
        content: 'Falha na conexão com o servidor de IA.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      useCopilotStore.getState().addMessage(errorMessage);
    } finally {
      setIsThinking(false);
    }
  };

  const clearMessages = () => {
    useCopilotStore.getState().clearMessages();
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
        openSettingsModal,
        closeSettingsModal,
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
        isTemplateEditorMode: Boolean(isTemplateEditorMode || activeEditingTemplate),
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
