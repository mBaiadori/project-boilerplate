import React from "react";
import { CreateTeamModal } from "./components/CreateTeamModal";
import { EditPermissionModal } from "./components/EditPermissionModal";
import { GovernanceHeader } from "./components/GovernanceHeader";
import { GovernanceTabs } from "./components/GovernanceTabs";
import { InviteMemberModal } from "./components/InviteMemberModal";
import { MembersTab } from "./components/MembersTab";
import { ProtectionTab } from "./components/ProtectionTab";
import { TeamsTab } from "./components/TeamsTab";
import { useGovernanceMembersData } from "./hooks/useGovernanceMembersData";

export const GovernanceMembersSubView: React.FC = () => {
  const {
    orgLogin,
    repoName,
    isAdmin,
    isSoloMode,
    activeTab,
    setActiveTab,
    collaborators,
    isLoadingCollabs,
    githubAuthError,
    fetchCollaborators,
    teams,
    isLoadingTeams,
    isCreateTeamModalOpen,
    setIsCreateTeamModalOpen,
    newTeamName,
    setNewTeamName,
    newTeamDesc,
    setNewTeamDesc,
    newTeamPrivacy,
    setNewTeamPrivacy,
    handleCreateTeam,
    handleDeleteTeam,
    branchProtection,
    isApplyingProtection,
    protectionFeedback,
    handleApplyProtection,
    quorumRules,
    isSavingQuorum,
    handleSaveQuorum,
    workflowStatus,
    isInstallingWorkflow,
    workflowFeedback,
    handleInstallWorkflow,
    isInviteModalOpen,
    setIsInviteModalOpen,
    inviteUsername,
    setInviteUsername,
    invitePermission,
    setInvitePermission,
    isInviting,
    inviteFeedback,
    handleSendInvite,
    editingCollab,
    setEditingCollab,
    editPermission,
    setEditPermission,
    isSavingEdit,
    editFeedback,
    handleSaveEditCollab,
    handleRemoveCollaborator,
  } = useGovernanceMembersData();

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px 16px" }}>
      <GovernanceHeader
        isSoloMode={isSoloMode}
        collaboratorsCount={collaborators.length}
        orgLogin={orgLogin}
        repoName={repoName}
        activeTab={activeTab}
        isAdmin={isAdmin}
        onOpenInviteModal={() => setIsInviteModalOpen(true)}
        onOpenCreateTeamModal={() => setIsCreateTeamModalOpen(true)}
      />

      <GovernanceTabs
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        collaboratorsCount={collaborators.length}
        teamsCount={teams.length}
        isWorkflowInstalled={workflowStatus?.installed}
      />

      {activeTab === "members" && (
        <MembersTab
          githubAuthError={githubAuthError}
          isLoadingCollabs={isLoadingCollabs}
          onRefreshCollaborators={fetchCollaborators}
          collaborators={collaborators}
          isAdmin={isAdmin}
          onEditCollab={(collab) => {
            setEditingCollab(collab);
            setEditPermission(collab.permission);
          }}
          onRemoveCollaborator={handleRemoveCollaborator}
        />
      )}

      {activeTab === "teams" && (
        <TeamsTab
          orgLogin={orgLogin}
          isAdmin={isAdmin}
          onOpenCreateTeamModal={() => setIsCreateTeamModalOpen(true)}
          isLoadingTeams={isLoadingTeams}
          teams={teams}
          onDeleteTeam={handleDeleteTeam}
        />
      )}

      {activeTab === "protection" && (
        <ProtectionTab
          isSoloMode={isSoloMode}
          quorumRules={quorumRules}
          isSavingQuorum={isSavingQuorum}
          onSaveQuorum={handleSaveQuorum}
          collaboratorsCount={collaborators.length}
          branchProtection={branchProtection}
          protectionFeedback={protectionFeedback}
          isApplyingProtection={isApplyingProtection}
          onApplyProtection={handleApplyProtection}
          workflowStatus={workflowStatus}
          workflowFeedback={workflowFeedback}
          isInstallingWorkflow={isInstallingWorkflow}
          onInstallWorkflow={handleInstallWorkflow}
        />
      )}

      <InviteMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        inviteUsername={inviteUsername}
        setInviteUsername={setInviteUsername}
        invitePermission={invitePermission}
        setInvitePermission={setInvitePermission}
        isInviting={isInviting}
        inviteFeedback={inviteFeedback}
        onSendInvite={handleSendInvite}
      />

      <EditPermissionModal
        editingCollab={editingCollab}
        onClose={() => setEditingCollab(null)}
        editPermission={editPermission}
        setEditPermission={setEditPermission}
        isSavingEdit={isSavingEdit}
        editFeedback={editFeedback}
        onSaveEditCollab={handleSaveEditCollab}
      />

      <CreateTeamModal
        isOpen={isCreateTeamModalOpen}
        onClose={() => setIsCreateTeamModalOpen(false)}
        orgLogin={orgLogin}
        newTeamName={newTeamName}
        setNewTeamName={setNewTeamName}
        newTeamDesc={newTeamDesc}
        setNewTeamDesc={setNewTeamDesc}
        newTeamPrivacy={newTeamPrivacy}
        setNewTeamPrivacy={setNewTeamPrivacy}
        onCreateTeam={handleCreateTeam}
      />
    </div>
  );
};

export default GovernanceMembersSubView;
