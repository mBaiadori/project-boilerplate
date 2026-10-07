import React from 'react';
import { Shield, X } from 'lucide-react';
import { Modal, IconButton, Button } from '../ui';
import { AccessGovernanceManager } from '../governance/AccessGovernanceManager';

interface RepoGovernanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgLogin: string;
  repoName: string;
}

export const RepoGovernanceModal: React.FC<RepoGovernanceModalProps> = ({
  isOpen,
  onClose,
  orgLogin,
  repoName,
}) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <div className="flex items-center justify-between p-4 border-b border-surface-subtle">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary-main/15 flex items-center justify-center text-primary-light">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              Governança & Acessos do Repositório
            </h3>
            <p className="text-xs text-text-muted">
              Gerencie times e colaboradores em <span className="font-mono text-primary-light">{orgLogin}/{repoName}</span>
            </p>
          </div>
        </div>

        <IconButton
          icon={<X className="w-4 h-4" />}
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Fechar"
        />
      </div>

      <div className="p-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
        <AccessGovernanceManager
          orgLogin={orgLogin}
          repoName={repoName}
          mode="live"
        />
      </div>

      <div className="flex items-center justify-end p-4 border-t border-surface-subtle bg-surface-subtle/30">
        <Button variant="primary" size="sm" onClick={onClose}>
          Concluir
        </Button>
      </div>
    </Modal>
  );
};
