import React from "react";
import { DictionaryPopover } from "../../../components/dictionary/DictionaryPopover";
import { WikiEditorPane } from "./components/WikiEditorPane";
import { WikiEmptyState } from "./components/WikiEmptyState";
import { WikiReaderPane } from "./components/WikiReaderPane";
import { WikiSidebar } from "./components/WikiSidebar";
import { useWikiData } from "./hooks/useWikiData";

export const WikiSubView: React.FC = () => {
  const {
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
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
    handleStartNewEntry,
    handleStartEdit,
    handleSaveEntry,
    handleDeleteEntry,
    handleInstallStarter,
    handleCopyMarkdown,
    filteredEntries,
    getCategoryCount,
  } = useWikiData();

  return (
    <div
      id="subview-wiki"
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        overflow: "hidden",
        background: "var(--color-surface)",
      }}
    >
      <WikiSidebar
        onStartNewEntry={handleStartNewEntry}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeCategory={activeCategory}
        onSelectCategory={setActiveCategory}
        getCategoryCount={getCategoryCount}
        isLoading={isLoading}
        filteredEntries={filteredEntries}
        activeEntry={activeEntry}
        onSelectEntry={(entry) => {
          setActiveEntry(entry);
          setIsEditing(false);
        }}
      />

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
          <WikiEditorPane
            activeEntry={activeEntry}
            onCancel={() => setIsEditing(false)}
            onSave={handleSaveEntry}
            editCategory={editCategory}
            setEditCategory={setEditCategory}
            editTitle={editTitle}
            setEditTitle={setEditTitle}
            editSlug={editSlug}
            setEditSlug={setEditSlug}
            editContent={editContent}
            setEditContent={setEditContent}
          />
        ) : activeEntry ? (
          <WikiReaderPane
            activeEntry={activeEntry}
            onStartEdit={handleStartEdit}
            onCopyMarkdown={handleCopyMarkdown}
            copied={copied}
            onDeleteEntry={handleDeleteEntry}
            onArticleMouseMove={handleArticleMouseMove}
            renderedHtml={renderedHtml}
          />
        ) : (
          <WikiEmptyState
            onStartNewEntry={handleStartNewEntry}
            onInstallStarter={handleInstallStarter}
          />
        )}
      </main>

      <DictionaryPopover
        data={dictPopoverData}
        onClose={() => setDictPopoverData(null)}
      />
    </div>
  );
};

export default WikiSubView;
