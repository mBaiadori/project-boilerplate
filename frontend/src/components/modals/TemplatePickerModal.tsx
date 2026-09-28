import React, { useState, useEffect, useMemo, useRef } from "react";
import { useTemplate } from "../../hooks/useTemplate";
import type { TemplateItem } from "../../types";
import {
  Modal,
  Button,
  Tabs,
  SearchInput,
  Badge,
  AlertBanner,
  EmptyState,
  Spinner,
  FilterChips,
} from "../ui";
import {
  BookTemplate,
  Globe,
  FolderGit2,
  FileText,
  Check,
  Download,
} from "lucide-react";

interface TemplatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called when user selects a project/merged template */
  onSelect: (template: TemplateItem) => void;
}

type TabMode = "projeto" | "comunidade";

export const TemplatePickerModal: React.FC<TemplatePickerModalProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  const {
    templates,
    communityTemplates,
    loading,
    importingId,
    error,
    fetchTemplates,
    fetchCommunityTemplates,
    importFromCommunity,
  } = useTemplate();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("Todos");
  const [tab, setTab] = useState<TabMode>("projeto");
  const [importFeedback, setImportFeedback] = useState<{
    id: string;
    ok: boolean;
    msg: string;
  } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
      fetchCommunityTemplates();
      setSearch("");
      setActiveCategory("Todos");
      setTab("projeto");
      setImportFeedback(null);
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [isOpen, fetchTemplates, fetchCommunityTemplates]);

  // Active list depending on tab
  const activeList = tab === "comunidade" ? communityTemplates : templates;

  // Derive unique categories from active list
  const categories = useMemo(() => {
    const cats = new Set<string>();
    activeList.forEach((t) => {
      if (t.category) cats.add(t.category);
    });
    return ["Todos", ...Array.from(cats).sort()];
  }, [activeList]);

  // Filter by search and category
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return activeList.filter((t) => {
      const matchesSearch =
        !q ||
        t.title.toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q) ||
        (t.tags || []).some((tag) => tag.toLowerCase().includes(q));
      const matchesCategory =
        activeCategory === "Todos" || t.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [activeList, search, activeCategory]);

  const handleImport = async (tpl: TemplateItem) => {
    const result = await importFromCommunity(tpl.id);
    setImportFeedback({ id: tpl.id, ok: result.success, msg: result.message });
    if (result.success) {
      // Auto-switch to project tab to show it
      setTimeout(() => {
        setTab("projeto");
        setImportFeedback(null);
      }, 1400);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <BookTemplate size={20} style={{ color: "var(--md-sys-color-primary, #1a73e8)" }} />
          <span>Escolher Template</span>
        </div>
      }
      subtitle="Selecione um template de especificação ou importe da comunidade"
      footer={
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
          }}
        >
          <span style={{ fontSize: "12.5px", color: "var(--md-sys-color-on-surface-variant, #5f6368)" }}>
            {filtered.length} template{filtered.length !== 1 ? "s" : ""} encontrado(s)
          </span>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Abas */}
        <Tabs<TabMode>
          activeTab={tab}
          onChange={(newTab) => {
            setTab(newTab);
            setActiveCategory("Todos");
            setSearch("");
          }}
          variant="underline"
          tabs={[
            {
              id: "projeto",
              label: "Do Projeto",
              icon: <FolderGit2 size={15} />,
              count: templates.length,
              badgeVariant: "primary",
            },
            {
              id: "comunidade",
              label: "Da Comunidade",
              icon: <Globe size={15} />,
              count: communityTemplates.length,
              badgeVariant: "purple",
            },
          ]}
        />

        {/* Busca */}
        <SearchInput
          ref={searchRef}
          id="template-picker-search"
          placeholder="Pesquisar templates por título, descrição ou tags..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch("")}
        />

        {/* Chips de Categoria */}
        <FilterChips
          items={categories}
          activeId={activeCategory}
          onChange={(cat) => setActiveCategory(cat)}
          size="sm"
        />

        {/* Info Banner Comunidade */}
        {tab === "comunidade" && (
          <AlertBanner
            type="info"
            message="Templates da comunidade são somente-leitura. Importe-os para o projeto para poder utilizá-los no editor."
          />
        )}

        {error && <AlertBanner type="error" message={error} />}

        {/* Lista de Templates */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            maxHeight: "360px",
            overflowY: "auto",
          }}
        >
          {loading ? (
            <Spinner size="lg" message="Carregando templates..." />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<BookTemplate size={36} />}
              title="Nenhum template encontrado"
              description={
                search
                  ? `Nenhum resultado para "${search}".`
                  : "Nenhum template disponível nesta categoria."
              }
            />
          ) : (
            filtered.map((tpl) => {
              const isImporting = importingId === tpl.id;
              const feedback =
                importFeedback?.id === tpl.id ? importFeedback : null;
              const alreadyImported =
                tab === "comunidade" && templates.some((t) => t.id === tpl.id);

              return (
                <div
                  key={tpl.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: "1px solid var(--md-sys-color-outline-variant, #dadce0)",
                    background: "var(--md-sys-color-surface, #ffffff)",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      flexShrink: 0,
                      background: "var(--md-sys-color-surface-container, #f1f3f4)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--md-sys-color-primary, #1a73e8)",
                    }}
                  >
                    <FileText size={18} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 2,
                        flexWrap: "wrap",
                      }}
                    >
                      <strong style={{ fontSize: "13.5px" }}>{tpl.title}</strong>
                      {tpl.badge && (
                        <Badge
                          variant={
                            tpl.source === "community" ? "purple" : "neutral"
                          }
                          size="sm"
                        >
                          {tpl.badge}
                        </Badge>
                      )}
                      {alreadyImported && (
                        <Badge variant="success" size="sm" icon={<Check size={11} />}>
                          Importado
                        </Badge>
                      )}
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "12px",
                        color: "var(--md-sys-color-on-surface-variant, #5f6368)",
                        lineHeight: 1.4,
                      }}
                    >
                      {tpl.description}
                    </p>
                    {(tpl.tags || []).length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          gap: 4,
                          marginTop: 6,
                          flexWrap: "wrap",
                        }}
                      >
                        {(tpl.tags || []).slice(0, 5).map((tag) => (
                          <span
                            key={tag}
                            style={{
                              fontSize: "10.5px",
                              padding: "1px 6px",
                              borderRadius: 4,
                              background: "var(--md-sys-color-surface-container-high, #e8eaed)",
                              color: "var(--md-sys-color-on-surface-variant, #5f6368)",
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {feedback && (
                      <p
                        style={{
                          margin: "4px 0 0",
                          fontSize: "11px",
                          color: feedback.ok ? "#137333" : "#c5221f",
                          fontWeight: 500,
                        }}
                      >
                        {feedback.ok ? "✓ " : "✗ "}
                        {feedback.msg}
                      </p>
                    )}
                  </div>

                  <div style={{ flexShrink: 0 }}>
                    {tab === "projeto" ? (
                      <Button
                        id={`btn-select-tpl-${tpl.id}`}
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          onSelect(tpl);
                          onClose();
                        }}
                      >
                        Usar
                      </Button>
                    ) : (
                      <Button
                        id={`btn-import-tpl-${tpl.id}`}
                        type="button"
                        variant={alreadyImported ? "secondary" : "primary"}
                        size="sm"
                        leftIcon={<Download size={13} />}
                        isLoading={isImporting}
                        onClick={() => handleImport(tpl)}
                      >
                        {alreadyImported ? "Reimportar" : "Importar"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
};
