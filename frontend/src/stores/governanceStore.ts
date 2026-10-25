import { create } from "zustand";
import { API } from "../services/api";
import type { DictionaryTerm, ProjectMetadataOptions } from "../types";
import { useRepoStore } from "./repoStore";

interface GovernanceState {
  projectMetaOptions: ProjectMetadataOptions | null;
  projectConfig: Record<string, unknown> | null;
  guardrailStatus: string;
  dictionaryTerms: DictionaryTerm[];

  setProjectMetaOptions: (opts: ProjectMetadataOptions | null) => void;
  setProjectConfig: (cfg: Record<string, unknown> | null) => void;
  setGuardrailStatus: (status: string) => void;
  setDictionaryTerms: (terms: DictionaryTerm[]) => void;

  loadProjectMetadataOptions: () => Promise<void>;
  loadProjectConfig: (targetRepoName?: string) => Promise<Record<string, unknown> | null>;
  saveProjectConfig: (configData: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;
  loadDictionaryTerms: () => Promise<DictionaryTerm[]>;
  saveDictionaryTerms: (terms: DictionaryTerm[]) => Promise<{ success: boolean; error?: string }>;
  addDictionaryTerm: (term: DictionaryTerm) => Promise<{ success: boolean; error?: string }>;
  addDictionarySynonym: (termIdOrCodename: string, synonym: string) => Promise<{ success: boolean; error?: string }>;
}

export const useGovernanceStore = create<GovernanceState>((set, get) => ({
  projectMetaOptions: null,
  projectConfig: null,
  guardrailStatus: "CLEAN",
  dictionaryTerms: [],

  setProjectMetaOptions: (projectMetaOptions) => set({ projectMetaOptions }),
  setProjectConfig: (projectConfig) => set({ projectConfig }),
  setGuardrailStatus: (guardrailStatus) => set({ guardrailStatus }),
  setDictionaryTerms: (dictionaryTerms) => set({ dictionaryTerms }),

  loadProjectMetadataOptions: async () => {
    const activeRepo = useRepoStore.getState().activeRepo;
    if (!activeRepo) return;
    try {
      const res = await API.getProjectMetadataOptions(activeRepo.name);
      if (res.ok && res.data) {
        set({ projectMetaOptions: res.data });
      }
    } catch (err) {
      console.warn("[governanceStore] Erro ao carregar opções de metadados:", err);
    }
  },

  loadProjectConfig: async (targetRepoName?: string) => {
    const activeRepo = useRepoStore.getState().activeRepo;
    const repoName = targetRepoName || activeRepo?.name;
    if (!repoName) return null;
    try {
      const res = await API.getProjectConfig(repoName);
      if (res.ok && res.data) {
        const cfg = res.data as Record<string, unknown>;
        set({
          projectConfig: cfg,
          projectMetaOptions: {
            statuses: Array.isArray(cfg.statuses) ? cfg.statuses : [],
            categories: Array.isArray(cfg.categories) ? cfg.categories : [],
            tags: Array.isArray(cfg.tags) ? cfg.tags : [],
            badges: Array.isArray(cfg.badges) ? cfg.badges : [],
            departments: Array.isArray(cfg.departments) && cfg.departments.length > 0 ? cfg.departments : [],
          },
        });
        return cfg;
      }
    } catch (err) {
      console.warn("[governanceStore] Erro ao carregar project.config:", err);
    }
    return null;
  },

  saveProjectConfig: async (configData: Record<string, unknown>) => {
    const activeRepo = useRepoStore.getState().activeRepo;
    if (!activeRepo) return { success: false, error: "Nenhum repositório ativo" };
    try {
      const res = await API.saveProjectConfig(configData, activeRepo.name);
      if (res.ok) {
        set({ projectConfig: configData });
        await get().loadProjectMetadataOptions();
        return { success: true };
      }
      return { success: false, error: "Falha ao salvar configurações do projeto" };
    } catch (err: unknown) {
      console.error("[governanceStore] Erro ao salvar project.config:", err);
      const msg = err instanceof Error ? err.message : "Erro ao salvar configurações";
      return { success: false, error: msg };
    }
  },

  loadDictionaryTerms: async (): Promise<DictionaryTerm[]> => {
    try {
      const res = await API.getDictionary();
      if (res.ok && res.data && Array.isArray(res.data.terms)) {
        set({ dictionaryTerms: res.data.terms });
        return res.data.terms;
      }
    } catch (err) {
      console.warn("[governanceStore] Erro ao carregar dicionário:", err);
    }
    return [];
  },

  saveDictionaryTerms: async (termsToSave: DictionaryTerm[]) => {
    try {
      const res = await API.saveDictionary(termsToSave);
      if (res.ok) {
        set({ dictionaryTerms: termsToSave });
        return { success: true };
      }
      return { success: false, error: res.data?.error || "Erro ao salvar dicionário" };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro de rede ao salvar dicionário";
      return { success: false, error: msg };
    }
  },

  addDictionaryTerm: async (newTerm: DictionaryTerm) => {
    const current = get().dictionaryTerms;
    const normalizedCodename = (newTerm.codename || newTerm.code_name || newTerm.term)
      .toUpperCase()
      .replace(/[\s-]+/g, "_")
      .replace(/[^A-Z0-9_]/g, "");

    const normalizedTerm: DictionaryTerm = {
      ...newTerm,
      id: newTerm.id || normalizedCodename.toLowerCase().replace(/_/g, "-"),
      codename: normalizedCodename,
      definition: (newTerm.definition || "").trim() || "Sem definição registrada.",
      synonyms: Array.from(
        new Set([...(newTerm.synonyms || []), ...(newTerm.aliases || [])].filter(Boolean)),
      ),
    };

    const updated = [
      ...current.filter(
        (t) =>
          t.codename !== normalizedTerm.codename &&
          t.term.toLowerCase() !== normalizedTerm.term.toLowerCase(),
      ),
      normalizedTerm,
    ];
    return await get().saveDictionaryTerms(updated);
  },

  addDictionarySynonym: async (termIdOrCodename: string, synonym: string) => {
    const cleanSyn = synonym.trim();
    if (!cleanSyn) return { success: false, error: "Sinônimo vazio" };
    const current = get().dictionaryTerms;
    const termIdx = current.findIndex(
      (t) =>
        (t.id && t.id === termIdOrCodename) ||
        t.codename.toLowerCase() === termIdOrCodename.toLowerCase() ||
        t.term.toLowerCase() === termIdOrCodename.toLowerCase(),
    );
    if (termIdx === -1) {
      return { success: false, error: "Termo não encontrado no dicionário" };
    }
    const targetTerm = current[termIdx];
    const existingSyns = Array.from(
      new Set([...(targetTerm.synonyms || []), ...(targetTerm.aliases || [])]),
    );
    if (!existingSyns.some((s) => s.toLowerCase() === cleanSyn.toLowerCase())) {
      existingSyns.push(cleanSyn);
    }
    const updatedTerm: DictionaryTerm = {
      ...targetTerm,
      synonyms: existingSyns,
    };
    const updated = [...current];
    updated[termIdx] = updatedTerm;
    return await get().saveDictionaryTerms(updated);
  },
}));
