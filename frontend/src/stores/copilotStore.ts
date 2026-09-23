import { create } from 'zustand';
import type { AISettingsState, ChatMessage } from '../types';

export interface DynamicContext {
  filePath: string;
  content: string;
  badge?: string;
}

export interface CopilotStoreState {
  messages: ChatMessage[];
  isThinking: boolean;
  aiSettings: AISettingsState | null;
  isSettingsModalOpen: boolean;
  dynamicContext: DynamicContext | null;

  // Prompt toggles & states
  templatePrompt: string | null;
  templateTitle: string | null;
  templateId: string | null;
  isTemplatePromptEnabled: boolean;

  docPrompt: string | null;
  isDocPromptEnabled: boolean;

  // Actions
  setMessages: (messages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
  addMessage: (msg: ChatMessage) => void;
  clearMessages: () => void;
  setIsThinking: (isThinking: boolean) => void;
  setAiSettings: (settings: AISettingsState | null) => void;
  openSettingsModal: () => void;
  closeSettingsModal: () => void;
  setDynamicContext: (ctx: DynamicContext | null) => void;

  setTemplateContext: (data: { id: string | null; title: string | null; prompt: string | null }) => void;
  toggleTemplatePrompt: () => void;
  setIsTemplatePromptEnabled: (val: boolean) => void;

  setDocPrompt: (prompt: string | null) => void;
  toggleDocPrompt: () => void;
  setIsDocPromptEnabled: (val: boolean) => void;
}

export const useCopilotStore = create<CopilotStoreState>((set) => ({
  messages: [],
  isThinking: false,
  aiSettings: null,
  isSettingsModalOpen: false,
  dynamicContext: null,

  templatePrompt: null,
  templateTitle: null,
  templateId: null,
  isTemplatePromptEnabled: true,

  docPrompt: null,
  isDocPromptEnabled: true,

  setMessages: (messages) => {
    set((state) => ({
      messages: typeof messages === 'function' ? messages(state.messages) : messages,
    }));
  },

  addMessage: (msg) => {
    set((state) => ({ messages: [...state.messages, msg] }));
  },

  clearMessages: () => {
    set({ messages: [] });
  },

  setIsThinking: (isThinking) => {
    set({ isThinking });
  },

  setAiSettings: (aiSettings) => {
    set({ aiSettings });
  },

  openSettingsModal: () => {
    set({ isSettingsModalOpen: true });
  },

  closeSettingsModal: () => {
    set({ isSettingsModalOpen: false });
  },

  setDynamicContext: (dynamicContext) => {
    set({ dynamicContext });
  },

  setTemplateContext: ({ id, title, prompt }) => {
    set({
      templateId: id,
      templateTitle: title,
      templatePrompt: prompt,
      ...(prompt ? { isTemplatePromptEnabled: true } : {}),
    });
  },

  toggleTemplatePrompt: () => {
    set((state) => ({ isTemplatePromptEnabled: !state.isTemplatePromptEnabled }));
  },

  setIsTemplatePromptEnabled: (val) => {
    set({ isTemplatePromptEnabled: val });
  },

  setDocPrompt: (docPrompt) => {
    set({
      docPrompt,
      ...(docPrompt && docPrompt.trim().length > 0 ? { isDocPromptEnabled: true } : {}),
    });
  },

  toggleDocPrompt: () => {
    set((state) => ({ isDocPromptEnabled: !state.isDocPromptEnabled }));
  },

  setIsDocPromptEnabled: (val) => {
    set({ isDocPromptEnabled: val });
  },
}));
