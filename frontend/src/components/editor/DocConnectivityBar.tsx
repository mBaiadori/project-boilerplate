import React, { useState, useEffect, useRef, useMemo } from "react";
import { API } from "../../services/api";
import { useWorkspace } from "../../context/WorkspaceContext";
import { useSecurity } from "../../context/SecurityContext";
import { Shield } from "lucide-react";
import type { TaxonomyItem, StatusItem } from "../../types";

interface DocConnectivityBarProps {
  filePath: string;
  onNavigateFile: (path: string) => void;
}

const TAG_PALETTES: Record<string, { bg: string; color: string; border: string }> = {
  rfc: { bg: 'rgba(99, 102, 241, 0.12)', color: '#4f46e5', border: 'rgba(99, 102, 241, 0.25)' },
  prd: { bg: 'rgba(168, 85, 247, 0.12)', color: '#7e22ce', border: 'rgba(168, 85, 247, 0.25)' },
  api: { bg: 'rgba(14, 165, 233, 0.12)', color: '#0284c7', border: 'rgba(14, 165, 233, 0.25)' },
  backend: { bg: 'rgba(59, 130, 246, 0.12)', color: '#2563eb', border: 'rgba(59, 130, 246, 0.25)' },
  frontend: { bg: 'rgba(236, 72, 153, 0.12)', color: '#db2777', border: 'rgba(236, 72, 153, 0.25)' },
  infra: { bg: 'rgba(234, 88, 12, 0.12)', color: '#c2410c', border: 'rgba(234, 88, 12, 0.25)' },
  sipoc: { bg: 'rgba(20, 184, 166, 0.12)', color: '#0f766e', border: 'rgba(20, 184, 166, 0.25)' },
  processos: { bg: 'rgba(245, 158, 11, 0.12)', color: '#d97706', border: 'rgba(245, 158, 11, 0.25)' },
  qualidade: { bg: 'rgba(16, 185, 129, 0.12)', color: '#059669', border: 'rgba(16, 185, 129, 0.25)' },
  security: { bg: 'rgba(239, 68, 68, 0.12)', color: '#dc2626', border: 'rgba(239, 68, 68, 0.25)' },
  database: { bg: 'rgba(139, 92, 246, 0.12)', color: '#6d28d9', border: 'rgba(139, 92, 246, 0.25)' },
};

