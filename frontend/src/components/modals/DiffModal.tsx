import React, { useState, useEffect } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { API } from "../../services/api";
import { VisualMarkdownDiff } from "../editor/VisualMarkdownDiff";
import {
  Modal,
  Button,
  IconButton,
  Badge,
  FormField,
  Input,
  Textarea,
} from "../ui";
import {
  Sparkles,
  FileText,
  ChevronDown,
  ChevronRight,
  Trash2,
  Send,
} from "lucide-react";

interface DiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPROpened?: () => void;
}

export const DiffModal: React.FC<DiffModalProps> = ({
  isOpen,
  onClose,
  onPROpened,
}) => {
  const {
    pendingChanges,
    guardrailStatus,
    discardChanges,
    refreshPendingChanges,
    activeRepo,
  } = useWorkspace();
  const [prTitle, setPrTitle] = useState("");
  const [prDesc, setPrDesc] = useState("");
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedDiffs, setExpandedDiffs] = useState<Record<string, boolean>>(
    {},
  );
  const [diffViewMode, setDiffViewMode] = useState<"visual" | "raw">("visual");

  useEffect(() => {
    if (isOpen) {
      setPrTitle(
        `Proposta de Evolução Documental (${pendingChanges.length} arquivos)`,
      );
      setPrDesc("");
    }
  }, [isOpen, pendingChanges.length]);

  if (!isOpen) return null;

  const totalAdditions = pendingChanges.reduce(
    (acc, c) => acc + (c.additions || 0),
    0,
  );
  const totalDeletions = pendingChanges.reduce(
    (acc, c) => acc + (c.deletions || 0),
    0,
  );

  const toggleExpand = (path: string) => {
    setExpandedDiffs((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const handleGenerateSummaryAI = async () => {
    setIsGeneratingSummary(true);
    try {
      const res = await API.generatePRSummaryAI(activeRepo?.name);
      if (res.ok && res.data) {
        if (res.data.title) setPrTitle(res.data.title);
        if (res.data.description) setPrDesc(res.data.description);
      }
    } catch (err) {
      console.error("[DiffModal] Erro ao gerar resumo:", err);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleCreatePR = async () => {
    if (!prTitle.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await API.createUnifiedPR({
        title: prTitle,
        description: prDesc,
        repo: activeRepo?.name,
      });
      if (res.ok) {
        await refreshPendingChanges();
        if (onPROpened) onPROpened();
        onClose();
      }
    } catch (err) {
      console.error("[DiffModal] Erro ao criar proposta:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDiscardAll = async () => {
    if (
      window.confirm(
        "Tem certeza que deseja descartar todas as alterações pendentes no workspace?",
      )
    ) {
      await discardChanges();
      onClose();
    }
  };

  const handleDiscardFile = async (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Descartar alterações em ${path}?`)) {
      await discardChanges(path);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span>Central de Revisão de Alterações</span>
          <Badge
            variant={guardrailStatus === "CLEAN" ? "success" : "warning"}
            size="sm"
          >
            {guardrailStatus === "CLEAN" ? "Conforme" : guardrailStatus}
          </Badge>
        </div>
      }
      subtitle="Revise visualmente o que mudou antes de submeter a proposta para aprovação oficial"
      footer={
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
            alignItems: "center",
          }}
        >
          <Button
            variant="ghost"
            size="sm"
            style={{ color: "var(--md-sys-color-error, #d93025)" }}
            onClick={handleDiscardAll}
            disabled={pendingChanges.length === 0}
          >
            Descartar Todas
          </Button>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Send size={14} />}
              onClick={handleCreatePR}
              isLoading={isSubmitting}
              disabled={pendingChanges.length === 0 || !prTitle.trim()}
            >
              Enviar Proposta para Aprovação
            </Button>
          </div>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Barra de Estatísticas & Alternador de Modo de Visualização */}
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--md-sys-color-surface-container-low, #f8f9fa)",
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid var(--md-sys-color-outline-variant, #dadce0)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FileText
              size={18}
              style={{ color: "var(--md-sys-color-primary, #1a73e8)" }}
            />
            <strong style={{ fontSize: "13.5px" }}>
              {pendingChanges.length} documento(s) com alterações
            </strong>
            <div
              style={{
                display: "flex",
                gap: 8,
                fontSize: "12.5px",
                marginLeft: 8,
              }}
            >
              <span style={{ color: "#137333", fontWeight: 600 }}>
                +{totalAdditions} adições
              </span>
              <span style={{ color: "#c5221f", fontWeight: 600 }}>
                -{totalDeletions} exclusões
              </span>
            </div>
          </div>

          {/* Toggle Visual vs Raw */}
          <div
            style={{
              display: "inline-flex",
              background:
                "var(--md-sys-color-surface-container-highest, #e8eaed)",
              padding: 2,
              borderRadius: 6,
            }}
          >
            <button
              type="button"
              onClick={() => setDiffViewMode("visual")}
              style={{
                padding: "3px 10px",
                border: "none",
                borderRadius: 4,
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                background:
                  diffViewMode === "visual"
                    ? "var(--md-sys-color-surface, #ffffff)"
                    : "transparent",
                color:
                  diffViewMode === "visual"
                    ? "var(--md-sys-color-primary, #1a73e8)"
                    : "var(--md-sys-color-on-surface-variant, #5f6368)",
                boxShadow:
                  diffViewMode === "visual"
                    ? "0 1px 2px rgba(0,0,0,0.1)"
                    : "none",
              }}
            >
              Visual Formatado
            </button>
            <button
              type="button"
              onClick={() => setDiffViewMode("raw")}
              style={{
                padding: "3px 10px",
                border: "none",
                borderRadius: 4,
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                background:
                  diffViewMode === "raw"
                    ? "var(--md-sys-color-surface, #ffffff)"
                    : "transparent",
                color:
                  diffViewMode === "raw"
                    ? "var(--md-sys-color-primary, #1a73e8)"
                    : "var(--md-sys-color-on-surface-variant, #5f6368)",
                boxShadow:
                  diffViewMode === "raw"
                    ? "0 1px 2px rgba(0,0,0,0.1)"
                    : "none",
              }}
            >
              Patch Técnico
            </button>
          </div>
        </div>

        {/* Lista de Diffs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {pendingChanges.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: 32,
                color: "var(--md-sys-color-on-surface-variant, #5f6368)",
              }}
            >
              Nenhuma alteração pendente no workspace.
            </div>
          ) : (
            pendingChanges.map((change) => {
              const isExpanded = expandedDiffs[change.path] !== false;
              return (
                <div
                  key={change.path}
                  style={{
                    border:
                      "1px solid var(--md-sys-color-outline-variant, #dadce0)",
                    borderRadius: 8,
                    overflow: "hidden",
                    background: "var(--md-sys-color-surface, #ffffff)",
                  }}
                >
                  <div
                    onClick={() => toggleExpand(change.path)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      background:
                        "var(--md-sys-color-surface-container-low, #f8f9fa)",
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      {isExpanded ? (
                        <ChevronDown size={16} />
                      ) : (
                        <ChevronRight size={16} />
                      )}
                      <span
                        style={{
                          fontFamily:
                            "var(--md-sys-typescale-font-code, monospace)",
                          fontSize: "13px",
                          fontWeight: 600,
                        }}
                      >
                        {change.path}
                      </span>
                      <Badge
                        variant={
                          change.type === "ADDED"
                            ? "success"
                            : change.type === "DELETED"
                              ? "danger"
                              : "primary"
                        }
                        size="sm"
                      >
                        {change.type === "ADDED"
                          ? "NOVO"
                          : change.type === "DELETED"
                            ? "REMOVIDO"
                            : "ALTERADO"}
                      </Badge>
                    </div>
                    <IconButton
                      size="sm"
                      tooltip="Descartar este arquivo"
                      onClick={(e) => handleDiscardFile(change.path, e)}
                    >
                      <Trash2
                        size={14}
                        style={{ color: "var(--md-sys-color-error, #d93025)" }}
                      />
                    </IconButton>
                  </div>

                  {isExpanded && (
                    <div
                      style={{
                        borderTop:
                          "1px solid var(--md-sys-color-outline-variant, #dadce0)",
                      }}
                    >
                      {diffViewMode === "visual" ? (
                        <div style={{ maxHeight: 380, overflowY: "auto" }}>
                          <VisualMarkdownDiff
                            oldContent={change.old_content || ""}
                            newContent={change.new_content || ""}
                            fileName={change.path}
                          />
                        </div>
                      ) : (
                        <pre
                          style={{
                            margin: 0,
                            padding: 12,
                            fontSize: "12px",
                            fontFamily:
                              "var(--md-sys-typescale-font-code, monospace)",
                            background: "#0f172a",
                            color: "#f8fafc",
                            overflowX: "auto",
                            maxHeight: 300,
                            lineHeight: "1.5",
                          }}
                        >
                          {change.diff_text ||
                            change.diff ||
                            "Sem patch de código"}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Metadados da Proposta */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <FormField
            label="Título da Proposta de Evolução:"
            required
            helperText={
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: 2,
                }}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  leftIcon={<Sparkles size={13} />}
                  onClick={handleGenerateSummaryAI}
                  isLoading={isGeneratingSummary}
                  disabled={
                    isGeneratingSummary || pendingChanges.length === 0
                  }
                >
                  Resumo Automático por IA
                </Button>
              </div>
            }
          >
            <Input
              id="unified-pr-title-input"
              value={prTitle}
              onChange={(e) => setPrTitle(e.target.value)}
              placeholder="Descreva o objetivo desta proposta..."
            />
          </FormField>

          <FormField label="Descrição & Justificativa:">
            <Textarea
              id="unified-pr-desc-input"
              rows={3}
              value={prDesc}
              onChange={(e) => setPrDesc(e.target.value)}
              placeholder="Detalhes adicionais, contexto ou instruções para os revisores..."
            />
          </FormField>
        </div>
      </div>
    </Modal>
  );
};
