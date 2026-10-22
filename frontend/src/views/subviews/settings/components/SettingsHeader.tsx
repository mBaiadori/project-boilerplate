import React from "react";
import { Sparkles, Copy, Save } from "lucide-react";
import { PageHeader, Badge, Button } from "../../../../components/ui";

interface SettingsHeaderProps {
  activeRepoName?: string;
  setShowOnboardingModal: (val: boolean) => void;
  handleCopyDiagnostics: () => void;
  handleSaveAllSettings: () => void;
  isSavingAll: boolean;
}

export const SettingsHeader: React.FC<SettingsHeaderProps> = ({
  activeRepoName,
  setShowOnboardingModal,
  handleCopyDiagnostics,
  handleSaveAllSettings,
  isSavingAll,
}) => {
  return (
    <PageHeader
      title="Configurações"
      badge={
        <Badge variant="primary" size="sm">
          {activeRepoName || "local"}
        </Badge>
      }
      actions={
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Button
            id="btn-reopen-onboarding"
            variant="subtle"
            size="sm"
            leftIcon={<Sparkles size={13} />}
            onClick={() => setShowOnboardingModal(true)}
          >
            Assistente / Tour
          </Button>
          <Button
            id="btn-copy-diagnostics"
            variant="subtle"
            size="sm"
            leftIcon={<Copy size={13} />}
            onClick={handleCopyDiagnostics}
          >
            Diagnóstico Suporte
          </Button>
          <Button
            id="btn-save-top-all-settings"
            variant="primary"
            size="sm"
            leftIcon={<Save size={13} />}
            onClick={handleSaveAllSettings}
            disabled={isSavingAll}
          >
            {isSavingAll ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      }
    />
  );
};
