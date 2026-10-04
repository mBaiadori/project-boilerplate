import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { API } from '../services/api';
import { useWorkspace } from './WorkspaceContext';
import { useAuth } from './AuthContext';
import type { DepartmentConfig } from '../types';

export const DEFAULT_DEPARTMENTS: DepartmentConfig[] = [];

export interface VaultFolderItem {
  id: string;
  name: string;
  folder: string;
  color: string;
  icon?: string;
  fileCount: number;
  authorizedMembers: string[];
  hasAccess: boolean;
}

export interface UserVaultAccess {
  login: string;
  fingerprint: string;
  publicKey: string;
  status: 'active' | 'pending' | 'unregistered';
  isOwner: boolean;
  folders: VaultFolderItem[];
}

interface SecurityContextType {
  vaultConfig: any | null;
  departments: DepartmentConfig[];
  myAccess: UserVaultAccess | null;
  activeAIToken: { token: string; expires_at: string } | null;
  isLoadingVault: boolean;
  refreshVault: () => Promise<void>;
  hasFolderAccess: (folderName: string) => boolean;
  canAccessDoc: (doc: { department?: string; path?: string }) => boolean;
  grantFolderAccess: (user: string, folders: string[]) => Promise<{ success: boolean; message?: string; error?: string }>;
  revokeFolderAccess: (user: string, folders: string[]) => Promise<{ success: boolean; message?: string; error?: string }>;
  rotateFolderKey: (folder: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  generateAIToken: (ttlMinutes?: number) => Promise<{ success: boolean; token?: string; error?: string }>;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeRepo, projectConfig, projectMetaOptions, tree } = useWorkspace();
  const currentRepoName = activeRepo?.name;
  const { user } = useAuth();

  const [vaultConfig, setVaultConfig] = useState<any | null>(null);
  const [myAccess, setMyAccess] = useState<UserVaultAccess | null>(null);
  const [activeAIToken, setActiveAIToken] = useState<{ token: string; expires_at: string } | null>(null);
  const [isLoadingVault, setIsLoadingVault] = useState(false);

  const departments = useMemo<DepartmentConfig[]>(() => {
    if (projectConfig?.departments && Array.isArray(projectConfig.departments) && projectConfig.departments.length > 0) {
      return projectConfig.departments;
    }
    if (projectMetaOptions?.departments && Array.isArray(projectMetaOptions.departments) && projectMetaOptions.departments.length > 0) {
      return projectMetaOptions.departments;
    }

    // Extrai pastas dinâmicas da árvore de arquivos do workspace
    const dynamicFolders: DepartmentConfig[] = [];
    const colors = ['#6366f1', '#10b981', '#a855f7', '#ec4899', '#f59e0b', '#06b6d4', '#3b82f6'];
    let colorIdx = 0;

    const walk = (nodes: any[]) => {
      for (const node of nodes || []) {
        if (node.type === 'directory' || (node.children && node.children.length > 0)) {
          const clean = (node.path || '').replace(/\\/g, '/').replace(/^\/+/, '');
          if (!clean) continue;
          if (!dynamicFolders.some((d) => d.folder === clean || d.id === clean.toLowerCase())) {
            dynamicFolders.push({
              id: clean.toLowerCase(),
              name: node.name || clean.split('/').pop() || clean,
              folder: clean,
              color: colors[colorIdx % colors.length],
              icon: 'folder',
            });
            colorIdx++;
          }
        }
      }
    };
    walk(tree || []);

    return dynamicFolders;
  }, [projectConfig?.departments, projectMetaOptions?.departments, tree]);

  const refreshVault = useCallback(async () => {
    setIsLoadingVault(true);
    try {
      const [vaultRes, accessRes] = await Promise.all([
        API.getSecurityVault(currentRepoName),
        API.getMyVaultAccess(currentRepoName, user?.login),
      ]);
      if (vaultRes.ok && vaultRes.data) {
        setVaultConfig(vaultRes.data);
      }
      if (accessRes.ok && accessRes.data) {
        setMyAccess(accessRes.data);
      }
    } catch (err) {
      console.warn('[SecurityContext] Falha ao sincronizar estado do cofre:', err);
    } finally {
      setIsLoadingVault(false);
    }
  }, [currentRepoName, user?.login]);

  useEffect(() => {
    refreshVault();
  }, [refreshVault]);

