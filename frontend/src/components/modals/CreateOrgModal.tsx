import React, { useState } from 'react';
import { Building2, X, Globe, ExternalLink, AlertCircle } from 'lucide-react';
import { Button, IconButton, FormField, Input } from '../ui';
import { API } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface CreateOrgModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (org: { login: string; full_name?: string }) => void;
}

export const CreateOrgModal: React.FC<CreateOrgModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const { provider } = useAuth();
  const isForgejo = provider === 'forgejo';
  const isGitHub = provider === 'github';

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private' | 'limited'>('public');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [webFlowUrl, setWebFlowUrl] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setUsername('');
      setFullName('');
      setDescription('');
      setVisibility('public');
      setErrorMsg(null);
      setWebFlowUrl(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.trim().toLowerCase().replace(/\s+/g, '-');
    if (!cleanUsername) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    setWebFlowUrl(null);

    try {
      const res = await API.createOrg({
        username: cleanUsername,
        full_name: fullName.trim() || undefined,
        description: description.trim() || undefined,
        visibility,
      });

      if (res.ok) {
        if (res.data?.requires_web_flow && res.data.web_url) {
          setWebFlowUrl(res.data.web_url);
        } else if (res.data?.success && res.data.org) {
          onCreated(res.data.org);
          onClose();
        } else {
          setErrorMsg(res.data?.error || res.data?.message || 'Erro ao registrar organização');
        }
      } else {
        setErrorMsg(res.data?.error || res.data?.message || 'Erro ao processar requisição');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro de conexão com o servidor');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '540px',
          backgroundColor: 'var(--color-surface, #ffffff)',
          color: 'var(--color-on-surface, #1e293b)',
          borderRadius: '16px',
          border: '1px solid var(--color-outline-variant, #e2e8f0)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--color-outline-variant, #e2e8f0)',
            backgroundColor: 'var(--color-surface-container-low, #f8fafc)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
              }}
            >
              <Building2 size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--color-on-surface, #0f172a)' }}>
                Nova Organização
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant, #64748b)' }}>
                {isForgejo ? 'Criar organização no Forgejo' : isGitHub ? 'Registrar organização no GitHub' : 'Criar organização local'}
              </span>
            </div>
          </div>

          <IconButton size="sm" tooltip="Fechar" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {errorMsg && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid #ef4444',
                color: '#ef4444',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {webFlowUrl && (
            <div
              style={{
                padding: '14px',
                borderRadius: '10px',
                backgroundColor: 'rgba(26, 115, 232, 0.08)',
                border: '1px solid var(--color-primary, #1a73e8)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary, #1a73e8)', fontWeight: 600, fontSize: '13px' }}>
                <Globe size={16} />
                <span>Fluxo Oficial do GitHub</span>
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-on-surface, #334155)', lineHeight: 1.4 }}>
                O GitHub exige que novas organizações sejam criadas pela sua interface web oficial para definição de faturamento e membros.
              </p>
              <a
                href={webFlowUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--color-primary, #1a73e8)',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 500,
                  textDecoration: 'none',
                  alignSelf: 'flex-start',
                }}
              >
                <span>Abrir Criador de Organizações do GitHub</span>
                <ExternalLink size={14} />
              </a>
            </div>
          )}

          {!webFlowUrl && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <FormField label="Identificador / Nome de Usuário:" required>
                  <Input
                    id="org-username-input"
                    placeholder="ex: acme-corp"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoFocus
                  />
                </FormField>

                <FormField label="Nome de Exibição:">
                  <Input
                    id="org-fullname-input"
                    placeholder="ex: Acme Corporation"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </FormField>
              </div>

              <FormField label="Descrição:">
                <Input
                  id="org-description-input"
                  placeholder="ex: Projetos e especificações de engenharia"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </FormField>

              {isForgejo && (
                <FormField label="Visibilidade no Forgejo:">
                  <select
                    id="org-visibility-select"
                    className="ui-input"
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as any)}
                  >
                    <option value="public">Pública (visível para todos)</option>
                    <option value="limited">Limitada (visível para usuários autenticados)</option>
                    <option value="private">Privada (visível apenas para membros)</option>
                  </select>
                </FormField>
              )}
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              {webFlowUrl ? 'Fechar' : 'Cancelar'}
            </Button>
            {!webFlowUrl && (
              <Button
                id="btn-submit-create-org"
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSubmitting}
                disabled={!username.trim()}
              >
                Criar Organização
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
