import { create } from 'zustand';
import type { AISettingsState, ChatMessage, RawTurnTelemetry } from '../types';

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
  activeSkillIds: string[];
  templateSkills: string[];
  isRawMode: boolean;
  isSkillsModalOpen: boolean;

  // Local RAG References & Search
  ragReferences: Array<{ id: string; relativePath: string; sectionTitle: string; snippet: string; score?: number }>;
  isRagModalOpen: boolean;
  isAutoRagEnabled: boolean;

  // Session RAW Telemetry & X-Ray Turns (keyed by sessionId)
  sessionTelemetry: Record<string, RawTurnTelemetry[]>;
  activeRawTurnIndex: number;
  addSessionTelemetryTurn: (sessionId: string, turn: RawTurnTelemetry) => void;
  setSessionTelemetry: (sessionId: string, turns: RawTurnTelemetry[]) => void;
  setActiveRawTurnIndex: (idx: number) => void;

  // Connected Providers & Approvals
  activeProviderId: string;
  setActiveProviderId: (id: string) => void;
  pendingApproval: { prompt: string; sessionId: string; providerId?: string } | null;
  setPendingApproval: (approval: { prompt: string; sessionId: string; providerId?: string } | null) => void;

  // Live Progress & Stream Logs
  thinkingStep: string;
  setThinkingStep: (step: string) => void;
  thinkingLogs: string[];
  addThinkingLog: (log: string) => void;
  clearThinkingLogs: () => void;

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
  setActiveSkillIds: (ids: string[]) => void;
  setTemplateSkills: (skills: string[]) => void;
  toggleSkill: (skillId: string) => void;
  addActiveSkill: (skillId: string) => void;
  removeActiveSkill: (skillId: string) => void;
  setIsRawMode: (isRaw: boolean) => void;
  openSkillsModal: () => void;
  closeSkillsModal: () => void;

  // RAG Actions
  addRagReference: (ref: { id: string; relativePath: string; sectionTitle: string; snippet: string; score?: number }) => void;
  removeRagReference: (id: string) => void;
  clearRagReferences: () => void;
  openRagModal: () => void;
  closeRagModal: () => void;
  toggleAutoRag: () => void;

  setTemplateContext: (data: { id: string | null; title: string | null; prompt: string | null; skills?: string[] }) => void;
  toggleTemplatePrompt: () => void;
  setIsTemplatePromptEnabled: (val: boolean) => void;

  historyVersion: number;
  incrementHistoryVersion: () => void;

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

  activeSkillId: null, // No default skill - user chooses
  activeSkillIds: [],
  templateSkills: [],
  isRawMode: false,
  isSkillsModalOpen: false,

  ragReferences: [],
  isRagModalOpen: false,
  isAutoRagEnabled: false,

  sessionTelemetry: {},
  activeRawTurnIndex: -1,

  activeProviderId: 'antigravity',
  setActiveProviderId: (activeProviderId) => set({ activeProviderId }),
  pendingApproval: null,
  setPendingApproval: (pendingApproval) => set({ pendingApproval }),

  thinkingStep: 'Iniciando raciocínio...',
  setThinkingStep: (thinkingStep) => set({ thinkingStep }),
  thinkingLogs: [],
  addThinkingLog: (log) => set((state) => ({ thinkingLogs: [...state.thinkingLogs.slice(-20), log] })),
  clearThinkingLogs: () => set({ thinkingLogs: [] }),

  templatePrompt: null,
  templateTitle: null,
  templateId: null,
  isTemplatePromptEnabled: true,

  docPrompt: null,
  isDocPromptEnabled: true,

  historyVersion: 0,
  incrementHistoryVersion: () => set((state) => ({ historyVersion: state.historyVersion + 1 })),

  setCurrentSessionId: (currentSessionId) => {
    set({ currentSessionId });
  },

  newChatSession: () => {
    const newId = `sess-${Date.now()}`;
    set((state) => ({
      currentSessionId: newId,
      messages: [],
      isThinking: false,
      activeRawTurnIndex: -1,
      historyVersion: state.historyVersion + 1,
      sessionTelemetry: {
        ...state.sessionTelemetry,
        [newId]: [],
      },
    }));
    return newId;
  },

  addSessionTelemetryTurn: (sessionId, turn) => {
    set((state) => {
      const existingTurns = state.sessionTelemetry[sessionId] || [];
      const turnIndex = existingTurns.findIndex((t) => t.turn_id === turn.turn_id);
      let nextTurns: RawTurnTelemetry[];
      if (turnIndex >= 0) {
        nextTurns = [...existingTurns];
        nextTurns[turnIndex] = turn;
      } else {
        nextTurns = [...existingTurns, turn];
      }
      return {
        sessionTelemetry: {
          ...state.sessionTelemetry,
          [sessionId]: nextTurns,
        },
        activeRawTurnIndex: nextTurns.length - 1,
      };
    });
  },

  setSessionTelemetry: (sessionId, turns) => {
    set((state) => ({
      sessionTelemetry: {
        ...state.sessionTelemetry,
        [sessionId]: turns,
      },
      activeRawTurnIndex: turns.length > 0 ? turns.length - 1 : -1,
    }));
  },

  setActiveRawTurnIndex: (activeRawTurnIndex) => {
    set({ activeRawTurnIndex });
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
    set({
      activeSkillId,
      activeSkillIds: activeSkillId ? [activeSkillId] : [],
    });
  },

  setActiveSkillIds: (activeSkillIds) => {
    set({
      activeSkillIds,
      activeSkillId: activeSkillIds[0] || null,
    });
  },

  setTemplateSkills: (templateSkills) => {
    set({ templateSkills });
  },

  toggleSkill: (skillId) => {
    set((state) => {
      const exists = state.activeSkillIds.includes(skillId);
      const next = exists
        ? state.activeSkillIds.filter((id) => id !== skillId)
        : [...state.activeSkillIds, skillId];
      return {
        activeSkillIds: next,
        activeSkillId: next[0] || null,
      };
    });
  },

  addActiveSkill: (skillId) => {
    set((state) => {
      if (state.activeSkillIds.includes(skillId)) return state;
      const next = [...state.activeSkillIds, skillId];
      return {
        activeSkillIds: next,
        activeSkillId: next[0] || null,
      };
    });
  },

  removeActiveSkill: (skillId) => {
    set((state) => {
      const next = state.activeSkillIds.filter((id) => id !== skillId);
      return {
        activeSkillIds: next,
        activeSkillId: next[0] || null,
      };
    });
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

  addRagReference: (ref) => {
    set((state) => {
      if (state.ragReferences.some((r) => r.id === ref.id)) return state;
      return { ragReferences: [...state.ragReferences, ref] };
    });
  },

  removeRagReference: (id) => {
    set((state) => ({
      ragReferences: state.ragReferences.filter((r) => r.id !== id),
    }));
  },

  clearRagReferences: () => {
    set({ ragReferences: [] });
  },

  openRagModal: () => {
    set({ isRagModalOpen: true });
  },

  closeRagModal: () => {
    set({ isRagModalOpen: false });
  },

  toggleAutoRag: () => {
    set((state) => ({ isAutoRagEnabled: !state.isAutoRagEnabled }));
  },

  setTemplateContext: ({ id, title, prompt, skills }) => {
    set({
      templateId: id,
      templateTitle: title,
      templatePrompt: prompt,
      ...(skills ? { templateSkills: skills } : {}),
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
