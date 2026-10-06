import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserPlus, AlertCircle } from 'lucide-react';
import { Modal, Button, FormField, Input } from '../ui';
import { useAuth } from '../../context/AuthContext';

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AddAccountModal: React.FC<AddAccountModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation(['common', 'repos', 'auth']);
  const { loginWithToken } = useAuth();

  const [token, setToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setToken('');
      setErrorMsg(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanToken = token.trim();
    if (!cleanToken) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    const res = await loginWithToken(cleanToken);

    setIsSubmitting(false);

    if (res.success) {
      if (onSuccess) onSuccess();
      onClose();
    } else {
      setErrorMsg(res.error || 'Falha ao autenticar token.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Conectar Nova Conta do GitHub"
      subtitle="Adicione outro perfil do GitHub para alternar rapidamente"
      icon={<UserPlus size={20} />}
      size="md"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%' }}>
          <Button variant="subtle" size="sm" onClick={onClose} disabled={isSubmitting}>
            {t('common:cancel', 'Cancelar')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            type="button"
            isLoading={isSubmitting}
            disabled={!token.trim()}
            onClick={handleSubmit}
          >
            Conectar e Salvar
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        <FormField label="Personal Access Token do GitHub:" required>
          <Input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ex: ghp_... ou gho_... (escopos repo e user)"
            required
            autoFocus
          />
        </FormField>

        {errorMsg && (
          <div
            style={{
              padding: '10px 12px',
              backgroundColor: 'var(--color-error-container, rgba(239, 68, 68, 0.12))',
              border: '1px solid var(--color-error, rgba(239, 68, 68, 0.3))',
              borderRadius: 'var(--radius-sm, 6px)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              color: 'var(--color-on-error-container, #f87171)',
              fontSize: '12px',
            }}
          >
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{errorMsg}</span>
          </div>
        )}
      </form>
    </Modal>
  );
};
