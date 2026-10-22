import React from "react";
import { BookA } from "lucide-react";
import { Card, CardContent, EmptyState, Spinner } from "../../../components/ui";
import { DictionaryGridView } from "./components/DictionaryGridView";
import { DictionaryHeader } from "./components/DictionaryHeader";
import { DictionaryTableView } from "./components/DictionaryTableView";
import { DictionaryToolbar } from "./components/DictionaryToolbar";
import { ImportDictionaryModal } from "./components/ImportDictionaryModal";
import { TermModal } from "./components/TermModal";
import { useDictionaryData } from "./hooks/useDictionaryData";

export const DictionarySubView: React.FC = () => {
  const {
    terms,
    searchTerm,
    handleSearchChange,
    selectedLetter,
    setSelectedLetter,
    selectedDomainFilter,
    setSelectedDomainFilter,
    selectedCategoryFilter,
    setSelectedCategoryFilter,
    sortOption,
    setSortOption,
    viewMode,
    setViewMode,
    isLoading,
    isSaving,
    isModalOpen,
    setIsModalOpen,
    isImportModalOpen,
    setIsImportModalOpen,
    importJsonText,
    setImportJsonText,
    importError,
    formError,
    copiedGeneral,
    copiedCodeId,
    categories,
    editingIndex,
    inputTerm,
    setInputTerm,
    inputCodename,
    setInputCodename,
    inputDomain,
    setInputDomain,
    inputCategory,
    setInputCategory,
    inputContext,
    setInputContext,
    inputSynonyms,
    setInputSynonyms,
    inputDefinition,
    setInputDefinition,
    handleOpenNewTerm,
    handleEditTerm,
    handleDeleteTerm,
    handleSaveTerm,
    copyToClipboard,
    handleExportMarkdown,
    handleApplyImport,
    getDomainColor,
    getDddCategoryInfo,
    availableLetters,
    filteredTerms,
    hasActiveFilters,
    clearFilters,
  } = useDictionaryData();

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
        <DictionaryHeader
          termsCount={terms.length}
          copiedGeneral={copiedGeneral}
          onCopyJson={() => copyToClipboard(JSON.stringify(terms, null, 2), "json")}
          onExportMarkdown={handleExportMarkdown}
          onOpenImport={() => {
            setImportJsonText("");
            setIsImportModalOpen(true);
          }}
          onOpenNewTerm={handleOpenNewTerm}
        />

        <DictionaryToolbar
          searchTerm={searchTerm}
          onSearchChange={handleSearchChange}
          categories={categories}
          selectedDomainFilter={selectedDomainFilter}
          onSelectDomainFilter={setSelectedDomainFilter}
          selectedCategoryFilter={selectedCategoryFilter}
          onSelectCategoryFilter={setSelectedCategoryFilter}
          sortOption={sortOption}
          onSortChange={setSortOption}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          termsCount={terms.length}
          availableLetters={availableLetters}
          selectedLetter={selectedLetter}
          onSelectLetter={setSelectedLetter}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
        />

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
                onAction={hasActiveFilters ? clearFilters : handleOpenNewTerm}
              />
            </CardContent>
          </Card>
        ) : viewMode === "table" ? (
          <DictionaryTableView
            filteredTerms={filteredTerms}
            terms={terms}
            copiedCodeId={copiedCodeId}
            onCopyCode={(codename) => copyToClipboard(codename, "code", codename)}
            getDomainColor={getDomainColor}
            getDddCategoryInfo={getDddCategoryInfo}
            onEditTerm={handleEditTerm}
            onDeleteTerm={handleDeleteTerm}
          />
        ) : (
          <DictionaryGridView
            filteredTerms={filteredTerms}
            terms={terms}
            copiedCodeId={copiedCodeId}
            onCopyCode={(codename) => copyToClipboard(codename, "code", codename)}
            getDomainColor={getDomainColor}
            getDddCategoryInfo={getDddCategoryInfo}
            onEditTerm={handleEditTerm}
            onDeleteTerm={handleDeleteTerm}
          />
        )}
      </div>

      <TermModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingIndex={editingIndex}
        inputTerm={inputTerm}
        setInputTerm={setInputTerm}
        inputCodename={inputCodename}
        setInputCodename={setInputCodename}
        inputDomain={inputDomain}
        setInputDomain={setInputDomain}
        inputCategory={inputCategory}
        setInputCategory={setInputCategory}
        inputContext={inputContext}
        setInputContext={setInputContext}
        inputSynonyms={inputSynonyms}
        setInputSynonyms={setInputSynonyms}
        inputDefinition={inputDefinition}
        setInputDefinition={setInputDefinition}
        formError={formError}
        isSaving={isSaving}
        categories={categories}
        onSaveTerm={handleSaveTerm}
      />

      <ImportDictionaryModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        importJsonText={importJsonText}
        setImportJsonText={setImportJsonText}
        importError={importError}
        isSaving={isSaving}
        onApplyImport={handleApplyImport}
      />
    </div>
  );
};

export default DictionarySubView;
