import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface AuthViewProps {
  onLoginSuccess: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onLoginSuccess }) => {
  const { loginWithToken, loginLocal } = useAuth();
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'error' | 'info' | 'success' } | null>(null);

  const handleTokenLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setStatusMessage({ text: 'Por favor, insira seu Personal Access Token (PAT) do GitHub.', type: 'error' });
      return;
    }

    setIsLoading(true);
    setStatusMessage({ text: 'Conectando ao GitHub e validando permissões...', type: 'info' });

    try {
      const result = await loginWithToken(token.trim());
      if (result.success) {
        setStatusMessage({ text: 'Autenticado com sucesso!', type: 'success' });
        onLoginSuccess();
      } else {
        setStatusMessage({ text: result.error || 'Token inválido ou expirado.', type: 'error' });
      }
    } catch (err) {
      setStatusMessage({ text: 'Erro ao conectar ao servidor local.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocalModeLogin = async () => {
    setIsLoading(true);
    setStatusMessage({ text: 'Iniciando modo offline local...', type: 'info' });
    try {
      await loginLocal();
      onLoginSuccess();
    } catch (err) {
      setStatusMessage({ text: 'Erro ao iniciar modo local.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="view-auth" className="screen-view" style={{ display: 'flex' }}>
      <div className="auth-card">
        <div className="logo-box">
          <span className="material-symbols-outlined icon-xl" style={{ color: 'var(--md-sys-color-primary)' }}>
            account_balance
          </span>
        </div>
        <h1>Governance Platform</h1>
        <p className="subtitle">
          Conecte sua conta do GitHub para gerenciar documentos, domínios e aprovações de propostas de evolução.
        </p>

        <div className="action-box">
          <a
            id="btn-open-github-token"
            href="https://github.com/settings/tokens/new?scopes=repo,read:org&description=Governance+Platform"
            target="_blank"
            rel="noreferrer"
            className="btn btn-github btn-large"
          >
            <svg height="18" width="18" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
            </svg>
            1. Abrir GitHub para Gerar Token (1-Click)
          </a>
          <span className="hint-text">
            <span className="material-symbols-outlined icon-xs">lightbulb</span> O link acima já abre o GitHub com as permissões <code>repo</code> e <code>read:org</code> pré-marcadas!
          </span>

          <div className="divider"><span>2. Cole o Token gerado abaixo</span></div>

          <form onSubmit={handleTokenLogin} className="form-group">
            <input
              type="password"
              id="pat-token-input"
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx ou github_pat_xxxx"
              autoComplete="off"
              value={token}
              onChange={e => setToken(e.target.value)}
            />
            <button
              id="btn-token-login"
              className="btn btn-primary btn-large"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? 'Conectando...' : 'Conectar Conta & Acessar'}
            </button>
            {statusMessage && (
              <div
                id="auth-status-msg"
                style={{
                  display: 'block',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  lineHeight: '1.4',
                  marginTop: '8px',
                  textAlign: 'left',
                  backgroundColor: statusMessage.type === 'error' ? '#fef2f2' : statusMessage.type === 'success' ? '#f0fdf4' : '#eff6ff',
                  color: statusMessage.type === 'error' ? '#991b1b' : statusMessage.type === 'success' ? '#166534' : '#1e40af',
                  border: `1px solid ${statusMessage.type === 'error' ? '#fecaca' : statusMessage.type === 'success' ? '#bbf7d0' : '#bfdbfe'}`
                }}
              >
                {statusMessage.text}
              </div>
            )}
          </form>

          <div className="divider"><span>OU</span></div>

          <button
            type="button"
            className="btn btn-secondary btn-large"
            onClick={handleLocalModeLogin}
            disabled={isLoading}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <span className="material-symbols-outlined icon-xs">desktop_windows</span>
            Modo Local / Offline (Sem Conexão Externa)
          </button>
        </div>
      </div>
    </div>
  );
};
