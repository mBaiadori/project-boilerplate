import React from "react";
import { FolderGit2 } from "lucide-react";
import { Card, Row, Button, FilterChips, Badge } from "../../../../components/ui";
import { DiffViewer } from "../../../../components/common";
import type { WhatsNewFilterType } from "../types";

interface WhatsNewTabProps {
  whatsNewSummary: any;
  handleSync: () => void;
  isSyncing: boolean;
  handleMarkAsSeen: () => void;
  whatsNewFilter: WhatsNewFilterType;
  setWhatsNewFilter: (val: WhatsNewFilterType) => void;
  whatsNewFiles: any[];
  newFilesCount: number;
  modFilesCount: number;
  whatsNewProposals: any[];
  isWhatsNewProposalsExpanded: boolean;
  setIsWhatsNewProposalsExpanded: (val: boolean) => void;
  selectedRepoFilter: string;
  activeRepoName?: string;
  filteredWhatsNewFiles: any[];
  expandedWhatsNewFiles: Record<string, boolean>;
  toggleAllWhatsNewFiles: (files: any[]) => void;
  toggleWhatsNewFile: (path: string) => void;
  whatsNewDiffs: Record<string, string>;
  loadingWhatsNewDiffs: Record<string, boolean>;
  handleOpenFileClick: (path: string) => void;
  whatsNewCommits: any[];
  isWhatsNewCommitsExpanded: boolean;
  setIsWhatsNewCommitsExpanded: (val: boolean) => void;
}

