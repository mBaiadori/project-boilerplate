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
  quickSetModel: (provider: string, model: string) => Promise<boolean>;
  sendMessage: (prompt: string, contextBadges?: string[]) => Promise<void>;
  clearMessages: () => void;
  newChatSession: () => string;
  restoreSession: (sessionId: string) => Promise<boolean>;
  resetMemory: (scope: string) => Promise<void>;

  // Session & Multi-Document References
  currentSessionId: string;
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
  setActiveSkillId: (id: string | null) => void;
  setIsRawMode: (isRaw: boolean) => void;
  openSkillsModal: () => void;
  closeSkillsModal: () => void;

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
  const { activeRepo, activeFile, fileContent, fileMetadata, projectConfig, tree } = useWorkspace();
  
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

  const currentSessionId = useCopilotStore((s) => s.currentSessionId);
  const setCurrentSessionId = useCopilotStore((s) => s.setCurrentSessionId);
  const newChatSession = useCopilotStore((s) => s.newChatSession);
  const referencedDocs = useCopilotStore((s) => s.referencedDocs);
  const isGlobalScope = useCopilotStore((s) => s.isGlobalScope);
  const setReferencedDocs = useCopilotStore((s) => s.setReferencedDocs);
  const addReferencedDoc = useCopilotStore((s) => s.addReferencedDoc);
  const removeReferencedDoc = useCopilotStore((s) => s.removeReferencedDoc);
  const setIsGlobalScope = useCopilotStore((s) => s.setIsGlobalScope);

  const activeSkillId = useCopilotStore((s) => s.activeSkillId);
  const isRawMode = useCopilotStore((s) => s.isRawMode);
  const isSkillsModalOpen = useCopilotStore((s) => s.isSkillsModalOpen);
  const setActiveSkillId = useCopilotStore((s) => s.setActiveSkillId);
  const setIsRawMode = useCopilotStore((s) => s.setIsRawMode);
  const openSkillsModal = useCopilotStore((s) => s.openSkillsModal);
  const closeSkillsModal = useCopilotStore((s) => s.closeSkillsModal);

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
          setDocTemplateTitle(tpl.title || tpl.templateName || tpl.id || null);
        } else {
          setDocTemplatePrompt(null);
          setDocTemplateTitle(null);
        }
      });
    } else {
      setDocTemplatePrompt(null);
      setDocTemplateTitle(null);
    }
  }, [fileMetadata?.templateId, activeRepo?.name, resolveTemplate]);

  // Keep activeFile referenced when not in global scope and no custom references set yet
  useEffect(() => {
    if (activeFile && !isGlobalScope && referencedDocs.length === 0) {
      setReferencedDocs([activeFile]);
    }
  }, [activeFile, isGlobalScope, referencedDocs.length, setReferencedDocs]);

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

  const saveAISettings = async (provider: string, model: string, apiKey?: string, customEndpoint?: string): Promise<boolean> => {
    try {
      const res = await API.saveAISettings({
        provider,
        model,
        api_key: apiKey,
        custom_endpoint: customEndpoint
      });
      if (res.ok) {
        await loadAISettings();
        closeSettingsModal();
        return true;
      }
      return false;
    } catch (err) {
      console.error('[AIContext] Erro ao salvar configurações de IA:', err);
      return false;
    }
  };

  const quickSetModel = async (provider: string, model: string): Promise<boolean> => {
    try {
      const res = await API.saveAISettings({
        provider,
        model,
      });
      if (res.ok) {
        await loadAISettings();
        return true;
      }
      return false;
    } catch (err) {
      console.error('[AIContext] Erro ao trocar modelo rapidamente:', err);
      return false;
    }
  };

  const restoreSession = async (sessionId: string): Promise<boolean> => {
    try {
      const res = await API.getMemorySession({ repo: activeRepo?.name || 'local', session_id: sessionId });
      const sess = res.ok && res.data?.session ? res.data.session : null;
      if (sess && Array.isArray(sess.events)) {
        const restoredMessages: ChatMessage[] = sess.events.map((ev: any, idx: number) => ({
          id: `restored-${sessionId}-${idx}`,
          sender: ev.role === 'model' || ev.role === 'assistant' ? 'assistant' : 'user',
          content: ev.text || '',
          timestamp: ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
        }));

        useCopilotStore.getState().setMessages(restoredMessages);
        setCurrentSessionId(sessionId);
        if (sess.path && sess.path !== 'Global') {
          setReferencedDocs([sess.path]);
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('[AIContext] Erro ao restaurar sessão:', err);
      return false;
    }
  };

  const sendMessage = async (prompt: string, contextBadges?: string[]) => {
    if (!prompt.trim()) return;

    const inTemplateMode = Boolean(isTemplateEditorMode);
    const currentTemplate = activeEditingTemplate || {};

    let effectivePath = 'Global';
    let effectiveContent = '';
    let effectiveBadges = contextBadges || [];

    if (inTemplateMode) {
      effectivePath = currentTemplate.templateName || currentTemplate.title || 'Novo Template';
      effectiveContent = currentTemplate.content || '';
      effectiveBadges = ['🛠️ Modo Template'];
    } else if (isGlobalScope || referencedDocs.length === 0) {
      effectivePath = 'Global (Sem Documento)';
      effectiveContent = '';
      effectiveBadges = ['🌐 Modo Global'];
    } else {
      // 1 ou múltiplas referências (podendo ser arquivos ou pastas inteiras)
      const pathDescriptions: string[] = [];
      const contentsList: string[] = [];
      const computedBadges: string[] = [];
      const processedFiles = new Set<string>();

      // Helper to collect all files inside a folder node from tree
      const collectFilesFromTree = (targetPath: string): string[] => {
        const findNode = (nodes: any[]): any => {
          for (const n of nodes) {
            if (n.path === targetPath) return n;
            if (n.children && n.children.length > 0) {
              const found = findNode(n.children);
              if (found) return found;
            }
          }
          return null;
        };

        const collect = (node: any): string[] => {
          const isDir = node.type === 'dir' || node.type === 'directory' || node.is_directory;
          if (!isDir) return [node.path];
          let collected: string[] = [];
          if (Array.isArray(node.children)) {
            for (const child of node.children) {
              collected = collected.concat(collect(child));
            }
          }
          return collected;
        };

        const node = findNode(tree || []);
        if (!node) return [targetPath];
        return collect(node);
      };

      for (const refPath of referencedDocs) {
        const files = collectFilesFromTree(refPath);
        const isFolder = files.length > 1 || (files.length === 1 && files[0] !== refPath);
        const folderName = refPath.split('/').pop() || refPath;

        if (isFolder) {
          pathDescriptions.push(`📁 ${refPath}/ (${files.length} docs)`);
          computedBadges.push(`📁 ${folderName}/ (${files.length})`);

          const folderContents: string[] = [];
          for (const f of files) {
            if (processedFiles.has(f)) continue;
            processedFiles.add(f);
            if (f === activeFile) {
              folderContents.push(`--- Arquivo: ${f} ---\n${fileContent}`);
            } else {
              try {
                const docData = await API.getProjectFile(f);
                if (docData && docData.content) {
                  folderContents.push(`--- Arquivo: ${f} ---\n${docData.content}`);
                }
              } catch {}
            }
          }
          if (folderContents.length > 0) {
            contentsList.push(`=== [PASTA NO CONTEXTO: ${refPath}/ (${files.length} arquivos)] ===\n${folderContents.join('\n\n')}`);
          }
        } else {
          // Arquivo individual
          const f = files[0] || refPath;
          const fileName = f.split('/').pop() || f;
          pathDescriptions.push(f);
          computedBadges.push(`📄 ${fileName}`);

          if (!processedFiles.has(f)) {
            processedFiles.add(f);
            if (f === activeFile) {
              contentsList.push(`=== DOCUMENTO: ${f} ===\n${fileContent}`);
            } else {
              try {
                const docData = await API.getProjectFile(f);
                if (docData && docData.content) {
                  contentsList.push(`=== DOCUMENTO: ${f} ===\n${docData.content}`);
                }
              } catch {}
            }
          }
        }
      }

      effectivePath = pathDescriptions.join(', ');
      effectiveBadges = computedBadges;
      effectiveContent = contentsList.join('\n\n\n');
    }

    if (dynamicContext?.content) {
      effectiveContent = `${effectiveContent ? effectiveContent + '\n\n' : ''}=== CONTEXTO DINÂMICO SELECIONADO ===\n${dynamicContext.content}`;
      if (dynamicContext.badge) effectiveBadges.push(dynamicContext.badge);
    }

    const userMessage: ChatMessage = {
      id: `msg-user-${Date.now()}`,
      sender: 'user',
      content: prompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      contextBadges: effectiveBadges,
      skill_id: isRawMode ? undefined : (activeSkillId || undefined),
    };

    useCopilotStore.getState().addMessage(userMessage);
    setIsThinking(true);

    try {
      const historyPayload = useCopilotStore.getState().messages.map((m) => ({
        sender: m.sender,
        text: m.content,
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
        session_id: currentSessionId,
        repo: activeRepo?.name || 'local',
        assistant_prompt: assistantPrompt,
        raw_mode: isRawMode,
        skill_id: isRawMode ? undefined : (activeSkillId || undefined),
      });

      if (res.ok && res.data) {
        // Verifica se houve proposta de diff nas tools executadas (ex: docs_propose_diff)
        let proposedDiff = res.data.diff;
        if (!proposedDiff && Array.isArray(res.data.tool_calls)) {
          const diffTool = res.data.tool_calls.find((tc) => tc.tool === 'docs_propose_diff');
          if (diffTool && diffTool.result?.data) {
            proposedDiff = {
              path: diffTool.result.data.file_path,
              old_content: diffTool.result.data.original_content,
              new_content: diffTool.result.data.proposed_content,
              rationale: diffTool.result.data.rationale,
            };
          }
        }

        const assistantMessage: ChatMessage = {
          id: `msg-ai-${Date.now()}`,
          sender: 'assistant',
          content: res.data.reply || 'Operação concluída com sucesso.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          diff: proposedDiff,
          tool_calls: res.data.tool_calls,
          steps_count: res.data.steps_count,
          skill_id: isRawMode ? undefined : (activeSkillId || undefined),
        };
        useCopilotStore.getState().addMessage(assistantMessage);
      } else {
        const errorMessage: ChatMessage = {
          id: `msg-err-${Date.now()}`,
          sender: 'system',
          content: 'Desculpe, ocorreu um erro ao se comunicar com o modelo de IA. Verifique as configurações de provedor.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        useCopilotStore.getState().addMessage(errorMessage);
      }
    } catch (err) {
      console.error('[AIContext] Erro no envio de mensagem para IA:', err);
      const errorMessage: ChatMessage = {
        id: `msg-err-${Date.now()}`,
        sender: 'system',
        content: 'Falha na conexão com o servidor de IA.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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
        quickSetModel,
        sendMessage,
        clearMessages,
        newChatSession,
        restoreSession,
        resetMemory,

        currentSessionId,
        referencedDocs,
        isGlobalScope,
        setReferencedDocs,
        addReferencedDoc,
        removeReferencedDoc,
        setIsGlobalScope,

        activeSkillId,
        isRawMode,
        isSkillsModalOpen,
        setActiveSkillId,
        setIsRawMode,
        openSkillsModal,
        closeSkillsModal,

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
    throw new Error('useAI must be used within an AIProvider');
  }
  return context;
};
