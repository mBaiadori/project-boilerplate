import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types';
import { API } from '../services/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithToken: (token: string) => Promise<{ success: boolean; error?: string }>;
  loginLocal: () => Promise<{ success: boolean }>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshAuth = async () => {
    try {
      const status = await API.getStatus();
      if (status.authenticated && status.user) {
        setUser(status.user);
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

  const loginWithToken = async (token: string) => {
    try {
      const res = await API.loginWithToken(token);
      if (res.ok && res.data.user) {
        setUser(res.data.user);
        return { success: true };
      }
      return { success: false, error: res.data.error || 'Falha ao autenticar com token GitHub' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro de conexão com o servidor' };
    }
  };

  const loginLocal = async () => {
    try {
      const res = await API.loginWithToken('local_mode');
      if (res.ok && res.data.user) {
        setUser(res.data.user);
        return { success: true };
      }
      // Se não, cria usuário local padrão
      setUser({ login: 'local_dev', name: 'Desenvolvedor Local', role: 'Administrador Local', is_local: true });
      return { success: true };
    } catch (err) {
      setUser({ login: 'local_dev', name: 'Desenvolvedor Local', role: 'Administrador Local', is_local: true });
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
