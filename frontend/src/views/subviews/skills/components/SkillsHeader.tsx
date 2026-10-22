import React from "react";
import { RefreshCw } from "lucide-react";
import { AlertBanner, Badge, Button } from "../../../../components/ui";

interface SkillsHeaderProps {
  onRefresh: () => void;
  actionFeedback: { ok: boolean; msg: string } | null;
  onCloseFeedback: () => void;
}

export const SkillsHeader: React.FC<SkillsHeaderProps> = ({
  onRefresh,
  actionFeedback,
  onCloseFeedback,
}) => {
  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "20px",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h1
              style={{
                margin: 0,
                fontSize: "22px",
                fontWeight: 700,
                color: "var(--color-on-surface)",
                letterSpacing: "-0.02em",
              }}
            >
              Harness & Skills do Agente
            </h1>
            <Badge variant="purple" size="md">
              Padrão ECC
            </Badge>
          </div>
          <p
            style={{
              margin: "6px 0 0 0",
              fontSize: "13.5px",
              color: "var(--color-on-surface-variant)",
            }}
          >
            Habilidades operacionais, guardrails de governança e ferramentas
            injetadas no contexto do Copilot e agentes autônomos.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Button
            id="btn-refresh-skills"
            variant="secondary"
            size="md"
            onClick={onRefresh}
            icon={<RefreshCw size={15} />}
          >
            Atualizar Catálogo
          </Button>
        </div>
      </div>

      {/* Feedback Banner */}
      {actionFeedback && (
        <div style={{ marginBottom: "16px" }}>
          <AlertBanner
            variant={actionFeedback.ok ? "success" : "error"}
            title={actionFeedback.msg}
            onClose={onCloseFeedback}
          />
        </div>
      )}
    </>
  );
};