export const WhatsNewTab: React.FC<WhatsNewTabProps> = ({
  whatsNewSummary,
  handleSync,
  isSyncing,
  handleMarkAsSeen,
  whatsNewFilter,
  setWhatsNewFilter,
  whatsNewFiles,
  newFilesCount,
  modFilesCount,
  whatsNewProposals,
  isWhatsNewProposalsExpanded,
  setIsWhatsNewProposalsExpanded,
  selectedRepoFilter,
  activeRepoName,
  filteredWhatsNewFiles,
  expandedWhatsNewFiles,
  toggleAllWhatsNewFiles,
  toggleWhatsNewFile,
  whatsNewDiffs,
  loadingWhatsNewDiffs,
  handleOpenFileClick,
  whatsNewCommits,
  isWhatsNewCommitsExpanded,
  setIsWhatsNewCommitsExpanded,
}) => {
  return (
    <div className="ui-stack ui-stack--lg">
      {/* Top Summary Banner */}
      <Card variant="elevated" padding="lg">
        <Row
          justify="between"
          align="center"
          style={{ width: "100%", flexWrap: "wrap", gap: "16px" }}
        >
          <div className="ui-row ui-row--align-center ui-row--md">
            <div
              style={{
                width: "46px",
                height: "46px",
                borderRadius: "12px",
                background: "var(--color-success-subtle, #dcfce7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--color-success, #16a34a)",
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "26px" }}
              >
                auto_awesome
              </span>
            </div>
            <div>
              <h3 className="ui-heading-3" style={{ margin: 0 }}>
                Novidades
              </h3>
              <span
                className="ui-text-muted"
                style={{
                  fontSize: "13px",
                  marginTop: "3px",
                  display: "block",
                }}
              >
                {whatsNewSummary?.summaryMessage || "Nenhuma atualização recente."}
              </span>
            </div>
          </div>

          <div className="ui-row ui-row--align-center ui-row--sm">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSync}
              disabled={isSyncing}
              icon={
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "16px" }}
                >
                  cloud_sync
                </span>
              }
            >
              {isSyncing ? "Buscando..." : "Buscar Novidades"}
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleMarkAsSeen}
              icon={
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "18px" }}
                >
                  done_all
                </span>
              }
            >
              Marcar tudo como visto
            </Button>
          </div>
        </Row>
      </Card>

      {/* Filter Chips Bar */}
      <div
        className="ui-row ui-row--align-center ui-row--sm"
        style={{ flexWrap: "wrap" }}
      >
        <span
          className="ui-text-muted"
          style={{
            fontSize: "13px",
            fontWeight: 600,
            marginRight: "4px",
          }}
        >
          Filtrar por:
        </span>

        <FilterChips<WhatsNewFilterType>
          activeId={whatsNewFilter}
          onChange={(id) => setWhatsNewFilter(id)}
          size="sm"
          items={[
            { id: "all", label: `Todos (${whatsNewFiles.length})` },
            { id: "new", label: `Novos Documentos (${newFilesCount})` },
            {
              id: "modified",
              label: `Documentos Alterados (${modFilesCount})`,
            },
            ...(whatsNewProposals.length > 0
              ? [
                  {
                    id: "proposals" as WhatsNewFilterType,
                    label: `Propostas (${whatsNewProposals.length})`,
                  },
                ]
              : []),
          ]}
        />
      </div>

      {/* Integrated Proposals Section */}
      {(whatsNewFilter === "all" || whatsNewFilter === "proposals") &&
        whatsNewProposals.length > 0 && (
          <Card variant="elevated" padding="none" style={{ overflow: "hidden" }}>
            <div
              className="ui-card__header"
              onClick={() => setIsWhatsNewProposalsExpanded(!isWhatsNewProposalsExpanded)}
              style={{
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 18px",
                userSelect: "none",
                background: isWhatsNewProposalsExpanded ? "var(--color-surface-subtle, #f8fafc)" : "transparent",
              }}
            >
              <div className="ui-row ui-row--align-center ui-row--xs">
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "20px", color: "var(--color-primary, #4f46e5)" }}
                >
                  verified
                </span>
                <strong
                  style={{
                    fontSize: "14px",
                    color: "var(--color-text-primary, #0f172a)",
                  }}
                >
                  Propostas de Alteração & Versões ({whatsNewProposals.length})
                </strong>
              </div>

              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsWhatsNewProposalsExpanded(!isWhatsNewProposalsExpanded);
                }}
                icon={
                  <span
                    className="material-symbols-outlined"
                    style={{
                      fontSize: "18px",
                      transition: "transform 0.2s ease",
                      transform: isWhatsNewProposalsExpanded ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                  >
                    expand_more
                  </span>
                }
              >
                {isWhatsNewProposalsExpanded ? "Recolher" : "Ver Propostas"}
              </Button>
            </div>

            {isWhatsNewProposalsExpanded && (
              <div
                className="ui-card__content"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  padding: "14px 18px",
                }}
              >
                {whatsNewProposals.map((pr, idx) => {
                  const statusLower = (pr.status || "merged").toLowerCase();
                  const isMerged = statusLower === "merged";
                  const isClosed = statusLower === "closed";
                  const repo = pr.repo_name || pr.repoName || (selectedRepoFilter !== "all" ? selectedRepoFilter : activeRepoName || "local");

                  const statusLabel = isMerged
                    ? "INTEGRADA"
                    : isClosed
                      ? "ARQUIVADA"
                      : "EM REVISÃO";

                  const statusVariant = isMerged
                    ? "success"
                    : isClosed
                      ? "danger"
                      : "warning";

                  return (
                    <div
                      key={idx}
                      className="ui-card ui-card--flat"
                      style={{
                        padding: "12px 16px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "12px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div className="ui-row ui-row--align-center ui-row--sm" style={{ flexWrap: "wrap" }}>
                        <Badge variant="primary" size="sm">
                          Proposta #{pr.id}
                        </Badge>

                        <Badge variant={statusVariant} size="xs">
                          {statusLabel}
                        </Badge>

                        {repo && (
                          <Badge
                            variant="neutral"
                            size="xs"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              backgroundColor: "var(--md-sys-color-surface-container-high, #e8eaed)",
                              color: "var(--md-sys-color-on-surface, #202124)",
                              borderColor: "var(--md-sys-color-outline-variant, #dadce0)",
                            }}
                          >
                            <FolderGit2 size={11} style={{ flexShrink: 0 }} />
                            {repo}
                          </Badge>
                        )}

                        <span
                          style={{
                            fontSize: "13.5px",
                            fontWeight: 600,
                            color: "var(--color-text-primary, #1e293b)",
                          }}
                        >
                          {pr.title}
                        </span>
                      </div>

                      {pr.author && (
                        <span
                          className="ui-text-muted"
                          style={{ fontSize: "12.5px" }}
                        >
                          Autor:{" "}
                          <strong
                            style={{
                              color: "var(--color-text-primary, #1e293b)",
                            }}
                          >
                            {pr.author}
                          </strong>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}

      {/* Changed Files Received from Team */}
      {whatsNewFilter !== "proposals" && (
        <Card variant="elevated" padding="none">
          <div
            className="ui-card__header"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 18px",
              borderBottom: "1px solid var(--color-border-subtle, #e2e8f0)",
            }}
          >
            <div className="ui-row ui-row--align-center ui-row--xs">
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "20px", color: "var(--color-primary, #3b82f6)" }}
              >
                difference
              </span>
              <strong
                style={{
                  fontSize: "14px",
                  color: "var(--color-text-primary, #0f172a)",
                }}
              >
                Documentos Atualizados da Equipe ({filteredWhatsNewFiles.length})
              </strong>
            </div>

            {filteredWhatsNewFiles.length > 0 && (
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={() => toggleAllWhatsNewFiles(filteredWhatsNewFiles)}
                icon={
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                    {filteredWhatsNewFiles.every((f) => !!expandedWhatsNewFiles[f.path])
                      ? "unfold_less"
                      : "unfold_more"}
                  </span>
                }
              >
                {filteredWhatsNewFiles.every((f) => !!expandedWhatsNewFiles[f.path])
                  ? "Recolher Todos"
                  : "Expandir Todos"}
              </Button>
            )}
          </div>

          {filteredWhatsNewFiles.length === 0 ? (
            <div className="ui-empty-state" style={{ padding: "40px" }}>
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: "32px",
                  color: "var(--color-success, #16a34a)",
                  display: "block",
                  marginBottom: "8px",
                }}
              >
                check_circle
              </span>
              Nenhum documento com este filtro nesta atualização.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {filteredWhatsNewFiles.map((file, idx) => {
                if (!file?.path) return null;
                const isExpanded = !!expandedWhatsNewFiles[file.path];
                const diffText = whatsNewDiffs[file.path] || "";
                const isLoadingDiff = !!loadingWhatsNewDiffs[file.path];

                return (
                  <div
                    key={file.path || idx}
                    style={{
                      borderBottom:
                        "1px solid var(--color-border-subtle, #e2e8f0)",
                      background: isExpanded
                        ? "var(--color-surface-subtle, #f8fafc)"
                        : "transparent",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "14px 20px",
                        cursor: "pointer",
                        userSelect: "none",
                        background: isExpanded
                          ? "var(--color-primary-subtle, #f1f5f9)"
                          : "transparent",
                        transition: "background 0.15s ease",
                      }}
                    >
                      <div
                        onClick={() => toggleWhatsNewFile(file.path)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          minWidth: 0,
                          flex: 1,
                          paddingRight: "16px",
                        }}
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{
                            fontSize: "20px",
                            color: isExpanded
                              ? "var(--color-primary, #1a73e8)"
                              : "var(--color-text-muted, #94a3b8)",
                            transition: "transform 0.2s ease",
                            transform: isExpanded
                              ? "rotate(90deg)"
                              : "rotate(0deg)",
                          }}
                        >
                          chevron_right
                        </span>

                        <span
                          className="material-symbols-outlined"
                          style={{
                            fontSize: "20px",
                            color:
                              file.status === "M"
                                ? "var(--color-warning, #d97706)"
                                : file.status === "A"
                                  ? "var(--color-success, #16a34a)"
                                  : file.status === "D"
                                    ? "var(--color-danger, #dc2626)"
                                    : "var(--color-text-muted, #64748b)",
                          }}
                        >
                          {file.status === "D"
                            ? "delete_outline"
                            : file.status === "A"
                              ? "note_add"
                              : "description"}
                        </span>

                        <span
                          style={{
                            fontFamily: "var(--font-family-mono)",
                            fontSize: "13px",
                            fontWeight: isExpanded ? 600 : 500,
                            color: "var(--color-text-primary, #0f172a)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={file.path}
                        >
                          {file.path}
                        </span>

                        <Badge
                          variant={
                            file.status === "M"
                              ? "warning"
                              : file.status === "A"
                                ? "success"
                                : file.status === "D"
                                  ? "danger"
                                  : "neutral"
                          }
                          size="sm"
                        >
                          {file.statusLabel ||
                            (file.status === "A"
                              ? "Novo Documento"
                              : file.status === "D"
                                ? "Documento Removido"
                                : "Documento Atualizado")}
                        </Badge>
                      </div>

                      <div
                        className="ui-row ui-row--align-center ui-row--sm"
                        style={{ flexShrink: 0 }}
                      >
                        {(file.additions > 0 || file.deletions > 0) && (
                          <div
                            className="ui-row ui-row--xs"
                            style={{
                              fontFamily: "var(--font-family-mono)",
                              fontSize: "12px",
                              marginRight: "8px",
                            }}
                          >
                            {file.additions > 0 && (
                              <span
                                style={{
                                  color: "var(--color-success, #16a34a)",
                                  fontWeight: 600,
                                }}
                              >
                                +{file.additions}
                              </span>
                            )}
                            {file.deletions > 0 && (
                              <span
                                style={{
                                  color: "var(--color-danger, #dc2626)",
                                  fontWeight: 600,
                                }}
                              >
                                -{file.deletions}
                              </span>
                            )}
                          </div>
                        )}

                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenFileClick(file.path);
                          }}
                          title="Abrir este documento no editor"
                          icon={
                            <span
                              className="material-symbols-outlined"
                              style={{ fontSize: "15px" }}
                            >
                              open_in_new
                            </span>
                          }
                        >
                          Abrir Documento
                        </Button>

                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          onClick={() => toggleWhatsNewFile(file.path)}
                        >
                          {isExpanded
                            ? "Ocultar mudanças"
                            : "Ver mudanças"}
                        </Button>
                      </div>
                    </div>

                    {/* Accordion Diff View */}
                    {isExpanded && (
                      <DiffViewer
                        diffText={diffText}
                        isLoading={isLoadingDiff}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Commits List */}
      {whatsNewCommits.length > 0 && (
        <Card variant="elevated" padding="none" style={{ overflow: "hidden" }}>
          <div
            className="ui-card__header"
            onClick={() => setIsWhatsNewCommitsExpanded(!isWhatsNewCommitsExpanded)}
            style={{
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 18px",
              userSelect: "none",
              background: isWhatsNewCommitsExpanded ? "var(--color-surface-subtle, #f8fafc)" : "transparent",
            }}
          >
            <div className="ui-row ui-row--align-center ui-row--xs">
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: "18px",
                  color: "var(--color-text-muted)",
                }}
              >
                history
              </span>
              <strong style={{ fontSize: "14px", color: "var(--color-text-primary, #0f172a)" }}>
                Publicações e Marcos Trazidos pela Atualização ({whatsNewCommits.length})
              </strong>
            </div>

            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                setIsWhatsNewCommitsExpanded(!isWhatsNewCommitsExpanded);
              }}
              icon={
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: "18px",
                    transition: "transform 0.2s ease",
                    transform: isWhatsNewCommitsExpanded ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                >
                  expand_more
                </span>
              }
            >
              {isWhatsNewCommitsExpanded ? "Recolher" : "Ver Marcos"}
            </Button>
          </div>

          {isWhatsNewCommitsExpanded && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                padding: "14px 18px",
              }}
            >
              {whatsNewCommits.map((item, idx) => (
                <div
                  key={idx}
                  className="ui-card ui-card--flat"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    fontSize: "13px",
                  }}
                >
                  <div className="ui-row ui-row--align-center ui-row--xs">
                    <span
                      style={{
                        fontFamily: "var(--font-family-mono)",
                        fontSize: "11px",
                        fontWeight: 600,
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background:
                          "var(--color-surface-subtle, #e2e8f0)",
                        color: "var(--color-text-secondary, #334155)",
                      }}
                    >
                      #
                      {item?.shortHash ||
                        item?.hash?.slice(0, 7) ||
                        "v-atual"}
                    </span>
                    <span
                      style={{
                        fontWeight: 500,
                        color: "var(--color-text-primary, #1e293b)",
                      }}
                    >
                      {item?.message || "Atualização de documentação"}
                    </span>
                  </div>
                  <span
                    className="ui-text-muted"
                    style={{ fontSize: "12px" }}
                  >
                    {item?.author || "Equipe"} &bull; {item?.date || ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
