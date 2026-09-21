import React, { useState, useEffect, useRef } from "react";
import { API } from "../../services/api";
import { useWorkspace } from "../../context/WorkspaceContext";

interface DocConnectivityBarProps {
  filePath: string;
  onNavigateFile: (path: string) => void;
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

  useEffect(() => {
    if (filePath) {
      loadContext();
    }
  }, [filePath]);

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

  const loadContext = async () => {
    try {
      const data = await API.getDocumentContext(filePath);
      setContextData(data);
    } catch (err) {
      console.warn("[DocConnectivityBar] Erro ao carregar contexto:", err);
    }
  };

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
  const currentUpdatedAt = fileMetadata?.updated_at || "";

  // Opções do projeto
  const statusOptions = projectMetaOptions?.statuses || [
    { key: "draft", label: "Rascunho (DRAFT)", badge: "badge-neutral" },
    { key: "proposed", label: "Proposto (PROPOSED)", badge: "badge-warning" },
    { key: "review", label: "Em Revisão (REVIEW)", badge: "badge-info" },
    { key: "approved", label: "Aprovado (APPROVED)", badge: "badge-success" },
    { key: "superseded", label: "Substituído (SUPERSEDED)", badge: "badge-secondary" },
    { key: "deprecated", label: "Obsoleto (DEPRECATED)", badge: "badge-danger" },
  ];

  const categoryOptions = projectMetaOptions?.categories || [
    "geral",
    "arquitetura",
    "engenharia",
    "produto",
    "segurança",
    "infraestrutura",
    "dados",
  ];

  const availableTags = projectMetaOptions?.tags || [
    "backend", "frontend", "api", "database", "security", "core", "auth", "mobile", "spec"
  ];

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

  const activeStatusObj = statusOptions.find((s) => s.key === currentStatus) || {
    key: currentStatus,
    label: currentStatus ? currentStatus.toUpperCase() : "DRAFT",
    badge: "badge-neutral-subtle",
  };

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
      {/* Left: Status + Categoria + Breadcrumbs */}
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
            title="Gerenciar e editar metadados do documento (.docs.metadata.json)"
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

          {/* Painel Flutuante de Metadados */}
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
                boxShadow: "0 12px 32px rgba(0,0,0,0.18)",
                padding: "14px 16px",
                minWidth: "340px",
                maxWidth: "380px",
                zIndex: 110,
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                animation: "fadeIn 0.15s ease-out",
              }}
            >
              {/* Header do Popover */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span className="material-symbols-outlined icon-xs" style={{ color: "var(--primary, #2563eb)" }}>
                    tune
                  </span>
                  <strong style={{ fontSize: "12.5px", color: "var(--color-on-surface, #0f172a)" }}>
                    Metadados do Documento
                  </strong>
                </div>
                <span style={{ fontSize: "10px", color: "#94a3b8" }}>.docs.metadata.json</span>
              </div>

              {/* Título do Documento */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748b" }}>Título Cadastrado:</span>
                  <span
                    style={{
                      fontSize: "10px",
                      padding: "1px 5px",
                      borderRadius: "4px",
                      background: currentTitle ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                      color: currentTitle ? "#10b981" : "#ef4444",
                      fontWeight: 600,
                    }}
                  >
                    {currentTitle ? "Título Definido" : "Sem Título"}
                  </span>
                </div>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Defina o título do documento..."
                  value={currentTitle}
                  onChange={(e) => updateFileMetadata({ title: e.target.value })}
                  style={{ fontSize: "12px", padding: "6px 8px", borderRadius: "5px", border: "1px solid #cbd5e1" }}
                />
              </div>

              {/* Status & Categoria em linha */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                {/* Status */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748b" }}>Status:</span>
                  <select
                    className="form-select"
                    value={currentStatus}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    style={{
                      fontSize: "11.5px",
                      padding: "5px 8px",
                      borderRadius: "5px",
                      border: "1px solid #cbd5e1",
                      background: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    {statusOptions.map((opt) => (
                      <option key={opt.key} value={opt.key}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Categoria */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748b" }}>Categoria:</span>
                  <select
                    className="form-select"
                    value={currentCategories}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    style={{
                      fontSize: "11.5px",
                      padding: "5px 8px",
                      borderRadius: "5px",
                      border: "1px solid #cbd5e1",
                      background: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    <option value="">(Nenhuma)</option>
                    {categoryOptions.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tags */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748b" }}>Tags de Taxonomia:</span>
                
                {/* Chips de tags existentes */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", minHeight: "26px", alignItems: "center" }}>
                  {currentTags.length === 0 ? (
                    <span style={{ fontSize: "11px", color: "#94a3b8", fontStyle: "italic" }}>
                      Nenhuma tag vinculada.
                    </span>
                  ) : (
                    currentTags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "3px",
                          fontSize: "10.5px",
                          padding: "2px 7px",
                          borderRadius: "12px",
                          background: "rgba(37,99,235,0.08)",
                          color: "#1d4ed8",
                          fontWeight: 500,
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
                            color: "#94a3b8",
                          }}
                          title={`Remover tag ${tag}`}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>
                            close
                          </span>
                        </button>
                      </span>
                    ))
                  )}
                </div>

                {/* Seletor rápido de tags sugeridas e input customizado */}
                <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "2px" }}>
                  <select
                    className="form-select"
                    value=""
                    onChange={(e) => {
                      if (e.target.value) handleAddTag(e.target.value);
                    }}
                    style={{ fontSize: "11px", padding: "4px 6px", borderRadius: "4px", flex: 1 }}
                  >
                    <option value="">+ Escolher tag do projeto...</option>
                    {availableTags
                      .filter((t) => !currentTags.includes(t))
                      .map((t) => (
                        <option key={t} value={t}>
                          #{t}
                        </option>
                      ))}
                  </select>
                </div>
                <div style={{ display: "flex", gap: "4px" }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Nova tag customizada..."
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTag(newTagInput);
                      }
                    }}
                    style={{ fontSize: "11px", padding: "4px 6px", borderRadius: "4px", flex: 1 }}
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
                <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748b" }}>Aprovadores (Approvers):</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", minHeight: "24px", alignItems: "center" }}>
                  {currentApprovers.length === 0 ? (
                    <span style={{ fontSize: "11px", color: "#94a3b8", fontStyle: "italic" }}>
                      Nenhum aprovador formal atribuído.
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
                    style={{ fontSize: "11px", padding: "4px 6px", borderRadius: "4px", flex: 1 }}
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

              {/* Informações do Sistema (Read-only) */}
              <div
                style={{
                  background: "#f8fafc",
                  borderRadius: "6px",
                  padding: "8px 10px",
                  fontSize: "10.5px",
                  color: "#64748b",
                  display: "flex",
                  flexDirection: "column",
                  gap: "3px",
                  border: "1px solid #f1f5f9",
                }}
              >
                <div>
                  <strong>ID: </strong>
                  <code>{currentId || "gerado automaticamente"}</code>
                </div>
                {currentUpdatedAt && (
                  <div>
                    <strong>Última atualização: </strong>
                    <span>{new Date(currentUpdatedAt).toLocaleString()}</span>
                  </div>
                )}
                <div>
                  <strong>Conexões: </strong>
                  <span>{dependencies.length} dependências, {consumers.length} consumidores</span>
                </div>
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
