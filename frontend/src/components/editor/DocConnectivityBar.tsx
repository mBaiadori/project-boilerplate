import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSecurity } from "../../context/SecurityContext";
import { useWorkspace } from "../../context/WorkspaceContext";
import { API } from "../../services/api";
import type { StatusItem, TaxonomyItem } from "../../types";

interface DocConnectivityBarProps {
  filePath: string;
  onNavigateFile: (path: string) => void;
  onCopyDoc?: () => void;
  onExportDoc?: () => void;
  onImportDoc?: () => void;
  isGitMode?: boolean;
  onToggleGitMode?: () => void;
  isHistoryDrawerOpen?: boolean;
  onToggleHistoryDrawer?: () => void;
  onSave?: () => void;
  saveStatus?: string;
  isDirty?: boolean;
}

const TAG_PALETTES: Record<
  string,
  { bg: string; color: string; border: string }
> = {
  rfc: {
    bg: "rgba(99, 102, 241, 0.12)",
    color: "#4f46e5",
    border: "rgba(99, 102, 241, 0.25)",
  },
  prd: {
    bg: "rgba(168, 85, 247, 0.12)",
    color: "#7e22ce",
    border: "rgba(168, 85, 247, 0.25)",
  },
  api: {
    bg: "rgba(14, 165, 233, 0.12)",
    color: "#0284c7",
    border: "rgba(14, 165, 233, 0.25)",
  },
  backend: {
    bg: "rgba(59, 130, 246, 0.12)",
    color: "#2563eb",
    border: "rgba(59, 130, 246, 0.25)",
  },
  frontend: {
    bg: "rgba(236, 72, 153, 0.12)",
    color: "#db2777",
    border: "rgba(236, 72, 153, 0.25)",
  },
  infra: {
    bg: "rgba(234, 88, 12, 0.12)",
    color: "#c2410c",
    border: "rgba(234, 88, 12, 0.25)",
  },
  sipoc: {
    bg: "rgba(20, 184, 166, 0.12)",
    color: "#0f766e",
    border: "rgba(20, 184, 166, 0.25)",
  },
  processos: {
    bg: "rgba(245, 158, 11, 0.12)",
    color: "#d97706",
    border: "rgba(245, 158, 11, 0.25)",
  },
  qualidade: {
    bg: "rgba(16, 185, 129, 0.12)",
    color: "#059669",
    border: "rgba(16, 185, 129, 0.25)",
  },
  security: {
    bg: "rgba(239, 68, 68, 0.12)",
    color: "#dc2626",
    border: "rgba(239, 68, 68, 0.25)",
  },
  database: {
    bg: "rgba(139, 92, 246, 0.12)",
    color: "#6d28d9",
    border: "rgba(139, 92, 246, 0.25)",
  },
};

function getTagStyle(tagName: string, customColor?: string) {
  if (customColor && customColor !== "#3b82f6" && customColor !== "#6366f1") {
    return {
      background: `${customColor}15`,
      color: customColor,
      borderColor: `${customColor}35`,
    };
  }
  const normalized = tagName.toLowerCase().trim();
  if (TAG_PALETTES[normalized]) {
    return {
      background: TAG_PALETTES[normalized].bg,
      color: TAG_PALETTES[normalized].color,
      borderColor: TAG_PALETTES[normalized].border,
    };
  }
  let hash = 0;
  for (let i = 0; i < normalized.length; i++)
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
  const hue = Math.abs(hash) % 360;
  return {
    background: `hsla(${hue}, 70%, 50%, 0.1)`,
    color: `hsl(${hue}, 75%, 38%)`,
    borderColor: `hsla(${hue}, 70%, 50%, 0.25)`,
  };
}

