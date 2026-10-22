import React from "react";
import { AICenterHeader } from "./components/AICenterHeader";
import { SkillsTab } from "./components/SkillsTab";
import { AgentsTab } from "./components/AgentsTab";
import { ToolsTab } from "./components/ToolsTab";
import { MCPServersTab } from "./components/MCPServersTab";
import { TestToolPlaygroundModal } from "./components/TestToolPlaygroundModal";
import { AddMcpServerModal } from "./components/AddMcpServerModal";
import { CustomToolModal } from "./components/CustomToolModal";
import { SkillDetailDrawer } from "./components/SkillDetailDrawer";
import { CommunityToolDrawer } from "./components/CommunityToolDrawer";
import { useAICenterData } from "./hooks/useAICenterData";

export const AICenterSubView: React.FC = () => {
  const data = useAICenterData();

  const systemSkills = data.hubSkills.filter((s) => s.source === "system");
  const communitySkills = data.hubSkills.filter(
    (s) => s.source === "community" || (!s.source && s.source !== "system"),
  );

  const systemAgents = data.hubAgents.filter((a) => a.source === "system");
  const communityAgents = data.hubAgents.filter(
    (a) => a.source === "community" || (!a.source && a.source !== "system"),
  );

  return (
    <div
      id="subview-aicenter"
      className="dash-subview"
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        overflowY: "auto",
        background: "var(--color-surface, #ffffff)",
      }}
    >
      <div
        className="templates-view-wrapper"
        style={{ padding: "24px 32px", maxWidth: "1400px", margin: "0 auto" }}
      >
        <AICenterHeader
          activeRepoName={data.activeRepo?.name}
          loadAllData={data.loadAllData}
          loading={data.loading}
          actionFeedback={data.actionFeedback}
          activeMainTab={data.activeMainTab}
          setActiveMainTab={data.setActiveMainTab}
          installedSkillsCount={data.installedSkills.length}
          installedAgentsCount={data.installedAgents.length}
          toolsCount={
            data.customTools.length +
            data.toolsList.length +
            data.communityTools.length
          }
          projectMcpServersCount={data.projectMcpServers.length}
        />

        {data.activeMainTab === "skills" && (
          <SkillsTab
            skillScope={data.skillScope}
            setSkillScope={data.setSkillScope}
            installedSkillsCount={data.installedSkills.length}
            systemSkillsCount={systemSkills.length}
            communitySkillsCount={communitySkills.length}
            searchQuery={data.searchQuery}
            setSearchQuery={data.setSearchQuery}
            selectedCategory={data.selectedCategory}
            setSelectedCategory={data.setSelectedCategory}
            filteredSkills={data.filteredSkills}
            isSkillInstalled={data.isSkillInstalled}
            activeSkillId={data.activeSkillId}
            setActiveSkillId={data.setActiveSkillId}
            setSelectedSkill={data.setSelectedSkill}
            handleInstallSkill={data.handleInstallSkill}
            handleUninstallSkill={data.handleUninstallSkill}
            setActionFeedback={data.setActionFeedback}
          />
        )}

        {data.activeMainTab === "agents" && (
          <AgentsTab
            agentScope={data.agentScope}
            setAgentScope={data.setAgentScope}
            installedAgentsCount={data.installedAgents.length}
            systemAgentsCount={systemAgents.length}
            communityAgentsCount={communityAgents.length}
            displayedAgents={data.displayedAgents}
            isAgentInstalled={data.isAgentInstalled}
            setSelectedAgent={data.setSelectedAgent}
            handleInstallAgent={data.handleInstallAgent}
            handleUninstallAgent={data.handleUninstallAgent}
          />
        )}

        {data.activeMainTab === "tools" && (
          <ToolsTab
            toolScope={data.toolScope}
            setToolScope={data.setToolScope}
            customTools={data.customTools}
            toolsList={data.toolsList}
            communityTools={data.communityTools}
            handleOpenCreateCustomTool={data.handleOpenCreateCustomTool}
            handleOpenEditCustomTool={data.handleOpenEditCustomTool}
            handleDeleteCustomTool={data.handleDeleteCustomTool}
            setTestingTool={data.setTestingTool}
            setToolArgsInput={data.setToolArgsInput}
            setToolTestResult={data.setToolTestResult}
            communityToolCategory={data.communityToolCategory}
            setCommunityToolCategory={data.setCommunityToolCategory}
            communityToolSearch={data.communityToolSearch}
            setCommunityToolSearch={data.setCommunityToolSearch}
            setSelectedCommunityTool={data.setSelectedCommunityTool}
            projectMcpServers={data.projectMcpServers}
            mcpTemplates={data.mcpTemplates}
            handleSaveMcpFromTemplate={data.handleSaveMcpFromTemplate}
            setActiveMainTab={data.setActiveMainTab}
          />
        )}

        {data.activeMainTab === "mcp" && (
          <MCPServersTab
            setIsAddingMcp={data.setIsAddingMcp}
            projectMcpServers={data.projectMcpServers}
            mcpTemplates={data.mcpTemplates}
            isMcpInstalled={data.isMcpInstalled}
            handleRemoveMcp={data.handleRemoveMcp}
            handleSaveMcpFromTemplate={data.handleSaveMcpFromTemplate}
          />
        )}

        {/* ── Modal: Test Tool Playground ── */}
        <TestToolPlaygroundModal
          testingTool={data.testingTool}
          onClose={() => data.setTestingTool(null)}
          toolArgsInput={data.toolArgsInput}
          setToolArgsInput={data.setToolArgsInput}
          handleExecuteToolTest={data.handleExecuteToolTest}
          isExecutingTool={data.isExecutingTool}
          toolTestResult={data.toolTestResult}
        />

        {/* ── Modal: Add Custom MCP Server ── */}
        <AddMcpServerModal
          isOpen={data.isAddingMcp}
          onClose={() => data.setIsAddingMcp(false)}
          handleSaveCustomMcp={data.handleSaveCustomMcp}
          newMcpName={data.newMcpName}
          setNewMcpName={data.setNewMcpName}
          newMcpType={data.newMcpType}
          setNewMcpType={data.setNewMcpType}
          newMcpCommand={data.newMcpCommand}
          setNewMcpCommand={data.setNewMcpCommand}
          newMcpEndpoint={data.newMcpEndpoint}
          setNewMcpEndpoint={data.setNewMcpEndpoint}
          newMcpDesc={data.newMcpDesc}
          setNewMcpDesc={data.setNewMcpDesc}
        />

        {/* ── Modal: Create / Edit Custom Tool ── */}
        <CustomToolModal
          isOpen={data.isCustomToolModalOpen}
          onClose={() => data.setIsCustomToolModalOpen(false)}
          editingCustomTool={data.editingCustomTool}
          setEditingCustomTool={data.setEditingCustomTool}
          customToolSchemaStr={data.customToolSchemaStr}
          setCustomToolSchemaStr={data.setCustomToolSchemaStr}
          handleSaveCustomTool={data.handleSaveCustomTool}
          handleTestCustomToolDirect={data.handleTestCustomToolDirect}
          isTestingCustomTool={data.isTestingCustomTool}
          customToolTestArgs={data.customToolTestArgs}
          setCustomToolTestArgs={data.setCustomToolTestArgs}
          customToolTestOutput={data.customToolTestOutput}
        />

        {/* ── Drawer: Skill Detail View ── */}
        <SkillDetailDrawer
          selectedSkill={data.selectedSkill}
          onClose={() => data.setSelectedSkill(null)}
        />

        {/* ── Drawer: Community Tool Detail View ── */}
        <CommunityToolDrawer
          selectedCommunityTool={data.selectedCommunityTool}
          onClose={() => data.setSelectedCommunityTool(null)}
          mcpTemplates={data.mcpTemplates}
          handleSaveMcpFromTemplate={data.handleSaveMcpFromTemplate}
          setActiveMainTab={data.setActiveMainTab}
        />
      </div>
    </div>
  );
};

export default AICenterSubView;
