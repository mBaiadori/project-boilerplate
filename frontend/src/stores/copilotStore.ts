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

  // Session Management
  currentSessionId: string;
  setCurrentSessionId: (id: string) => void;
  newChatSession: () => string;

  // Multi-Document References & Global Scope
  referencedDocs: string[];
  isGlobalScope: boolean;
  setReferencedDocs: (docs: string[]) => void;
  addReferencedDoc: (path: string) => void;
  removeReferencedDoc: (path: string) => void;
  setIsGlobalScope: (isGlobal: boolean) => void;

  // Skills & RAW Mode
  activeSkillId: string | null;
  isRawMode: boolean;
  isSkillsModalOpen: boolean;

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

  setActiveSkillId: (skillId: string | null) => void;
  setIsRawMode: (isRaw: boolean) => void;
  openSkillsModal: () => void;
  closeSkillsModal: () => void;

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

  currentSessionId: `sess-${Date.now()}`,
  referencedDocs: [],
  isGlobalScope: false,

  activeSkillId: 'living-docs-governance', // Default skill
  isRawMode: false,
  isSkillsModalOpen: false,

  templatePrompt: null,
  templateTitle: null,
  templateId: null,
  isTemplatePromptEnabled: true,

  docPrompt: null,
  isDocPromptEnabled: true,

  setCurrentSessionId: (currentSessionId) => {
    set({ currentSessionId });
  },

  newChatSession: () => {
    const newId = `sess-${Date.now()}`;
    set({
      currentSessionId: newId,
      messages: [],
      isThinking: false,
    });
    return newId;
  },

  setReferencedDocs: (referencedDocs) => {
    set({ referencedDocs, isGlobalScope: referencedDocs.length === 0 });
  },

  addReferencedDoc: (path) => {
    set((state) => {
      if (state.referencedDocs.includes(path)) return state;
      return {
        referencedDocs: [...state.referencedDocs, path],
        isGlobalScope: false,
      };
    });
  },

  removeReferencedDoc: (path) => {
    set((state) => {
      const nextDocs = state.referencedDocs.filter((p) => p !== path);
      return {
        referencedDocs: nextDocs,
        isGlobalScope: nextDocs.length === 0,
      };
    });
  },

  setIsGlobalScope: (isGlobalScope) => {
    set((state) => ({
      isGlobalScope,
      referencedDocs: isGlobalScope ? [] : state.referencedDocs,
    }));
  },

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

  setActiveSkillId: (activeSkillId) => {
    set({ activeSkillId });
  },

  setIsRawMode: (isRawMode) => {
    set({ isRawMode });
  },

  openSkillsModal: () => {
    set({ isSkillsModalOpen: true });
  },

  closeSkillsModal: () => {
    set({ isSkillsModalOpen: false });
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

  setIsTemplatePromptEnabled: (isTemplatePromptEnabled) => {
    set({ isTemplatePromptEnabled });
  },

  setDocPrompt: (docPrompt) => {
    set({ docPrompt });
  },

  toggleDocPrompt: () => {
    set((state) => ({ isDocPromptEnabled: !state.isDocPromptEnabled }));
  },

  setIsDocPromptEnabled: (isDocPromptEnabled) => {
    set({ isDocPromptEnabled });
  },
}));
