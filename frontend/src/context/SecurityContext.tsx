import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { API } from '../services/api';
import { useWorkspace } from './WorkspaceContext';
import { useAuth } from './AuthContext';
import type { DynamicSecurityLevel } from '../types';

export const DEFAULT_SECURITY_LEVELS: DynamicSecurityLevel[] = [
  {
    id: 'root',
    rank: 0,
    name: 'Root / Executivo',
    color: '#ef4444',
    description: 'Acesso Irrestrito Supremo (Abre todos os níveis e documentos)',
  },
  {
    id: 'strategic',
    rank: 1,
    name: 'Estratégico / Liderança',
    color: '#f97316',
    description: 'Acesso Amplo de Liderança, Arquitetura e Decisões Estratégicas',
  },
  {
    id: 'engineering',
    rank: 2,
    name: 'Engenharia / Time Técnico',
    color: '#eab308',
    description: 'Acesso Técnico de Engenharia e Especificações de Features',
  },
  {
    id: 'operational',
    rank: 3,
    name: 'Operacional / Restrito Básico',
    color: '#3b82f6',
    description: 'Acesso Básico Operacional para Colaboradores e Prestadores',
  },
  {
    id: 'public',
    rank: 999,
    name: 'Público / Geral',
    color: '#10b981',
    description: 'Texto plano sem criptografia, acessível para todos os membros',
  },
];

interface SecurityContextType {
  vaultConfig: any | null;
  securityLevels: DynamicSecurityLevel[];
  unlockedLevels: number[];
  unlockedLevelIds: string[];
  passphrases: Record<string, string>;
  activeAIToken: { token: string; expiresAt: string; authorizedLevel: number } | null;
  isLoadingVault: boolean;
  refreshVault: () => Promise<void>;
  unlockLevel: (levelIdOrRank: string | number, passphrase: string) => Promise<{ success: boolean; error?: string }>;
  setUserPassphrase: (levelId: string, passphrase: string) => Promise<{ success: boolean; error?: string }>;
  lockLevel: (levelIdOrRank: string | number) => void;
  lockAll: () => void;
  isLevelUnlocked: (levelIdOrRank: string | number) => boolean;
  encryptContent: (content: string, level: number | string, metadata?: any) => Promise<{ success: boolean; envelope?: string; error?: string }>;
  decryptContent: (envelope: string) => Promise<{ success: boolean; content?: string; level: number; error?: string }>;
  generateAIToken: (level?: number, ttlMinutes?: number) => Promise<{ success: boolean; token?: string; error?: string }>;
}

