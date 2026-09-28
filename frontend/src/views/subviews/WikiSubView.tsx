import React, { useState, useEffect, useCallback } from "react";
import { marked } from "marked";
import { useWorkspace } from "../../context/WorkspaceContext";
import { useAI } from "../../context/AIContext";
import { API } from "../../services/api";
import {
  SearchInput,
  FormField,
  Input,
  Textarea,
  Button,
  IconButton,
  Badge,
  EmptyState,
  Spinner,
} from "../../components/ui";
import { 
  BookOpen, 
  Plus, 
  Edit3, 
  Copy, 
  Trash2, 
  Check, 
  ShieldCheck, 
  Layers, 
  AlertTriangle, 
  History, 
  Sparkles,
  Library
} from "lucide-react";

interface CategoryMetaItem {
  label: string;
  short: string;
  badge: string;
  icon: React.ReactNode;
  color: string;
  badgeVariant: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral';
  desc: string;
}

const CATEGORY_META: Record<string, CategoryMetaItem> = {
  decisions: {
    label: "Decisões Arquiteturais",
    short: "Decisões",
    badge: "ADR",
    icon: <Layers size={15} />,
    color: "var(--color-primary)",
    badgeVariant: "primary",
    desc: "Decisões técnicas e escolhas de arquitetura que definem a stack e contratos.",
  },
  _rules: {
    label: "Regras & Invariantes",
    short: "Regras",
    badge: "REGRA",
    icon: <ShieldCheck size={15} />,
    color: "var(--color-success)",
    badgeVariant: "success",
    desc: "Políticas inegociáveis de segurança, dados e qualidade seguidas em todo prompt.",
  },
  concepts: {
    label: "Conceitos & Domínio",
    short: "Conceitos",
    badge: "CONCEITO",
    icon: <Sparkles size={15} />,
    color: "#a855f7",
    badgeVariant: "purple",
    desc: "Glossário ubíquo, regras de negócio e limites de contexto do produto.",
  },
  gotchas: {
    label: "Gotchas & Armadilhas",
    short: "Gotchas",
    badge: "GOTCHA",
    icon: <AlertTriangle size={15} />,
    color: "var(--color-warning)",
    badgeVariant: "warning",
    desc: "Bugs conhecidos, armadilhas de libs e comportamentos não óbvios documentados.",
  },
  handoffs: {
    label: "Handoffs de Sessão",
    short: "Handoffs",
    badge: "HANDOFF",
    icon: <History size={15} />,
    color: "var(--color-info)",
    badgeVariant: "info",
    desc: "Passagens de bastão de contexto compiladas para continuidade entre agentes.",
  },
};

const STARTER_TEMPLATES = [
  {
    category: "decisions",
    title: "ADR 0001: Autenticação Stateless e Segurança",
    slug: "0001-autenticacao-stateless",
    content: `## Contexto & Motivação\nA aplicação necessita de um mecanismo de autenticação seguro, escalável horizontalmente e compatível com microserviços e mobile.\n\n## Decisão Tomada\nAdotamos autenticação stateless baseada em **JWT (JSON Web Tokens)** assinados com chaves assimétricas **RSA-256 (RS256)**:\n- Tokens de acesso com TTL curto (15 minutos).\n- Refresh tokens armazenados em cookies seguros com flags \`HttpOnly\`, \`Secure\` e \`SameSite=Strict\`.\n\n## Consequências & Invariantes\n- Nenhum estado de sessão é mantido na memória dos nós de aplicação.\n- Toda rota autenticada valida a assinatura do token localmente via chave pública.`,
  },
  {
    category: "_rules",
    title: "Regra de Governança: Conformidade LGPD & Logs Sanitizados",
    slug: "regra-lgpd-sanitizacao-logs",
    content: `## Propósito\nGarantir que nenhum dado pessoal sensível (PII), chaves de API, senhas ou tokens trafeguem ou sejam persistidos em logs abertos.\n\n## Invariantes Obrigatórias\n1. **Sanitização Automática:** Todos os logs e transcrições passam por filtros de expressão regular antes de gravação no Git.\n2. **Sem Credenciais no Código:** Segredos devem ser injetados exclusivamente via variáveis de ambiente ou Infisical.\n3. **Auditoria:** Apenas identificadores anônimos (UUID) podem ser indexados em métricas públicas.`,
  },
];

interface WikiEntry {
  category: string;
  slug: string;
  title: string;
  content: string;
  updated_at?: string;
}

