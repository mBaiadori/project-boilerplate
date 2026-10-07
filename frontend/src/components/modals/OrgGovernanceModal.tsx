import React from 'react';
import { Building2 } from 'lucide-react';
import { Modal, Button } from '../ui';
import { AccessGovernanceManager } from '../governance/AccessGovernanceManager';

interface OrgGovernanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgLogin: string;
}

export const OrgGovernanceModal: React.FC<OrgGovernanceModalProps> = ({
  isOpen,
  onClose,
  orgLogin,
}) => {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title="Governança da Organização"
      subtitle={
        <>
          Gerencie times, membros oficiais e permissões na organização{' '}
          <code
            style={{
              color: 'var(--md-sys-color-primary, #1a73e8)',
              fontWeight: 600,
              fontFamily: 'monospace',
            }}
          >
            @{orgLogin}
          </code>
        </>
      }
      icon={<Building2 size={20} />}
      footer={
        <Button variant="primary" size="sm" onClick={onClose}>
          Concluir
        </Button>
      }
    >
      <div style={{ maxHeight: '70vh', overflowY: 'auto' }} className="custom-scrollbar">
        <AccessGovernanceManager
          orgLogin={orgLogin}
          mode="org"
        />
      </div>
    </Modal>
  );
};
