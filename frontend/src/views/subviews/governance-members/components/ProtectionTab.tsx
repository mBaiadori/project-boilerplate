import React from "react";
import { Check, GitBranch, Play, Shield, ShieldCheck } from "lucide-react";
import { Badge } from "../../../../components/ui/Badge";
import { Button } from "../../../../components/ui/Button";
import { Card } from "../../../../components/ui/Card";

interface ProtectionTabProps {
  isSoloMode: boolean;
  quorumRules: { min_approvals_default: number };
  isSavingQuorum: boolean;
  onSaveQuorum: (val: number) => void;
  collaboratorsCount: number;
  branchProtection: {
    enabled: boolean;
    required_approving_review_count?: number;
    dismiss_stale_reviews?: boolean;
    enforce_admins?: boolean;
    allow_force_pushes?: boolean;
  } | null;
  protectionFeedback: { type: "success" | "error"; message: string } | null;
  isApplyingProtection: boolean;
  onApplyProtection: () => void;
  workflowStatus: { installed: boolean; path: string; content?: string } | null;
  workflowFeedback: { type: "success" | "error"; message: string } | null;
  isInstallingWorkflow: boolean;
  onInstallWorkflow: () => void;
}

export const ProtectionTab: React.FC<ProtectionTabProps> = ({
  isSoloMode,
  quorumRules,
  isSavingQuorum,
  onSaveQuorum,
  collaboratorsCount,
  branchProtection,
  protectionFeedback,
  isApplyingProtection,
  onApplyProtection,
  workflowStatus,
  workflowFeedback,
  isInstallingWorkflow,
  onInstallWorkflow,
}) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Quórum Card */}
      <Card variant="flat" padding="md">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Shield size={18} color="var(--color-primary, #6366f1)" />
            <h3
              style={{
                fontSize: "15px",
                fontWeight: 600,
                margin: 0,
                color: "var(--color-on-surface, #ffffff)",
              }}
            >
              Quórum de Aprovação de Pull Requests
            </h3>
          </div>
          <Badge variant={isSoloMode ? "neutral" : "success"} size="sm">
            {isSoloMode ? "Modo Solo" : "Modo Equipe"}
          </Badge>
        </div>

        <p
          style={{
            fontSize: "13px",
            color: "var(--color-outline, #a6adc8)",
            margin: "0 0 16px 0",
          }}
        >
          Define a quantidade mínima de revisões com aprovação obrigatórias
          antes de permitir o merge de Pull Requests.
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span
            style={{
              fontSize: "13px",
              color: "var(--color-on-surface, #cdd6f4)",
            }}
          >
            Aprovações mínimas por PR:
          </span>
          <input
            type="number"
            min={1}
            max={Math.max(1, collaboratorsCount - 1)}
            value={quorumRules?.min_approvals_default ?? 1}
            onChange={(e) =>
              onSaveQuorum(Math.max(1, Number(e.target.value)))
            }
            disabled={isSavingQuorum}
            style={{
              width: "60px",
              padding: "6px 10px",
              borderRadius: "6px",
              background: "var(--color-surface-container-high, #1e1e2e)",
              color: "var(--color-on-surface, #cdd6f4)",
              border:
                "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.12))",
              fontSize: "13px",
              textAlign: "center",
            }}
          />
        </div>
      </Card>

      {/* GitHub Branch Protection Card */}
      <Card variant="flat" padding="md">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <GitBranch size={18} color="#818cf8" />
            <h3
              style={{
                fontSize: "15px",
                fontWeight: 600,
                margin: 0,
                color: "var(--color-on-surface, #ffffff)",
              }}
            >
              Proteção de Branch no GitHub (`main`)
            </h3>
          </div>

          <Badge
            variant={branchProtection?.enabled ? "success" : "warning"}
            size="sm"
          >
            {branchProtection?.enabled
              ? "✓ main protegida"
              : "⚠️ main desprotegida"}
          </Badge>
        </div>

        <p
          style={{
            fontSize: "13px",
            color: "var(--color-outline, #a6adc8)",
            margin: "0 0 16px 0",
          }}
        >
          Bloqueia push direto na branch <code>main</code> e exige aprovação
          formal de Pull Request para qualquer alteração.
        </p>

        {protectionFeedback && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "6px",
              marginBottom: "14px",
              background:
                protectionFeedback.type === "success"
                  ? "rgba(16, 185, 129, 0.15)"
                  : "rgba(239, 68, 68, 0.15)",
              color:
                protectionFeedback.type === "success" ? "#10b981" : "#ef4444",
              fontSize: "13px",
            }}
          >
            {protectionFeedback.message}
          </div>
        )}

        <Button
          variant={branchProtection?.enabled ? "outline" : "primary"}
          size="sm"
          onClick={onApplyProtection}
          disabled={Boolean(branchProtection?.enabled) || isApplyingProtection}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          {branchProtection?.enabled ? (
            <>
              <Check size={14} color="#10b981" />
              <span>Branch main já está protegida no GitHub</span>
            </>
          ) : (
            <>
              <ShieldCheck size={14} />
              <span>
                {isApplyingProtection
                  ? "Aplicando regras..."
                  : "Ativar Proteção da Branch main"}
              </span>
            </>
          )}
        </Button>
      </Card>

      {/* GitHub Actions Governance Gatekeeper Card */}
      <Card variant="flat" padding="md">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <ShieldCheck size={18} color="#10b981" />
            <h3
              style={{
                fontSize: "15px",
                fontWeight: 600,
                margin: 0,
                color: "var(--color-on-surface, #ffffff)",
              }}
            >
              GitHub Actions Governance Gatekeeper (CI/CD)
            </h3>
          </div>

          <Badge
            variant={workflowStatus?.installed ? "success" : "warning"}
            size="sm"
          >
            {workflowStatus?.installed
              ? "✓ Workflow Ativo"
              : "Não Instalado"}
          </Badge>
        </div>

        <p
          style={{
            fontSize: "13px",
            color: "var(--color-outline, #a6adc8)",
            margin: "0 0 16px 0",
          }}
        >
          Executa validações automáticas de CODEOWNERS, regras de Quórum e
          integridade de Pull Requests diretamente nos pipelines do GitHub
          Actions (inclusive em repositórios privados no GitHub Free).
        </p>

        {workflowFeedback && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "6px",
              marginBottom: "14px",
              background:
                workflowFeedback.type === "success"
                  ? "rgba(16, 185, 129, 0.15)"
                  : "rgba(239, 68, 68, 0.15)",
              color:
                workflowFeedback.type === "success" ? "#10b981" : "#ef4444",
              fontSize: "13px",
            }}
          >
            {workflowFeedback.message}
          </div>
        )}

        <Button
          variant={workflowStatus?.installed ? "outline" : "primary"}
          size="sm"
          onClick={onInstallWorkflow}
          disabled={isInstallingWorkflow}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          {isInstallingWorkflow ? (
            "Instalando..."
          ) : workflowStatus?.installed ? (
            <>
              <Check size={14} color="#10b981" />
              <span>
                Reinstalar / Atualizar Workflow
                (.github/workflows/governance-check.yml)
              </span>
            </>
          ) : (
            <>
              <Play size={14} />
              <span>Instalar Workflow de Governança no Repositório</span>
            </>
          )}
        </Button>
      </Card>
    </div>
  );
};
