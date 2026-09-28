import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, FormField, Input, Button, AlertBanner } from '../components/ui';
import { ShieldCheck, Monitor, Lightbulb, ExternalLink } from 'lucide-react';

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
    } catch {
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
    } catch {
      setStatusMessage({ text: 'Erro ao iniciar modo local.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      id="view-auth"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        width: '100%',
        padding: '24px',
        boxSizing: 'border-box',
        background: 'var(--color-surface)',
      }}
    >
      <div style={{ width: '100%', maxWidth: '480px' }}>
        <Card>
          <CardContent style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'center' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: 'var(--radius-lg, 16px)',
                background: 'var(--color-primary-container)',
                color: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
              }}
            >
              <ShieldCheck size={32} />
            </div>

            <div>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: 'var(--color-on-surface)', letterSpacing: '-0.02em' }}>
                Governance Platform
              </h1>
              <p style={{ margin: '8px 0 0 0', fontSize: '13.5px', color: 'var(--color-on-surface-variant)', lineHeight: 1.5 }}>
                Conecte sua conta do GitHub para gerenciar documentos, domínios e aprovações de propostas de evolução.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
              <a
                id="btn-open-github-token"
                href="https://github.com/settings/tokens/new?scopes=repo,read:org&description=Governance+Platform"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  borderRadius: 'var(--radius-md, 8px)',
                  background: 'var(--color-surface-container-high)',
                  color: 'var(--color-on-surface)',
                  fontWeight: 600,
                  fontSize: '13.5px',
                  textDecoration: 'none',
                  border: '1px solid var(--color-outline-variant)',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>1. Abrir GitHub para Gerar Token (1-Click)</span>
                <ExternalLink size={15} />
              </a>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  fontSize: '12px',
                  color: 'var(--color-outline)',
                  background: 'var(--color-surface-container-low)',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md, 6px)',
                  border: '1px solid var(--color-outline-variant)',
                }}
              >
                <Lightbulb size={16} style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: '2px' }} />
                <span>
                  O link acima já abre o GitHub com as permissões <code style={{ fontFamily: 'var(--font-mono, monospace)', background: 'var(--color-surface-container-highest)', padding: '1px 4px', borderRadius: '3px' }}>repo</code> e <code style={{ fontFamily: 'var(--font-mono, monospace)', background: 'var(--color-surface-container-highest)', padding: '1px 4px', borderRadius: '3px' }}>read:org</code> pré-marcadas!
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '4px 0' }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--color-outline-variant)' }} />
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  2. Cole o Token abaixo
                </span>
                <div style={{ flex: 1, height: '1px', background: 'var(--color-outline-variant)' }} />
              </div>

              <form onSubmit={handleTokenLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <FormField label="GitHub Personal Access Token (PAT)">
                  <Input
                    type="password"
                    id="pat-token-input"
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx ou github_pat_xxxx"
                    autoComplete="off"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                  />
                </FormField>

                <Button
                  id="btn-token-login"
                  variant="primary"
                  size="md"
                  fullWidth
                  type="submit"
                  loading={isLoading}
                >
                  Conectar Conta & Acessar
                </Button>

                {statusMessage && (
                  <AlertBanner
                    variant={statusMessage.type}
                    title={statusMessage.text}
                    onClose={() => setStatusMessage(null)}
                  />
                )}
              </form>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '4px 0' }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--color-outline-variant)' }} />
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-outline)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  OU
                </span>
                <div style={{ flex: 1, height: '1px', background: 'var(--color-outline-variant)' }} />
              </div>

              <Button
                variant="secondary"
                size="md"
                fullWidth
                type="button"
                onClick={handleLocalModeLogin}
                disabled={isLoading}
                icon={<Monitor size={16} />}
              >
                Modo Local / Offline (Sem Conexão Externa)
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
