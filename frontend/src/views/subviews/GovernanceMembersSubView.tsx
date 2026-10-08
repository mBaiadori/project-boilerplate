import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  Shield,
  ShieldCheck,
  UserPlus,
  Trash2,
  Edit2,
  RefreshCw,
  GitBranch,
  Check,
  AlertTriangle,
  Plus,
  Layers,
  Play,
  FolderGit2,
} from "lucide-react";
import { API } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useWorkspace } from "../../context/WorkspaceContext";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { FormField } from "../../components/ui/FormField";
import { Card } from "../../components/ui/Card";
import type { CollaboratorInfo, OrganizationTeamInfo } from "../../types";

const PERMISSION_CONFIG: Record<
  string,
  { label: string; description: string; color: string; bg: string }
> = {
  pull: {
    label: "Leitura (Pull)",
    description: "Apenas ler e clonar o repositório",
    color: "#0284c7",
    bg: "rgba(2, 132, 199, 0.12)",
  },
  triage: {
    label: "Triagem (Triage)",
    description: "Gerenciar issues e discussões",
    color: "#0d9488",
    bg: "rgba(13, 148, 136, 0.12)",
  },
  push: {
    label: "Escrita (Push)",
    description: "Criar branches, editar e propor Pull Requests",
    color: "#10b981",
    bg: "rgba(16, 185, 129, 0.12)",
  },
  maintain: {
    label: "Mantenedor (Maintain)",
    description: "Gerenciar branches e merge de PRs",
    color: "#8b5cf6",
    bg: "rgba(139, 92, 246, 0.12)",
  },
  admin: {
    label: "Administrador (Admin)",
    description: "Acesso total, governança e configurações do repositório",
    color: "#ec4899",
    bg: "rgba(236, 72, 153, 0.12)",
  },
};

