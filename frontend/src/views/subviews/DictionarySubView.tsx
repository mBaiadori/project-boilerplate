import {
  AlertCircle,
  ArrowUpDown,
  BookA,
  Check,
  Copy,
  Download,
  Edit3,
  Filter,
  Layers,
  LayoutGrid,
  List,
  Plus,
  Sparkles,
  Tag,
  Trash2,
  Upload,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
  Textarea,
} from "../../components/ui";
import { useAI } from "../../context/AIContext";
import { useWorkspace } from "../../context/WorkspaceContext";
import type { DictionaryTerm } from "../../types";

type SortOption = "name-asc" | "name-desc" | "code-asc" | "domain-asc";
type ViewMode = "table" | "grid";

const DDD_CATEGORIES = [
  { id: "Entity", label: "Entity", desc: "Entidade com identidade única", color: "#2563eb" },
  { id: "Value Object", label: "Value Object", desc: "Objeto de valor imutável", color: "#0891b2" },
  { id: "Aggregate", label: "Aggregate", desc: "Raiz de agregação", color: "#7c3aed" },
  { id: "Domain Event", label: "Domain Event", desc: "Fato relevante ocorrido", color: "#ea580c" },
  { id: "Service", label: "Service", desc: "Serviço de domínio puro", color: "#059669" },
  { id: "Process", label: "Process", desc: "Fluxo ou processo de negócio", color: "#d97706" },
  { id: "Rule / Policy", label: "Rule / Policy", desc: "Regra / política de negócio", color: "#dc2626" },
  { id: "Metric", label: "Metric", desc: "Métrica / KPI de monitoramento", color: "#4f46e5" },
];

