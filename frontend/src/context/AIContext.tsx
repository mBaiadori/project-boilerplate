import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AISettingsState, ChatMessage } from '../types';
import { API } from '../services/api';
import { useWorkspace } from './WorkspaceContext';

interface AIContextType {
  aiSettings: AISettingsState | null;
  isSettingsModalOpen: boolean;
  messages: ChatMessage[];
  isThinking: boolean;
  openSettingsModal: () => void;
  closeSettingsModal: () => void;
  loadAISettings: () => Promise<void>;
  saveAISettings: (provider: string, model: string, apiKey?: string, customEndpoint?: string) => Promise<boolean>;
  saveSettings: (payload: { active_provider: string; active_model: string; api_keys?: Record<string, string>; custom_endpoint?: string }) => Promise<boolean>;
  sendMessage: (prompt: string, contextBadges?: string[]) => Promise<void>;
  clearMessages: () => void;
  resetMemory: (scope: string) => Promise<void>;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

export const AIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeRepo, activeFile, fileContent, loadFile, refreshPendingChanges } = useWorkspace();
  const [aiSettings, setAiSettings] = useState<AISettingsState | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);

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

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      content: prompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      contextBadges
    };

    setMessages(prev => [...prev, userMessage]);
    setIsThinking(true);

    try {
      const historyPayload = messages.map(m => ({
        sender: m.sender,
        text: m.content
      }));

      const res = await API.sendChatMessage({
        prompt,
        content: fileContent,
        path: activeFile,
        history: historyPayload,
        repo: activeRepo?.name || 'local'
      });

      if (res.ok && res.data) {
        const assistantMessage: ChatMessage = {
          id: `msg-ai-${Date.now()}`,
          sender: 'assistant',
          content: res.data.reply || 'Operação concluída com sucesso.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          diff: res.data.diff ? {
            path: activeFile,
            old_content: fileContent,
            new_content: res.data.diff.new_content || ''
          } : undefined
        };
        setMessages(prev => [...prev, assistantMessage]);

        // Se houve modificação de arquivo aplicada
        if (res.data.diff && res.data.diff.new_content) {
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
        openSettingsModal: () => setIsSettingsModalOpen(true),
        closeSettingsModal: () => setIsSettingsModalOpen(false),
        loadAISettings,
        saveAISettings,
        saveSettings,
        sendMessage,
        clearMessages,
        resetMemory
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