export const WikiSubView: React.FC = () => {
  const { activeRepo } = useWorkspace();
  const { setDynamicContext } = useAI();
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [entries, setEntries] = useState<WikiEntry[]>([]);
  const [activeEntry, setActiveEntry] = useState<WikiEntry | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Edit / Create State
  const [isEditing, setIsEditing] = useState(false);
  const [editCategory, setEditCategory] = useState<string>("decisions");
  const [editTitle, setEditTitle] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editContent, setEditContent] = useState("");

  const loadWikiEntries = useCallback(async () => {
    if (!activeRepo) return;
    setIsLoading(true);
    try {
      const res = await API.getMemoryWiki({
        repo: activeRepo.name,
        query: searchQuery,
      });
      if (res.ok && res.data) {
        const rawEntries: WikiEntry[] = res.data.entries || [];
        setEntries(rawEntries);
        if (rawEntries.length > 0 && !activeEntry) {
          setActiveEntry(rawEntries[0]);
        }
      }
    } catch (err) {
      console.error("[WikiSubView] Erro ao carregar wiki:", err);
    } finally {
      setIsLoading(false);
    }
  }, [activeRepo, searchQuery, activeEntry]);

  useEffect(() => {
    loadWikiEntries();
  }, [loadWikiEntries]);

  useEffect(() => {
    if (activeEntry) {
      setDynamicContext({
        filePath: `wiki/${activeEntry.category}/${activeEntry.slug}.md`,
        content: `# ${activeEntry.title}\n\nCategoria: ${activeEntry.category}\n\n${activeEntry.content}`,
        badge: `📖 Wiki: ${activeEntry.title}`,
      });
    } else if (entries.length > 0) {
      setDynamicContext({
        filePath: "wiki/summary.json",
        content: JSON.stringify(entries, null, 2),
        badge: "📖 Base de Conhecimento Wiki",
      });
    }
    return () => {
      setDynamicContext(null);
    };
  }, [activeEntry, entries, setDynamicContext]);

  const handleStartNewEntry = () => {
    setEditCategory(activeCategory === "all" ? "decisions" : activeCategory);
    setEditTitle("");
    setEditSlug("");
    setEditContent("");
    setIsEditing(true);
  };

  const handleStartEdit = () => {
    if (!activeEntry) return;
    setEditCategory(activeEntry.category);
    setEditTitle(activeEntry.title);
    setEditSlug(activeEntry.slug);
    setEditContent(activeEntry.content);
    setIsEditing(true);
  };

  const handleSaveEntry = async () => {
    if (!editTitle.trim() || !activeRepo) return;
    const slug =
      editSlug.trim() ||
      editTitle
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\-_]/g, "-");

    try {
      await API.saveMemoryWikiEntry({
        repo: activeRepo.name,
        category: editCategory,
        slug,
        title: editTitle.trim(),
        content: editContent,
      });
      setIsEditing(false);
      const savedEntry: WikiEntry = {
        category: editCategory,
        slug,
        title: editTitle.trim(),
        content: editContent,
      };
      setActiveEntry(savedEntry);
      await loadWikiEntries();
    } catch (err) {
      console.error("[WikiSubView] Erro ao salvar entrada:", err);
    }
  };

  const handleDeleteEntry = async () => {
    if (!activeEntry || !activeRepo) return;
    if (window.confirm(`Excluir a entrada "${activeEntry.title}"?`)) {
      try {
        await API.deleteMemoryWikiEntry({
          repo: activeRepo.name,
          category: activeEntry.category,
          slug: activeEntry.slug,
        });
        setActiveEntry(null);
        setIsEditing(false);
        await loadWikiEntries();
      } catch (err) {
        console.error("[WikiSubView] Erro ao deletar entrada:", err);
      }
    }
  };

  const handleInstallStarter = async (
    starter: (typeof STARTER_TEMPLATES)[0],
  ) => {
    if (!activeRepo) return;
    try {
      await API.saveMemoryWikiEntry({
        repo: activeRepo.name,
        category: starter.category,
        slug: starter.slug,
        title: starter.title,
        content: starter.content,
      });
      await loadWikiEntries();
    } catch (err) {
      console.error("Erro ao instalar starter:", err);
    }
  };

  const handleCopyMarkdown = () => {
    if (!activeEntry) return;
    navigator.clipboard.writeText(activeEntry.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredEntries = entries.filter((e) => {
    const matchesCategory =
      activeCategory === "all" || e.category === activeCategory;
    const matchesSearch =
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.content &&
        e.content.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const getCategoryCount = (catKey: string) => {
    if (catKey === "all") return entries.length;
    return entries.filter((e) => e.category === catKey).length;
  };

  return (
    <div
      id="subview-wiki"
      style={{ display: "flex", height: "100%", width: "100%", overflow: "hidden", background: "var(--color-surface)" }}
    >
      {/* Left Sidebar: Categories, Search & Document List */}
      <aside
        style={{
          width: "320px",
          flexShrink: 0,
          borderRight: "1px solid var(--color-outline-variant)",
          display: "flex",
          flexDirection: "column",
          background: "var(--color-surface-container-low)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px",
            borderBottom: "1px solid var(--color-outline-variant)",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "var(--radius-md, 8px)",
                  background: "var(--color-primary-container)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--color-primary)",
                }}
              >
                <BookOpen size={18} />
              </div>
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "var(--color-on-surface)",
                  }}
                >
                  Base Wiki & Memória
                </h2>
                <span style={{ fontSize: "11px", color: "var(--color-outline)" }}>
                  Decisões, Regras e ADRs
                </span>
              </div>
            </div>

            <Button
              id="btn-wiki-new-entry"
              variant="primary"
              size="sm"
              onClick={handleStartNewEntry}
              icon={<Plus size={14} />}
            >
              Nova Nota
            </Button>
          </div>

          <SearchInput
            id="wiki-search-input"
            placeholder="Buscar em todas as notas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery("")}
          />
        </div>

        {/* Categories List */}
        <div
          style={{
            padding: "10px 12px 6px 12px",
            borderBottom: "1px solid var(--color-outline-variant)",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
          }}
          id="wiki-category-nav"
        >
          <button
            type="button"
            className={`wiki-nav-btn ${activeCategory === "all" ? "active" : ""}`}
            data-cat="all"
            onClick={() => setActiveCategory("all")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "7px 10px",
              borderRadius: "var(--radius-md, 6px)",
              border: "none",
              background:
                activeCategory === "all"
                  ? "var(--color-primary-container)"
                  : "transparent",
              color:
                activeCategory === "all"
                  ? "var(--color-primary)"
                  : "var(--color-on-surface-variant)",
              fontSize: "12.5px",
              fontWeight: activeCategory === "all" ? 600 : 500,
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Library size={15} />
              <span>Todas as Notas</span>
            </div>
            <Badge variant="neutral" size="sm">{getCategoryCount("all")}</Badge>
          </button>

          {Object.entries(CATEGORY_META).map(([catKey, meta]) => {
            const count = getCategoryCount(catKey);
            const isActive = activeCategory === catKey;
            return (
              <button
                key={catKey}
                type="button"
                className={`wiki-nav-btn ${isActive ? "active" : ""}`}
                data-cat={catKey}
                onClick={() => setActiveCategory(catKey)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 10px",
                  borderRadius: "var(--radius-md, 6px)",
                  border: "none",
                  background: isActive
                    ? "var(--color-primary-container)"
                    : "transparent",
                  color: isActive
                    ? "var(--color-primary)"
                    : "var(--color-on-surface-variant)",
                  fontSize: "12px",
                  fontWeight: isActive ? 600 : 500,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ color: meta.color }}>{meta.icon}</span>
                  <span>{meta.label}</span>
                </div>
                <Badge variant={meta.badgeVariant} size="sm">{count}</Badge>
              </button>
            );
          })}
        </div>

        {/* Entries List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
          {isLoading ? (
            <div style={{ padding: "32px 0", display: "flex", justifyContent: "center" }}>
              <Spinner size="md" message="Carregando notas..." />
            </div>
          ) : filteredEntries.length === 0 ? (
            <div
              style={{
                padding: "24px 16px",
                textAlign: "center",
                color: "var(--color-outline)",
                fontSize: "12.5px",
              }}
            >
              Nenhuma nota encontrada.
            </div>
          ) : (
            filteredEntries.map((entry) => {
              const isSelected =
                activeEntry?.slug === entry.slug &&
                activeEntry?.category === entry.category;
              const meta =
                CATEGORY_META[entry.category] || CATEGORY_META.decisions;
              return (
                <div
                  key={`${entry.category}-${entry.slug}`}
                  onClick={() => {
                    setActiveEntry(entry);
                    setIsEditing(false);
                  }}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "var(--radius-md, 8px)",
                    cursor: "pointer",
                    border: isSelected ? "1px solid var(--color-primary)" : "1px solid transparent",
                    background: isSelected
                      ? "var(--color-primary-container)"
                      : "transparent",
                    transition: "all 0.15s ease",
                    marginBottom: "4px",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "var(--color-surface-container)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      marginBottom: "4px",
                    }}
                  >
                    <Badge variant={meta.badgeVariant} size="sm">
                      {meta.badge}
                    </Badge>
                  </div>
                  <strong
                    style={{
                      fontSize: "13px",
                      color: "var(--color-on-surface)",
                      display: "block",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {entry.title}
                  </strong>
                  <span
                    style={{ fontSize: "11px", color: "var(--color-outline)", fontFamily: "var(--font-mono, monospace)" }}
                  >
                    {entry.slug}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Reader / Editor Pane */}
      <main
        style={{
          flex: 1,
          height: "100%",
          overflowY: "auto",
          padding: "28px 40px",
          background: "var(--color-surface)",
        }}
      >
        {isEditing ? (
          <div
            style={{
              maxWidth: "800px",
              margin: "0 auto",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid var(--color-outline-variant)",
                paddingBottom: "14px",
              }}
            >
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "var(--color-on-surface)" }}>
                {activeEntry ? "Editar Nota do Wiki" : "Nova Nota no Wiki"}
              </h3>
              <div style={{ display: "flex", gap: "8px" }}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveEntry}
                  disabled={!editTitle.trim()}
                  icon={<Check size={14} />}
                >
                  Salvar Nota
                </Button>
              </div>
            </div>

            <FormField label="Categoria">
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "var(--radius-md, 8px)",
                  border: "1px solid var(--color-outline-variant)",
                  background: "var(--color-surface-container)",
                  color: "var(--color-on-surface)",
                  fontSize: "13px",
                  outline: "none",
                }}
              >
                {Object.entries(CATEGORY_META).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Título da Nota" required>
              <Input
                placeholder="ex: ADR 0002: Cache Distribuído com Redis"
                value={editTitle}
                onChange={(e) => {
                  setEditTitle(e.target.value);
                  if (!editSlug) {
                    setEditSlug(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9\-_]/g, "-"),
                    );
                  }
                }}
              />
            </FormField>

            <FormField label="Slug (Identificador do Arquivo)">
              <Input
                placeholder="ex: 0002-cache-redis"
                value={editSlug}
                onChange={(e) => setEditSlug(e.target.value)}
              />
            </FormField>

            <FormField label="Conteúdo Markdown" required>
              <Textarea
                rows={16}
                style={{
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: "13px",
                  lineHeight: 1.6,
                }}
                placeholder="## Contexto & Decisão..."
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
              />
            </FormField>
          </div>
        ) : activeEntry ? (
          <div style={{ maxWidth: "850px", margin: "0 auto" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid var(--color-outline-variant)",
                paddingBottom: "16px",
                marginBottom: "24px",
                gap: "16px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Badge
                  variant={CATEGORY_META[activeEntry.category]?.badgeVariant || "primary"}
                  size="md"
                >
                  {CATEGORY_META[activeEntry.category]?.badge || "WIKI"}
                </Badge>
                <h1
                  style={{
                    margin: 0,
                    fontSize: "20px",
                    fontWeight: 700,
                    color: "var(--color-on-surface)",
                  }}
                >
                  {activeEntry.title}
                </h1>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleStartEdit}
                  icon={<Edit3 size={14} />}
                >
                  Editar
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCopyMarkdown}
                  icon={copied ? <Check size={14} style={{ color: "var(--color-success)" }} /> : <Copy size={14} />}
                >
                  {copied ? "Copiado!" : "Copiar"}
                </Button>
                <IconButton
                  variant="ghost"
                  size="sm"
                  onClick={handleDeleteEntry}
                  tooltip="Excluir Nota"
                  icon={<Trash2 size={15} style={{ color: "var(--color-error)" }} />}
                />
              </div>
            </div>

            <article
              className="markdown-body"
              dangerouslySetInnerHTML={{
                __html: marked.parse(activeEntry.content || "") as string,
              }}
              style={{ fontSize: "14.5px", lineHeight: 1.7 }}
            />
          </div>
        ) : (
          <div style={{ maxWidth: "600px", margin: "60px auto", textAlign: "center" }}>
            <EmptyState
              icon={<BookOpen size={48} />}
              title="Wiki & Memória Contínua"
              description="Esta base armazena o conhecimento vivo de arquitetura, invariantes e ADRs sincronizadas diretamente no Git sob .spec-memory/."
              actionLabel="Criar Primeira Nota"
              onAction={handleStartNewEntry}
            />

            <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap", marginTop: "24px" }}>
              {STARTER_TEMPLATES.map((starter, i) => (
                <Button
                  key={i}
                  variant="secondary"
                  size="sm"
                  onClick={() => handleInstallStarter(starter)}
                  icon={<Plus size={13} />}
                >
                  Adicionar {starter.title.split(":")[0]}
                </Button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
