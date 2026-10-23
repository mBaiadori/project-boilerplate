import React from "react";
import { Card, Button, Badge } from "../../../../components/ui";
import { DiffViewer } from "../../../../components/common";
import { VisualMarkdownDiff } from "../../../../components/editor/VisualMarkdownDiff";
import { getSystemFileFriendlyName } from "../../../../utils/hidden-files";
import type { DraftItem } from "../types";

interface SystemDraftsTabProps {
  allSystemDraftFiles: DraftItem[];
  toggleAllSystemFiles: () => void;
  expandedSystemFiles: Record<string, boolean>;
  toggleSystemFile: (path: string, repoName?: string) => void;
  systemDiffs: Record<string, string>;
  loadingSystemDiffs: Record<string, boolean>;
  handleDiscard: (path: string, repoName?: string) => void;
}

export const SystemDraftsTab: React.FC<SystemDraftsTabProps> = ({
  allSystemDraftFiles,
  toggleAllSystemFiles,
  expandedSystemFiles,
  toggleSystemFile,
  systemDiffs,
  loadingSystemDiffs,
  handleDiscard,
}) => {
  if (allSystemDraftFiles.length === 0) {
    return (
      <div className="ui-stack ui-stack--lg">
        <Card
          variant="elevated"
          padding="xl"
          style={{ textAlign: "center" }}
        >
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: "44px",
              color: "var(--color-success, #16a34a)",
              marginBottom: "12px",
            }}
          >
            check_circle
          </span>
          <h4 className="ui-heading-3" style={{ margin: 0 }}>
            Nenhuma Alteração de Sistema Pendente
          </h4>
          <p
            className="ui-text-muted"
            style={{
              margin: "8px auto 0 auto",
              fontSize: "13.5px",
              maxWidth: "480px",
              lineHeight: "1.5",
            }}
          >
            Todos os templates (<code>.templates.json</code>), termos do
            dicionário (<code>.dictionary.json</code>) e arquivos de
            configuração do projeto estão sincronizados.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="ui-stack ui-stack--lg">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 4px",
          marginBottom: "-4px",
        }}
      >
        <strong style={{ fontSize: "14px", color: "var(--color-text-primary, #0f172a)" }}>
          Arquivos de Configuração & Sistema ({allSystemDraftFiles.length})
        </strong>

        <Button
          type="button"
          size="xs"
          variant="ghost"
          onClick={toggleAllSystemFiles}
          icon={
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
              {allSystemDraftFiles.every((f) => !!expandedSystemFiles[`${f.repoName}:${f.path}`])
                ? "unfold_less"
                : "unfold_more"}
            </span>
          }
        >
          {allSystemDraftFiles.every((f) => !!expandedSystemFiles[`${f.repoName}:${f.path}`])
            ? "Recolher Todos"
            : "Expandir Todos"}
        </Button>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {allSystemDraftFiles.map((f) => {
          const fKey = `${f.repoName}:${f.path}`;
          const isExpanded = !!expandedSystemFiles[fKey];
          const diffText = systemDiffs[fKey] || "";
          const isLoading = !!loadingSystemDiffs[fKey];

          return (
            <Card key={fKey} variant="elevated" padding="none">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 20px",
                  background: "var(--color-surface-subtle, #f8fafc)",
                  borderBottom: isExpanded
                    ? "1px solid var(--color-border-subtle, #e2e8f0)"
                    : "none",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                <div className="ui-row ui-row--align-center ui-row--sm">
                  <span
                    className="material-symbols-outlined"
                    style={{
                      fontSize: "22px",
                      color: "var(--color-primary, #3b82f6)",
                    }}
                  >
                    {f.path.includes("template")
                      ? "dashboard_customize"
                      : f.path.includes("dictionary")
                        ? "book"
                        : f.path.includes("metadata")
                          ? "tune"
                          : "settings"}
                  </span>
                  <div>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 700,
                        color: "var(--color-text-primary, #0f172a)",
                      }}
                    >
                      {getSystemFileFriendlyName(f.path)}
                    </div>
                    <div
                      className="ui-text-muted"
                      style={{
                        fontSize: "12px",
                        fontFamily: "var(--font-family-mono, monospace)",
                      }}
                    >
                      {f.path} {f.repoName && `(${f.repoName})`}
                    </div>
                  </div>
                </div>

                <div className="ui-row ui-row--align-center ui-row--xs">
                  <Badge
                    variant={
                      f.type === "ADDED"
                        ? "success"
                        : f.type === "DELETED"
                          ? "danger"
                          : "info"
                    }
                    size="sm"
                  >
                    {f.type === "ADDED"
                      ? "NOVO"
                      : f.type === "DELETED"
                        ? "REMOVIDO"
                        : "MODIFICADO"}
                  </Badge>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => toggleSystemFile(f.path, f.repoName)}
                    icon={
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: "16px" }}
                      >
                        {isExpanded ? "expand_less" : "expand_more"}
                      </span>
                    }
                  >
                    {isExpanded ? "Ocultar Diferenças" : "Ver Diferenças (Diff)"}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    style={{ color: "var(--color-danger, #dc2626)" }}
                    onClick={() => handleDiscard(f.path, f.repoName)}
                    title="Descartar alterações neste arquivo de sistema"
                    icon={
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: "15px" }}
                      >
                        delete
                      </span>
                    }
                  >
                    Descartar
                  </Button>
                </div>
              </div>

              {/* Diff Viewer Body */}
              {isExpanded && (
                <div style={{ padding: "8px 12px 12px 12px", borderTop: "1px solid var(--color-border-subtle, #e2e8f0)" }}>
                  {(f.old_content || f.new_content) ? (
                    <div style={{ borderRadius: "6px", overflow: "hidden", border: "1px solid var(--color-border-subtle, #e2e8f0)" }}>
                      <VisualMarkdownDiff
                        oldContent={f.old_content || ""}
                        newContent={f.new_content || ""}
                        fileName={f.path}
                        oldTitle="Versão Base"
                        newTitle="Rascunho Atual"
                        initialViewMode="split"
                      />
                    </div>
                  ) : (
                    <DiffViewer
                      diffText={diffText}
                      isLoading={isLoading}
                    />
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};
