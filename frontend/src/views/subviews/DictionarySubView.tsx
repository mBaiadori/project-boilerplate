import {
  AlertCircle,
  ArrowUpDown,
  BookA,
  BookOpen,
  Check,
  Code2,
  Copy,
  Download,
  Edit3,
  LayoutGrid,
  List,
  Plus,
  Sparkles,
  Tag,
  Trash2,
  Upload,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  EmptyState,
  FormField,
  IconButton,
  Input,
  Modal,
  SearchInput,
  Spinner,
  StatCard,
  Textarea,
} from "../../components/ui";
import { useAI } from "../../context/AIContext";
import { API } from "../../services/api";
import type { DictionaryTerm } from "../../types";

type SortOption = "name-asc" | "name-desc" | "code-asc";
type ViewMode = "table" | "grid";

export const DictionarySubView: React.FC = () => {
  const { setDynamicContext } = useAI();
  const [terms, setTerms] = useState<DictionaryTerm[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLetter, setSelectedLetter] = useState<string>("ALL");
  const [sortOption, setSortOption] = useState<SortOption>("name-asc");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState("");
  const [importError, setImportError] = useState("");
  const [copiedGeneral, setCopiedGeneral] = useState<string | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  // Form State
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [inputTerm, setInputTerm] = useState("");
  const [inputCodename, setInputCodename] = useState("");
  const [inputAliases, setInputAliases] = useState("");
  const [inputDefinition, setInputDefinition] = useState("");

  const loadDictionary = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await API.getDictionary();
      if (res.ok && res.data && Array.isArray(res.data.terms)) {
        setTerms(res.data.terms);
      }
    } catch (err) {
      console.error("[DictionarySubView] Erro ao buscar dicionário:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDictionary();
  }, [loadDictionary]);

  // Sync with AI Context
  useEffect(() => {
    if (terms.length > 0) {
      setDynamicContext({
        filePath: "dictionary.json",
        content: JSON.stringify(terms, null, 2),
        badge: "📚 Dicionário de Dados",
      });
    }
    return () => {
      setDynamicContext(null);
    };
  }, [terms, setDynamicContext]);

  // Handle Opening Modal for New Term
  const handleOpenNewTerm = () => {
    setEditingIndex(null);
    setInputTerm("");
    setInputCodename("");
    setInputAliases("");
    setInputDefinition("");
    setIsModalOpen(true);
  };

  // Handle Opening Modal for Edit
  const handleEditTerm = (t: DictionaryTerm, idx: number) => {
    setEditingIndex(idx);
    setInputTerm(t.term || "");
    setInputCodename(t.codename || "");
    setInputAliases(t.context || "");
    setInputDefinition(t.definition || "");
    setIsModalOpen(true);
  };

  // Handle Deleting Term
  const handleDeleteTerm = async (idx: number) => {
    const target = terms[idx];
    if (
      !window.confirm(
        `Tem certeza que deseja remover o termo "${target?.term || "selecionado"}" do dicionário?`,
      )
    ) {
      return;
    }
    const updated = terms.filter((_, i) => i !== idx);
    try {
      setIsSaving(true);
      await API.saveDictionary(updated);
      setTerms(updated);
    } catch (err) {
      console.error("Erro ao deletar termo:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Saving Term
  const handleSaveTerm = async () => {
    if (!inputTerm.trim()) return;
    const termItem: DictionaryTerm = {
      term: inputTerm.trim(),
      codename:
        inputCodename.trim() ||
        inputTerm
          .trim()
          .toUpperCase()
          .replace(/[\s-]+/g, "_")
          .replace(/[^A-Z0-9_]/g, ""),
      definition: inputDefinition.trim(),
      context: inputAliases.trim(),
    };

    let updated: DictionaryTerm[];
    if (editingIndex !== null) {
      updated = [...terms];
      updated[editingIndex] = termItem;
    } else {
      updated = [...terms, termItem];
    }

    try {
      setIsSaving(true);
      await API.saveDictionary(updated);
      setTerms(updated);
      setIsModalOpen(false);
    } catch (err) {
      console.error("[DictionarySubView] Erro ao salvar termo:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Copy helper
  const copyToClipboard = (text: string, type: string, id?: string) => {
    navigator.clipboard.writeText(text);
    if (id) {
      setCopiedCodeId(id);
      setTimeout(() => setCopiedCodeId(null), 2000);
    } else {
      setCopiedGeneral(type);
      setTimeout(() => setCopiedGeneral(null), 2000);
    }
  };

  // Export Markdown table
  const handleExportMarkdown = () => {
    let md = "# 📚 Dicionário Ubíquo & Vocabulário Oficial\n\n";
    md += "| Termo | Code Name | Definição | Aliases / Contexto |\n";
    md += "| :--- | :--- | :--- | :--- |\n";
    terms.forEach((t) => {
      md += `| **${t.term.replace(/\|/g, "\\|")}** | \`${t.codename}\` | ${t.definition.replace(/\|/g, "\\|")} | ${t.context || "-"} |\n`;
    });

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dictionary.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import JSON handler
  const handleApplyImport = async () => {
    setImportError("");
    try {
      const parsed = JSON.parse(importJsonText);
      let incomingTerms: DictionaryTerm[] = [];
      if (Array.isArray(parsed)) {
        incomingTerms = parsed;
      } else if (parsed && Array.isArray(parsed.terms)) {
        incomingTerms = parsed.terms;
      } else {
        throw new Error(
          "O JSON deve ser um array de termos ou um objeto com a chave 'terms'.",
        );
      }

      // Validate structure
      const valid = incomingTerms.filter(
        (t) => t && typeof t.term === "string",
      );
      if (valid.length === 0) {
        throw new Error("Nenhum termo válido encontrado no JSON.");
      }

      setIsSaving(true);
      await API.saveDictionary(valid);
      setTerms(valid);
      setIsImportModalOpen(false);
      setImportJsonText("");
    } catch (err: any) {
      setImportError(err.message || "Erro ao processar JSON.");
    } finally {
      setIsSaving(false);
    }
  };

  // Available Alphabet Letters for fast filtering
  const availableLetters = useMemo(() => {
    const set = new Set<string>();
    terms.forEach((t) => {
      const first = t.term.trim().charAt(0).toUpperCase();
      if (/[A-Z]/.test(first)) {
        set.add(first);
      } else {
        set.add("#");
      }
    });
    return Array.from(set).sort();
  }, [terms]);

  // Filtered & Sorted terms
  const filteredTerms = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();

    return terms
      .filter((t) => {
        // Search Filter
        const matchesSearch =
          !q ||
          t.term.toLowerCase().includes(q) ||
          (t.codename && t.codename.toLowerCase().includes(q)) ||
          (t.definition && t.definition.toLowerCase().includes(q)) ||
          (t.context && t.context.toLowerCase().includes(q));

        if (!matchesSearch) return false;

        // Letter Filter
        if (selectedLetter !== "ALL") {
          const first = t.term.trim().charAt(0).toUpperCase();
          if (selectedLetter === "#") {
            return !/[A-Z]/.test(first);
          }
          return first === selectedLetter;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortOption === "name-asc") {
          return a.term.localeCompare(b.term, "pt", { sensitivity: "base" });
        }
        if (sortOption === "name-desc") {
          return b.term.localeCompare(a.term, "pt", { sensitivity: "base" });
        }
        if (sortOption === "code-asc") {
          return (a.codename || "").localeCompare(b.codename || "");
        }
        return 0;
      });
  }, [terms, searchTerm, selectedLetter, sortOption]);

  // Statistics
  const totalCodenames = useMemo(
    () => terms.filter((t) => Boolean(t.codename?.trim())).length,
    [terms],
  );
  const totalWithAliases = useMemo(
    () => terms.filter((t) => Boolean(t.context?.trim())).length,
    [terms],
  );

  return (
    <div
      id="subview-dictionary"
      className="dash-subview"
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        overflowY: "auto",
        overflowX: "hidden",
        background: "var(--color-surface, #ffffff)",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          padding: "24px 32px 64px",
          maxWidth: "1400px",
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* Header Ribbon */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: "24px",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: "var(--md-sys-color-primary-container, #d2e3fc)",
                  color: "var(--md-sys-color-primary, #1a73e8)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <BookA size={22} />
              </div>
              <div>
                <h1
                  style={{
                    margin: 0,
                    fontSize: "24px",
                    fontWeight: 700,
                    color: "var(--color-on-surface, #1e293b)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  Dicionário Ubíquo & Vocabulário Oficial
                </h1>
                <p
                  style={{
                    margin: "4px 0 0 0",
                    fontSize: "13.5px",
                    color: "var(--color-on-surface-variant, #64748b)",
                  }}
                >
                  Vocabulário canônico consumido em tempo real pelo Copilot e
                  Agentes Autônomos. Persistido em{" "}
                  <code
                    style={{
                      fontFamily: "var(--font-mono, monospace)",
                      background:
                        "var(--color-surface-container-high, #e2e8f0)",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontSize: "12px",
                      color: "var(--color-primary, #1a73e8)",
                      fontWeight: 600,
                    }}
                  >
                    .dictionary.json
                  </code>
                </p>
              </div>
            </div>
          </div>

          {/* Global Action Buttons */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <Button
              id="btn-copy-dict-json"
              variant="secondary"
              size="md"
              onClick={() =>
                copyToClipboard(JSON.stringify(terms, null, 2), "json")
              }
              icon={
                copiedGeneral === "json" ? (
                  <Check
                    size={16}
                    style={{ color: "var(--color-success, #16a34a)" }}
                  />
                ) : (
                  <Copy size={16} />
                )
              }
            >
              {copiedGeneral === "json" ? "JSON Copiado!" : "Copiar JSON"}
            </Button>

            <Button
              id="btn-export-markdown"
              variant="secondary"
              size="md"
              onClick={handleExportMarkdown}
              icon={<Download size={16} />}
              title="Baixar dicionário formatado em Markdown"
            >
              Exportar MD
            </Button>

            <Button
              id="btn-import-json"
              variant="secondary"
              size="md"
              onClick={() => {
                setImportJsonText("");
                setImportError("");
                setIsImportModalOpen(true);
              }}
              icon={<Upload size={16} />}
            >
              Importar
            </Button>

            <Button
              id="btn-open-new-term"
              variant="primary"
              size="md"
              onClick={handleOpenNewTerm}
              icon={<Plus size={16} />}
            >
              Novo Termo
            </Button>
          </div>
        </div>

        {/* Stats Metrics Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          <StatCard
            title="Total de Termos"
            value={terms.length}
            subtitle="Conceitos cadastrados no projeto"
            icon={<BookOpen size={20} />}
            iconBgColor="rgba(26, 115, 232, 0.12)"
            iconColor="var(--color-primary, #1a73e8)"
          />

          <StatCard
            title="Codenames Oficiais"
            value={totalCodenames}
            subtitle="Identificadores vinculados ao código"
            icon={<Code2 size={20} />}
            iconBgColor="rgba(16, 185, 129, 0.12)"
            iconColor="#10b981"
          />

          <StatCard
            title="Com Aliases / Sinônimos"
            value={totalWithAliases}
            subtitle="Mapeamentos de termos alternativos"
            icon={<Tag size={20} />}
            iconBgColor="rgba(245, 158, 11, 0.12)"
            iconColor="#f59e0b"
          />

          <StatCard
            title="Sincronização com IA"
            value="Ativo"
            subtitle="Injetado no contexto dinâmico"
            icon={<Sparkles size={20} />}
            iconBgColor="rgba(139, 92, 246, 0.12)"
            iconColor="#8b5cf6"
          />
        </div>

        {/* Search, Filter & Controls Toolbar */}
        <Card style={{ marginBottom: "20px" }}>
          <div
            style={{
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "16px",
            }}
          >
            {/* Search Input */}
            <div style={{ flex: "1 1 320px", maxWidth: "500px" }}>
              <SearchInput
                id="dict-search-input"
                placeholder="Buscar por termo, codename, sinônimo ou definição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClear={() => setSearchTerm("")}
              />
            </div>

            {/* View Switcher, Sort & Filters */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              {/* Sort selector */}
              <div
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <ArrowUpDown
                  size={15}
                  style={{ color: "var(--color-on-surface-variant, #64748b)" }}
                />
                <select
                  id="dict-sort-select"
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as SortOption)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "6px",
                    border: "1px solid var(--color-outline-variant, #cbd5e1)",
                    background: "var(--color-surface, #ffffff)",
                    color: "var(--color-on-surface, #1e293b)",
                    fontSize: "13px",
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  <option value="name-asc">Ordem Alfabética (A-Z)</option>
                  <option value="name-desc">Ordem Inversa (Z-A)</option>
                  <option value="code-asc">Por Code Name</option>
                </select>
              </div>

              {/* View Mode Toggle */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "var(--color-surface-container, #f1f5f9)",
                  padding: "3px",
                  borderRadius: "8px",
                  border: "1px solid var(--color-outline-variant, #e2e8f0)",
                }}
              >
                <button
                  type="button"
                  id="btn-view-mode-table"
                  onClick={() => setViewMode("table")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "none",
                    background:
                      viewMode === "table"
                        ? "var(--color-surface, #ffffff)"
                        : "transparent",
                    color:
                      viewMode === "table"
                        ? "var(--color-primary, #1a73e8)"
                        : "var(--color-on-surface-variant, #64748b)",
                    boxShadow:
                      viewMode === "table"
                        ? "0 1px 3px rgba(0,0,0,0.08)"
                        : "none",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <List size={15} />
                  Tabela
                </button>
                <button
                  type="button"
                  id="btn-view-mode-grid"
                  onClick={() => setViewMode("grid")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "none",
                    background:
                      viewMode === "grid"
                        ? "var(--color-surface, #ffffff)"
                        : "transparent",
                    color:
                      viewMode === "grid"
                        ? "var(--color-primary, #1a73e8)"
                        : "var(--color-on-surface-variant, #64748b)",
                    boxShadow:
                      viewMode === "grid"
                        ? "0 1px 3px rgba(0,0,0,0.08)"
                        : "none",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <LayoutGrid size={15} />
                  Cards
                </button>
              </div>
            </div>
          </div>

          {/* Quick Alphabet Filter Ribbon */}
          {terms.length > 5 && (
            <div
              style={{
                padding: "8px 20px 14px",
                borderTop: "1px solid var(--color-outline-variant, #f1f5f9)",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                overflowX: "auto",
              }}
            >
              <span
                style={{
                  fontSize: "11.5px",
                  fontWeight: 600,
                  color: "var(--color-on-surface-variant, #94a3b8)",
                  marginRight: "8px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Letra:
              </span>
              <button
                type="button"
                onClick={() => setSelectedLetter("ALL")}
                style={{
                  padding: "4px 8px",
                  borderRadius: "4px",
                  border: "none",
                  background:
                    selectedLetter === "ALL"
                      ? "var(--color-primary, #1a73e8)"
                      : "transparent",
                  color:
                    selectedLetter === "ALL"
                      ? "#ffffff"
                      : "var(--color-on-surface-variant, #64748b)",
                  fontSize: "12px",
                  fontWeight: selectedLetter === "ALL" ? 700 : 500,
                  cursor: "pointer",
                  transition: "all 0.12s ease",
                }}
              >
                Todos ({terms.length})
              </button>
              {availableLetters.map((ltr) => (
                <button
                  key={ltr}
                  type="button"
                  onClick={() => setSelectedLetter(ltr)}
                  style={{
                    minWidth: "26px",
                    height: "26px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "4px",
                    border: "none",
                    background:
                      selectedLetter === ltr
                        ? "var(--color-primary, #1a73e8)"
                        : "transparent",
                    color:
                      selectedLetter === ltr
                        ? "#ffffff"
                        : "var(--color-on-surface, #334155)",
                    fontSize: "12px",
                    fontWeight: selectedLetter === ltr ? 700 : 500,
                    cursor: "pointer",
                    transition: "all 0.12s ease",
                  }}
                >
                  {ltr}
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Content Section: Table or Grid */}
        {isLoading ? (
          <div
            style={{
              padding: "64px 0",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Spinner size="lg" message="Carregando dicionário ubíquo..." />
          </div>
        ) : filteredTerms.length === 0 ? (
          <Card>
            <CardContent style={{ padding: "48px 24px" }}>
              <EmptyState
                icon={<BookA size={44} />}
                title={
                  searchTerm || selectedLetter !== "ALL"
                    ? "Nenhum termo correspondente"
                    : "Dicionário Vazio"
                }
                description={
                  searchTerm || selectedLetter !== "ALL"
                    ? `Nenhum termo encontrado para os filtros atuais. Limpe a busca para visualizar todos.`
                    : "Cadastre termos, codenames e definições canônicas para que a equipe e a IA operem sob o mesmo vocabulário de domínio."
                }
                actionLabel={
                  searchTerm || selectedLetter !== "ALL"
                    ? "Limpar Filtros"
                    : "Cadastrar Primeiro Termo"
                }
                onAction={
                  searchTerm || selectedLetter !== "ALL"
                    ? () => {
                        setSearchTerm("");
                        setSelectedLetter("ALL");
                      }
                    : handleOpenNewTerm
                }
              />
            </CardContent>
          </Card>
        ) : viewMode === "table" ? (
          /* Table View */
          <Card>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  textAlign: "left",
                  fontSize: "13.5px",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "var(--color-surface-container, #f8fafc)",
                      borderBottom:
                        "1px solid var(--color-outline-variant, #e2e8f0)",
                    }}
                  >
                    <th
                      style={{
                        padding: "14px 20px",
                        fontWeight: 600,
                        color: "var(--color-on-surface, #334155)",
                        width: "25%",
                      }}
                    >
                      Termo / Conceito
                    </th>
                    <th
                      style={{
                        padding: "14px 20px",
                        fontWeight: 600,
                        color: "var(--color-on-surface, #334155)",
                        width: "22%",
                      }}
                    >
                      Code Name Oficial
                    </th>
                    <th
                      style={{
                        padding: "14px 20px",
                        fontWeight: 600,
                        color: "var(--color-on-surface, #334155)",
                        width: "41%",
                      }}
                    >
                      Definição & Significado
                    </th>
                    <th
                      style={{
                        padding: "14px 20px",
                        fontWeight: 600,
                        color: "var(--color-on-surface, #334155)",
                        width: "12%",
                        textAlign: "right",
                      }}
                    >
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTerms.map((t) => {
                    const originalIdx = terms.findIndex(
                      (item) =>
                        item.term === t.term && item.codename === t.codename,
                    );
                    const isCodeCopied = copiedCodeId === t.codename;

                    return (
                      <tr
                        key={`${t.term}-${t.codename}-${originalIdx}`}
                        style={{
                          borderBottom:
                            "1px solid var(--color-outline-variant, #f1f5f9)",
                          transition: "background 0.15s ease",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background =
                            "var(--color-surface-container, #f8fafc)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "transparent")
                        }
                      >
                        {/* Term & Aliases */}
                        <td
                          style={{ padding: "14px 20px", verticalAlign: "top" }}
                        >
                          <div
                            style={{
                              fontWeight: 600,
                              color: "var(--color-on-surface, #0f172a)",
                              fontSize: "14px",
                            }}
                          >
                            {t.term}
                          </div>
                          {t.context && (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                                marginTop: "4px",
                                flexWrap: "wrap",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "11px",
                                  color:
                                    "var(--color-on-surface-variant, #94a3b8)",
                                }}
                              >
                                Aliases:
                              </span>
                              {t.context
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean)
                                .map((alias, aIdx) => (
                                  <span
                                    key={aIdx}
                                    style={{
                                      fontSize: "11px",
                                      background:
                                        "var(--color-surface-container-high, #e2e8f0)",
                                      color:
                                        "var(--color-on-surface-variant, #475569)",
                                      padding: "1px 6px",
                                      borderRadius: "4px",
                                      fontFamily: "var(--font-mono, monospace)",
                                    }}
                                  >
                                    {alias}
                                  </span>
                                ))}
                            </div>
                          )}
                        </td>

                        {/* Code Name Badge with 1-click Copy */}
                        <td
                          style={{ padding: "14px 20px", verticalAlign: "top" }}
                        >
                          {t.codename ? (
                            <div
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                              }}
                            >
                              <code
                                style={{
                                  fontFamily: "var(--font-mono, monospace)",
                                  background:
                                    "var(--color-surface-container-high, #e0f2fe)",
                                  padding: "3px 8px",
                                  borderRadius: "6px",
                                  fontSize: "12.5px",
                                  color: "var(--color-primary, #0284c7)",
                                  fontWeight: 600,
                                  border: "1px solid rgba(2, 132, 199, 0.2)",
                                }}
                              >
                                {t.codename}
                              </code>
                              <IconButton
                                icon={
                                  isCodeCopied ? (
                                    <Check
                                      size={13}
                                      style={{
                                        color: "var(--color-success, #16a34a)",
                                      }}
                                    />
                                  ) : (
                                    <Copy size={13} />
                                  )
                                }
                                variant="ghost"
                                size="sm"
                                tooltip={
                                  isCodeCopied ? "Copiado!" : "Copiar Code Name"
                                }
                                onClick={() =>
                                  copyToClipboard(
                                    t.codename,
                                    "code",
                                    t.codename,
                                  )
                                }
                              />
                            </div>
                          ) : (
                            <span
                              style={{
                                color: "var(--color-outline, #94a3b8)",
                                fontSize: "12px",
                              }}
                            >
                              —
                            </span>
                          )}
                        </td>

                        {/* Definition */}
                        <td
                          style={{
                            padding: "14px 20px",
                            verticalAlign: "top",
                            color: "var(--color-on-surface-variant, #334155)",
                            lineHeight: 1.55,
                            fontSize: "13.5px",
                          }}
                        >
                          {t.definition}
                        </td>

                        {/* Actions */}
                        <td
                          style={{
                            padding: "14px 20px",
                            verticalAlign: "top",
                            textAlign: "right",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <IconButton
                            icon={<Edit3 size={15} />}
                            variant="ghost"
                            size="sm"
                            tooltip="Editar termo"
                            onClick={() => handleEditTerm(t, originalIdx)}
                          />
                          <IconButton
                            icon={<Trash2 size={15} />}
                            variant="ghost"
                            size="sm"
                            tooltip="Remover termo"
                            onClick={() => handleDeleteTerm(originalIdx)}
                            style={{ color: "var(--color-error, #ef4444)" }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          /* Grid View */
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
              gap: "18px",
            }}
          >
            {filteredTerms.map((t) => {
              const originalIdx = terms.findIndex(
                (item) => item.term === t.term && item.codename === t.codename,
              );
              const isCodeCopied = copiedCodeId === t.codename;

              return (
                <Card
                  key={`${t.term}-${t.codename}-${originalIdx}`}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                    border: "1px solid var(--color-outline-variant, #e2e8f0)",
                  }}
                >
                  <CardContent style={{ padding: "20px" }}>
                    {/* Top row */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: "12px",
                        marginBottom: "10px",
                      }}
                    >
                      <h3
                        style={{
                          margin: 0,
                          fontSize: "16px",
                          fontWeight: 700,
                          color: "var(--color-on-surface, #0f172a)",
                          lineHeight: 1.3,
                        }}
                      >
                        {t.term}
                      </h3>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <IconButton
                          icon={<Edit3 size={14} />}
                          variant="ghost"
                          size="sm"
                          tooltip="Editar termo"
                          onClick={() => handleEditTerm(t, originalIdx)}
                        />
                        <IconButton
                          icon={<Trash2 size={14} />}
                          variant="ghost"
                          size="sm"
                          tooltip="Remover termo"
                          onClick={() => handleDeleteTerm(originalIdx)}
                          style={{ color: "var(--color-error, #ef4444)" }}
                        />
                      </div>
                    </div>

                    {/* Codename Pill */}
                    {t.codename && (
                      <div
                        style={{
                          marginBottom: "12px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          background: "var(--color-surface-container, #f1f5f9)",
                          padding: "3px 8px",
                          borderRadius: "6px",
                          border:
                            "1px solid var(--color-outline-variant, #e2e8f0)",
                        }}
                      >
                        <Code2
                          size={13}
                          style={{ color: "var(--color-primary, #1a73e8)" }}
                        />
                        <code
                          style={{
                            fontFamily: "var(--font-mono, monospace)",
                            fontSize: "12px",
                            fontWeight: 600,
                            color: "var(--color-primary, #1a73e8)",
                          }}
                        >
                          {t.codename}
                        </code>
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard(t.codename, "code", t.codename)
                          }
                          style={{
                            background: "transparent",
                            border: "none",
                            padding: "2px",
                            cursor: "pointer",
                            color: isCodeCopied
                              ? "var(--color-success, #16a34a)"
                              : "var(--color-on-surface-variant, #64748b)",
                            display: "flex",
                            alignItems: "center",
                          }}
                          title={isCodeCopied ? "Copiado!" : "Copiar Code Name"}
                        >
                          {isCodeCopied ? (
                            <Check size={12} />
                          ) : (
                            <Copy size={12} />
                          )}
                        </button>
                      </div>
                    )}

                    {/* Definition */}
                    <p
                      style={{
                        margin: 0,
                        fontSize: "13.5px",
                        lineHeight: 1.55,
                        color: "var(--color-on-surface-variant, #334155)",
                      }}
                    >
                      {t.definition}
                    </p>

                    {/* Aliases Tags */}
                    {t.context && (
                      <div
                        style={{
                          marginTop: "14px",
                          paddingTop: "12px",
                          borderTop:
                            "1px solid var(--color-outline-variant, #f1f5f9)",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          flexWrap: "wrap",
                        }}
                      >
                        <Tag
                          size={12}
                          style={{ color: "var(--color-outline, #94a3b8)" }}
                        />
                        {t.context
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean)
                          .map((alias, aIdx) => (
                            <span
                              key={aIdx}
                              style={{
                                fontSize: "11px",
                                background:
                                  "var(--color-surface-container-high, #f1f5f9)",
                                color:
                                  "var(--color-on-surface-variant, #475569)",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                fontFamily: "var(--font-mono, monospace)",
                              }}
                            >
                              {alias}
                            </span>
                          ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Cadastrar / Editar Termo */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          editingIndex !== null ? "Editar Termo" : "Novo Termo do Dicionário"
        }
        subtitle="Defina o significado inequívoco e associe o identificador oficial para código e IA"
        icon={<Sparkles size={18} />}
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsModalOpen(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveTerm}
              disabled={!inputTerm.trim() || isSaving}
              icon={isSaving ? <Spinner size="sm" /> : <Check size={14} />}
            >
              {isSaving ? "Salvando..." : "Salvar Termo"}
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveTerm();
          }}
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
        >
          <FormField
            label="Nome do Termo / Conceito"
            required
            helperText="ex: Chave de Idempotência, Bounded Context ou Lead Time"
          >
            <Input
              id="dict-input-term"
              placeholder="ex: Chave de Idempotência"
              value={inputTerm}
              onChange={(e) => {
                const val = e.target.value;
                setInputTerm(val);
                if (editingIndex === null || !inputCodename) {
                  setInputCodename(
                    val
                      .toUpperCase()
                      .normalize("NFD")
                      .replace(/[\u0300-\u036f]/g, "")
                      .replace(/[\s-]+/g, "_")
                      .replace(/[^A-Z0-9_]/g, ""),
                  );
                }
              }}
              autoFocus
            />
          </FormField>

          <FormField
            label="Code Name Oficial (Identificador)"
            required
            helperText="Identificador único usado em entidades, APIs, constantes e prompts (letras, números e _)."
          >
            <Input
              id="dict-input-codename"
              placeholder="ex: IDEMPOTENCY_KEY ou BOUNDED_CONTEXT"
              value={inputCodename}
              onChange={(e) => setInputCodename(e.target.value)}
            />
          </FormField>

          <FormField
            label="Sinônimos / Aliases / Contexto"
            helperText="Termos alternativos e variações separados por vírgula (ex: Chave Única, Idempotency Token)."
          >
            <Input
              id="dict-input-aliases"
              placeholder="ex: Idempotency Key, Chave Única"
              value={inputAliases}
              onChange={(e) => setInputAliases(e.target.value)}
            />
          </FormField>

          <FormField
            label="Definição / Significado Inequívoco"
            required
            helperText="Explicação clara do significado exato do conceito no domínio da aplicação."
          >
            <Textarea
              id="dict-input-definition"
              rows={4}
              placeholder="Descreva o significado exato no contexto da arquitetura e negócio..."
              value={inputDefinition}
              onChange={(e) => setInputDefinition(e.target.value)}
            />
          </FormField>

          {/* Live Preview Card */}
          {inputTerm.trim() && (
            <div
              style={{
                marginTop: "4px",
                padding: "12px 14px",
                borderRadius: "8px",
                background: "var(--color-surface-container, #f8fafc)",
                border: "1px dashed var(--color-outline-variant, #cbd5e1)",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--color-on-surface-variant, #64748b)",
                  marginBottom: "6px",
                }}
              >
                Pré-visualização
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    color: "var(--color-on-surface, #0f172a)",
                  }}
                >
                  {inputTerm}
                </span>
                {inputCodename && (
                  <code
                    style={{
                      fontSize: "11.5px",
                      background:
                        "var(--color-surface-container-high, #e2e8f0)",
                      color: "var(--color-primary, #1a73e8)",
                      padding: "2px 6px",
                      borderRadius: "4px",
                    }}
                  >
                    {inputCodename}
                  </code>
                )}
              </div>
              {inputDefinition && (
                <p
                  style={{
                    margin: "4px 0 0 0",
                    fontSize: "12.5px",
                    color: "var(--color-on-surface-variant, #475569)",
                  }}
                >
                  {inputDefinition}
                </p>
              )}
            </div>
          )}
        </form>
      </Modal>

      {/* Modal: Importar JSON */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Importar Dicionário JSON"
        subtitle="Cole um array de termos ou objeto com a propriedade 'terms' para atualizar o dicionário"
        icon={<Upload size={18} />}
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsImportModalOpen(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleApplyImport}
              disabled={!importJsonText.trim() || isSaving}
              icon={isSaving ? <Spinner size="sm" /> : <Check size={14} />}
            >
              {isSaving ? "Importando..." : "Substituir Dicionário"}
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <FormField
            label="Conteúdo JSON"
            required
            helperText="Formato: [{ 'term': '...', 'codename': '...', 'definition': '...', 'context': '...' }]"
          >
            <Textarea
              id="dict-import-textarea"
              rows={8}
              placeholder={`[\n  {\n    "term": "Chave de Idempotência",\n    "codename": "IDEMPOTENCY_KEY",\n    "definition": "Identificador exclusivo para evitar duplicidade de operações.",\n    "context": "Idempotency Key"\n  }\n]`}
              value={importJsonText}
              onChange={(e) => {
                setImportJsonText(e.target.value);
                setImportError("");
              }}
              style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: "12px",
              }}
            />
          </FormField>

          {importError && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "6px",
                background: "var(--color-error-container, #fee2e2)",
                color: "var(--color-error, #b91c1c)",
                fontSize: "12.5px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <AlertCircle size={16} />
              <span>{importError}</span>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
