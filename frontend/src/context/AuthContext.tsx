import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types';
import { API } from '../services/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  provider: 'github' | 'forgejo' | 'local';
  providerUrl?: string;
  loginWithToken: (token: string, provider?: 'github' | 'forgejo', providerUrl?: string) => Promise<{ success: boolean; error?: string }>;
  loginLocal: () => Promise<{ success: boolean }>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [provider, setProvider] = useState<'github' | 'forgejo' | 'local'>('forgejo');
  const [providerUrl, setProviderUrl] = useState<string | undefined>('http://localhost:3000/api/v1');
  const [isLoading, setIsLoading] = useState(true);

  const refreshAuth = async () => {
    try {
      const status = await API.getStatus();
      if (status.authenticated && status.user) {
        setUser(status.user);
        if (status.git_provider) {
          setProvider(status.git_provider as any);
        }
        if (status.git_provider_url) {
          setProviderUrl(status.git_provider_url);
        }
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('[AuthContext] Erro ao obter status:', err);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshAuth();
  }, []);

  const loginWithToken = async (token: string, selectedProvider: 'github' | 'forgejo' = 'forgejo', selectedProviderUrl?: string) => {
    try {
      const res = await API.loginWithToken(token, selectedProvider, selectedProviderUrl);
      if (res.ok && res.data.user) {
        setUser(res.data.user);
        setProvider(selectedProvider);
        if (selectedProviderUrl) setProviderUrl(selectedProviderUrl);
        return { success: true };
      }
      return { success: false, error: res.data.error || `Falha ao autenticar com token ${selectedProvider === 'forgejo' ? 'Forgejo' : 'GitHub'}` };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro de conexão com o servidor' };
    }
  };

  const loginLocal = async () => {
    try {
      const res = await API.loginWithToken('local_mode');
      if (res.ok && res.data.user) {
        setUser(res.data.user);
        setProvider('local');
        return { success: true };
      }
      setUser({ login: 'local_dev', name: 'Desenvolvedor Local', role: 'Administrador Local', is_local: true });
      setProvider('local');
      return { success: true };
    } catch (err) {
      setUser({ login: 'local_dev', name: 'Desenvolvedor Local', role: 'Administrador Local', is_local: true });
      setProvider('local');
      return { success: true };
    }
  };

  const logout = async () => {
    try {
      await API.logout();
    } catch (err) {
      console.error('[AuthContext] Erro ao deslogar:', err);
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        provider,
        providerUrl,
        loginWithToken,
        loginLocal,
        logout,
        refreshAuth
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
};
