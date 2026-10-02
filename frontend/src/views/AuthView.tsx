import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, FormField, Input, Button, AlertBanner } from '../components/ui';
import { 
  ShieldCheck, 
  Monitor, 
  ExternalLink, 
  Globe, 
  Server, 
  Lock, 
  Sparkles
} from 'lucide-react';

interface AuthViewProps {
  onLoginSuccess: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onLoginSuccess }) => {
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

  const handleTokenLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setStatusMessage({
        text: `Por favor, insira seu Personal Access Token do ${provider === 'forgejo' ? 'Forgejo' : 'GitHub'}.`,
        type: 'error',
      });
      return;
    }

    setIsLoading(true);
    setStatusMessage({
      text: `Conectando ao ${provider === 'forgejo' ? 'Forgejo' : 'GitHub'} e validando permissões de governança...`,
      type: 'info',
    });

    try {
      const activeUrl = provider === 'forgejo' ? (forgejoUrl.trim() || 'http://localhost:3000/api/v1') : undefined;
      const result = await loginWithToken(token.trim(), provider, activeUrl);
      if (result.success) {
        setStatusMessage({ text: 'Autenticado com sucesso!', type: 'success' });
        onLoginSuccess();
      } else {
        setStatusMessage({ text: result.error || 'Token inválido ou servidor inacessível.', type: 'error' });
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
        padding: '32px 20px',
        boxSizing: 'border-box',
        background: 'radial-gradient(ellipse at top, var(--color-surface-container-high) 0%, var(--color-surface) 70%)',
      }}
    >
      <div style={{ width: '100%', maxWidth: '860px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Header Hero Branding */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '20px',
              background: 'var(--color-primary-container)',
              color: 'var(--color-primary)',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              border: '1px solid rgba(var(--color-primary-rgb, 59, 130, 246), 0.25)',
            }}
          >
            <Sparkles size={14} />
            <span>Context OS • Spec-Driven Architecture & AI Governance</span>
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: '32px',
              fontWeight: 800,
              color: 'var(--color-on-surface)',
              letterSpacing: '-0.03em',
              lineHeight: 1.2,
            }}
          >
            A Inteligência do Produto e o Código no Mesmo Lugar
          </h1>
          <p
            style={{
              margin: 0,
              maxWidth: '640px',
              fontSize: '14.5px',
              color: 'var(--color-on-surface-variant)',
              lineHeight: 1.6,
            }}
          >
            Gerencie especificações vivas com auxílio de IA, criptografia ponta a ponta (Zero-Trust) e controle estrito de permissões integrado ao ciclo de vida Git.
          </p>
        </div>

        {/* Main Split Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '20px',
            alignItems: 'stretch',
          }}
        >
          {/* Card Esquerdo: Escolha do Provedor e Formulário */}
          <Card style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent style={{ padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: '18px', height: '100%' }}>
              
              <div>
                <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--color-on-surface)' }}>
                  Acesso & Provedor Git
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>
                  Selecione onde os repositórios e regras de branch serão mantidos:
                </p>
              </div>

              {/* Provider Selector Tabs */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '6px',
                  background: 'var(--color-surface-container-low)',
                  padding: '4px',
                  borderRadius: 'var(--radius-md, 10px)',
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
                    gap: '8px',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm, 8px)',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 700,
                    transition: 'all 0.15s ease',
                    background: provider === 'forgejo' ? 'var(--color-surface-container-highest)' : 'transparent',
                    color: provider === 'forgejo' ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
                    boxShadow: provider === 'forgejo' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  <Server size={16} />
                  <span>Forgejo Privado</span>
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
                    gap: '8px',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm, 8px)',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 700,
                    transition: 'all 0.15s ease',
                    background: provider === 'github' ? 'var(--color-surface-container-highest)' : 'transparent',
                    color: provider === 'github' ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
                    boxShadow: provider === 'github' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  <Globe size={16} />
                  <span>GitHub Cloud</span>
                </button>
              </div>

              {/* Provider Active Form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {provider === 'forgejo' ? (
                  <>
                    <FormField
                      label="URL da Instância Forgejo (API v1)"
                      helperText="Instância local Docker ou sua VPS privada"
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
                        gap: '8px',
                        padding: '9px 14px',
                        borderRadius: 'var(--radius-md, 8px)',
                        background: 'var(--color-surface-container-high)',
                        color: 'var(--color-on-surface)',
                        fontWeight: 600,
                        fontSize: '12.5px',
                        textDecoration: 'none',
                        border: '1px solid var(--color-outline-variant)',
                      }}
                    >
                      <span>1. Gerar Token no Forgejo</span>
                      <ExternalLink size={14} />
                    </a>
                  </>
                ) : (
                  <>
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
                        padding: '9px 14px',
                        borderRadius: 'var(--radius-md, 8px)',
                        background: 'var(--color-surface-container-high)',
                        color: 'var(--color-on-surface)',
                        fontWeight: 600,
                        fontSize: '12.5px',
                        textDecoration: 'none',
                        border: '1px solid var(--color-outline-variant)',
                      }}
                    >
                      <span>1. Gerar Token no GitHub (1-Click)</span>
                      <ExternalLink size={14} />
                    </a>
                  </>
                )}

                <form onSubmit={handleTokenLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <FormField 
                    label={`2. Cole o Token (${provider === 'forgejo' ? 'Forgejo' : 'GitHub'})`}
                    helperText={
                      provider === 'forgejo' 
                        ? 'No Forgejo, marque as permissões "user", "repo" e "organization" (ou selecione "all").' 
                        : 'Permissões necessárias: repo, read:org, user'
                    }
                  >
                    <Input
                      type="password"
                      id="pat-token-input"
                      placeholder={provider === 'forgejo' ? 'Token (ex: 2ff8bb9148a...)' : 'ghp_xxxxxxxxxxxx ou github_pat_xxxx'}
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
                    Conectar ao {provider === 'forgejo' ? 'Forgejo' : 'GitHub'}
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
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-outline)', textTransform: 'uppercase' }}>
                    OU
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
                  icon={<Monitor size={15} />}
                >
                  Modo Local Offline
                </Button>
              </div>

            </CardContent>
          </Card>

          {/* Card Direito: Comparativo & Diferenciais de Governança */}
          <Card style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--color-surface-container-lowest)' }}>
            <CardContent style={{ padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', justifyContent: 'space-between' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      padding: '8px',
                      borderRadius: '8px',
                      background: 'var(--color-primary-container)',
                      color: 'var(--color-primary)',
                      display: 'flex',
                    }}
                  >
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--color-on-surface)' }}>
                      Qual a diferença entre eles?
                    </h3>
                    <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>
                      Entenda o modelo de segurança e custos
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
                    <strong style={{ fontSize: '13.5px', color: 'var(--color-on-surface)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Server size={15} />
                      Forgejo Privado (Recomendado)
                    </strong>
                    <span style={{ fontSize: '11px', fontWeight: 700, background: '#10b98120', color: '#10b981', padding: '2px 8px', borderRadius: '12px' }}>
                      Custo $0 / Ilimitado
                    </span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12.5px', color: 'var(--color-on-surface-variant)', lineHeight: 1.5 }}>
                    <li><strong>Branch & File Protection 100% livres</strong> em repositórios privados sem pagar plano Enterprise ($21/usuário).</li>
                    <li><strong>Controle Soberano:</strong> Roda no seu Docker ou VPS; nenhum código ou especificação sai da sua infraestrutura.</li>
                    <li><strong>Ações de Deploy & CI/CD:</strong> Suporte nativo a Forgejo Actions (.forgejo/workflows).</li>
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
                    <strong style={{ fontSize: '13.5px', color: 'var(--color-on-surface)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Globe size={15} />
                      GitHub Cloud (SaaS)
                    </strong>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-outline)' }}>
                      Padrão de Mercado
                    </span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12.5px', color: 'var(--color-on-surface-variant)', lineHeight: 1.5 }}>
                    <li>Ideal se a equipe já mantém os repositórios principais no GitHub.com.</li>
                    <li><em>Atenção:</em> Contas gratuitas do GitHub bloqueiam branch rules em repos privados (exige GitHub Pro/Enterprise).</li>
                    <li>O <strong>Cofre Zero-Trust</strong> do Context OS garante a criptografia dos dados confidenciais mesmo no GitHub Free.</li>
                  </ul>
                </div>
              </div>

              {/* Box Zero-Trust Architecture Guarantee */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  fontSize: '12px',
                  color: 'var(--color-on-surface-variant)',
                  background: 'var(--color-surface-container-high)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md, 8px)',
                  border: '1px dashed var(--color-outline-variant)',
                }}
              >
                <Lock size={16} style={{ color: 'var(--color-primary)', flexShrink: 0, marginTop: '2px' }} />
                <span>
                  <strong>Arquitetura Unificada:</strong> A IA, as regras de negócio e a criptografia são gerenciadas diretamente pelo framework, sem duplicar código e mantendo compatibilidade 1:1.
                </span>
              </div>

            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
};