export const DictionarySubView: React.FC = () => {
  const { setDynamicContext } = useAI();
  const { projectMetaOptions, projectConfig, dictionaryTerms, loadDictionaryTerms, saveDictionaryTerms } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();
  const [terms, setTerms] = useState<DictionaryTerm[]>(dictionaryTerms || []);
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get("search") || "");
  const [selectedLetter, setSelectedLetter] = useState<string>("ALL");
  const [selectedDomainFilter, setSelectedDomainFilter] = useState<string>("ALL");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("ALL");
  const [sortOption, setSortOption] = useState<SortOption>("name-asc");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState("");
  const [importError, setImportError] = useState("");
  const [formError, setFormError] = useState("");
  const [copiedGeneral, setCopiedGeneral] = useState<string | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  // Sincroniza termos com o WorkspaceContext
  useEffect(() => {
    if (dictionaryTerms && dictionaryTerms.length > 0) {
      setTerms(dictionaryTerms);
    }
  }, [dictionaryTerms]);

  // Sincroniza com parâmetros de busca da URL
  useEffect(() => {
    const q = searchParams.get("search");
    if (q !== null && q !== searchTerm) {
      setSearchTerm(q);
    }
  }, [searchParams]);

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (val.trim()) {
          next.set("search", val);
        } else {
          next.delete("search");
        }
        return next;
      },
      { replace: true }
    );
  };

  // Dynamic Categories from .project.config.json
  const categories = useMemo(() => {
    const cats = projectMetaOptions?.categories || projectConfig?.categories || [];
    return cats.length > 0 ? cats : [{ name: "geral", label: "Geral", color: "#3b82f6" }];
  }, [projectMetaOptions, projectConfig]);

  // Form State
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [inputTerm, setInputTerm] = useState("");
  const [inputCodename, setInputCodename] = useState("");
  const [inputDomain, setInputDomain] = useState("geral");
  const [inputCategory, setInputCategory] = useState("Entity");
  const [inputContext, setInputContext] = useState("");
  const [inputSynonyms, setInputSynonyms] = useState("");
  const [inputDefinition, setInputDefinition] = useState("");

  const loadDictionary = useCallback(async () => {
    if (dictionaryTerms.length === 0) {
      setIsLoading(true);
      try {
        const fetched = await loadDictionaryTerms();
        setTerms(fetched);
      } catch (err) {
        console.error("[DictionarySubView] Erro ao buscar dicionário:", err);
      } finally {
        setIsLoading(false);
      }
    }
  }, [dictionaryTerms.length, loadDictionaryTerms]);

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
    setInputDomain(categories[0]?.name || "geral");
    setInputCategory("Entity");
    setInputContext("");
    setInputSynonyms("");
    setInputDefinition("");
    setFormError("");
    setIsModalOpen(true);
  };

  // Handle Opening Modal for Edit
  const handleEditTerm = (t: DictionaryTerm, idx: number) => {
    setEditingIndex(idx);
    setInputTerm(t.term || "");
    setInputCodename(t.codename || t.code_name || "");
    setInputDomain(t.domain || categories[0]?.name || "geral");
    setInputCategory(t.category || "Entity");
    setInputContext(t.context || "");
    const syns = t.synonyms || t.aliases || [];
    setInputSynonyms(syns.join(", "));
    setInputDefinition(t.definition || "");
    setFormError("");
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
      const res = await saveDictionaryTerms(updated);
      if (res.success) {
        setTerms(updated);
      } else {
        alert(res.error || "Erro ao remover termo do dicionário.");
      }
    } catch (err) {
      console.error("Erro ao deletar termo:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Saving Term
  const handleSaveTerm = async () => {
    if (!inputTerm.trim()) {
      setFormError("O nome do termo é obrigatório.");
      return;
    }
    if (!inputDefinition.trim()) {
      setFormError("A definição do termo é obrigatória para manter a precisão conceitual.");
      return;
    }

    const syns = inputSynonyms
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter((s) => s && s.toLowerCase() !== inputTerm.trim().toLowerCase());

    const termItem: DictionaryTerm = {
      id: editingIndex !== null ? terms[editingIndex].id : undefined,
      term: inputTerm.trim(),
      codename:
        inputCodename.trim() ||
        inputTerm
          .trim()
          .toUpperCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[\s-]+/g, "_")
          .replace(/[^A-Z0-9_]/g, ""),
      domain: inputDomain.trim() || "geral",
      category: inputCategory.trim() || "Entity",
      context: inputContext.trim() || undefined,
      definition: inputDefinition.trim(),
      synonyms: Array.from(new Set(syns)),
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
      setFormError("");
      const res = await saveDictionaryTerms(updated);
      if (res.success) {
        setTerms(updated);
        setIsModalOpen(false);
      } else {
        setFormError(res.error || "Erro ao salvar termo no dicionário.");
      }
    } catch (err: any) {
      console.error("[DictionarySubView] Erro ao salvar termo:", err);
      setFormError(err.message || "Erro inesperado ao salvar.");
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
    md += "| Termo | Code Name | Domínio | Categoria DDD | Contexto | Sinônimos | Definição |\n";
    md += "| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n";
    terms.forEach((t) => {
      const syns = (t.synonyms || t.aliases || []).join(", ") || "-";
      md += `| **${t.term.replace(/\|/g, "\\|")}** | \`${t.codename || t.code_name || "-"}\` | ${t.domain || "-"} | ${t.category || "-"} | ${t.context || "-"} | ${syns} | ${t.definition.replace(/\|/g, "\\|")} |\n`;
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
      let incomingTerms: any[] = [];
      if (Array.isArray(parsed)) {
        incomingTerms = parsed;
      } else if (parsed && Array.isArray(parsed.terms)) {
        incomingTerms = parsed.terms;
      } else {
        throw new Error(
          "O JSON deve ser um array de termos ou um objeto com a chave 'terms'.",
        );
      }

      // Validate and normalize structure
      const valid: DictionaryTerm[] = incomingTerms
        .filter((t) => t && typeof t.term === "string" && t.term.trim().length > 0)
        .map((t) => ({
          id: t.id || undefined,
          term: t.term.trim(),
          codename:
            t.codename ||
            t.code_name ||
            t.term
              .trim()
              .toUpperCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/[\s-]+/g, "_")
              .replace(/[^A-Z0-9_]/g, ""),
          domain: t.domain || "geral",
          category: t.category || "Entity",
          context: t.context || undefined,
          definition: t.definition ? String(t.definition).trim() : "Definição não informada.",
          synonyms: Array.isArray(t.synonyms)
            ? t.synonyms
            : Array.isArray(t.aliases)
              ? t.aliases
              : typeof t.synonyms === "string"
                ? t.synonyms.split(",").map((s: string) => s.trim()).filter(Boolean)
                : [],
        }));

      if (valid.length === 0) {
        throw new Error("Nenhum termo válido encontrado no JSON.");
      }

      setIsSaving(true);
      const res = await saveDictionaryTerms(valid);
      if (res.success) {
        setTerms(valid);
        setIsImportModalOpen(false);
        setImportJsonText("");
      } else {
        setImportError(res.error || "Falha ao gravar termos importados.");
      }
    } catch (err: any) {
      setImportError(err.message || "Erro ao processar JSON.");
    } finally {
      setIsSaving(false);
    }
  };

  // Helper to get domain color
  const getDomainColor = useCallback(
    (domainName?: string) => {
      if (!domainName) return "#64748b";
      const cat = categories.find(
        (c: any) => (c.name || "").toLowerCase() === domainName.toLowerCase() || (c.label || "").toLowerCase() === domainName.toLowerCase(),
      );
      return cat?.color || "#3b82f6";
    },
    [categories],
  );

  // Helper to get DDD category info
  const getDddCategoryInfo = useCallback((catName?: string) => {
    if (!catName) return { label: "Entity", color: "#2563eb" };
    const found = DDD_CATEGORIES.find(
      (c) => c.id.toLowerCase() === catName.toLowerCase(),
    );
    return found || { label: catName, color: "#6366f1" };
  }, []);

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
        const synsText = (t.synonyms || t.aliases || []).join(" ").toLowerCase();
        const matchesSearch =
          !q ||
          t.term.toLowerCase().includes(q) ||
          (t.codename && t.codename.toLowerCase().includes(q)) ||
          (t.code_name && t.code_name.toLowerCase().includes(q)) ||
          (t.definition && t.definition.toLowerCase().includes(q)) ||
          (t.context && t.context.toLowerCase().includes(q)) ||
          (t.domain && t.domain.toLowerCase().includes(q)) ||
          (t.category && t.category.toLowerCase().includes(q)) ||
          synsText.includes(q);

        if (!matchesSearch) return false;

        // Domain Filter
        if (
          selectedDomainFilter !== "ALL" &&
          (t.domain || "geral").toLowerCase() !== selectedDomainFilter.toLowerCase()
        ) {
          return false;
        }

        // Category DDD Filter
        if (
          selectedCategoryFilter !== "ALL" &&
          (t.category || "Entity").toLowerCase() !== selectedCategoryFilter.toLowerCase()
        ) {
          return false;
        }

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
          return (a.codename || a.code_name || "").localeCompare(b.codename || b.code_name || "");
        }
        if (sortOption === "domain-asc") {
          return (a.domain || "").localeCompare(b.domain || "");
        }
        return 0;
      });
  }, [terms, searchTerm, selectedLetter, selectedDomainFilter, selectedCategoryFilter, sortOption]);

  const hasActiveFilters =
    searchTerm.trim() !== "" ||
    selectedLetter !== "ALL" ||
    selectedDomainFilter !== "ALL" ||
    selectedCategoryFilter !== "ALL";

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
        {/* Header Minimalista */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "20px",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                background: "var(--color-surface-container, #f1f5f9)",
                color: "var(--color-primary, #1a73e8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <BookA size={20} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h1
                  style={{
                    margin: 0,
                    fontSize: "20px",
                    fontWeight: 700,
                    color: "var(--color-on-surface, #0f172a)",
                    letterSpacing: "-0.01em",
                  }}
                >
                  Dicionário Ubíquo
                </h1>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--color-on-surface-variant, #64748b)",
                    background: "var(--color-surface-container, #f1f5f9)",
                    padding: "2px 8px",
                    borderRadius: "12px",
                  }}
                >
                  {terms.length} {terms.length === 1 ? "termo" : "termos"}
                </span>
              </div>
              <p
                style={{
                  margin: "2px 0 0 0",
                  fontSize: "12.5px",
                  color: "var(--color-on-surface-variant, #64748b)",
                }}
              >
                Vocabulário canônico consumido pelo Copilot, editores e agentes em tempo real.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
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
              size="sm"
              onClick={() =>
                copyToClipboard(JSON.stringify(terms, null, 2), "json")
              }
              icon={
                copiedGeneral === "json" ? (
                  <Check
                    size={14}
                    style={{ color: "var(--color-success, #16a34a)" }}
                  />
                ) : (
                  <Copy size={14} />
                )
              }
            >
              {copiedGeneral === "json" ? "Copiado!" : "Copiar JSON"}
            </Button>

            <Button
              id="btn-export-markdown"
              variant="secondary"
              size="sm"
              onClick={handleExportMarkdown}
              icon={<Download size={14} />}
              title="Baixar dicionário formatado em Markdown"
            >
              Exportar MD
            </Button>

            <Button
              id="btn-import-json"
              variant="secondary"
              size="sm"
              onClick={() => {
                setImportJsonText("");
                setImportError("");
                setIsImportModalOpen(true);
              }}
              icon={<Upload size={14} />}
            >
              Importar
            </Button>

            <Button
              id="btn-open-new-term"
              variant="primary"
              size="sm"
              onClick={handleOpenNewTerm}
              icon={<Plus size={15} />}
            >
              Novo Termo
            </Button>
          </div>
        </div>

        {/* Toolbar Minimalista e Integrada */}
        <div
          style={{
            background: "var(--color-surface, #ffffff)",
            borderRadius: "10px",
            border: "1px solid var(--color-outline-variant, #e2e8f0)",
            padding: "10px 14px",
            marginBottom: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          {/* Main Controls Row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            {/* Search Input */}
            <div style={{ flex: "1 1 260px", maxWidth: "440px" }}>
              <SearchInput
                id="dict-search-input"
                placeholder="Buscar termo, codename, sinônimo..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                onClear={() => handleSearchChange("")}
              />
            </div>

            {/* Filter Selectors & View Mode */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              {/* Domain Filter */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  background: "var(--color-surface-container, #f8fafc)",
                  border: "1px solid var(--color-outline-variant, #e2e8f0)",
                  borderRadius: "6px",
                  padding: "0 8px",
                  height: "32px",
                }}
              >
                <Filter size={13} style={{ color: "var(--color-on-surface-variant, #64748b)", marginRight: "5px" }} />
                <select
                  id="dict-domain-filter"
                  value={selectedDomainFilter}
                  onChange={(e) => setSelectedDomainFilter(e.target.value)}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "var(--color-on-surface, #1e293b)",
                    fontSize: "12.5px",
                    fontWeight: 500,
                    cursor: "pointer",
                    outline: "none",
                    padding: "4px 0",
                  }}
                >
                  <option value="ALL">Todos os Domínios</option>
                  {categories.map((cat: any) => (
                    <option key={cat.name} value={cat.name}>
                      {cat.label || cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* DDD Category Filter */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  background: "var(--color-surface-container, #f8fafc)",
                  border: "1px solid var(--color-outline-variant, #e2e8f0)",
                  borderRadius: "6px",
                  padding: "0 8px",
                  height: "32px",
                }}
              >
                <Layers size={13} style={{ color: "var(--color-on-surface-variant, #64748b)", marginRight: "5px" }} />
                <select
                  id="dict-category-filter"
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "var(--color-on-surface, #1e293b)",
                    fontSize: "12.5px",
                    fontWeight: 500,
                    cursor: "pointer",
                    outline: "none",
                    padding: "4px 0",
                  }}
                >
                  <option value="ALL">Todos os Tipos (DDD)</option>
                  {DDD_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort selector */}
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  background: "var(--color-surface-container, #f8fafc)",
                  border: "1px solid var(--color-outline-variant, #e2e8f0)",
                  borderRadius: "6px",
                  padding: "0 8px",
                  height: "32px",
                }}
              >
                <ArrowUpDown size={13} style={{ color: "var(--color-on-surface-variant, #64748b)", marginRight: "5px" }} />
                <select
                  id="dict-sort-select"
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as SortOption)}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "var(--color-on-surface, #1e293b)",
                    fontSize: "12.5px",
                    fontWeight: 500,
                    cursor: "pointer",
                    outline: "none",
                    padding: "4px 0",
                  }}
                >
                  <option value="name-asc">Ordem (A-Z)</option>
                  <option value="name-desc">Ordem (Z-A)</option>
                  <option value="code-asc">Por Codename</option>
                  <option value="domain-asc">Por Domínio</option>
                </select>
              </div>

              {/* View Mode Toggle */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "var(--color-surface-container, #f1f5f9)",
                  padding: "2px",
                  borderRadius: "6px",
                  border: "1px solid var(--color-outline-variant, #e2e8f0)",
                  height: "28px",
                }}
              >
                <button
                  type="button"
                  id="btn-view-mode-table"
                  onClick={() => setViewMode("table")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    border: "none",
                    fontSize: "12px",
                    fontWeight: viewMode === "table" ? 600 : 500,
                    cursor: "pointer",
                    background: viewMode === "table" ? "var(--color-surface, #ffffff)" : "transparent",
                    color: viewMode === "table" ? "var(--color-on-surface, #0f172a)" : "var(--color-on-surface-variant, #64748b)",
                    boxShadow: viewMode === "table" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  <List size={13} />
                  <span>Tabela</span>
                </button>
                <button
                  type="button"
                  id="btn-view-mode-grid"
                  onClick={() => setViewMode("grid")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    border: "none",
                    fontSize: "12px",
                    fontWeight: viewMode === "grid" ? 600 : 500,
                    cursor: "pointer",
                    background: viewMode === "grid" ? "var(--color-surface, #ffffff)" : "transparent",
                    color: viewMode === "grid" ? "var(--color-on-surface, #0f172a)" : "var(--color-on-surface-variant, #64748b)",
                    boxShadow: viewMode === "grid" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  <LayoutGrid size={13} />
                  <span>Cards</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Alphabet Jump Strip */}
          {terms.length > 5 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "3px",
                overflowX: "auto",
                paddingTop: "6px",
                borderTop: "1px solid var(--color-outline-variant, #f1f5f9)",
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedLetter("ALL")}
                style={{
                  padding: "2px 8px",
                  borderRadius: "4px",
                  border: "none",
                  fontSize: "11px",
                  fontWeight: selectedLetter === "ALL" ? 600 : 500,
                  cursor: "pointer",
                  background: selectedLetter === "ALL" ? "var(--color-primary, #1a73e8)" : "transparent",
                  color: selectedLetter === "ALL" ? "#ffffff" : "var(--color-on-surface-variant, #64748b)",
                  transition: "all 0.15s ease",
                }}
              >
                Todos ({terms.length})
              </button>
              {availableLetters.map((ltr) => {
                const isActive = selectedLetter === ltr;
                return (
                  <button
                    key={ltr}
                    type="button"
                    onClick={() => setSelectedLetter(ltr)}
                    style={{
                      minWidth: "22px",
                      height: "22px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "4px",
                      border: "none",
                      fontSize: "11px",
                      fontWeight: isActive ? 600 : 500,
                      cursor: "pointer",
                      background: isActive ? "var(--color-primary, #1a73e8)" : "transparent",
                      color: isActive ? "#ffffff" : "var(--color-on-surface-variant, #64748b)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {ltr}
                  </button>
                );
              })}

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    handleSearchChange("");
                    setSelectedLetter("ALL");
                    setSelectedDomainFilter("ALL");
                    setSelectedCategoryFilter("ALL");
                  }}
                  style={{
                    marginLeft: "auto",
                    padding: "2px 6px",
                    background: "transparent",
                    border: "none",
                    fontSize: "11px",
                    color: "var(--color-primary, #1a73e8)",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Limpar Filtros
                </button>
              )}
            </div>
          )}
        </div>

        {/* Content Section: Table or Grid */}
        {isLoading ? (
          <div
            style={{
              padding: "48px 0",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Spinner size="md" message="Carregando dicionário ubíquo..." />
          </div>
        ) : filteredTerms.length === 0 ? (
          <Card>
            <CardContent style={{ padding: "40px 24px" }}>
              <EmptyState
                icon={<BookA size={38} />}
                title={
                  hasActiveFilters
                    ? "Nenhum termo correspondente"
                    : "Dicionário Vazio"
                }
                description={
                  hasActiveFilters
                    ? `Nenhum termo encontrado para os filtros atuais.`
                    : "Cadastre termos, codenames, categorias DDD e definições canônicas para unificar o vocabulário de domínio."
                }
                actionLabel={
                  hasActiveFilters
                    ? "Limpar Filtros"
                    : "Cadastrar Primeiro Termo"
                }
                onAction={
                  hasActiveFilters
                    ? () => {
                        handleSearchChange("");
                        setSelectedLetter("ALL");
                        setSelectedDomainFilter("ALL");
                        setSelectedCategoryFilter("ALL");
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
                  fontSize: "13px",
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
                        padding: "12px 18px",
                        fontWeight: 600,
                        color: "var(--color-on-surface, #334155)",
                        width: "24%",
                      }}
                    >
                      Termo & Sinônimos
                    </th>
                    <th
                      style={{
                        padding: "12px 18px",
                        fontWeight: 600,
                        color: "var(--color-on-surface, #334155)",
                        width: "18%",
                      }}
                    >
                      Code Name Oficial
                    </th>
                    <th
                      style={{
                        padding: "12px 18px",
                        fontWeight: 600,
                        color: "var(--color-on-surface, #334155)",
                        width: "16%",
                      }}
                    >
                      Domínio & Tipo
                    </th>
                    <th
                      style={{
                        padding: "12px 18px",
                        fontWeight: 600,
                        color: "var(--color-on-surface, #334155)",
                        width: "32%",
                      }}
                    >
                      Definição & Contexto
                    </th>
                    <th
                      style={{
                        padding: "12px 18px",
                        fontWeight: 600,
                        color: "var(--color-on-surface, #334155)",
                        width: "10%",
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
                        item.term === t.term &&
                        (item.codename === t.codename || item.code_name === t.code_name),
                    );
                    const codename = t.codename || t.code_name || "";
                    const isCodeCopied = copiedCodeId === codename;
                    const domainColor = getDomainColor(t.domain);
                    const dddInfo = getDddCategoryInfo(t.category);
                    const synonyms = t.synonyms || t.aliases || [];

                    return (
                      <tr
                        key={`${t.term}-${codename}-${originalIdx}`}
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
                        {/* Term & Synonyms */}
                        <td
                          style={{ padding: "12px 18px", verticalAlign: "top" }}
                        >
                          <div
                            style={{
                              fontWeight: 600,
                              color: "var(--color-on-surface, #0f172a)",
                              fontSize: "13.5px",
                            }}
                          >
                            {t.term}
                          </div>
                          {synonyms.length > 0 && (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                                marginTop: "4px",
                                flexWrap: "wrap",
                              }}
                            >
                              {synonyms.map((syn, sIdx) => (
                                <span
                                  key={sIdx}
                                  style={{
                                    fontSize: "10.5px",
                                    background:
                                      "var(--color-surface-container-high, #f1f5f9)",
                                    color:
                                      "var(--color-on-surface-variant, #475569)",
                                    padding: "1px 5px",
                                    borderRadius: "4px",
                                    border: "1px solid var(--color-outline-variant, #e2e8f0)",
                                  }}
                                >
                                  {syn}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* Code Name Badge with 1-click Copy */}
                        <td
                          style={{ padding: "12px 18px", verticalAlign: "top" }}
                        >
                          {codename ? (
                            <div
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                              }}
                            >
                              <code
                                style={{
                                  fontFamily: "var(--font-mono, monospace)",
                                  background:
                                    "var(--color-surface-container-high, #e0f2fe)",
                                  padding: "2px 7px",
                                  borderRadius: "4px",
                                  fontSize: "11.5px",
                                  color: "var(--color-primary, #0284c7)",
                                  fontWeight: 600,
                                  border: "1px solid rgba(2, 132, 199, 0.2)",
                                }}
                              >
                                {codename}
                              </code>
                              <IconButton
                                icon={
                                  isCodeCopied ? (
                                    <Check
                                      size={12}
                                      style={{
                                        color: "var(--color-success, #16a34a)",
                                      }}
                                    />
                                  ) : (
                                    <Copy size={12} />
                                  )
                                }
                                variant="ghost"
                                size="xs"
                                tooltip={
                                  isCodeCopied ? "Copiado!" : "Copiar Code Name"
                                }
                                onClick={() =>
                                  copyToClipboard(
                                    codename,
                                    "code",
                                    codename,
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

                        {/* Domain & Category Badges */}
                        <td
                          style={{ padding: "12px 18px", verticalAlign: "top" }}
                        >
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {t.domain && (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  width: "fit-content",
                                  padding: "1px 7px",
                                  borderRadius: 10,
                                  backgroundColor: `${domainColor}15`,
                                  borderColor: `${domainColor}40`,
                                  borderWidth: 1,
                                  borderStyle: "solid",
                                  color: domainColor,
                                  fontSize: 11,
                                  fontWeight: 600,
                                }}
                              >
                                <span
                                  style={{
                                    width: 5,
                                    height: 5,
                                    borderRadius: "50%",
                                    backgroundColor: domainColor,
                                  }}
                                />
                                {t.domain}
                              </span>
                            )}
                            {t.category && (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  width: "fit-content",
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                  backgroundColor: `${dddInfo.color}10`,
                                  color: dddInfo.color,
                                  border: `1px solid ${dddInfo.color}25`,
                                  fontSize: 10.5,
                                  fontWeight: 600,
                                }}
                              >
                                {t.category}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Definition & Context */}
                        <td
                          style={{
                            padding: "12px 18px",
                            verticalAlign: "top",
                            color: "var(--color-on-surface-variant, #334155)",
                            lineHeight: 1.5,
                            fontSize: "13px",
                          }}
                        >
                          <div>{t.definition}</div>
                          {t.context && (
                            <div
                              style={{
                                marginTop: "4px",
                                fontSize: "11px",
                                color: "var(--color-on-surface-variant, #64748b)",
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <span style={{ fontWeight: 600 }}>Contexto:</span>
                              <span>{t.context}</span>
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td
                          style={{
                            padding: "12px 18px",
                            verticalAlign: "top",
                            textAlign: "right",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <IconButton
                            icon={<Edit3 size={14} />}
                            variant="ghost"
                            size="xs"
                            tooltip="Editar termo"
                            onClick={() => handleEditTerm(t, originalIdx)}
                          />
                          <IconButton
                            icon={<Trash2 size={14} />}
                            variant="ghost"
                            size="xs"
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
              gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
              gap: "14px",
            }}
          >
            {filteredTerms.map((t) => {
              const originalIdx = terms.findIndex(
                (item) =>
                  item.term === t.term &&
                  (item.codename === t.codename || item.code_name === t.code_name),
              );
              const codename = t.codename || t.code_name || "";
              const isCodeCopied = copiedCodeId === codename;
              const domainColor = getDomainColor(t.domain);
              const dddInfo = getDddCategoryInfo(t.category);
              const synonyms = t.synonyms || t.aliases || [];

              return (
                <Card
                  key={`${t.term}-${codename}-${originalIdx}`}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    transition: "all 0.15s ease",
                    border: "1px solid var(--color-outline-variant, #e2e8f0)",
                  }}
                >
                  <CardContent style={{ padding: "16px" }}>
                    {/* Top Row: Domain & Category Badges + Actions */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "8px",
                        marginBottom: "10px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                        {t.domain && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "1px 7px",
                              borderRadius: 10,
                              backgroundColor: `${domainColor}15`,
                              borderColor: `${domainColor}40`,
                              borderWidth: 1,
                              borderStyle: "solid",
                              color: domainColor,
                              fontSize: 10.5,
                              fontWeight: 600,
                            }}
                          >
                            <span
                              style={{
                                width: 5,
                                height: 5,
                                borderRadius: "50%",
                                backgroundColor: domainColor,
                              }}
                            />
                            {t.domain}
                          </span>
                        )}
                        {t.category && (
                          <span
                            style={{
                              padding: "1px 5px",
                              borderRadius: 4,
                              backgroundColor: `${dddInfo.color}10`,
                              color: dddInfo.color,
                              border: `1px solid ${dddInfo.color}25`,
                              fontSize: 10,
                              fontWeight: 600,
                            }}
                          >
                            {t.category}
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "2px",
                        }}
                      >
                        <IconButton
                          icon={<Edit3 size={13} />}
                          variant="ghost"
                          size="xs"
                          tooltip="Editar termo"
                          onClick={() => handleEditTerm(t, originalIdx)}
                        />
                        <IconButton
                          icon={<Trash2 size={13} />}
                          variant="ghost"
                          size="xs"
                          tooltip="Remover termo"
                          onClick={() => handleDeleteTerm(originalIdx)}
                          style={{ color: "var(--color-error, #ef4444)" }}
                        />
                      </div>
                    </div>

                    {/* Title */}
                    <h3
                      style={{
                        margin: "0 0 6px 0",
                        fontSize: "15px",
                        fontWeight: 700,
                        color: "var(--color-on-surface, #0f172a)",
                        lineHeight: 1.3,
                      }}
                    >
                      {t.term}
                    </h3>

                    {/* Codename Pill */}
                    {codename && (
                      <div
                        style={{
                          marginBottom: "10px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          background: "var(--color-surface-container, #f1f5f9)",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          border:
                            "1px solid var(--color-outline-variant, #e2e8f0)",
                        }}
                      >
                        <code
                          style={{
                            fontFamily: "var(--font-mono, monospace)",
                            fontSize: "11px",
                            fontWeight: 600,
                            color: "var(--color-primary, #1a73e8)",
                          }}
                        >
                          {codename}
                        </code>
                        <IconButton
                          size="xs"
                          variant="ghost"
                          onClick={() =>
                            copyToClipboard(codename, "code", codename)
                          }
                          title={isCodeCopied ? "Copiado!" : "Copiar Code Name"}
                          icon={
                            isCodeCopied ? (
                              <Check size={11} style={{ color: "var(--color-success, #16a34a)" }} />
                            ) : (
                              <Copy size={11} />
                            )
                          }
                        />
                      </div>
                    )}

                    {/* Definition */}
                    <p
                      style={{
                        margin: 0,
                        fontSize: "12.5px",
                        lineHeight: 1.5,
                        color: "var(--color-on-surface-variant, #334155)",
                      }}
                    >
                      {t.definition}
                    </p>

                    {/* Synonyms Chips */}
                    {synonyms.length > 0 && (
                      <div
                        style={{
                          marginTop: "10px",
                          paddingTop: "8px",
                          borderTop:
                            "1px solid var(--color-outline-variant, #f1f5f9)",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          flexWrap: "wrap",
                        }}
                      >
                        <Tag
                          size={11}
                          style={{ color: "var(--color-outline, #94a3b8)" }}
                        />
                        {synonyms.map((syn, sIdx) => (
                          <span
                            key={sIdx}
                            style={{
                              fontSize: "10.5px",
                              background:
                                "var(--color-surface-container-high, #f1f5f9)",
                              color:
                                "var(--color-on-surface-variant, #475569)",
                              padding: "1px 5px",
                              borderRadius: "4px",
                              border: "1px solid var(--color-outline-variant, #e2e8f0)",
                            }}
                          >
                            {syn}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Context Footer */}
                    {t.context && (
                      <div
                        style={{
                          marginTop: synonyms.length > 0 ? "6px" : "10px",
                          fontSize: "11px",
                          color: "var(--color-on-surface-variant, #64748b)",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>Contexto:</span>
                        <span>{t.context}</span>
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
          style={{ display: "flex", flexDirection: "column", gap: "14px" }}
        >
          {formError && (
            <div
              style={{
                color: "#ef4444",
                fontSize: "12.5px",
                padding: "8px 12px",
                background: "rgba(239, 68, 68, 0.1)",
                borderRadius: "6px",
                border: "1px solid rgba(239, 68, 68, 0.25)",
              }}
            >
              {formError}
            </div>
          )}
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

          {/* Domínio (Categorias do Projeto com Cores Dinâmicas) */}
          <FormField
            label="Domínio de Negócio (do Projeto)"
            required
            helperText="Selecione o domínio/categoria correspondente configurado no projeto."
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
              {categories.map((cat: any) => {
                const isSelected = inputDomain.toLowerCase() === (cat.name || "").toLowerCase();
                const color = cat.color || "#3b82f6";
                return (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => setInputDomain(cat.name)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "4px 10px",
                      borderRadius: 16,
                      border: `1.5px solid ${isSelected ? color : "var(--color-outline-variant, #e2e8f0)"}`,
                      backgroundColor: isSelected ? `${color}18` : "#ffffff",
                      color: isSelected ? color : "var(--color-on-surface, #334155)",
                      fontSize: 11.5,
                      fontWeight: isSelected ? 600 : 500,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        backgroundColor: color,
                      }}
                    />
                    <span>{cat.label || cat.name}</span>
                  </button>
                );
              })}
            </div>
          </FormField>

          {/* Classificação Conceitual DDD */}
          <FormField
            label="Classificação Arquitetural (DDD)"
            helperText="Padrão conceitual no domínio da aplicação."
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 2 }}>
              {DDD_CATEGORIES.map((cat) => {
                const isSelected = inputCategory.toLowerCase() === cat.id.toLowerCase();
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setInputCategory(cat.id)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "3px 8px",
                      borderRadius: 5,
                      border: `1px solid ${isSelected ? cat.color : "var(--color-outline-variant, #e2e8f0)"}`,
                      backgroundColor: isSelected ? `${cat.color}18` : "var(--color-surface, #ffffff)",
                      color: isSelected ? cat.color : "var(--color-on-surface-variant, #475569)",
                      fontSize: 11,
                      fontWeight: isSelected ? 600 : 500,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    title={cat.desc}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </FormField>

          {/* Contexto Delimitado */}
          <FormField
            label="Contexto Delimitado / Escopo de Uso"
            helperText="Contexto ou módulo onde este termo é empregado (ex: faturamento, dispensação, autenticação)."
          >
            <Input
              id="dict-input-context"
              placeholder="ex: faturamento, dispensação, prescrição"
              value={inputContext}
              onChange={(e) => setInputContext(e.target.value)}
            />
          </FormField>

          {/* Sinônimos & Aliases */}
          <FormField
            label="Sinônimos / Aliases (separados por vírgula)"
            helperText="Termos alternativos e variações textuais que referenciam este mesmo conceito."
          >
            <Input
              id="dict-input-synonyms"
              placeholder="ex: Idempotency Key, Chave Única"
              value={inputSynonyms}
              onChange={(e) => setInputSynonyms(e.target.value)}
            />
          </FormField>

          {/* Definição */}
          <FormField
            label="Definição / Significado Inequívoco"
            required
            helperText="Explicação clara do significado exato do conceito no domínio da aplicação."
          >
            <Textarea
              id="dict-input-definition"
              rows={3}
              placeholder="Descreva o significado exato no contexto da arquitetura e negócio..."
              value={inputDefinition}
              onChange={(e) => setInputDefinition(e.target.value)}
            />
          </FormField>
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
            helperText="Formato: [{ 'term': '...', 'codename': '...', 'domain': '...', 'category': '...', 'definition': '...', 'context': '...', 'synonyms': [...] }]"
          >
            <Textarea
              id="dict-import-textarea"
              rows={8}
              placeholder={`[\n  {\n    "term": "Chave de Idempotência",\n    "codename": "IDEMPOTENCY_KEY",\n    "domain": "arquitetura",\n    "category": "Value Object",\n    "definition": "Identificador exclusivo para evitar duplicidade de operações.",\n    "context": "apis, mensageria",\n    "synonyms": ["Idempotency Key", "Chave Única"]\n  }\n]`}
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
