import React from "react";
import { Sparkles } from "lucide-react";
import { EmptyState, Spinner } from "../../../components/ui";
import type { SkillItem } from "../../../types";
import { SkillCard } from "./components/SkillCard";
import { SkillDetailModal } from "./components/SkillDetailModal";
import { SkillsHeader } from "./components/SkillsHeader";
import { SkillsToolbar } from "./components/SkillsToolbar";
import { useSkillsData } from "./hooks/useSkillsData";

export const SkillsSubView: React.FC = () => {
  const {
    activeSkillId,
    setActiveSkillId,
    scopeFilter,
    setScopeFilter,
    installedSkills,
    systemSkills,
    communitySkills,
    loading,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    selectedSkill,
    setSelectedSkill,
    actionFeedback,
    setActionFeedback,
    loadSkills,
    handleInstall,
    handleUninstall,
    isInstalled,
    filteredSkills,
  } = useSkillsData();

  const handleActivateCopilot = (skill: SkillItem) => {
    setActiveSkillId(skill.id);
    setActionFeedback({
      ok: true,
      msg: `Skill '${skill.title || skill.name}' ativada no Copilot!`,
    });
    setTimeout(() => setActionFeedback(null), 3000);
  };

  return (
    <div
      id="subview-skills"
      style={{
        padding: "24px 32px",
        maxWidth: "1400px",
        margin: "0 auto",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <SkillsHeader
        onRefresh={loadSkills}
        actionFeedback={actionFeedback}
        onCloseFeedback={() => setActionFeedback(null)}
      />

      <SkillsToolbar
        scopeFilter={scopeFilter}
        onSelectScopeFilter={setScopeFilter}
        installedCount={installedSkills.length}
        systemCount={systemSkills.length}
        communityCount={communitySkills.length}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />

      {/* Skills Grid */}
      {loading ? (
        <div
          style={{
            padding: "60px 0",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <Spinner size="lg" message="Carregando catálogo de skills..." />
        </div>
      ) : filteredSkills.length === 0 ? (
        <EmptyState
          icon={<Sparkles size={48} />}
          title={
            scopeFilter === "installed"
              ? "Nenhuma skill instalada neste projeto"
              : "Nenhuma skill encontrada"
          }
          description={
            scopeFilter === "installed"
              ? "Explore as abas 'Sistema' ou 'Comunidade' para habilitar guardrails de governança, validação de termos e diagramação viva."
              : "Tente mudar os termos de busca ou o filtro de categoria acima."
          }
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "16px",
          }}
        >
          {filteredSkills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              installed={isInstalled(skill.id)}
              isActiveInCopilot={activeSkillId === skill.id}
              onOpenDetails={setSelectedSkill}
              onActivateCopilot={handleActivateCopilot}
              onInstall={handleInstall}
            />
          ))}
        </div>
      )}

      {/* Modal: Detalhes da Skill */}
      <SkillDetailModal
        selectedSkill={selectedSkill}
        onClose={() => setSelectedSkill(null)}
        isInstalled={selectedSkill ? isInstalled(selectedSkill.id) : false}
        onUninstall={handleUninstall}
        onActivateCopilot={handleActivateCopilot}
        onInstall={handleInstall}
      />
    </div>
  );
};

export default SkillsSubView;