export const DocConnectivityBar: React.FC<DocConnectivityBarProps> = ({
  filePath,
  onNavigateFile,
  onCopyDoc,
  onExportDoc,
  onImportDoc,
  isGitMode = false,
  onToggleGitMode,
  isHistoryDrawerOpen = false,
  onToggleHistoryDrawer,
  onSave,
  saveStatus,
  isDirty = false,
}) => {
  const { fileMetadata, updateFileMetadata, projectMetaOptions } =
    useWorkspace();
  const [contextData, setContextData] = useState<any>(null);
  const [showConsumers, setShowConsumers] = useState(false);
  const [showDeps, setShowDeps] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [newTagInput, setNewTagInput] = useState("");
  const [customCategoryInput, setCustomCategoryInput] = useState("");
  const barRef = useRef<HTMLDivElement>(null);

  const loadContext = React.useCallback(async () => {
    if (!filePath) return;
    try {
      const data = await API.getDocumentContext(filePath);
      setContextData(data);
    } catch (err) {
      console.warn("[DocConnectivityBar] Erro ao carregar contexto:", err);
    }
  }, [filePath]);

  useEffect(() => {
    if (filePath) {
      loadContext();
    }
  }, [filePath, loadContext]);

  // Atualização em tempo real das dependências e consumidores ao salvar documento ou metadados
  useEffect(() => {
    const handleDocumentSaved = (e: any) => {
      const savedPath = e.detail?.filePath;
      if (
        !savedPath ||
        !filePath ||
        savedPath === filePath ||
        savedPath === filePath.split("#")[0] ||
        filePath.startsWith(savedPath)
      ) {
        loadContext();
      }
    };
    window.addEventListener("workspace:document-saved", handleDocumentSaved);
    return () =>
      window.removeEventListener(
        "workspace:document-saved",
        handleDocumentSaved,
      );
  }, [filePath, loadContext]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setShowConsumers(false);
        setShowDeps(false);
        setShowStatusPicker(false);
        setShowCategoryPicker(false);
        setShowTagPicker(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const consumers = contextData?.consumers || [];
  const dependencies = contextData?.dependencies || [];

  // Metadados ativos combinando o contextData com o fileMetadata reativo
  const rawStatus = fileMetadata?.status ?? contextData?.status ?? "";
  const currentStatus = rawStatus && rawStatus !== "-" ? rawStatus : "";

  const rawCat =
    fileMetadata?.categories ||
    fileMetadata?.category ||
    contextData?.categories ||
    contextData?.category ||
    "";
  const currentCategories = rawCat && rawCat !== "-" ? rawCat : "";

  const currentTags: string[] = Array.isArray(fileMetadata?.tags)
    ? fileMetadata.tags
    : [];

  // Opções do projeto
  const statusOptions = useMemo<StatusItem[]>(() => {
    const raw = projectMetaOptions?.statuses || [];
    return raw.map((s: any) => {
      const name = String(s.name || s.key || s.label || "")
        .toLowerCase()
        .replace(/\s+/g, "-");
      const label = String(s.label || name.toUpperCase().replace(/-/g, " "));
      const key = String(s.key || name);
      const color = String(s.color || "#3b82f6");
      return { name, key, label, color };
    });
  }, [projectMetaOptions?.statuses]);

  const categoryOptions = useMemo<TaxonomyItem[]>(() => {
    const raw = projectMetaOptions?.categories || [];
    return raw.map((c: any) =>
      typeof c === "string"
        ? { name: c, color: "#3b82f6" }
        : { name: c.name || "", color: c.color || "#3b82f6" },
    );
  }, [projectMetaOptions?.categories]);

  const availableTags = useMemo<TaxonomyItem[]>(() => {
    const raw = projectMetaOptions?.tags || [];
    return raw.map((t: any) =>
      typeof t === "string"
        ? { name: t, color: "#6366f1" }
        : { name: t.name || "", color: t.color || "#6366f1" },
    );
  }, [projectMetaOptions?.tags]);

  const handleStatusChange = (newStatus: string) => {
    updateFileMetadata({ status: newStatus });
  };

  const handleCategoryChange = (newCat: string) => {
    updateFileMetadata({ categories: newCat });
  };

  const handleAddTag = (tagToAdd: string) => {
    const trimmed = tagToAdd.trim().toLowerCase();
    if (!trimmed || currentTags.includes(trimmed)) return;
    const updated = [...currentTags, trimmed];
    updateFileMetadata({ tags: updated });
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updated = currentTags.filter((t) => t !== tagToRemove);
    updateFileMetadata({ tags: updated });
  };

  const { departments } = useSecurity();

  const currentDeptId = fileMetadata?.department || "";
  const activeDept = departments.find(
    (d) =>
      d.id === currentDeptId ||
      d.folder.toLowerCase() === currentDeptId.toLowerCase(),
  );

  const activeStatusObj = currentStatus
    ? statusOptions.find(
        (s) =>
          (s.name && s.name.toLowerCase() === currentStatus.toLowerCase()) ||
          (s.key && s.key.toLowerCase() === currentStatus.toLowerCase()),
      ) || {
        name: currentStatus,
        key: currentStatus,
        label: currentStatus.toUpperCase().replace(/-/g, " "),
        color: "#64748b",
      }
    : null;

  const activeCatObj = currentCategories
    ? categoryOptions.find(
        (c) =>
          c.name.toLowerCase() ===
            String(currentCategories || "").toLowerCase() ||
          c.name.toLowerCase() ===
            (Array.isArray(currentCategories)
              ? currentCategories[0]
              : ""
            ).toLowerCase(),
      )
    : null;
  const catColor = activeCatObj?.color || "#3b82f6";

  return (
    <div
      ref={barRef}
      className="doc-connectivity-bar"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "5px 16px",
        background: "var(--color-surface-container-lowest, #ffffff)",
        borderBottom: "1px solid var(--color-outline-variant, #e2e8f0)",
        fontSize: "12px",
        position: "relative",
        minHeight: "38px",
      }}
    >
      {/* Left: Status + Categoria + Tags + Departamento + Conectividade */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexWrap: "nowrap",
        }}
      >
        {/* 1. Status Badge & Popover */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => {
              setShowStatusPicker(!showStatusPicker);
              setShowCategoryPicker(false);
              setShowTagPicker(false);
              setShowConsumers(false);
              setShowDeps(false);
            }}
            style={{
              fontSize: "11px",
              padding: "2.5px 8px",
              borderRadius: "4px",
              fontWeight: 600,
              backgroundColor: activeStatusObj
                ? `${activeStatusObj.color}18`
                : "var(--color-surface-container-high, #f1f5f9)",
              color: activeStatusObj
                ? activeStatusObj.color
                : "var(--color-outline, #64748b)",
              border: `1px solid ${
                activeStatusObj
                  ? activeStatusObj.color + "40"
                  : "var(--color-outline-variant, #cbd5e1)"
              }`,
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              cursor: "pointer",
              letterSpacing: "0.02em",
              transition: "all 0.15s ease",
            }}
            title="Clique para alterar o status do documento"
          >
            <span>{activeStatusObj ? activeStatusObj.label : "-"}</span>
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "13px", opacity: 0.7 }}
            >
              expand_more
            </span>
          </button>

          {showStatusPicker && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 5px)",
                left: 0,
                background: "var(--color-surface, #ffffff)",
                border: "1px solid var(--color-outline-variant, #cbd5e1)",
                borderRadius: "8px",
                boxShadow:
                  "0 10px 25px -5px rgba(0,0,0,0.14), 0 8px 10px -6px rgba(0,0,0,0.06)",
                padding: "6px",
                minWidth: "160px",
                zIndex: 120,
                display: "flex",
                flexDirection: "column",
                gap: "3px",
              }}
            >
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  color: "var(--color-outline, #64748b)",
                  padding: "4px 8px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Status do Documento
              </div>

              <button
                type="button"
                onClick={() => {
                  handleStatusChange("");
                  setShowStatusPicker(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "5px 8px",
                  borderRadius: "5px",
                  border: "none",
                  background: !currentStatus
                    ? "var(--color-surface-container, #f1f5f9)"
                    : "transparent",
                  color: "var(--color-outline, #64748b)",
                  cursor: "pointer",
                  fontSize: "11.5px",
                  textAlign: "left",
                  width: "100%",
                }}
                className="dropdown-item-hover"
              >
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "#94a3b8",
                  }}
                />
                <span>- (Sem status)</span>
              </button>

              {statusOptions.map((opt) => {
                const optKey = opt.key || opt.name || "";
                const optName = opt.name || opt.key || "";
                const isSelected =
                  currentStatus.toLowerCase() === optName.toLowerCase() ||
                  currentStatus.toLowerCase() === optKey.toLowerCase();
                return (
                  <button
                    key={optKey || optName}
                    type="button"
                    onClick={() => {
                      handleStatusChange(optKey || optName);
                      setShowStatusPicker(false);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "5px 8px",
                      borderRadius: "5px",
                      border: "none",
                      background: isSelected ? `${opt.color}15` : "transparent",
                      cursor: "pointer",
                      fontSize: "11.5px",
                      textAlign: "left",
                      width: "100%",
                    }}
                    className="dropdown-item-hover"
                  >
                    <span
                      style={{
                        padding: "1.5px 6px",
                        borderRadius: "4px",
                        fontWeight: 600,
                        fontSize: "11px",
                        backgroundColor: `${opt.color}18`,
                        color: opt.color,
                        border: `1px solid ${opt.color}40`,
                      }}
                    >
                      {opt.label || optName.toUpperCase()}
                    </span>
                    {isSelected && (
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: "14px", color: opt.color }}
                      >
                        check
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 2. Categoria Badge & Popover */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => {
              setShowCategoryPicker(!showCategoryPicker);
              setShowStatusPicker(false);
              setShowTagPicker(false);
              setShowConsumers(false);
              setShowDeps(false);
            }}
            style={{
              fontSize: "11px",
              padding: "2.5px 8px",
              borderRadius: "4px",
              fontWeight: 500,
              backgroundColor: currentCategories
                ? `${catColor}18`
                : "var(--color-surface-container-high, #f1f5f9)",
              color: currentCategories
                ? catColor
                : "var(--color-outline, #64748b)",
              border: `1px solid ${
                currentCategories
                  ? catColor + "40"
                  : "var(--color-outline-variant, #cbd5e1)"
              }`,
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            title="Clique para alterar a categoria do documento"
          >
            <span>
              {currentCategories
                ? Array.isArray(currentCategories)
                  ? currentCategories.join(", ")
                  : currentCategories
                : "-"}
            </span>
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "13px", opacity: 0.7 }}
            >
              expand_more
            </span>
          </button>

          {showCategoryPicker && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 5px)",
                left: 0,
                background: "var(--color-surface, #ffffff)",
                border: "1px solid var(--color-outline-variant, #cbd5e1)",
                borderRadius: "8px",
                boxShadow:
                  "0 10px 25px -5px rgba(0,0,0,0.14), 0 8px 10px -6px rgba(0,0,0,0.06)",
                padding: "6px",
                minWidth: "170px",
                zIndex: 120,
                display: "flex",
                flexDirection: "column",
                gap: "3px",
              }}
            >
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  color: "var(--color-outline, #64748b)",
                  padding: "4px 8px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Categoria
              </div>

              <button
                type="button"
                onClick={() => {
                  handleCategoryChange("");
                  setShowCategoryPicker(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "5px 8px",
                  borderRadius: "5px",
                  border: "none",
                  background: !currentCategories
                    ? "var(--color-surface-container, #f1f5f9)"
                    : "transparent",
                  color: "var(--color-outline, #64748b)",
                  cursor: "pointer",
                  fontSize: "11.5px",
                  textAlign: "left",
                  width: "100%",
                }}
                className="dropdown-item-hover"
              >
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "#94a3b8",
                  }}
                />
                <span>- (Sem categoria)</span>
              </button>

              {categoryOptions.map((cat) => (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => {
                    handleCategoryChange(cat.name);
                    setShowCategoryPicker(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "5px 8px",
                    borderRadius: "5px",
                    border: "none",
                    background:
                      currentCategories.toLowerCase() === cat.name.toLowerCase()
                        ? `${cat.color}15`
                        : "transparent",
                    cursor: "pointer",
                    fontSize: "11.5px",
                    textAlign: "left",
                    width: "100%",
                  }}
                  className="dropdown-item-hover"
                >
                  <span
                    style={{
                      padding: "1.5px 6px",
                      borderRadius: "4px",
                      fontWeight: 500,
                      fontSize: "11px",
                      backgroundColor: `${cat.color}18`,
                      color: cat.color,
                      border: `1px solid ${cat.color}40`,
                    }}
                  >
                    {cat.name.toUpperCase()}
                  </span>
                  {currentCategories.toLowerCase() ===
                    cat.name.toLowerCase() && (
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: "14px", color: cat.color }}
                    >
                      check
                    </span>
                  )}
                </button>
              ))}

              {/* Input de categoria customizada */}
              <div
                style={{
                  marginTop: "4px",
                  borderTop: "1px solid var(--color-outline-variant, #f1f5f9)",
                  paddingTop: "4px",
                  display: "flex",
                  gap: "4px",
                }}
              >
                <input
                  type="text"
                  placeholder="Outra..."
                  value={customCategoryInput}
                  onChange={(e) => setCustomCategoryInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customCategoryInput.trim()) {
                      e.preventDefault();
                      handleCategoryChange(customCategoryInput.trim());
                      setCustomCategoryInput("");
                      setShowCategoryPicker(false);
                    }
                  }}
                  style={{
                    fontSize: "11px",
                    padding: "3px 6px",
                    borderRadius: "4px",
                    border: "1px solid var(--color-outline-variant, #cbd5e1)",
                    flex: 1,
                    outline: "none",
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (customCategoryInput.trim()) {
                      handleCategoryChange(customCategoryInput.trim());
                      setCustomCategoryInput("");
                      setShowCategoryPicker(false);
                    }
                  }}
                  style={{
                    padding: "3px 6px",
                    borderRadius: "4px",
                    background: "var(--primary, #2563eb)",
                    color: "#fff",
                    border: "none",
                    fontSize: "11px",
                    cursor: "pointer",
                  }}
                >
                  OK
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 3. Tags Chips & Popover */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            position: "relative",
          }}
        >
          {currentTags.map((tag) => {
            const tagOpt = availableTags.find(
              (t) => t.name.toLowerCase() === tag.toLowerCase(),
            );
            const style = getTagStyle(tag, tagOpt?.color);
            return (
              <span
                key={tag}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "3px",
                  fontSize: "10.5px",
                  padding: "2px 6px",
                  borderRadius: "10px",
                  background: style.background,
                  color: style.color,
                  border: `1px solid ${style.borderColor}`,
                  fontWeight: 600,
                }}
              >
                #{tag}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveTag(tag);
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    color: "inherit",
                    opacity: 0.7,
                  }}
                  title={`Remover #${tag}`}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "11px" }}
                  >
                    close
                  </span>
                </button>
              </span>
            );
          })}

          {/* Botão + Tag */}
          <button
            type="button"
            onClick={() => {
              setShowTagPicker(!showTagPicker);
              setShowStatusPicker(false);
              setShowCategoryPicker(false);
              setShowConsumers(false);
              setShowDeps(false);
            }}
            style={{
              border: "1px dashed var(--color-outline-variant, #cbd5e1)",
              background: showTagPicker
                ? "var(--color-surface-container, #f1f5f9)"
                : "transparent",
              color: "var(--color-outline, #64748b)",
              borderRadius: "10px",
              fontSize: "10.5px",
              padding: "1.5px 6px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "2px",
              fontWeight: 500,
              transition: "all 0.15s ease",
            }}
            title="Adicionar ou selecionar tags"
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "12px" }}
            >
              add
            </span>
            <span>Tag</span>
          </button>

          {showTagPicker && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 5px)",
                left: 0,
                background: "var(--color-surface, #ffffff)",
                border: "1px solid var(--color-outline-variant, #cbd5e1)",
                borderRadius: "8px",
                boxShadow:
                  "0 10px 25px -5px rgba(0,0,0,0.14), 0 8px 10px -6px rgba(0,0,0,0.06)",
                padding: "10px",
                minWidth: "220px",
                maxWidth: "280px",
                zIndex: 120,
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  color: "var(--color-outline, #64748b)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Gerenciar Tags
              </div>

              {/* Input de nova tag */}
              <div style={{ display: "flex", gap: "4px" }}>
                <input
                  type="text"
                  placeholder="Nova tag..."
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newTagInput.trim()) {
                      e.preventDefault();
                      handleAddTag(newTagInput.trim());
                      setNewTagInput("");
                    }
                  }}
                  style={{
                    fontSize: "11px",
                    padding: "3px 6px",
                    borderRadius: "4px",
                    border: "1px solid var(--color-outline-variant, #cbd5e1)",
                    flex: 1,
                    outline: "none",
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newTagInput.trim()) {
                      handleAddTag(newTagInput.trim());
                      setNewTagInput("");
                    }
                  }}
                  disabled={!newTagInput.trim()}
                  style={{
                    padding: "3px 8px",
                    borderRadius: "4px",
                    background: "var(--primary, #2563eb)",
                    color: "#fff",
                    border: "none",
                    fontSize: "11px",
                    cursor: newTagInput.trim() ? "pointer" : "not-allowed",
                    opacity: newTagInput.trim() ? 1 : 0.6,
                  }}
                >
                  +
                </button>
              </div>

              {/* Sugestões do projeto */}
              {availableTags.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "10px",
                      color: "var(--color-outline, #64748b)",
                    }}
                  >
                    Tags configuradas:
                  </span>
                  <div
                    style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}
                  >
                    {availableTags.map((t) => {
                      const isSelected = currentTags.includes(
                        t.name.toLowerCase(),
                      );
                      const style = getTagStyle(t.name, t.color);
                      return (
                        <button
                          key={t.name}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              handleRemoveTag(t.name.toLowerCase());
                            } else {
                              handleAddTag(t.name);
                            }
                          }}
                          style={{
                            border: `1px solid ${
                              isSelected
                                ? style.borderColor
                                : "var(--color-outline-variant, #cbd5e1)"
                            }`,
                            background: isSelected
                              ? style.background
                              : "transparent",
                            color: isSelected
                              ? style.color
                              : "var(--color-outline, #64748b)",
                            borderRadius: "10px",
                            fontSize: "10px",
                            padding: "2px 6px",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "2px",
                            fontWeight: isSelected ? 600 : 400,
                          }}
                        >
                          {isSelected ? "✓" : "+"} #{t.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 4. Departamento Badge */}
        {activeDept && (
          <span
            style={{
              fontSize: "10.5px",
              padding: "2px 8px",
              borderRadius: "12px",
              backgroundColor: activeDept.color + "15",
              borderColor: activeDept.color + "40",
              borderWidth: "1px",
              borderStyle: "solid",
              color: activeDept.color,
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
            title={`Departamento: ${activeDept.name}`}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "12px" }}
            >
              domain
            </span>
            {activeDept.name}
          </span>
        )}

        <div
          style={{
            width: "1px",
            height: "16px",
            background: "var(--color-outline-variant, #e2e8f0)",
            margin: "0 2px",
          }}
        />
        {/* Consumers (Backlinks) */}
        <div style={{ position: "relative" }}>
          <button
            id="btn-doc-consumers"
            type="button"
            className={`btn-icon-action ${showConsumers ? "active" : ""}`}
            onClick={() => {
              setShowConsumers(!showConsumers);
              setShowDeps(false);
              setShowStatusPicker(false);
              setShowCategoryPicker(false);
              setShowTagPicker(false);
            }}
            style={{
              height: "28px",
              width: "auto",
              padding: "0 6px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              borderRadius: "6px",
              border: "1px solid",
              borderColor: showConsumers
                ? "var(--primary, #2563eb)"
                : "var(--color-outline-variant, #e2e8f0)",
              background: showConsumers
                ? "var(--color-primary-container, #eff6ff)"
                : "transparent",
              cursor: "pointer",
              color: showConsumers
                ? "var(--primary, #2563eb)"
                : "var(--color-outline, #64748b)",
              transition: "all 0.15s ease",
            }}
            title="Documentos que referenciam este (Dependentes / Backlinks)"
          >
            <span
              className="material-symbols-outlined icon-xs"
              style={{ fontSize: "16px", color: "blue" }}
            >
              call_received
            </span>
            <span
              style={{
                fontWeight: 600,
                fontSize: "11px",
                lineHeight: 1,
                color: "blue",
              }}
            >
              {consumers.length}
            </span>
          </button>

          {showConsumers && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                background: "var(--color-surface, #ffffff)",
                border: "1px solid var(--color-outline-variant, #cbd5e1)",
                borderRadius: "8px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.16)",
                padding: "8px",
                minWidth: "260px",
                maxWidth: "320px",
                zIndex: 100,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "6px",
                  borderBottom: "1px solid #f1f5f9",
                  paddingBottom: "4px",
                }}
              >
                <strong
                  style={{
                    fontSize: "11px",
                    color: "var(--color-on-surface, #0f172a)",
                  }}
                >
                  Dependentes:
                </strong>
                <span style={{ fontSize: "10px", color: "#94a3b8" }}>
                  {consumers.length}
                </span>
              </div>
              {consumers.length === 0 ? (
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--color-outline, #64748b)",
                    padding: "8px 4px",
                    textAlign: "center",
                  }}
                >
                  Nenhum outro documento aponta para este.
                </div>
              ) : (
                <div
                  style={{
                    maxHeight: "200px",
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: "2px",
                  }}
                >
                  {consumers.map((c: any, i: number) => (
                    <div
                      key={i}
                      onClick={() => {
                        onNavigateFile(c.path || c);
                        setShowConsumers(false);
                      }}
                      style={{
                        padding: "6px 8px",
                        cursor: "pointer",
                        borderRadius: "5px",
                        fontSize: "11.5px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        transition: "background 0.15s",
                      }}
                      className="dropdown-item-hover"
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          overflow: "hidden",
                        }}
                      >
                        <span
                          className="material-symbols-outlined icon-xs"
                          style={{ color: "#64748b" }}
                        >
                          description
                        </span>
                        <span
                          style={{
                            fontWeight: 500,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {c.title || c.path || c}
                        </span>
                      </div>
                      {c.categories && (
                        <span
                          style={{
                            fontSize: "9.5px",
                            padding: "1px 4px",
                            borderRadius: "3px",
                            background: "rgba(0,0,0,0.06)",
                            color: "#64748b",
                            flexShrink: 0,
                          }}
                        >
                          {c.categories}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Dependencies */}
        <div style={{ position: "relative" }}>
          <button
            id="btn-doc-dependencies"
            type="button"
            className={`btn-icon-action ${showDeps ? "active" : ""}`}
            onClick={() => {
              setShowDeps(!showDeps);
              setShowConsumers(false);
              setShowStatusPicker(false);
              setShowCategoryPicker(false);
              setShowTagPicker(false);
            }}
            style={{
              height: "28px",
              width: "auto",
              padding: "0 6px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              borderRadius: "6px",
              border: "1px solid",
              borderColor: showDeps
                ? "var(--primary, #2563eb)"
                : "var(--color-outline-variant, #e2e8f0)",
              background: showDeps
                ? "var(--color-primary-container, #eff6ff)"
                : "transparent",
              cursor: "pointer",
              color: showDeps
                ? "var(--primary, #2563eb)"
                : "var(--color-outline, #64748b)",
              transition: "all 0.15s ease",
            }}
            title="Links e documentos referenciados por este arquivo"
          >
            <span
              className="material-symbols-outlined icon-xs"
              style={{ fontSize: "16px", color: "green" }}
            >
              call_made
            </span>
            <span
              style={{
                fontWeight: 600,
                fontSize: "11px",
                lineHeight: 1,
                color: "green",
              }}
            >
              {dependencies.length}
            </span>
          </button>

          {showDeps && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                background: "var(--color-surface, #ffffff)",
                border: "1px solid var(--color-outline-variant, #cbd5e1)",
                borderRadius: "8px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.16)",
                padding: "8px",
                minWidth: "260px",
                maxWidth: "320px",
                zIndex: 100,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "6px",
                  borderBottom: "1px solid #f1f5f9",
                  paddingBottom: "4px",
                }}
              >
                <strong
                  style={{
                    fontSize: "11px",
                    color: "var(--color-on-surface, #0f172a)",
                  }}
                >
                  Referenciados:
                </strong>
                <span style={{ fontSize: "10px", color: "#94a3b8" }}>
                  {dependencies.length}
                </span>
              </div>
              {dependencies.length === 0 ? (
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--color-outline, #64748b)",
                    padding: "8px 4px",
                    textAlign: "center",
                  }}
                >
                  Nenhum link ou dependência referenciada.
                </div>
              ) : (
                <div
                  style={{
                    maxHeight: "200px",
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: "2px",
                  }}
                >
                  {dependencies.map((d: any, i: number) => (
                    <div
                      key={i}
                      onClick={() => {
                        onNavigateFile(d.path || d.filePath || d);
                        setShowDeps(false);
                      }}
                      style={{
                        padding: "6px 8px",
                        cursor: "pointer",
                        borderRadius: "5px",
                        fontSize: "11.5px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        transition: "background 0.15s",
                      }}
                      className="dropdown-item-hover"
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          overflow: "hidden",
                        }}
                      >
                        <span
                          className="material-symbols-outlined icon-xs"
                          style={{ color: d.hash ? "#2563eb" : "#64748b" }}
                        >
                          {d.hash ? "share_location" : "description"}
                        </span>
                        <span
                          style={{
                            fontWeight: 500,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {d.title || d.path || d}
                        </span>
                      </div>
                      {d.categories && (
                        <span
                          style={{
                            fontSize: "9.5px",
                            padding: "1px 4px",
                            borderRadius: "3px",
                            background: "rgba(0,0,0,0.06)",
                            color: "#64748b",
                            flexShrink: 0,
                          }}
                        >
                          {d.categories}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: Ações do Editor (Copiar, Baixar, Upload, Raw, Histórico, Salvar) */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        {onCopyDoc && (
          <button
            id="btn-copy-doc-full"
            className="btn-icon-action"
            type="button"
            title="Copiar Markdown completo"
            onClick={onCopyDoc}
            style={{
              width: "28px",
              height: "28px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "6px",
              border: "1px solid var(--color-outline-variant, #e2e8f0)",
              background: "transparent",
              cursor: "pointer",
              color: "var(--color-outline, #64748b)",
              transition: "all 0.15s ease",
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
        )}

        {onExportDoc && (
          <button
            id="btn-export-md-file"
            className="btn-icon-action"
            type="button"
            title="Exportar arquivo .md (Baixar)"
            onClick={onExportDoc}
            style={{
              width: "28px",
              height: "28px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "6px",
              border: "1px solid var(--color-outline-variant, #e2e8f0)",
              background: "transparent",
              cursor: "pointer",
              color: "var(--color-outline, #64748b)",
              transition: "all 0.15s ease",
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </button>
        )}

        {onImportDoc && (
          <button
            id="btn-import-doc"
            className="btn-icon-action"
            type="button"
            title="Importar documento (.md ou colar)"
            onClick={onImportDoc}
            style={{
              width: "28px",
              height: "28px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "6px",
              border: "1px solid var(--color-outline-variant, #e2e8f0)",
              background: "transparent",
              cursor: "pointer",
              color: "var(--color-outline, #64748b)",
              transition: "all 0.15s ease",
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
          </button>
        )}

        {onToggleGitMode && (
          <button
            id="btn-toggle-git-mode"
            className={`btn-icon-action ${isGitMode ? "active" : ""}`}
            type="button"
            title={
              isGitMode
                ? "Voltar para Modo de Edição"
                : "Modo Comparativo & Auditoria (Diffs / Raw)"
            }
            onClick={onToggleGitMode}
            style={{
              width: "28px",
              height: "28px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "6px",
              border: "1px solid",
              borderColor: isGitMode
                ? "var(--primary, #2563eb)"
                : "var(--color-outline-variant, #e2e8f0)",
              background: isGitMode
                ? "var(--color-primary-container, #eff6ff)"
                : "transparent",
              cursor: "pointer",
              color: isGitMode
                ? "var(--primary, #2563eb)"
                : "var(--color-outline, #64748b)",
              transition: "all 0.15s ease",
            }}
          >
            <span
              className="material-symbols-outlined icon-xs"
              style={{ fontSize: "16px" }}
            >
              visibility
            </span>
          </button>
        )}

        {onToggleHistoryDrawer && (
          <button
            id="btn-toggle-history-drawer"
            className={`btn-icon-action ${isHistoryDrawerOpen ? "active" : ""}`}
            type="button"
            title="Linha do Tempo de Versões & Auditoria deste documento"
            onClick={onToggleHistoryDrawer}
            style={{
              width: "28px",
              height: "28px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "6px",
              border: "1px solid",
              borderColor: isHistoryDrawerOpen
                ? "var(--primary, #2563eb)"
                : "var(--color-outline-variant, #e2e8f0)",
              background: isHistoryDrawerOpen
                ? "var(--color-primary-container, #eff6ff)"
                : "transparent",
              cursor: "pointer",
              color: isHistoryDrawerOpen
                ? "var(--primary, #2563eb)"
                : "var(--color-outline, #64748b)",
              transition: "all 0.15s ease",
            }}
          >
            <span
              className="material-symbols-outlined icon-xs"
              style={{ fontSize: "16px" }}
            >
              history
            </span>
          </button>
        )}

        {onSave && !isGitMode && (
          <button
            id="btn-save-draft"
            className={`btn-icon-action ${
              saveStatus === "Salvando..."
                ? "is-saving"
                : saveStatus === "Salvo no disco"
                  ? "saved-success"
                  : saveStatus === "Erro"
                    ? "has-error"
                    : isDirty
                      ? "has-unsaved"
                      : ""
            }`}
            type="button"
            title={
              saveStatus === "Salvando..."
                ? "Gravando alterações no disco da máquina..."
                : saveStatus === "Salvo no disco"
                  ? "Salvo no disco com sucesso!"
                  : saveStatus === "Erro"
                    ? "Erro ao gravar no disco. Rascunho preservado."
                    : isDirty
                      ? "Gravando automaticamente no disco (ou clique/Ctrl+S para forçar gravação imediata)"
                      : "Arquivo sincronizado no disco (Ctrl+S)"
            }
            onClick={onSave}
            disabled={saveStatus === "Salvando..."}
            style={{
              height: "28px",
              width: "auto",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "5px",
              padding: "0 6px",
              borderRadius: "6px",
              fontSize: "11.5px",
              cursor: saveStatus === "Salvando..." ? "not-allowed" : "pointer",
              border: "1px solid",
              borderColor:
                saveStatus === "Salvo no disco"
                  ? "rgba(16, 185, 129, 0.4)"
                  : saveStatus === "Erro"
                    ? "rgba(239, 68, 68, 0.4)"
                    : isDirty
                      ? "rgba(37, 99, 235, 0.4)"
                      : "var(--color-outline-variant, #cbd5e1)",
              background:
                saveStatus === "Salvo no disco"
                  ? "rgba(16, 185, 129, 0.08)"
                  : saveStatus === "Erro"
                    ? "rgba(239, 68, 68, 0.08)"
                    : isDirty
                      ? "var(--color-primary-container, #eff6ff)"
                      : "var(--color-surface, #ffffff)",
              color:
                saveStatus === "Salvo no disco"
                  ? "#059669"
                  : saveStatus === "Erro"
                    ? "#dc2626"
                    : isDirty
                      ? "var(--color-primary, #2563eb)"
                      : "var(--color-on-surface, #0f172a)",
              transition: "all 0.15s ease",
            }}
          >
            {saveStatus === "Salvando..." ? (
              <span
                className="material-symbols-outlined icon-xs"
                style={{
                  animation: "spin 1s linear infinite",
                  fontSize: "15px",
                  color: "var(--primary, #2563eb)",
                  flexShrink: 0,
                }}
              >
                progress_activity
              </span>
            ) : saveStatus === "Salvo no disco" ? (
              <span
                className="material-symbols-outlined icon-xs"
                style={{ color: "#10b981", fontSize: "15px", flexShrink: 0 }}
              >
                check
              </span>
            ) : saveStatus === "Erro" ? (
              <span
                className="material-symbols-outlined icon-xs"
                style={{ color: "#ef4444", fontSize: "15px", flexShrink: 0 }}
              >
                error
              </span>
            ) : (
              <span
                className="material-symbols-outlined icon-xs"
                style={{ fontSize: "15px", flexShrink: 0 }}
              >
                save
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
