import { marked } from "marked";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { DictionaryPopoverData } from "../../../../components/dictionary/DictionaryPopover";
import { useAI } from "../../../../context/AIContext";
import { useWorkspace } from "../../../../context/WorkspaceContext";
import { API } from "../../../../services/api";
import { decorateHtmlWithTerms, findDictionaryTerm } from "../../../../utils/dictionary-matcher";
import { STARTER_TEMPLATES, type WikiEntry } from "../types";

export function useWikiData() {
  const { activeRepo, dictionaryTerms } = useWorkspace();
  const { setDynamicContext } = useAI();
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [entries, setEntries] = useState<WikiEntry[]>([]);
  const [activeEntry, setActiveEntry] = useState<WikiEntry | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dictPopoverData, setDictPopoverData] = useState<DictionaryPopoverData | null>(null);

  // Edit / Create State
  const [isEditing, setIsEditing] = useState(false);
  const [editCategory, setEditCategory] = useState<string>("decisions");
  const [editTitle, setEditTitle] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editContent, setEditContent] = useState("");

  const renderedHtml = useMemo(() => {
    if (!activeEntry?.content) return "";
    const rawHtml = marked.parse(activeEntry.content) as string;
    return decorateHtmlWithTerms(rawHtml, dictionaryTerms || []);
  }, [activeEntry?.content, dictionaryTerms]);

  const handleArticleMouseMove = (e: React.MouseEvent) => {
    const target = (e.target as HTMLElement).closest(".dict-term-highlight") as HTMLElement | null;
    if (target && dictionaryTerms && dictionaryTerms.length > 0) {
      const termKey = target.getAttribute("data-term-key") || target.textContent || "";
      const match = findDictionaryTerm(termKey, dictionaryTerms);
      if (match) {
        const t = match.term;
        setDictPopoverData({
          termId: t.id,
          term: t.term,
          codename: t.codename || t.code_name || "",
          domain: t.domain || t.category || "",
          definition: t.definition || "",
          synonyms: Array.isArray(t.synonyms) ? t.synonyms : t.aliases || [],
          rect: target.getBoundingClientRect(),
        });
      }
    }
  };

  const loadWikiEntries = useCallback(async () => {
    if (!activeRepo) return;
    setIsLoading(true);
    try {
      const res = await API.getMemoryWiki({
        repo: activeRepo.name,
        query: searchQuery,
      });
      if (res.ok && res.data) {
        const rawEntries: WikiEntry[] = res.data.entries || res.data.wiki || [];
        setEntries(rawEntries);
        setActiveEntry((prev) => {
          if (prev && rawEntries.some((e) => e.slug === prev.slug)) {
            return prev;
          }
          return rawEntries[0] || null;
        });
      }
    } catch (err) {
      console.error("[WikiSubView] Erro ao carregar wiki:", err);
    } finally {
      setIsLoading(false);
    }
  }, [activeRepo?.name, searchQuery]);

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

  const handleInstallStarter = async (starter: (typeof STARTER_TEMPLATES)[0]) => {
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
      (e.content && e.content.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const getCategoryCount = (catKey: string) => {
    if (catKey === "all") return entries.length;
    return entries.filter((e) => e.category === catKey).length;
  };

  return {
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    entries,
    activeEntry,
    setActiveEntry,
    isLoading,
    copied,
    dictPopoverData,
    setDictPopoverData,
    isEditing,
    setIsEditing,
    editCategory,
    setEditCategory,
    editTitle,
    setEditTitle,
    editSlug,
    setEditSlug,
    editContent,
    setEditContent,
    renderedHtml,
    handleArticleMouseMove,
    loadWikiEntries,
    handleStartNewEntry,
    handleStartEdit,
    handleSaveEntry,
    handleDeleteEntry,
    handleInstallStarter,
    handleCopyMarkdown,
    filteredEntries,
    getCategoryCount,
  };
}