  /**
   * Verifica se o usuário atual tem acesso à pasta segura/departamento
   */
  const hasFolderAccess = useCallback(
    (folderName: string): boolean => {
      if (!folderName || folderName === 'public' || folderName === 'docs/public') return true;
      if (myAccess?.isOwner) return true;
      const cleanFolder = folderName.replace(/\\/g, '/').replace(/^\/+/, '').split('/')[0].toLowerCase();
      const folderItem = myAccess?.folders?.find(
        (f) => f.folder.toLowerCase() === cleanFolder || f.id.toLowerCase() === cleanFolder
      );
      if (folderItem) {
        return folderItem.hasAccess;
      }
      return true; // Se a pasta não for uma das pastas seguras configuradas, é livre
    },
    [myAccess]
  );

  /**
   * Avalia autorização de acesso ao documento com base em cofre/departamento e rotas
   */
  const canAccessDoc = useCallback(
    (doc: { department?: string; path?: string }): boolean => {
      if (myAccess?.isOwner) return true;

      // 1. Verifica acesso à pasta / departamento
      if (doc.path) {
        const folderPart = doc.path.replace(/\\/g, '/').replace(/^\/+/, '').split('/')[0];
        if (!hasFolderAccess(folderPart)) {
          return false;
        }
      } else if (doc.department) {
        if (!hasFolderAccess(doc.department)) {
          return false;
        }
      }

      // 2. Verifica rota permitida para o colaborador se houver restrição
      const userLogin = user?.login?.toLowerCase();
      const collabs = projectConfig?.governance_collaborators || {};
      const userMeta = Object.entries(collabs).find(([k]) => k.toLowerCase() === userLogin)?.[1] as any;

      if (doc.path && userMeta?.allowed_paths) {
        const allowedPaths: string[] = Array.isArray(userMeta.allowed_paths) ? userMeta.allowed_paths : ['*'];
        if (!allowedPaths.includes('*') && !allowedPaths.includes('/**')) {
          const cleanDocPath = doc.path.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
          const hasPathAccess = allowedPaths.some((pattern) => {
            if (pattern === '*' || pattern === '/**') return true;
            const cleanPattern = pattern
              .replace(/\\/g, '/')
              .replace(/^\/+/, '')
              .replace(/\/\*+$/, '')
              .toLowerCase();
            return cleanDocPath === cleanPattern || cleanDocPath.startsWith(cleanPattern + '/');
          });
          if (!hasPathAccess) {
            return false;
          }
        }
      }

      return true;
    },
    [myAccess, hasFolderAccess, user?.login, projectConfig?.governance_collaborators]
  );

  const grantFolderAccess = async (targetUser: string, folders: string[]) => {
    const res = await API.grantVaultAccess(targetUser, folders, currentRepoName);
    if (res.ok && res.data.success) {
      await refreshVault();
      return { success: true, message: res.data.message };
    }
    return { success: false, error: res.data?.error || 'Falha ao conceder acesso aos cofres.' };
  };

  const revokeFolderAccess = async (targetUser: string, folders: string[]) => {
    const res = await API.revokeVaultAccess(targetUser, folders, currentRepoName);
    if (res.ok && res.data.success) {
      await refreshVault();
      return { success: true, message: res.data.message };
    }
    return { success: false, error: res.data?.error || 'Falha ao revogar acesso aos cofres.' };
  };

  const rotateFolderKey = async (folder: string) => {
    const res = await API.rotateVaultKey(folder, currentRepoName);
    if (res.ok && res.data.success) {
      await refreshVault();
      return { success: true, message: res.data.message };
    }
    return { success: false, error: res.data?.error || 'Falha ao rotacionar chave do cofre.' };
  };

  const generateAIToken = async (ttlMinutes: number = 60) => {
    const res = await API.createSecureAIToken({ ttlMinutes, repo: currentRepoName });
    if (res.ok && res.data?.token) {
      const tokenObj = { token: res.data.token, expires_at: res.data.expiresAt || '' };
      setActiveAIToken(tokenObj);
      return { success: true, token: res.data.token };
    }
    return { success: false, error: res.data?.error || 'Falha ao gerar token de IA' };
  };

  return (
    <SecurityContext.Provider
      value={{
        vaultConfig,
        departments,
        myAccess,
        activeAIToken,
        isLoadingVault,
        refreshVault,
        hasFolderAccess,
        canAccessDoc,
        grantFolderAccess,
        revokeFolderAccess,
        rotateFolderKey,
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
