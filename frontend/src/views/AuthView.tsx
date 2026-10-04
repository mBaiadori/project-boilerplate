import React, { useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, FormField, Input, Button, AlertBanner } from '../components/ui';
import { LanguageSwitcher } from '../components/common/LanguageSwitcher';
import { 
  ShieldCheck, 
  Monitor, 
  ExternalLink, 
  Globe, 
  Server, 
  Sparkles
} from 'lucide-react';

interface AuthViewProps {
  onLoginSuccess: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onLoginSuccess }) => {
  const { t } = useTranslation(['auth', 'common']);
  const { loginWithToken, loginLocal } = useAuth();
  const [provider, setProvider] = useState<'forgejo' | 'github'>('forgejo');
  const [forgejoUrl, setForgejoUrl] = useState('http://localhost:3000/api/v1');
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'error' | 'info' | 'success' } | null>(null);

  const getForgejoBaseWebUrl = (apiUrl: string) => {
    try {
      return apiUrl.replace(/\/api\/v1\/?$/, '').replace(/\/api\/?$/, '');
    } catch {
      return 'http://localhost:3000';
    }
  };

  const currentProviderName = provider === 'forgejo' ? 'Forgejo' : 'GitHub';

  const handleTokenLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setStatusMessage({
        text: t('auth:statusPromptToken', { provider: currentProviderName }),
        type: 'error',
      });
      return;
    }

    setIsLoading(true);
    setStatusMessage({
      text: t('auth:statusConnecting', { provider: currentProviderName }),
      type: 'info',
    });

    try {
      const activeUrl = provider === 'forgejo' ? (forgejoUrl.trim() || 'http://localhost:3000/api/v1') : undefined;
      const result = await loginWithToken(token.trim(), provider, activeUrl);
      if (result.success) {
        setStatusMessage({ text: t('auth:statusSuccess'), type: 'success' });
        onLoginSuccess();
      } else {
        setStatusMessage({ text: result.error || t('auth:statusDefaultError'), type: 'error' });
      }
    } catch {
      setStatusMessage({ text: t('auth:statusServerError'), type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocalModeLogin = async () => {
    setIsLoading(true);
    setStatusMessage({ text: t('auth:statusStartingLocal'), type: 'info' });
    try {
      await loginLocal();
      onLoginSuccess();
    } catch {
      setStatusMessage({ text: t('auth:statusLocalError'), type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const forgejoWebBase = getForgejoBaseWebUrl(forgejoUrl);

  return (
    <div
      id="view-auth"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        width: '100%',
        padding: '24px 16px',
        boxSizing: 'border-box',
        background: 'radial-gradient(ellipse at top, var(--color-surface-container-high) 0%, var(--color-surface) 75%)',
        position: 'relative',
        overflowY: 'auto',
      }}
    >
      {/* Top right language switcher */}
      <div style={{ position: 'absolute', top: '16px', right: '20px', zIndex: 10 }}>
        <LanguageSwitcher />
      </div>

      <div style={{ width: '100%', maxWidth: '820px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Header Hero Branding */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: '16px',
              background: 'var(--color-primary-container)',
              color: 'var(--color-primary)',
              fontSize: '11.5px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              border: '1px solid rgba(var(--color-primary-rgb, 59, 130, 246), 0.2)',
            }}
          >
            <Sparkles size={13} />
            <span>{t('auth:badge')}</span>
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: '24px',
              fontWeight: 800,
              color: 'var(--color-on-surface)',
              letterSpacing: '-0.02em',
              lineHeight: 1.25,
            }}
          >
            {t('auth:heroTitle')}
          </h1>
          <p
            style={{
              margin: 0,
              maxWidth: '560px',
              fontSize: '13px',
              color: 'var(--color-on-surface-variant)',
              lineHeight: 1.45,
            }}
          >
            {t('auth:heroSubtitle')}
          </p>
        </div>

        {/* Main Split Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '16px',
            alignItems: 'stretch',
          }}
        >
          {/* Card Esquerdo: Escolha do Provedor e Formulário */}
          <Card style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', height: '100%' }}>
              
              <div>
                <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--color-on-surface)' }}>
                  {t('auth:accessTitle')}
                </h2>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>
                  {t('auth:accessSubtitle')}
                </p>
              </div>

              {/* Provider Selector Tabs */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '4px',
                  background: 'var(--color-surface-container-low)',
                  padding: '3px',
                  borderRadius: 'var(--radius-md, 8px)',
                  border: '1px solid var(--color-outline-variant)',
                }}
              >
                <button
                  type="button"
                  id="tab-provider-forgejo"
                  onClick={() => {
                    setProvider('forgejo');
                    setStatusMessage(null);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm, 6px)',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    transition: 'all 0.15s ease',
                    background: provider === 'forgejo' ? 'var(--color-surface-container-highest)' : 'transparent',
                    color: provider === 'forgejo' ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
                    boxShadow: provider === 'forgejo' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  <Server size={15} />
                  <span>{t('auth:providerForgejo')}</span>
                </button>

                <button
                  type="button"
                  id="tab-provider-github"
                  onClick={() => {
                    setProvider('github');
                    setStatusMessage(null);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm, 6px)',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    transition: 'all 0.15s ease',
                    background: provider === 'github' ? 'var(--color-surface-container-highest)' : 'transparent',
                    color: provider === 'github' ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
                    boxShadow: provider === 'github' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  <Globe size={15} />
                  <span>{t('auth:providerGithub')}</span>
                </button>
              </div>

              {/* Provider Active Form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {provider === 'forgejo' ? (
                  <>
                    <FormField
                      label={t('auth:forgejoUrlLabel')}
                      helperText={t('auth:forgejoUrlHelper')}
                    >
                      <Input
                        type="text"
                        id="forgejo-url-input"
                        placeholder="http://localhost:3000/api/v1"
                        value={forgejoUrl}
                        onChange={(e) => setForgejoUrl(e.target.value)}
                      />
                    </FormField>

                    <a
                      id="btn-open-forgejo-token"
                      href={`${forgejoWebBase}/user/settings/applications`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '7px 12px',
                        borderRadius: 'var(--radius-md, 6px)',
                        background: 'var(--color-surface-container-high)',
                        color: 'var(--color-on-surface)',
                        fontWeight: 600,
                        fontSize: '12px',
                        textDecoration: 'none',
                        border: '1px solid var(--color-outline-variant)',
                      }}
                    >
                      <span>{t('auth:generateTokenForgejo')}</span>
                      <ExternalLink size={13} />
                    </a>
                  </>
                ) : (
                  <>
                    <a
                      id="btn-open-github-token"
                      href="https://github.com/settings/tokens/new?scopes=repo,read:org,user&description=Context+OS"
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '7px 12px',
                        borderRadius: 'var(--radius-md, 6px)',
                        background: 'var(--color-surface-container-high)',
                        color: 'var(--color-on-surface)',
                        fontWeight: 600,
                        fontSize: '12px',
                        textDecoration: 'none',
                        border: '1px solid var(--color-outline-variant)',
                      }}
                    >
                      <span>{t('auth:generateTokenGithub')}</span>
                      <ExternalLink size={13} />
                    </a>
                  </>
                )}

                <form onSubmit={handleTokenLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <FormField 
                    label={t('auth:tokenLabel', { provider: currentProviderName })}
                    helperText={
                      provider === 'forgejo' 
                        ? t('auth:tokenHelperForgejo')
                        : t('auth:tokenHelperGithub')
                    }
                  >
                    <Input
                      type="password"
                      id="pat-token-input"
                      placeholder={provider === 'forgejo' ? t('auth:tokenPlaceholderForgejo') : t('auth:tokenPlaceholderGithub')}
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
                    {t('auth:connectButton', { provider: currentProviderName })}
                  </Button>

                  {statusMessage && (
                    <AlertBanner
                      variant={statusMessage.type}
                      title={statusMessage.text}
                      onClose={() => setStatusMessage(null)}
                    />
                  )}
                </form>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '2px 0' }}>
                  <div style={{ flex: 1, height: '1px', background: 'var(--color-outline-variant)' }} />
                  <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-outline)', textTransform: 'uppercase' }}>
                    {t('common:or')}
                  </span>
                  <div style={{ flex: 1, height: '1px', background: 'var(--color-outline-variant)' }} />
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  fullWidth
                  type="button"
                  onClick={handleLocalModeLogin}
                  disabled={isLoading}
                  icon={<Monitor size={14} />}
                >
                  {t('auth:localModeButton')}
                </Button>
              </div>

            </CardContent>
          </Card>

          {/* Card Direito: Comparativo & Diferenciais de Governança */}
          <Card style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--color-surface-container-lowest)' }}>
            <CardContent style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', height: '100%', justifyContent: 'flex-start' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    padding: '6px',
                    borderRadius: '8px',
                    background: 'var(--color-primary-container)',
                    color: 'var(--color-primary)',
                    display: 'flex',
                  }}
                >
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--color-on-surface)' }}>
                    {t('auth:differencesTitle')}
                  </h3>
                  <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>
                    {t('auth:differencesSubtitle')}
                  </span>
                </div>
              </div>

              {/* Box Forgejo */}
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md, 8px)',
                  background: provider === 'forgejo' ? 'rgba(var(--color-primary-rgb, 59, 130, 246), 0.08)' : 'var(--color-surface-container)',
                  border: provider === 'forgejo' ? '1px solid var(--color-primary)' : '1px solid var(--color-outline-variant)',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <strong style={{ fontSize: '13px', color: 'var(--color-on-surface)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Server size={14} />
                    {t('auth:forgejoBoxTitle')}
                  </strong>
                  <span style={{ fontSize: '10.5px', fontWeight: 700, background: '#10b98120', color: '#10b981', padding: '2px 7px', borderRadius: '10px' }}>
                    {t('auth:forgejoBoxTag')}
                  </span>
                </div>
                <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: 'var(--color-on-surface-variant)', lineHeight: 1.45, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <li>
                    <Trans ns="auth" i18nKey="forgejoItem1">
                      <strong>Branch & File Protection:</strong> Regras nativas sem custo em repositórios privados.
                    </Trans>
                  </li>
                  <li>
                    <Trans ns="auth" i18nKey="forgejoItem2">
                      <strong>Controle Total:</strong> Roda na sua infraestrutura, sem dados externos.
                    </Trans>
                  </li>
                </ul>
              </div>

              {/* Box GitHub */}
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md, 8px)',
                  background: provider === 'github' ? 'rgba(var(--color-primary-rgb, 59, 130, 246), 0.08)' : 'var(--color-surface-container)',
                  border: provider === 'github' ? '1px solid var(--color-primary)' : '1px solid var(--color-outline-variant)',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <strong style={{ fontSize: '13px', color: 'var(--color-on-surface)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Globe size={14} />
                    {t('auth:githubBoxTitle')}
                  </strong>
                  <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--color-outline)', background: 'var(--color-surface-container-high)', padding: '2px 7px', borderRadius: '10px' }}>
                    {t('auth:githubBoxTag')}
                  </span>
                </div>
                <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: 'var(--color-on-surface-variant)', lineHeight: 1.45, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <li>
                    <Trans ns="auth" i18nKey="githubItem1">
                      <strong>Repositórios GitHub:</strong> Conexão direta com seus repositórios existentes.
                    </Trans>
                  </li>
                  <li>
                    <Trans ns="auth" i18nKey="githubItem2">
                      <strong>Cofre Zero-Trust:</strong> Criptografia ponta a ponta em todos os planos.
                    </Trans>
                  </li>
                </ul>
              </div>

            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
};