export const GovernanceMembersSubView: React.FC = () => {
  const { user } = useAuth();
  const { activeRepo, activeOrg } = useWorkspace();

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    "members" | "teams" | "protection"
  >("members");

  // Collaborators State
  const [collaborators, setCollaborators] = useState<CollaboratorInfo[]>([]);
  const [isLoadingCollabs, setIsLoadingCollabs] = useState<boolean>(false);
  const [githubAuthError, setGithubAuthError] = useState<string | null>(null);

  // Teams State (GitHub Free for Organizations)
  const [teams, setTeams] = useState<OrganizationTeamInfo[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const [isCreateTeamModalOpen, setIsCreateTeamModalOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDesc, setNewTeamDesc] = useState("");
  const [newTeamPrivacy, setNewTeamPrivacy] = useState<"closed" | "secret">(
    "closed",
  );

  // Branch Protection & Quorum State
  const [branchProtection, setBranchProtection] = useState<{
    enabled: boolean;
    required_approving_review_count?: number;
    dismiss_stale_reviews?: boolean;
    enforce_admins?: boolean;
    allow_force_pushes?: boolean;
  } | null>(null);
  const [isApplyingProtection, setIsApplyingProtection] = useState(false);
  const [protectionFeedback, setProtectionFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [quorumRules, setQuorumRules] = useState<{
    min_approvals_default: number;
  }>({
    min_approvals_default: 1,
  });
  const [isSavingQuorum, setIsSavingQuorum] = useState(false);

  // GitHub Actions Governance Workflow State
  const [workflowStatus, setWorkflowStatus] = useState<{
    installed: boolean;
    path: string;
    content?: string;
  } | null>(null);
  const [isInstallingWorkflow, setIsInstallingWorkflow] = useState(false);
  const [workflowFeedback, setWorkflowFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Modals State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteUsername, setInviteUsername] = useState("");
  const [invitePermission, setInvitePermission] = useState<string>("push");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteFeedback, setInviteFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [editingCollab, setEditingCollab] = useState<CollaboratorInfo | null>(
    null,
  );
  const [editPermission, setEditPermission] = useState<string>("push");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editFeedback, setEditFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const orgLogin =
    activeOrg?.login ||
    (typeof activeRepo?.owner === "string"
      ? activeRepo.owner
      : (activeRepo?.owner as any)?.login) ||
    user?.login ||
    "";
  const repoName = activeRepo?.name || "";

  const isAdmin = Boolean(
    activeRepo?.permissions?.admin ??
    (activeRepo?.is_owner ||
      activeRepo?.is_local ||
      (user?.login &&
        collaborators.some(
          (c) =>
            c.login === user.login && (c.is_owner || c.permission === "admin"),
        )) ||
      false),
  );

  const isSoloMode = collaborators.length <= 1;

  // Carregar Colaboradores
  const fetchCollaborators = useCallback(async () => {
    if (!repoName) return;
    setIsLoadingCollabs(true);
    setGithubAuthError(null);
    try {
      const res = await API.getGovernanceCollaborators(repoName);
      if (res.ok && res.data?.collaborators) {
        setCollaborators(res.data.collaborators as any);
      }
      if (res.data?.githubAuthError) {
        setGithubAuthError(res.data.githubAuthError);
      }
    } catch (err: any) {
      console.error("Erro ao carregar colaboradores:", err);
      setGithubAuthError(err.message || "Erro ao conectar com o GitHub.");
    } finally {
      setIsLoadingCollabs(false);
    }
  }, [repoName]);

  // Carregar Equipes da Organização
  const fetchTeams = useCallback(async () => {
    if (!orgLogin) return;
    setIsLoadingTeams(true);
    try {
      const res = await API.getOrgTeams(orgLogin);
      if (res.ok && res.data?.teams) {
        setTeams(res.data.teams);
      }
    } catch (err) {
      console.error("Erro ao carregar equipes da org:", err);
    } finally {
      setIsLoadingTeams(false);
    }
  }, [orgLogin]);

  // Carregar Status de Branch Protection
  const fetchProtection = useCallback(async () => {
    if (!repoName) return;
    try {
      const res = await API.getBranchProtection(repoName);
      if (res.ok && res.data) {
        setBranchProtection(res.data);
      }
    } catch (err) {
      console.warn("Branch protection status unavailable:", err);
    }
  }, [repoName]);

  // Carregar Status do GitHub Actions Workflow
  const fetchWorkflowStatus = useCallback(async () => {
    if (!repoName) return;
    try {
      const res = await API.getGovernanceWorkflow(repoName);
      if (res.ok && res.data) {
        setWorkflowStatus(res.data);
      }
    } catch (err) {
      console.warn("Workflow status unavailable:", err);
    }
  }, [repoName]);

  // Carregar Quorum Rules
  const fetchQuorum = useCallback(async () => {
    if (!repoName) return;
    try {
      const res = await API.getQuorumRules(repoName);
      if (res.ok && res.data?.rules) {
        setQuorumRules({
          min_approvals_default: res.data.rules.min_approvals_default ?? 1,
        });
      }
    } catch (err) {
      console.warn("Quorum unavailable:", err);
    }
  }, [repoName]);

  useEffect(() => {
    fetchCollaborators();
    fetchTeams();
    fetchProtection();
    fetchWorkflowStatus();
    fetchQuorum();
  }, [
    fetchCollaborators,
    fetchTeams,
    fetchProtection,
    fetchWorkflowStatus,
    fetchQuorum,
  ]);

  // Salvar Quorum
  const handleSaveQuorum = async (minApprovals: number) => {
    setIsSavingQuorum(true);
    try {
      await API.updateQuorumRules({
        repo: repoName,
        rules: { min_approvals_default: minApprovals },
      });
      setQuorumRules({ min_approvals_default: minApprovals });
    } catch (err) {
      console.error("Erro ao salvar quórum:", err);
    } finally {
      setIsSavingQuorum(false);
    }
  };

  // Ativar Proteção de Branch
  const handleApplyProtection = async () => {
    setIsApplyingProtection(true);
    setProtectionFeedback(null);
    try {
      const res = await API.applyBranchProtection({
        repo: repoName,
        min_approvals: Math.max(1, quorumRules.min_approvals_default || 1),
        enforce_admins: false,
        dismiss_stale_reviews: true,
      });
      if (res.ok && res.data?.success) {
        setProtectionFeedback({
          type: "success",
          message:
            "Regras de proteção da branch 'main' aplicadas com sucesso no GitHub!",
        });
        await fetchProtection();
      } else {
        throw new Error(res.data?.error || "Falha ao aplicar proteção.");
      }
    } catch (err: any) {
      setProtectionFeedback({
        type: "error",
        message: err.message || "Erro ao aplicar proteção de branch no GitHub.",
      });
    } finally {
      setIsApplyingProtection(false);
    }
  };

  // Instalar Actions Workflow
  const handleInstallWorkflow = async () => {
    setIsInstallingWorkflow(true);
    setWorkflowFeedback(null);
    try {
      const res = await API.installGovernanceWorkflow(repoName);
      if (res.ok && res.data?.success) {
        setWorkflowFeedback({
          type: "success",
          message:
            "Workflow de Governança instalado em .github/workflows/governance-check.yml com sucesso!",
        });
        await fetchWorkflowStatus();
      } else {
        throw new Error("Falha ao instalar workflow.");
      }
    } catch (err: any) {
      setWorkflowFeedback({
        type: "error",
        message: err.message || "Erro ao instalar workflow do GitHub Actions.",
      });
    } finally {
      setIsInstallingWorkflow(false);
    }
  };

  // Convidar Colaborador
  const handleSendInvite = async () => {
    if (!inviteUsername.trim() || !repoName) return;
    setIsInviting(true);
    setInviteFeedback(null);
    try {
      const res = await API.inviteCollaborator({
        repo: repoName,
        username: inviteUsername.trim(),
        permission: invitePermission,
      });
      if (res.ok && res.data?.success) {
        setInviteFeedback({
          type: "success",
          message: `Convite enviado para @${inviteUsername} com permissão ${invitePermission.toUpperCase()}!`,
        });
        setInviteUsername("");
        await fetchCollaborators();
        setTimeout(() => {
          setIsInviteModalOpen(false);
          setInviteFeedback(null);
        }, 1500);
      } else {
        throw new Error(res.data?.error || "Erro ao enviar convite.");
      }
    } catch (err: any) {
      setInviteFeedback({
        type: "error",
        message: err.message || "Erro ao enviar convite.",
      });
    } finally {
      setIsInviting(false);
    }
  };

  // Editar Permissão
  const handleSaveEditCollab = async () => {
    if (!editingCollab || !repoName) return;
    setIsSavingEdit(true);
    setEditFeedback(null);
    try {
      const res = await API.updateCollaboratorClearance({
        repo: repoName,
        username: editingCollab.login,
        permission: editPermission,
      });
      if (res.ok && res.data?.success) {
        setEditFeedback({
          type: "success",
          message: `Permissão de @${editingCollab.login} atualizada para ${editPermission.toUpperCase()}!`,
        });
        await fetchCollaborators();
        setTimeout(() => {
          setEditingCollab(null);
          setEditFeedback(null);
        }, 1200);
      } else {
        throw new Error("Erro ao atualizar permissão.");
      }
    } catch (err: any) {
      setEditFeedback({
        type: "error",
        message: err.message || "Erro ao atualizar permissão.",
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Remover Colaborador
  const handleRemoveCollaborator = async (username: string) => {
    if (
      !window.confirm(
        `Tem certeza que deseja remover @${username} deste repositório?`,
      )
    )
      return;
    try {
      await API.removeCollaborator(username, repoName);
      await fetchCollaborators();
    } catch (err: any) {
      alert(err.message || "Erro ao remover colaborador.");
    }
  };

  // Criar Equipe
  const handleCreateTeam = async () => {
    if (!newTeamName.trim() || !orgLogin) return;
    try {
      const res = await API.createOrgTeam({
        org: orgLogin,
        name: newTeamName.trim(),
        description: newTeamDesc.trim() || undefined,
        privacy: newTeamPrivacy,
      });
      if (res.ok && res.data?.success) {
        setIsCreateTeamModalOpen(false);
        setNewTeamName("");
        setNewTeamDesc("");
        await fetchTeams();
      } else {
        throw new Error(res.data?.message || "Falha ao criar equipe.");
      }
    } catch (err: any) {
      alert(err.message || "Erro ao criar equipe.");
    }
  };

  // Excluir Equipe
  const handleDeleteTeam = async (teamSlug: string) => {
    if (
      !window.confirm(
        `Tem certeza que deseja excluir a equipe "${teamSlug}" da organização?`,
      )
    )
      return;
    try {
      await API.deleteOrgTeam(orgLogin, teamSlug);
      await fetchTeams();
    } catch (err: any) {
      alert(err.message || "Erro ao excluir equipe.");
    }
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px 16px" }}>
      {/* Header Principal */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "24px",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: "rgba(99, 102, 241, 0.15)",
              color: "var(--color-primary, #6366f1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Shield size={24} />
          </div>
          <div>
            <h1
              style={{
                fontSize: "20px",
                fontWeight: 700,
                margin: 0,
                color: "var(--color-on-surface, #ffffff)",
              }}
            >
              Governança de Acesso & Repositório
            </h1>
            <p
              style={{
                fontSize: "13px",
                margin: "4px 0 0",
                color: "var(--color-outline, #a6adc8)",
              }}
            >
              Gerencie colaboradores, equipes da organização, proteção de
              branches e validações CI/CD integradas ao GitHub.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: "4px",
            }}
          >
            <Badge variant={isSoloMode ? "neutral" : "success"} size="md">
              {isSoloMode
                ? "Modo Solo (1 Membro)"
                : `Modo Equipe (${collaborators.length} Membros)`}
            </Badge>

            <Badge
              variant="primary"
              size="xs"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontWeight: 600,
              }}
            >
              <FolderGit2 size={11} style={{ flexShrink: 0 }} />
              @{orgLogin}/{repoName || "repositório"}
            </Badge>
          </div>

          {activeTab === "members" && isAdmin && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsInviteModalOpen(true)}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <UserPlus size={15} />
              <span>Convidar Membro</span>
            </Button>
          )}

          {activeTab === "teams" && isAdmin && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateTeamModalOpen(true)}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <Plus size={15} />
              <span>Nova Equipe</span>
            </Button>
          )}
        </div>
      </div>

      {/* Tabs Simplificadas (3 Abas Alinhadas ao GitHub) */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          borderBottom:
            "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.08))",
          marginBottom: "24px",
          overflowX: "auto",
        }}
      >
        <button
          onClick={() => setActiveTab("members")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 18px",
            background: "none",
            border: "none",
            borderBottom:
              activeTab === "members"
                ? "2px solid var(--color-primary, #6366f1)"
                : "2px solid transparent",
            color:
              activeTab === "members"
                ? "var(--color-primary, #6366f1)"
                : "var(--color-outline, #a6adc8)",
            fontWeight: activeTab === "members" ? 600 : 500,
            cursor: "pointer",
            fontSize: "14px",
            whiteSpace: "nowrap",
          }}
        >
          <Users size={16} />
          <span>Membros & Colaboradores ({collaborators.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("teams")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 18px",
            background: "none",
            border: "none",
            borderBottom:
              activeTab === "teams"
                ? "2px solid var(--color-primary, #6366f1)"
                : "2px solid transparent",
            color:
              activeTab === "teams"
                ? "var(--color-primary, #6366f1)"
                : "var(--color-outline, #a6adc8)",
            fontWeight: activeTab === "teams" ? 600 : 500,
            cursor: "pointer",
            fontSize: "14px",
            whiteSpace: "nowrap",
          }}
        >
          <Layers size={16} />
          <span>Equipes da Org ({teams.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("protection")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 18px",
            background: "none",
            border: "none",
            borderBottom:
              activeTab === "protection"
                ? "2px solid var(--color-primary, #6366f1)"
                : "2px solid transparent",
            color:
              activeTab === "protection"
                ? "var(--color-primary, #6366f1)"
                : "var(--color-outline, #a6adc8)",
            fontWeight: activeTab === "protection" ? 600 : 500,
            cursor: "pointer",
            fontSize: "14px",
            whiteSpace: "nowrap",
          }}
        >
          <GitBranch size={16} />
          <span>Proteção & Actions CI/CD</span>
          {workflowStatus?.installed && (
            <Badge variant="success" size="xs">
              Actions Ativo
            </Badge>
          )}
        </button>
      </div>

      {/* ABA 1: MEMBROS & COLABORADORES */}
      {activeTab === "members" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {githubAuthError && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "8px",
                background: "rgba(234, 179, 8, 0.1)",
                border: "1px solid rgba(234, 179, 8, 0.3)",
                color: "#fde047",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "13px",
              }}
            >
              <AlertTriangle
                size={16}
                style={{ color: "#eab308", flexShrink: 0 }}
              />
              <div style={{ flex: 1 }}>{githubAuthError}</div>
              <Button
                variant="outline"
                size="xs"
                onClick={fetchCollaborators}
                disabled={isLoadingCollabs}
              >
                Tentar Novamente
              </Button>
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              margin: "4px 0",
            }}
          >
            <Button
              variant="outline"
              size="xs"
              onClick={fetchCollaborators}
              disabled={isLoadingCollabs}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <RefreshCw
                size={13}
                className={isLoadingCollabs ? "animate-spin" : ""}
              />
              <span>Sincronizar Git</span>
            </Button>
          </div>

          {/* Tabela de Colaboradores */}
          <Card variant="flat" padding="none" style={{ overflow: "hidden" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                textAlign: "left",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "var(--color-surface-container-high, #1e1e2e)",
                    borderBottom:
                      "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.08))",
                    fontSize: "12px",
                    color: "var(--color-outline, #a6adc8)",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  <th style={{ padding: "12px 16px" }}>Colaborador</th>
                  <th style={{ padding: "12px 16px" }}>Tipo de Vínculo</th>
                  <th style={{ padding: "12px 16px" }}>
                    Permissão no Repositório
                  </th>
                  {isAdmin && (
                    <th style={{ padding: "12px 16px", textAlign: "right" }}>
                      Ações
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {collaborators.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isAdmin ? 4 : 3}
                      style={{
                        padding: "28px",
                        textAlign: "center",
                        color: "var(--color-outline, #a6adc8)",
                      }}
                    >
                      Nenhum colaborador encontrado para este repositório.
                    </td>
                  </tr>
                ) : (
                  collaborators.map((collab) => {
                    const permMeta =
                      PERMISSION_CONFIG[collab.permission] ||
                      PERMISSION_CONFIG.push;

                    return (
                      <tr
                        key={collab.login}
                        style={{
                          borderBottom:
                            "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.04))",
                          fontSize: "13px",
                        }}
                      >
                        <td style={{ padding: "12px 16px" }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                            }}
                          >
                            <img
                              src={collab.avatar_url}
                              alt={collab.login}
                              style={{
                                width: "32px",
                                height: "32px",
                                borderRadius: "50%",
                                background: "#313244",
                              }}
                            />
                            <div>
                              <div
                                style={{
                                  fontWeight: 600,
                                  color: "var(--color-on-surface, #cdd6f4)",
                                }}
                              >
                                @{collab.login}
                              </div>
                              {collab.is_owner && (
                                <span
                                  style={{
                                    fontSize: "11px",
                                    color: "var(--color-primary, #6366f1)",
                                    fontWeight: 500,
                                  }}
                                >
                                  Proprietário do Repositório
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: "12px 16px" }}>
                          {collab.is_owner ? (
                            <Badge variant="primary" size="xs">
                              Owner
                            </Badge>
                          ) : (
                            <Badge variant="neutral" size="xs">
                              Colaborador do Repositório
                            </Badge>
                          )}
                        </td>

                        <td style={{ padding: "12px 16px" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "4px 10px",
                              borderRadius: "6px",
                              backgroundColor: permMeta.bg,
                              color: permMeta.color,
                              fontSize: "12px",
                              fontWeight: 600,
                            }}
                          >
                            <span
                              style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "50%",
                                backgroundColor: permMeta.color,
                              }}
                            />
                            {permMeta.label}
                          </span>
                        </td>

                        {isAdmin && (
                          <td
                            style={{ padding: "12px 16px", textAlign: "right" }}
                          >
                            <div
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                              }}
                            >
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => {
                                  setEditingCollab(collab);
                                  setEditPermission(collab.permission);
                                }}
                                style={{ padding: "6px 10px" }}
                                title="Alterar nível de permissão"
                              >
                                <Edit2
                                  size={13}
                                  style={{ marginRight: "4px" }}
                                />
                                <span>Alterar Permissão</span>
                              </Button>
                              {!collab.is_owner && (
                                <Button
                                  variant="danger"
                                  size="xs"
                                  onClick={() =>
                                    handleRemoveCollaborator(collab.login)
                                  }
                                  style={{ padding: "6px 10px" }}
                                  title="Remover colaborador do repositório"
                                >
                                  <Trash2 size={13} />
                                </Button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* ABA 2: EQUIPES DA ORGANIZAÇÃO */}
      {activeTab === "teams" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              padding: "16px 20px",
              borderRadius: "10px",
              backgroundColor:
                "var(--color-surface-container, rgba(255, 255, 255, 0.03))",
              border:
                "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.08))",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(99, 102, 241, 0.12)",
                  color: "var(--color-primary, #6366f1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Layers size={20} />
              </div>
              <div>
                <h4
                  style={{
                    margin: "0 0 2px",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "var(--color-on-surface, #ffffff)",
                  }}
                >
                  Gestão de Equipes (GitHub Teams)
                </h4>
                <p
                  style={{
                    margin: 0,
                    fontSize: "12px",
                    color: "var(--color-outline, #a6adc8)",
                    lineHeight: 1.4,
                  }}
                >
                  Crie e organize squads da organização{" "}
                  <strong>@{orgLogin}</strong> para conceder permissões em lote
                  a múltiplos repositórios.
                </p>
              </div>
            </div>

            {isAdmin && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsCreateTeamModalOpen(true)}
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <Plus size={15} />
                <span>Nova Equipe</span>
              </Button>
            )}
          </div>

          {isLoadingTeams ? (
            <div
              style={{
                padding: "30px",
                textAlign: "center",
                color: "var(--color-outline, #a6adc8)",
              }}
            >
              Carregando equipes da organização...
            </div>
          ) : teams.length > 0 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                gap: "14px",
              }}
            >
              {teams.map((team) => (
                <Card
                  key={team.slug || team.id}
                  variant="flat"
                  padding="md"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          marginBottom: "4px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "14px",
                            fontWeight: 700,
                            color: "var(--color-on-surface, #ffffff)",
                          }}
                        >
                          {team.name}
                        </span>
                        <Badge variant="primary" size="xs">
                          @{orgLogin}/{team.slug}
                        </Badge>
                      </div>
                      {team.description && (
                        <p
                          style={{
                            margin: 0,
                            fontSize: "12px",
                            color: "var(--color-outline, #a6adc8)",
                            lineHeight: 1.4,
                          }}
                        >
                          {team.description}
                        </p>
                      )}
                    </div>
                    {team.permission && (
                      <Badge
                        variant={
                          team.permission === "admin" ? "danger" : "success"
                        }
                        size="xs"
                      >
                        {team.permission.toUpperCase()}
                      </Badge>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "16px",
                      fontSize: "12px",
                      color: "var(--color-outline, #a6adc8)",
                    }}
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <Users size={14} /> {team.members_count || 0} membros
                    </span>
                  </div>

                  {isAdmin && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: "8px",
                        borderTop:
                          "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.08))",
                        paddingTop: "8px",
                        marginTop: "4px",
                      }}
                    >
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleDeleteTeam(team.slug)}
                        style={{ color: "#ef4444", fontSize: "11px" }}
                      >
                        <Trash2 size={12} style={{ marginRight: "4px" }} />{" "}
                        Excluir Time
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <div
              style={{
                padding: "40px 20px",
                textAlign: "center",
                borderRadius: "10px",
                border:
                  "1px dashed var(--color-outline-variant, rgba(255, 255, 255, 0.12))",
                color: "var(--color-outline, #a6adc8)",
                fontSize: "13px",
              }}
            >
              <Layers
                size={32}
                style={{ margin: "0 auto 12px", opacity: 0.4 }}
              />
              <div>Nenhuma equipe criada nesta organização ainda.</div>
              <div style={{ fontSize: "12px", marginTop: "4px" }}>
                Clique em <strong>Nova Equipe</strong> para criar seu primeiro
                time ou squad.
              </div>
            </div>
          )}
        </div>
      )}

      {/* ABA 3: PROTEÇÃO & ACTIONS CI/CD */}
      {activeTab === "protection" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Quórum Card */}
          <Card variant="flat" padding="md">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "12px",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <Shield size={18} color="var(--color-primary, #6366f1)" />
                <h3
                  style={{
                    fontSize: "15px",
                    fontWeight: 600,
                    margin: 0,
                    color: "var(--color-on-surface, #ffffff)",
                  }}
                >
                  Quórum de Aprovação de Pull Requests
                </h3>
              </div>
              <Badge variant={isSoloMode ? "neutral" : "success"} size="sm">
                {isSoloMode ? "Modo Solo" : "Modo Equipe"}
              </Badge>
            </div>

            <p
              style={{
                fontSize: "13px",
                color: "var(--color-outline, #a6adc8)",
                margin: "0 0 16px 0",
              }}
            >
              Define a quantidade mínima de revisões com aprovação obrigatórias
              antes de permitir o merge de Pull Requests.
            </p>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span
                style={{
                  fontSize: "13px",
                  color: "var(--color-on-surface, #cdd6f4)",
                }}
              >
                Aprovações mínimas por PR:
              </span>
              <input
                type="number"
                min={1}
                max={Math.max(1, collaborators.length - 1)}
                value={quorumRules?.min_approvals_default ?? 1}
                onChange={(e) =>
                  handleSaveQuorum(Math.max(1, Number(e.target.value)))
                }
                disabled={isSavingQuorum}
                style={{
                  width: "60px",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  background: "var(--color-surface-container-high, #1e1e2e)",
                  color: "var(--color-on-surface, #cdd6f4)",
                  border:
                    "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.12))",
                  fontSize: "13px",
                  textAlign: "center",
                }}
              />
            </div>
          </Card>

          {/* GitHub Branch Protection Card */}
          <Card variant="flat" padding="md">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "12px",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <GitBranch size={18} color="#818cf8" />
                <h3
                  style={{
                    fontSize: "15px",
                    fontWeight: 600,
                    margin: 0,
                    color: "var(--color-on-surface, #ffffff)",
                  }}
                >
                  Proteção de Branch no GitHub (`main`)
                </h3>
              </div>

              <Badge
                variant={branchProtection?.enabled ? "success" : "warning"}
                size="sm"
              >
                {branchProtection?.enabled
                  ? "✓ main protegida"
                  : "⚠️ main desprotegida"}
              </Badge>
            </div>

            <p
              style={{
                fontSize: "13px",
                color: "var(--color-outline, #a6adc8)",
                margin: "0 0 16px 0",
              }}
            >
              Bloqueia push direto na branch <code>main</code> e exige aprovação
              formal de Pull Request para qualquer alteração.
            </p>

            {protectionFeedback && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "6px",
                  marginBottom: "14px",
                  background:
                    protectionFeedback.type === "success"
                      ? "rgba(16, 185, 129, 0.15)"
                      : "rgba(239, 68, 68, 0.15)",
                  color:
                    protectionFeedback.type === "success"
                      ? "#10b981"
                      : "#ef4444",
                  fontSize: "13px",
                }}
              >
                {protectionFeedback.message}
              </div>
            )}

            <Button
              variant={branchProtection?.enabled ? "outline" : "primary"}
              size="sm"
              onClick={handleApplyProtection}
              disabled={
                Boolean(branchProtection?.enabled) || isApplyingProtection
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {branchProtection?.enabled ? (
                <>
                  <Check size={14} color="#10b981" />
                  <span>Branch main já está protegida no GitHub</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={14} />
                  <span>
                    {isApplyingProtection
                      ? "Aplicando regras..."
                      : "Ativar Proteção da Branch main"}
                  </span>
                </>
              )}
            </Button>
          </Card>

          {/* GitHub Actions Governance Gatekeeper Card */}
          <Card variant="flat" padding="md">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "12px",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <ShieldCheck size={18} color="#10b981" />
                <h3
                  style={{
                    fontSize: "15px",
                    fontWeight: 600,
                    margin: 0,
                    color: "var(--color-on-surface, #ffffff)",
                  }}
                >
                  GitHub Actions Governance Gatekeeper (CI/CD)
                </h3>
              </div>

              <Badge
                variant={workflowStatus?.installed ? "success" : "warning"}
                size="sm"
              >
                {workflowStatus?.installed
                  ? "✓ Workflow Ativo"
                  : "Não Instalado"}
              </Badge>
            </div>

            <p
              style={{
                fontSize: "13px",
                color: "var(--color-outline, #a6adc8)",
                margin: "0 0 16px 0",
              }}
            >
              Executa validações automáticas de CODEOWNERS, regras de Quórum e
              integridade de Pull Requests diretamente nos pipelines do GitHub
              Actions (inclusive em repositórios privados no GitHub Free).
            </p>

            {workflowFeedback && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "6px",
                  marginBottom: "14px",
                  background:
                    workflowFeedback.type === "success"
                      ? "rgba(16, 185, 129, 0.15)"
                      : "rgba(239, 68, 68, 0.15)",
                  color:
                    workflowFeedback.type === "success" ? "#10b981" : "#ef4444",
                  fontSize: "13px",
                }}
              >
                {workflowFeedback.message}
              </div>
            )}

            <Button
              variant={workflowStatus?.installed ? "outline" : "primary"}
              size="sm"
              onClick={handleInstallWorkflow}
              disabled={isInstallingWorkflow}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {isInstallingWorkflow ? (
                "Instalando..."
              ) : workflowStatus?.installed ? (
                <>
                  <Check size={14} color="#10b981" />
                  <span>
                    Reinstalar / Atualizar Workflow
                    (.github/workflows/governance-check.yml)
                  </span>
                </>
              ) : (
                <>
                  <Play size={14} />
                  <span>Instalar Workflow de Governança no Repositório</span>
                </>
              )}
            </Button>
          </Card>
        </div>
      )}

      {/* Modal Convidar Colaborador */}
      {isInviteModalOpen && (
        <Modal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          title="Convidar Colaborador para o Repositório"
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              padding: "8px 0",
            }}
          >
            <FormField label="Nome de Usuário no GitHub" required>
              <input
                type="text"
                placeholder="Ex: octocat"
                value={inviteUsername}
                onChange={(e) => setInviteUsername(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  background: "var(--color-surface-container-high, #1e1e2e)",
                  color: "var(--color-on-surface, #cdd6f4)",
                  border:
                    "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.12))",
                  fontSize: "13px",
                }}
              />
            </FormField>

            <FormField label="Permissão Git no Repositório" required>
              <select
                value={invitePermission}
                onChange={(e) => setInvitePermission(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  background: "var(--color-surface-container-high, #1e1e2e)",
                  color: "var(--color-on-surface, #cdd6f4)",
                  border:
                    "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.12))",
                  fontSize: "13px",
                }}
              >
                <option value="push">
                  Escrita (Push / Criar branches & PRs)
                </option>
                <option value="triage">
                  Triagem (Triage / Gerenciar issues)
                </option>
                <option value="pull">Leitura (Pull / Clone & leitura)</option>
                <option value="maintain">
                  Mantenedor (Maintain / Merge & branches)
                </option>
                <option value="admin">
                  Administrador (Admin / Acesso total)
                </option>
              </select>
            </FormField>

            {inviteFeedback && (
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  background:
                    inviteFeedback.type === "success"
                      ? "rgba(16, 185, 129, 0.15)"
                      : "rgba(239, 68, 68, 0.15)",
                  color:
                    inviteFeedback.type === "success" ? "#10b981" : "#ef4444",
                  fontSize: "13px",
                }}
              >
                {inviteFeedback.message}
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "8px",
                marginTop: "8px",
              }}
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsInviteModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSendInvite}
                disabled={isInviting || !inviteUsername.trim()}
              >
                {isInviting ? "Enviando..." : "Enviar Convite"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Editar Permissão */}
      {editingCollab && (
        <Modal
          isOpen={Boolean(editingCollab)}
          onClose={() => setEditingCollab(null)}
          title={`Editar Permissão de @${editingCollab.login}`}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              padding: "8px 0",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px",
                borderRadius: "8px",
                background: "var(--color-surface-container-high, #1e1e2e)",
                border:
                  "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.08))",
              }}
            >
              <img
                src={editingCollab.avatar_url}
                alt={editingCollab.login}
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: "#313244",
                }}
              />
              <div>
                <div
                  style={{
                    fontWeight: 600,
                    color: "var(--color-on-surface, #cdd6f4)",
                    fontSize: "14px",
                  }}
                >
                  @{editingCollab.login}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--color-outline, #a6adc8)",
                  }}
                >
                  {editingCollab.is_owner
                    ? "Proprietário do Repositório"
                    : "Colaborador"}
                </div>
              </div>
            </div>

            <FormField label="Permissão Git no Repositório">
              <select
                value={editPermission}
                onChange={(e) => setEditPermission(e.target.value)}
                disabled={editingCollab.is_owner}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  background: "var(--color-surface-container-high, #1e1e2e)",
                  color: "var(--color-on-surface, #cdd6f4)",
                  border:
                    "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.12))",
                  fontSize: "13px",
                }}
              >
                <option value="pull">Leitura (Pull)</option>
                <option value="triage">Triagem (Triage)</option>
                <option value="push">Escrita (Push)</option>
                <option value="maintain">Mantenedor (Maintain)</option>
                <option value="admin">Administrador (Admin)</option>
              </select>
            </FormField>

            {editFeedback && (
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: "6px",
                  background:
                    editFeedback.type === "success"
                      ? "rgba(16, 185, 129, 0.15)"
                      : "rgba(239, 68, 68, 0.15)",
                  color:
                    editFeedback.type === "success" ? "#10b981" : "#ef4444",
                  fontSize: "13px",
                }}
              >
                {editFeedback.message}
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "8px",
                marginTop: "8px",
              }}
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingCollab(null)}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveEditCollab}
                disabled={isSavingEdit || editingCollab.is_owner}
              >
                {isSavingEdit ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Criar Equipe */}
      {isCreateTeamModalOpen && (
        <Modal
          isOpen={isCreateTeamModalOpen}
          onClose={() => setIsCreateTeamModalOpen(false)}
          title="Criar Nova Equipe (GitHub Team)"
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              padding: "8px 0",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "13px",
                color: "var(--color-outline, #a6adc8)",
                lineHeight: 1.5,
              }}
            >
              Equipes facilitam o gerenciamento de acesso a múltiplos
              repositórios e squads na organização <strong>@{orgLogin}</strong>.
            </p>

            <FormField label="Nome da Equipe" required>
              <input
                type="text"
                placeholder="Ex: Core Architecture, Squad Checkout"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  background: "var(--color-surface-container-high, #1e1e2e)",
                  color: "var(--color-on-surface, #cdd6f4)",
                  border:
                    "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.12))",
                  fontSize: "13px",
                }}
              />
            </FormField>

            <FormField label="Descrição">
              <input
                type="text"
                placeholder="Ex: Responsável pelos microsserviços e pipelines"
                value={newTeamDesc}
                onChange={(e) => setNewTeamDesc(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  background: "var(--color-surface-container-high, #1e1e2e)",
                  color: "var(--color-on-surface, #cdd6f4)",
                  border:
                    "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.12))",
                  fontSize: "13px",
                }}
              />
            </FormField>

            <FormField label="Visibilidade da Equipe">
              <select
                value={newTeamPrivacy}
                onChange={(e) => setNewTeamPrivacy(e.target.value as any)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  background: "var(--color-surface-container-high, #1e1e2e)",
                  color: "var(--color-on-surface, #cdd6f4)",
                  border:
                    "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.12))",
                  fontSize: "13px",
                }}
              >
                <option value="closed">Visível para a Org (Closed)</option>
                <option value="secret">Secreto / Privado (Secret)</option>
              </select>
            </FormField>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "8px",
                marginTop: "8px",
              }}
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreateTeamModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!newTeamName.trim()}
                onClick={handleCreateTeam}
              >
                Criar Equipe
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