function getTagStyle(tagName: string, customColor?: string) {
  if (customColor && customColor !== '#3b82f6' && customColor !== '#6366f1') {
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
  for (let i = 0; i < normalized.length; i++) hash = (hash << 5) - hash + normalized.charCodeAt(i);
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
}) => {
  const { fileMetadata, updateFileMetadata, projectMetaOptions } = useWorkspace();
  const [contextData, setContextData] = useState<any>(null);
  const [showConsumers, setShowConsumers] = useState(false);
  const [showDeps, setShowDeps] = useState(false);
  const [showProperties, setShowProperties] = useState(false);
  const [newTagInput, setNewTagInput] = useState("");
  const [newApproverInput, setNewApproverInput] = useState("");
  const barRef = useRef<HTMLDivElement>(null);
  const propDropdownRef = useRef<HTMLDivElement>(null);

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
      if (!savedPath || !filePath || savedPath === filePath || savedPath === filePath.split('#')[0] || filePath.startsWith(savedPath)) {
        loadContext();
      }
    };
    window.addEventListener("workspace:document-saved", handleDocumentSaved);
    return () => window.removeEventListener("workspace:document-saved", handleDocumentSaved);
  }, [filePath, loadContext]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setShowConsumers(false);
        setShowDeps(false);
        setShowProperties(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const cleanPath = filePath.split('#')[0];
  const segments = cleanPath.split("/").filter(Boolean);
  const consumers = contextData?.consumers || [];
  const dependencies = contextData?.dependencies || [];
  
  // Metadados ativos combinando o contextData com o fileMetadata reativo
  const currentTitle = fileMetadata?.title || contextData?.title || "";
  const currentStatus = fileMetadata?.status || contextData?.status || "draft";
  const currentCategories = fileMetadata?.categories || fileMetadata?.category || contextData?.categories || contextData?.category || "";
  const currentTags: string[] = Array.isArray(fileMetadata?.tags) ? fileMetadata.tags : [];
  const currentApprovers: string[] = Array.isArray(fileMetadata?.approvers) ? fileMetadata.approvers : [];
  const currentId = fileMetadata?.id || "";
  const currentTemplateId = fileMetadata?.templateId || fileMetadata?.template || contextData?.templateId || contextData?.template || "";
  const currentUpdatedAt = fileMetadata?.updated_at || "";

  // Opções do projeto
  const statusOptions = useMemo<StatusItem[]>(() => {
    const raw = projectMetaOptions?.statuses || [];
    return raw.map((s: any) => {
      const name = String(s.name || s.key || s.label || "").toLowerCase().replace(/\s+/g, "-");
      const label = s.label || name.toUpperCase().replace(/-/g, " ");
      const key = s.key || name;
      const color = s.color || "#3b82f6";
      return { name, key, label, color };
    });
  }, [projectMetaOptions?.statuses]);

  const categoryOptions = useMemo<TaxonomyItem[]>(() => {
    const raw = projectMetaOptions?.categories || [];
    return raw.map((c: any) =>
      typeof c === "string" ? { name: c, color: "#3b82f6" } : { name: c.name || "", color: c.color || "#3b82f6" }
    );
  }, [projectMetaOptions?.categories]);

  const availableTags = useMemo<TaxonomyItem[]>(() => {
    const raw = projectMetaOptions?.tags || [];
    return raw.map((t: any) =>
      typeof t === "string" ? { name: t, color: "#6366f1" } : { name: t.name || "", color: t.color || "#6366f1" }
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
    setNewTagInput("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updated = currentTags.filter((t) => t !== tagToRemove);
    updateFileMetadata({ tags: updated });
  };

  const handleAddApprover = () => {
    const trimmed = newApproverInput.trim();
    if (!trimmed || currentApprovers.includes(trimmed)) return;
    const updated = [...currentApprovers, trimmed];
    updateFileMetadata({ approvers: updated });
    setNewApproverInput("");
  };

  const handleRemoveApprover = (approverToRemove: string) => {
    const updated = currentApprovers.filter((a) => a !== approverToRemove);
    updateFileMetadata({ approvers: updated });
  };

  const { securityLevels, departments } = useSecurity();

  const currentDeptId = fileMetadata?.department || "";
  const activeDept = departments.find(
    (d) => d.id === currentDeptId || d.folder.toLowerCase() === currentDeptId.toLowerCase()
  );

  const activeStatusObj = statusOptions.find((s) => s.name === currentStatus || s.key === currentStatus) || {
    name: currentStatus,
    key: currentStatus,
    label: currentStatus ? currentStatus.toUpperCase().replace(/-/g, " ") : "DRAFT",
    color: "#64748b",
  };

  const currentSecLevelId =
    fileMetadata?.security_level_id ||
    (fileMetadata?.security_level !== undefined
      ? securityLevels.find((l) => l.rank === Number(fileMetadata.security_level))?.id
      : "public") ||
    "public";

  const activeSecLevel =
    securityLevels.find(
      (l) => l.id === currentSecLevelId || l.rank === Number(fileMetadata?.security_level)
    ) ||
    securityLevels.find((l) => l.id === "public") ||
    securityLevels[securityLevels.length - 1];

  return (
    <div
      ref={barRef}
      className="doc-connectivity-bar"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 16px",
        background: "var(--color-surface-container-lowest, #ffffff)",
        borderBottom: "1px solid var(--color-outline-variant, #e2e8f0)",
        fontSize: "12px",
        position: "relative",
      }}
    >
      {/* Left: Status + Categoria + Nível de Segurança + Departamento + Breadcrumbs */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {/* Status Badge */}
        <span
          className={`badge ${
            currentStatus === "approved"
              ? "badge-success-subtle"
              : currentStatus === "review"
              ? "badge-info-subtle"
              : currentStatus === "proposed"
              ? "badge-warning-subtle"
              : "badge-neutral-subtle"
          }`}
          style={{ fontSize: "10.5px", padding: "2px 7px", borderRadius: "4px", fontWeight: 600 }}
          title={`Status de governança: ${activeStatusObj.label}`}
        >
          {activeStatusObj.key ? activeStatusObj.key.toUpperCase() : "DRAFT"}
        </span>

        {/* Categoria Badge */}
        {currentCategories && (
          <span
            className="badge badge-primary-subtle"
            style={{ fontSize: "10.5px", padding: "2px 7px", borderRadius: "4px" }}
            title="Categoria funcional do documento"
          >
            {currentCategories}
          </span>
        )}

        {/* Nível de Segurança Badge */}
        {activeSecLevel && (
          <span
            style={{
              fontSize: "10.5px",
              padding: "2px 8px",
              borderRadius: "12px",
              backgroundColor: activeSecLevel.color + "15",
              borderColor: activeSecLevel.color + "40",
              borderWidth: "1px",
              borderStyle: "solid",
              color: activeSecLevel.color,
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              cursor: "pointer",
            }}
            onClick={() => setShowProperties(true)}
            title={`Nível de Segurança: ${activeSecLevel.name} (Rank ${activeSecLevel.rank}) - Clique para gerenciar`}
          >
            <Shield size={11} />
            {activeSecLevel.name}
          </span>
        )}

        {/* Departamento Badge */}
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
              cursor: "pointer",
            }}
            onClick={() => setShowProperties(true)}
            title={`Departamento: ${activeDept.name} (Pasta padrão: ${activeDept.folder}) - Clique para gerenciar`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>
              domain
            </span>
            {activeDept.name}
          </span>
        )}

        {/* Breadcrumb Path */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            color: "var(--color-outline, #64748b)",
          }}
        >
          {segments.map((seg, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span style={{ opacity: 0.5 }}>/</span>}
              <span
                style={{
                  fontWeight: idx === segments.length - 1 ? 600 : 400,
                  color:
                    idx === segments.length - 1
                      ? "var(--color-on-surface, #0f172a)"
                      : "var(--color-outline, #64748b)",
                }}
              >
                {seg}
              </span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Right: Propriedades (Dropdown), Consumidores & Dependências */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        
        {/* 1. Botão Dropdown / Popover de Propriedades (Metadados) */}
        <div style={{ position: "relative" }} ref={propDropdownRef}>
          <button
            id="btn-doc-properties-dropdown"
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => {
              setShowProperties(!showProperties);
              setShowConsumers(false);
              setShowDeps(false);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              fontSize: "11px",
              fontWeight: 500,
              background: showProperties ? "var(--color-surface-container, #f1f5f9)" : "transparent",
              color: showProperties ? "var(--primary, #2563eb)" : "inherit",
              borderRadius: "5px",
              padding: "4px 8px",
            }}
            title="Gerenciar propriedades do documento"
          >
            <span className="material-symbols-outlined icon-xs" style={{ color: "#2563eb", fontSize: "15px" }}>
              tune
            </span>
            <span>Propriedades</span>
            {currentTags.length > 0 && (
              <span
                style={{
                  fontWeight: 600,
                  background: "rgba(37,99,235,0.1)",
                  color: "#2563eb",
                  padding: "0 5px",
                  borderRadius: "8px",
                  fontSize: "9.5px",
                }}
              >
                {currentTags.length}
              </span>
            )}
            <span className="material-symbols-outlined icon-xs" style={{ fontSize: "14px", opacity: 0.7 }}>
              {showProperties ? "expand_less" : "expand_more"}
            </span>
          </button>

          {/* Painel Flutuante de Propriedades */}
          {showProperties && (
            <div
              id="doc-properties-popover"
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                background: "var(--color-surface, #ffffff)",
                border: "1px solid var(--color-outline-variant, #cbd5e1)",
                borderRadius: "10px",
                boxShadow: "0 12px 32px rgba(0,0,0,0.14)",
                padding: "14px 16px",
                minWidth: "350px",
                maxWidth: "390px",
                zIndex: 110,
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                animation: "fadeIn 0.15s ease-out",
              }}
            >
              {/* Header do Popover */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--color-outline-variant, #f1f5f9)", paddingBottom: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span className="material-symbols-outlined icon-xs" style={{ color: "var(--primary, #2563eb)" }}>
                    tune
                  </span>
                  <strong style={{ fontSize: "12.5px", color: "var(--color-on-surface, #0f172a)" }}>
                    Propriedades
                  </strong>
                </div>
                {currentTemplateId && (
                  <span
                    style={{
                      fontSize: "10px",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      background: "rgba(37,99,235,0.08)",
                      color: "#2563eb",
                      fontWeight: 600,
                    }}
                    title="Template base do documento"
                  >
                    Template: {currentTemplateId}
                  </span>
                )}
              </div>

              {/* Título do Documento */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-outline, #64748b)" }}>Título</span>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Título do documento..."
                  value={currentTitle}
                  onChange={(e) => updateFileMetadata({ title: e.target.value })}
                  style={{ fontSize: "12px", padding: "6px 8px", borderRadius: "5px", border: "1px solid var(--color-outline-variant, #cbd5e1)" }}
                />
              </div>

              {/* Nível de Segurança & Departamento em linha */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                {/* Nível de Segurança */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-outline, #64748b)" }}>
                    Nível de Segurança
                  </span>
                  <select
                    className="form-select"
                    value={activeSecLevel?.id || "public"}
                    onChange={(e) => {
                      const chosen = securityLevels.find((l) => l.id === e.target.value);
                      if (chosen) {
                        updateFileMetadata({
                          security_level: chosen.rank,
                          security_level_id: chosen.id,
                          level: chosen.rank,
                        });
                      }
                    }}
                    style={{
                      fontSize: "11.5px",
                      padding: "5px 8px",
                      borderRadius: "5px",
                      border: `1px solid ${activeSecLevel ? activeSecLevel.color + "60" : "var(--color-outline-variant, #cbd5e1)"}`,
                      background: "#fff",
                      color: activeSecLevel?.color || "#0f172a",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    {securityLevels.map((lvl) => (
                      <option key={lvl.id} value={lvl.id} style={{ color: "#0f172a" }}>
                        {lvl.name} (Rank {lvl.rank})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Departamento */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-outline, #64748b)" }}>
                    Departamento
                  </span>
                  <select
                    className="form-select"
                    value={currentDeptId}
                    onChange={(e) => {
                      updateFileMetadata({
                        department: e.target.value || undefined,
                      });
                    }}
                    style={{
                      fontSize: "11.5px",
                      padding: "5px 8px",
                      borderRadius: "5px",
                      border: `1px solid ${activeDept ? activeDept.color + "60" : "var(--color-outline-variant, #cbd5e1)"}`,
                      background: "#fff",
                      color: activeDept?.color || "#0f172a",
                      cursor: "pointer",
                      fontWeight: 500,
                    }}
                  >
                    <option value="">(Automático / Pasta)</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id} style={{ color: "#0f172a" }}>
                        {dept.name} ({dept.folder})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status & Categoria em linha */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                {/* Status */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-outline, #64748b)" }}>Status</span>
                  <select
                    className="form-select"
                    value={currentStatus}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    style={{
                      fontSize: "11.5px",
                      padding: "5px 8px",
                      borderRadius: "5px",
                      border: "1px solid var(--color-outline-variant, #cbd5e1)",
                      background: "#fff",
                      cursor: "pointer",
                      fontWeight: 500,
                    }}
                  >
                    {statusOptions.map((opt) => (
                      <option key={opt.name || opt.key || ""} value={opt.name || opt.key || ""}>
                        {opt.label || (opt.name ? opt.name.toUpperCase() : (opt.key ? opt.key.toUpperCase() : ""))}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Categoria */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-outline, #64748b)" }}>Categoria</span>
                  <select
                    className="form-select"
                    value={currentCategories}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    style={{
                      fontSize: "11.5px",
                      padding: "5px 8px",
                      borderRadius: "5px",
                      border: "1px solid var(--color-outline-variant, #cbd5e1)",
                      background: "#fff",
                      cursor: "pointer",
                      fontWeight: 500,
                    }}
                  >
                    <option value="">(Nenhuma)</option>
                    {categoryOptions.map((cat) => (
                      <option key={cat.name} value={cat.name}>
                        {cat.name.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tags */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-outline, #64748b)" }}>Tags</span>
                
                {/* Chips de tags ativas com cores */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", minHeight: "26px", alignItems: "center" }}>
                  {currentTags.length === 0 ? (
                    <span style={{ fontSize: "11px", color: "#94a3b8", fontStyle: "italic" }}>
                      Nenhuma tag atribuída.
                    </span>
                  ) : (
                    currentTags.map((tag) => {
                      const tagOpt = availableTags.find((t) => t.name === tag);
                      const style = getTagStyle(tag, tagOpt?.color);
                      return (
                        <span
                          key={tag}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "11px",
                            padding: "2px 7px",
                            borderRadius: "12px",
                            background: style.background,
                            color: style.color,
                            border: `1px solid ${style.borderColor}`,
                            fontWeight: 600,
                          }}
                        >
                          #{tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
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
                            <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>
                              close
                            </span>
                          </button>
                        </span>
                      );
                    })
                  )}
                </div>

                {/* Sugestões rápidas de tags do projeto (.project.json) */}
                {availableTags.filter((t) => !currentTags.includes(t.name)).length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", alignItems: "center", marginTop: "2px" }}>
                    <span style={{ fontSize: "10px", color: "#94a3b8", marginRight: "2px" }}>Sugeridas:</span>
                    {availableTags
                      .filter((t) => !currentTags.includes(t.name))
                      .slice(0, 7)
                      .map((t) => {
                        const style = getTagStyle(t.name, t.color);
                        return (
                          <button
                            key={t.name}
                            type="button"
                            onClick={() => handleAddTag(t.name)}
                            style={{
                              border: `1px dashed ${style.borderColor}`,
                              background: "transparent",
                              color: style.color,
                              borderRadius: "10px",
                              fontSize: "10px",
                              padding: "1px 6px",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "2px",
                              fontWeight: 500,
                              transition: "all 0.15s",
                            }}
                            title={`Adicionar #${t.name}`}
                          >
                            +{t.name}
                          </button>
                        );
                      })}
                  </div>
                )}

                {/* Input para adicionar nova tag */}
                <div style={{ display: "flex", gap: "4px", marginTop: "2px" }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Adicionar tag..."
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTag(newTagInput);
                      }
                    }}
                    style={{ fontSize: "11px", padding: "4px 7px", borderRadius: "4px", flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    onClick={() => handleAddTag(newTagInput)}
                    disabled={!newTagInput.trim()}
                  >
                    Adicionar
                  </button>
                </div>
              </div>

              {/* Aprovadores (Approvers) */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-outline, #64748b)" }}>Aprovadores</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", minHeight: "22px", alignItems: "center" }}>
                  {currentApprovers.length === 0 ? (
                    <span style={{ fontSize: "11px", color: "#94a3b8", fontStyle: "italic" }}>
                      Nenhum aprovador atribuído.
                    </span>
                  ) : (
                    currentApprovers.map((appr) => (
                      <span
                        key={appr}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "3px",
                          fontSize: "10.5px",
                          padding: "2px 7px",
                          borderRadius: "12px",
                          background: "rgba(16,185,129,0.1)",
                          color: "#047857",
                          fontWeight: 500,
                        }}
                      >
                        @{appr}
                        <button
                          type="button"
                          onClick={() => handleRemoveApprover(appr)}
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            padding: 0,
                            display: "inline-flex",
                            alignItems: "center",
                            color: "#94a3b8",
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>
                            close
                          </span>
                        </button>
                      </span>
                    ))
                  )}
                </div>
                <div style={{ display: "flex", gap: "4px" }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Adicionar @revisor..."
                    value={newApproverInput}
                    onChange={(e) => setNewApproverInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddApprover();
                      }
                    }}
                    style={{ fontSize: "11px", padding: "4px 7px", borderRadius: "4px", flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    onClick={handleAddApprover}
                    disabled={!newApproverInput.trim()}
                  >
                    Adicionar
                  </button>
                </div>
              </div>

              {/* Template ID */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-outline, #64748b)" }}>Template ID</span>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Identificador de template (ex: sipoc, rfc)..."
                    value={currentTemplateId}
                    onChange={(e) => updateFileMetadata({ templateId: e.target.value })}
                    style={{ fontSize: "11px", padding: "4px 7px", borderRadius: "4px", flex: 1, fontFamily: "monospace" }}
                  />
                </div>
              </div>

              {/* Informações do Sistema (Minimalista) */}
              <div
                style={{
                  background: "var(--color-surface-container-low, #f8fafc)",
                  borderRadius: "6px",
                  padding: "7px 10px",
                  fontSize: "10.5px",
                  color: "#64748b",
                  display: "flex",
                  flexDirection: "column",
                  gap: "3px",
                  border: "1px solid var(--color-outline-variant, #f1f5f9)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span><strong>ID: </strong><code>{currentId || "auto"}</code></span>
                  <span>{dependencies.length} deps &bull; {consumers.length} cons</span>
                </div>
                {currentUpdatedAt && (
                  <div>
                    <span><strong>Atualizado: </strong>{new Date(currentUpdatedAt).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 2. Consumers (Backlinks) */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => {
              setShowConsumers(!showConsumers);
              setShowDeps(false);
              setShowProperties(false);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "11px",
              background: showConsumers ? "var(--color-surface-container, #f1f5f9)" : "transparent",
            }}
          >
            <span className="material-symbols-outlined icon-xs" style={{ color: "#2563eb" }}>
              call_received
            </span>
            <span>Consumidores</span>
            <span
              style={{
                fontWeight: 700,
                background: consumers.length > 0 ? "rgba(37,99,235,0.12)" : "rgba(0,0,0,0.06)",
                color: consumers.length > 0 ? "#2563eb" : "inherit",
                padding: "1px 5px",
                borderRadius: "10px",
                fontSize: "10px",
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
                right: 0,
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
                <strong style={{ fontSize: "11px", color: "var(--color-on-surface, #0f172a)" }}>
                  Documentos Dependentes (Backlinks):
                </strong>
                <span style={{ fontSize: "10px", color: "#94a3b8" }}>{consumers.length}</span>
              </div>
              {consumers.length === 0 ? (
                <div style={{ fontSize: "11px", color: "var(--color-outline, #64748b)", padding: "8px 4px", textAlign: "center" }}>
                  Nenhum outro documento aponta para este.
                </div>
              ) : (
                <div style={{ maxHeight: "200px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "2px" }}>
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
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden" }}>
                        <span className="material-symbols-outlined icon-xs" style={{ color: "#64748b" }}>
                          description
                        </span>
                        <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {c.title || c.path || c}
                        </span>
                      </div>
                      {c.categories && (
                        <span style={{ fontSize: "9.5px", padding: "1px 4px", borderRadius: "3px", background: "rgba(0,0,0,0.06)", color: "#64748b", flexShrink: 0 }}>
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

        {/* 3. Dependencies */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => {
              setShowDeps(!showDeps);
              setShowConsumers(false);
              setShowProperties(false);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "11px",
              background: showDeps ? "var(--color-surface-container, #f1f5f9)" : "transparent",
            }}
          >
            <span className="material-symbols-outlined icon-xs" style={{ color: "#16a34a" }}>
              call_made
            </span>
            <span>Dependências</span>
            <span
              style={{
                fontWeight: 700,
                background: dependencies.length > 0 ? "rgba(22,163,74,0.12)" : "rgba(0,0,0,0.06)",
                color: dependencies.length > 0 ? "#16a34a" : "inherit",
                padding: "1px 5px",
                borderRadius: "10px",
                fontSize: "10px",
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
                right: 0,
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
                <strong style={{ fontSize: "11px", color: "var(--color-on-surface, #0f172a)" }}>
                  Contratos Requeridos (Links de Saída):
                </strong>
                <span style={{ fontSize: "10px", color: "#94a3b8" }}>{dependencies.length}</span>
              </div>
              {dependencies.length === 0 ? (
                <div style={{ fontSize: "11px", color: "var(--color-outline, #64748b)", padding: "8px 4px", textAlign: "center" }}>
                  Nenhum link ou dependência referenciada.
                </div>
              ) : (
                <div style={{ maxHeight: "200px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "2px" }}>
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
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden" }}>
                        <span className="material-symbols-outlined icon-xs" style={{ color: d.hash ? "#2563eb" : "#64748b" }}>
                          {d.hash ? "share_location" : "description"}
                        </span>
                        <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {d.title || d.path || d}
                        </span>
                      </div>
                      {d.categories && (
                        <span style={{ fontSize: "9.5px", padding: "1px 4px", borderRadius: "3px", background: "rgba(0,0,0,0.06)", color: "#64748b", flexShrink: 0 }}>
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
    </div>
  );
};