const STORAGE_KEY_PASSPHRASES = 'context_os_security_passphrases';
const STORAGE_KEY_AI_TOKEN = 'context_os_ai_secure_token';

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeRepo, projectConfig, projectMetaOptions } = useWorkspace();
  const currentRepoName = activeRepo?.name;
  const { user } = useAuth();

  const [vaultConfig, setVaultConfig] = useState<any | null>(null);
  const [unlockedLevels, setUnlockedLevels] = useState<number[]>([999]);
  const [unlockedLevelIds, setUnlockedLevelIds] = useState<string[]>(['public']);
  const [passphrases, setPassphrases] = useState<Record<string, string>>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY_PASSPHRASES);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [activeAIToken, setActiveAIToken] = useState<SecurityContextType['activeAIToken']>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY_AI_TOKEN);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isLoadingVault, setIsLoadingVault] = useState(false);

  // Dynamic security levels from project config / metadata options with fallback
  const securityLevels = useMemo<DynamicSecurityLevel[]>(() => {
    let rawList: any[] = [];
    if (projectConfig?.security_levels && Array.isArray(projectConfig.security_levels) && projectConfig.security_levels.length > 0) {
      rawList = [...projectConfig.security_levels];
    } else if (projectMetaOptions?.security_levels && Array.isArray(projectMetaOptions.security_levels) && projectMetaOptions.security_levels.length > 0) {
      rawList = [...projectMetaOptions.security_levels];
    } else if (vaultConfig?.levels && Array.isArray(vaultConfig.levels) && vaultConfig.levels.length > 0) {
      rawList = [...vaultConfig.levels];
    } else {
      rawList = [...DEFAULT_SECURITY_LEVELS];
    }

    const seenIds = new Set<string>();
    const list: DynamicSecurityLevel[] = rawList.map((lvl: any, idx: number) => {
      const rank = typeof lvl.rank === 'number' ? lvl.rank : (typeof lvl.level === 'number' ? lvl.level : idx);
      const id = String(lvl.id || (rank === 0 ? 'root' : rank === 1 ? 'strategic' : rank === 2 ? 'engineering' : rank === 3 ? 'operational' : rank === 999 ? 'public' : `level_${rank}`));
      const name = lvl.name || lvl.label || (rank === 999 ? 'Público / Geral' : `Level ${rank}`);
      const color = lvl.color || (rank === 0 ? '#ef4444' : rank === 1 ? '#f97316' : rank === 2 ? '#eab308' : rank === 3 ? '#3b82f6' : '#10b981');
      const description = lvl.description || (rank === 999 ? 'Texto plano sem criptografia, acessível para todos os membros' : '');
      return {
        id,
        rank,
        name,
        color,
        description,
        created_at: lvl.created_at,
        updated_at: lvl.updated_at,
      };
    }).filter((l) => {
      if (seenIds.has(l.id)) return false;
      seenIds.add(l.id);
      return true;
    });

    if (!list.some((l) => l.rank === 999 || l.id === 'public')) {
      list.push({
        id: 'public',
        rank: 999,
        name: 'Público / Geral',
        color: '#10b981',
        description: 'Texto plano sem criptografia, acessível para todos os membros',
      });
    }

    return list.sort((a, b) => a.rank - b.rank);
  }, [projectConfig?.security_levels, projectMetaOptions?.security_levels, vaultConfig?.levels]);

  const refreshVault = useCallback(async () => {
    setIsLoadingVault(true);
    try {
      const res = await API.getSecurityVault(currentRepoName);
      if (res.ok && res.data) {
        setVaultConfig(res.data);
      }
    } catch (err) {
      console.warn('[SecurityContext] Falha ao carregar cofre de segurança:', err);
    } finally {
      setIsLoadingVault(false);
    }
  }, [currentRepoName]);

  useEffect(() => {
    refreshVault();
  }, [refreshVault]);

  // Recalculate unlocked levels based on stored passphrases, ranks, and hierarchy
  useEffect(() => {
    const unlockedRanks = new Set<number>([999]);
    const unlockedIds = new Set<string>(['public']);

    // Check every key in passphrases
    Object.entries(passphrases).forEach(([key, pass]) => {
      if (!pass) return;

      // Find matching level by id or rank
      const foundLevel = securityLevels.find(
        (lvl) => lvl.id === key || String(lvl.rank) === key
      );

      if (foundLevel) {
        // User unlocked this rank -> unlock this and all higher rank numbers (lower privilege)
        const userRank = foundLevel.rank;
        securityLevels.forEach((l) => {
          if (l.rank >= userRank) {
            unlockedRanks.add(l.rank);
            unlockedIds.add(l.id);
          }
        });
      } else {
        // Fallback for numeric keys 0, 1, 2, 3
        const numKey = Number(key);
        if (!isNaN(numKey)) {
          unlockedRanks.add(numKey);
          securityLevels.forEach((l) => {
            if (l.rank >= numKey) {
              unlockedRanks.add(l.rank);
              unlockedIds.add(l.id);
            }
          });
        }
      }
    });

    setUnlockedLevels(Array.from(unlockedRanks).sort((a, b) => a - b));
    setUnlockedLevelIds(Array.from(unlockedIds));

    try {
      sessionStorage.setItem(STORAGE_KEY_PASSPHRASES, JSON.stringify(passphrases));
    } catch {}
  }, [passphrases, securityLevels]);

  const unlockLevel = async (
    levelIdOrRank: string | number,
    passphrase: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanPass = passphrase.trim();
    if (!cleanPass) {
      return { success: false, error: 'A chave/senha não pode ser vazia.' };
    }

    const currentLevel = securityLevels.find(
      (l) => l.id === levelIdOrRank || l.rank === Number(levelIdOrRank)
    );
    const targetLevelId = currentLevel?.id || String(levelIdOrRank);

    // Cryptographic Canary Probe Verification via Backend
    try {
      const res = await API.unlockUserPassphrase({
        user: user?.login || 'local_user',
        passphrase: cleanPass,
        levelId: targetLevelId,
        repo: currentRepoName,
      });

      if (!res.ok || !res.data.success) {
        return {
          success: false,
          error: res.data?.error || 'Passphrase incorreta. Verificação criptográfica falhou.',
        };
      }

      // If valid, store passphrase
      const updated: Record<string, string> = {
        ...passphrases,
        [targetLevelId]: cleanPass,
      };
      if (currentLevel) {
        updated[String(currentLevel.rank)] = cleanPass;
      }
      setPassphrases(updated);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao validar passphrase criptográfica.' };
    }
  };

  const setUserPassphrase = async (
    levelId: string,
    passphrase: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanPass = passphrase.trim();
    if (!cleanPass) {
      return { success: false, error: 'A senha não pode ser vazia.' };
    }

    try {
      const res = await API.setUserPassphrase({
        user: user?.login || 'local_user',
        passphrase: cleanPass,
        levelId,
        repo: currentRepoName,
      });

      if (res.ok && res.data.success) {
        await refreshVault();
        // Automatically unlock in session as well
        await unlockLevel(levelId, cleanPass);
        return { success: true };
      }
      return { success: false, error: res.data.error || 'Falha ao definir chave de usuário.' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const lockLevel = (levelIdOrRank: string | number) => {
    const updated = { ...passphrases };
    delete updated[String(levelIdOrRank)];

    const currentLevel = securityLevels.find(
      (l) => l.id === levelIdOrRank || l.rank === Number(levelIdOrRank)
    );
    if (currentLevel) {
      delete updated[currentLevel.id];
      delete updated[String(currentLevel.rank)];
    }

    setPassphrases(updated);
  };

  const lockAll = () => {
    setPassphrases({});
    setActiveAIToken(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY_PASSPHRASES);
      sessionStorage.removeItem(STORAGE_KEY_AI_TOKEN);
    } catch {}
  };

  const isLevelUnlocked = useCallback(
    (levelIdOrRank: string | number): boolean => {
      if (levelIdOrRank === 999 || levelIdOrRank === 'public' || levelIdOrRank === '999') {
        return true;
      }
      if (typeof levelIdOrRank === 'number') {
        return unlockedLevels.includes(levelIdOrRank);
      }
      if (typeof levelIdOrRank === 'string') {
        if (unlockedLevelIds.includes(levelIdOrRank)) return true;
        const num = Number(levelIdOrRank);
        if (!isNaN(num)) return unlockedLevels.includes(num);
      }
      return false;
    },
    [unlockedLevels, unlockedLevelIds]
  );

  const encryptContent = async (
    content: string,
    level: number | string,
    metadata?: any
  ): Promise<{ success: boolean; envelope?: string; error?: string }> => {
    try {
      const currentLevel = securityLevels.find((l) => l.id === level || l.rank === Number(level));
      const targetRank = currentLevel ? currentLevel.rank : typeof level === 'number' ? level : 2;
      const pass =
        passphrases[String(level)] ||
        (currentLevel ? passphrases[currentLevel.id] : '') ||
        passphrases['0'] ||
        passphrases['root'] ||
        `key-level-${targetRank}`;

      const res = await API.encryptDoc({
        content,
        level: targetRank,
        passphrase: pass,
        metadata: {
          ...metadata,
          security_level_id: currentLevel?.id,
          security_level: targetRank,
        },
        repo: currentRepoName,
      });

      if (res.ok && res.data.success && res.data.envelope) {
        return { success: true, envelope: res.data.envelope };
      }
      return { success: false, error: res.data.error || 'Falha ao criptografar documento.' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const decryptContent = async (
    envelope: string
  ): Promise<{ success: boolean; content?: string; level: number; error?: string }> => {
    try {
      const res = await API.decryptDoc({
        envelope,
        passphrases: passphrases as any,
        repo: currentRepoName,
      });

      if (res.ok && res.data.success) {
        return { success: true, content: res.data.content, level: res.data.level };
      }
      return {
        success: false,
        level: res.data?.level ?? 3,
        error: res.data?.error || 'Acesso bloqueado: Chave de segurança não encontrada na sessão.',
      };
    } catch (err: any) {
      return {
        success: false,
        level: 3,
        error: err.message,
      };
    }
  };

  const generateAIToken = async (
    level?: number,
    ttlMinutes: number = 60
  ): Promise<{ success: boolean; token?: string; error?: string }> => {
    try {
      const targetLevel = level !== undefined ? level : (unlockedLevels.length > 0 ? unlockedLevels[0] : 2);
      const res = await API.createSecureAIToken({
        user: user?.login ? `@${user.login}` : 'Dev Local',
        level: targetLevel,
        passphrases: passphrases as any,
        repo: currentRepoName,
        ttlMinutes,
      });

      if (res.ok && res.data.token) {
        setActiveAIToken(res.data);
        try {
          sessionStorage.setItem(STORAGE_KEY_AI_TOKEN, JSON.stringify(res.data));
        } catch {}
        return { success: true, token: res.data.token };
      }
      return { success: false, error: 'Falha ao gerar token efêmero de IA.' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  return (
    <SecurityContext.Provider
      value={{
        vaultConfig,
        securityLevels,
        unlockedLevels,
        unlockedLevelIds,
        passphrases,
        activeAIToken,
        isLoadingVault,
        refreshVault,
        unlockLevel,
        setUserPassphrase,
        lockLevel,
        lockAll,
        isLevelUnlocked,
        encryptContent,
        decryptContent,
        generateAIToken,
      }}
    >
      {children}
    </SecurityContext.Provider>
  );
};

export const useSecurity = (): SecurityContextType => {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurity deve ser usado dentro de um SecurityProvider');
  }
  return context;
};

