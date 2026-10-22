import React from "react";
import { GitPullRequest, RefreshCw } from "lucide-react";
import { PageHeader, Row, Button } from "../../../../components/ui";
import { RepoSelectorDropdown } from "../../../../components/layout/RepoSelectorDropdown";

interface PRsHeaderProps {
  selectedRepoFilter: string;
  setSelectedRepoFilter: (val: string) => void;
  repoOpenCounts: Record<string, number>;
  isLoading: boolean;
  loadPRs: () => void;
  providerLabel: string;
}

export const PRsHeader: React.FC<PRsHeaderProps> = ({
  selectedRepoFilter,
  setSelectedRepoFilter,
  repoOpenCounts,
  isLoading,
  loadPRs,
  providerLabel: _providerLabel,
}) => {
  return (
    <PageHeader
      title="Revisões & Publicações"
      subtitle={
        <Row gap="sm" align="center" style={{ marginTop: "4px", flexWrap: "wrap" }}>
          <RepoSelectorDropdown
            value={selectedRepoFilter}
            onChange={(val) => {
              setSelectedRepoFilter(val);
            }}
            repoOpenCounts={repoOpenCounts}
            allowAll={true}
          />
          <span className="ui-text-muted" style={{ fontSize: "12.5px" }}>
            Revise propostas de alteração de documentos, aprove versões e controle o histórico de integrações.
          </span>
        </Row>
      }
      icon={
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "10px",
            background: "var(--md-sys-color-primary-container, #e8f0fe)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--md-sys-color-primary, #1a73e8)",
          }}
        >
          <GitPullRequest size={22} />
        </div>
      }
      actions={
        <Row gap="xs">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={14} />}
            onClick={() => loadPRs()}
            title="Atualizar lista de propostas"
            disabled={isLoading}
          >
            {isLoading ? "Atualizando..." : "Atualizar"}
          </Button>
        </Row>
      }
    />
  );
};
