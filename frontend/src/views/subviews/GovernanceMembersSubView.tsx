import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Users,
  Shield,
  ShieldCheck,
  Key,
  Lock,
  Unlock,
  UserPlus,
  Trash2,
  Edit2,
  RefreshCw,
  GitBranch,
  Copy,
  Check,
  Bot,
  Terminal,
  History,
  ExternalLink,
  AlertTriangle,
  Search,
  CheckCircle2,
} from "lucide-react";
import { API } from "../../services/api";
import { useWorkspace } from "../../context/WorkspaceContext";
import { useSecurity } from "../../context/SecurityContext";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { FormField } from "../../components/ui/FormField";
import { Card } from "../../components/ui/Card";

interface FolderTreePickerProps {
  tree: any[];
  selectedPaths: string[];
  onChange: (paths: string[]) => void;
}

const FolderTreePicker: React.FC<FolderTreePickerProps> = ({
  tree,
  selectedPaths,
  onChange,
}) => {
  const folders = useMemo(() => {
    const list: { path: string; name: string; depth: number }[] = [];
    const walk = (nodes: any[], depth = 0) => {
      for (const node of nodes) {
        if (node.type === "directory" || (node.children && node.children.length > 0)) {
          const clean = (node.path || "").replace(/^\/+/, "");
          list.push({ path: clean, name: node.name, depth });
          if (Array.isArray(node.children)) {
            walk(node.children, depth + 1);
          }
        }
      }
    };
    walk(tree || []);
    return list;
  }, [tree]);

  const isGlobal = selectedPaths.includes("*") || selectedPaths.includes("/**");

  const handleToggleGlobal = () => {
    if (isGlobal) {
      onChange([]);
    } else {
      onChange(["*"]);
    }
  };

  const handleToggleFolder = (folderPath: string) => {
    const clean = folderPath.replace(/\\/g, "/").replace(/^\/+/, "");
    if (isGlobal) {
      onChange([clean]);
      return;
    }
    const isSelected = selectedPaths.includes(clean);
    if (isSelected) {
      onChange(selectedPaths.filter((p) => p !== clean));
    } else {
      onChange([...selectedPaths, clean]);
    }
  };

  return (
    <div
      style={{
        border: "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.12))",
        borderRadius: "8px",
        background: "var(--color-surface-container, #181825)",
        maxHeight: "220px",
        overflowY: "auto",
        padding: "8px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
      }}
    >
      {/* Opção Acesso Global */}
      <div
        onClick={handleToggleGlobal}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "6px 10px",
          borderRadius: "6px",
          cursor: "pointer",
          backgroundColor: isGlobal ? "rgba(139, 92, 246, 0.18)" : "transparent",
          border: isGlobal ? "1px solid rgba(139, 92, 246, 0.4)" : "1px solid transparent",
          transition: "background 0.15s ease",
        }}
      >
        <input
          type="checkbox"
          checked={isGlobal}
          onChange={handleToggleGlobal}
          onClick={(e) => e.stopPropagation()}
          style={{ cursor: "pointer", accentColor: "#8b5cf6" }}
        />
        <span
          className="material-symbols-outlined"
          style={{ fontSize: "16px", color: isGlobal ? "#8b5cf6" : "#a6adc8" }}
        >
          all_inclusive
        </span>
        <span style={{ fontSize: "12px", fontWeight: 600, color: isGlobal ? "#8b5cf6" : "var(--color-on-surface, #cdd6f4)" }}>
          Todas as Pastas e Documentos (*)
        </span>
        <span style={{ fontSize: "11px", color: "var(--color-outline, #a6adc8)", marginLeft: "auto" }}>
          Acesso Global
        </span>
      </div>

      <div style={{ height: "1px", background: "var(--color-outline-variant, rgba(255, 255, 255, 0.08))", margin: "4px 0" }} />

      {/* Lista de Pastas da Tree */}
      {folders.length === 0 ? (
        <div style={{ padding: "8px 10px", fontSize: "12px", color: "#a6adc8", fontStyle: "italic" }}>
          Nenhuma pasta detectada no workspace. O colaborador terá acesso a todas as rotas (*).
        </div>
      ) : (
        folders.map((f) => {
          const isSelected = isGlobal || selectedPaths.includes(f.path);
          return (
            <div
              key={f.path}
              onClick={() => handleToggleFolder(f.path)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "5px 8px",
                paddingLeft: `${Math.max(f.depth * 16 + 8, 8)}px`,
                borderRadius: "5px",
                cursor: "pointer",
                backgroundColor: isSelected && !isGlobal ? "rgba(99, 102, 241, 0.12)" : "transparent",
                border: isSelected && !isGlobal ? "1px solid rgba(99, 102, 241, 0.3)" : "1px solid transparent",
              }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                disabled={isGlobal}
                onChange={() => handleToggleFolder(f.path)}
                onClick={(e) => e.stopPropagation()}
                style={{ cursor: isGlobal ? "not-allowed" : "pointer", accentColor: "#6366f1" }}
              />
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: "16px",
                  color: isSelected ? "#6366f1" : "var(--color-outline, #a6adc8)",
                }}
              >
                folder
              </span>
              <span style={{ fontSize: "12px", color: isSelected ? "var(--color-on-surface, #cdd6f4)" : "var(--color-outline, #a6adc8)", fontWeight: isSelected ? 600 : 400 }}>
                {f.name}
              </span>
              <span style={{ fontSize: "10.5px", color: "var(--color-outline, #6c7086)", marginLeft: "auto", fontFamily: "monospace" }}>
                {f.path}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
};

export const GovernanceMembersSubView: React.FC = () => {
  const { activeRepo, tree } = useWorkspace();
  const currentRepoName = activeRepo?.name;
  const {
    securityLevels,
    unlockedLevels,
    unlockedLevelIds,
    activeAIToken,
    unlockLevel,
    lockLevel,
    lockAll,
    generateAIToken,
  } = useSecurity();

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    "members" | "quorum" | "vault" | "audit"
  >("members");

  // Collaborators State
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [isSoloMode, setIsSoloMode] = useState<boolean>(true);
  const [isLoadingCollabs, setIsLoadingCollabs] = useState<boolean>(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState<boolean>(false);
  const [githubAuthError, setGithubAuthError] = useState<string | null>(null);
  const [inviteUsername, setInviteUsername] = useState<string>("");
  const [invitePermission, setInvitePermission] = useState<string>("push");
  const [inviteLevelId, setInviteLevelId] = useState<string>("engineering");
  const [inviteRoleName, setInviteRoleName] = useState<string>("");
  const [inviteAllowedPaths, setInviteAllowedPaths] = useState<string[]>(["*"]);
  const [isInviting, setIsInviting] = useState<boolean>(false);
  const [inviteFeedback, setInviteFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Edit Collaborator Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editingCollab, setEditingCollab] = useState<any>(null);
  const [editRoleName, setEditRoleName] = useState<string>("");
  const [editPermission, setEditPermission] = useState<string>("push");
  const [editLevelId, setEditLevelId] = useState<string>("2");
  const [editAllowedPaths, setEditAllowedPaths] = useState<string[]>(["*"]);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const [editFeedback, setEditFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Quorum & Branch Protection State
  const [quorumRules, setQuorumRules] = useState<any>(null);
  const [keymap, setKeymap] = useState<any>(null);
  const [branchProtection, setBranchProtection] = useState<any>(null);
  const [isSavingQuorum, setIsSavingQuorum] = useState<boolean>(false);
  const [isApplyingProtection, setIsApplyingProtection] =
    useState<boolean>(false);
  const [protectionFeedback, setProtectionFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Vault Passphrases Inputs State
  const [levelInputs, setLevelInputs] = useState<Record<string, string>>({});
  const [unlockErrors, setUnlockErrors] = useState<Record<string, string>>({});
  const [isGeneratingToken, setIsGeneratingToken] = useState<boolean>(false);
  const [copiedToken, setCopiedToken] = useState<boolean>(false);

  // Secret Scanning State
  const [isScanningSecrets, setIsScanningSecrets] = useState<boolean>(false);
  const [secretScanResult, setSecretScanResult] = useState<{
    scanned: boolean;
    hasSecrets: boolean;
    violations: any[];
  } | null>(null);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState<boolean>(false);

  // Fetch Collaborators
  const fetchCollaborators = useCallback(async () => {
    setIsLoadingCollabs(true);
    try {
      const res = await API.getGovernanceCollaborators(currentRepoName);
      if (res.ok && res.data) {
        setCollaborators(res.data.collaborators || []);
        setIsSoloMode(res.data.isSoloMode);
        setGithubAuthError(res.data.githubAuthError || null);
      }
      try {
        const kmRes = await API.getKeymap(currentRepoName);
        if (kmRes.ok && kmRes.data) {
          setKeymap(kmRes.data);
        }
      } catch {}
    } catch (err) {
      console.warn("[GovernanceSubView] Erro ao carregar colaboradores:", err);
    } finally {
      setIsLoadingCollabs(false);
    }
  }, [currentRepoName]);

  // Fetch Quorum & Branch Protection
  const fetchQuorumAndProtection = useCallback(async () => {
    try {
      const [qRes, pRes] = await Promise.all([
        API.getQuorumRules(currentRepoName),
        API.getBranchProtection(currentRepoName),
      ]);
      if (qRes.ok && qRes.data) {
        setQuorumRules(qRes.data.rules);
        setIsSoloMode(qRes.data.isSoloMode);
      }
      if (pRes.ok && pRes.data) {
        setBranchProtection(pRes.data);
      }
    } catch (err) {
      console.warn(
        "[GovernanceSubView] Erro ao carregar regras de quórum:",
        err,
      );
    }
  }, [currentRepoName]);

  // Fetch Audit Logs
  const fetchAuditLogs = useCallback(async () => {
    setIsLoadingAudit(true);
    try {
      const res = await API.getGovernanceAuditLogs(currentRepoName);
      if (res.ok && res.data) {
        setAuditLogs(res.data.logs || []);
      }
    } catch (err) {
      console.warn(
        "[GovernanceSubView] Erro ao carregar logs de auditoria:",
        err,
      );
    } finally {
      setIsLoadingAudit(false);
    }
  }, [currentRepoName]);

  useEffect(() => {
    fetchCollaborators();
    fetchQuorumAndProtection();
    fetchAuditLogs();
  }, [fetchCollaborators, fetchQuorumAndProtection, fetchAuditLogs]);

  // Helper to find Level Definition
  const getLevelDef = (levelIdOrRank: string | number) => {
    return (
      securityLevels.find(
        (l) =>
          l.id === levelIdOrRank ||
          String(l.rank) === String(levelIdOrRank) ||
          l.rank === Number(levelIdOrRank) ||
          l.name.toLowerCase() === String(levelIdOrRank).toLowerCase(),
      ) || {
        id: "public",
        rank: 999,
        name: "Público / Geral",
        color: "#10b981",
        description: "Acesso Geral",
      }
    );
  };

  // Handle Invite
  const handleSendInvite = async () => {
    if (!inviteUsername.trim()) return;
    setIsInviting(true);
    setInviteFeedback(null);
    try {
      const chosenLevel = getLevelDef(inviteLevelId);
      const res = await API.inviteCollaborator({
        username: inviteUsername.trim(),
        permission: invitePermission as any,
        security_level: chosenLevel.rank as any,
        level: chosenLevel.rank as any,
        role: inviteRoleName.trim() || undefined,
        role_name: inviteRoleName.trim() || undefined,
        allowed_paths: inviteAllowedPaths,
        repo: currentRepoName,
      });

      if (res.ok && res.data.success) {
        setInviteFeedback({ type: "success", message: res.data.message });
        setInviteUsername("");
        setInviteRoleName("");
        setInviteAllowedPaths(["*"]);
        fetchCollaborators();
        fetchAuditLogs();
        setTimeout(() => {
          setIsInviteModalOpen(false);
          setInviteFeedback(null);
        }, 1800);
      } else {
        setInviteFeedback({
          type: "error",
          message: res.data.error || "Falha ao convidar membro.",
        });
      }
    } catch (err: any) {
      setInviteFeedback({ type: "error", message: err.message });
    } finally {
      setIsInviting(false);
    }
  };

  // Open Edit Collaborator Modal
  const handleOpenEditModal = (collab: any) => {
    setEditingCollab(collab);
    setEditRoleName(collab.role || collab.role_name || "");
    setEditPermission(collab.permission || "push");
    const lvl = getLevelDef(collab.security_level_id || collab.security_level);
    setEditLevelId(lvl.id);
    const paths = Array.isArray(collab.allowed_paths) && collab.allowed_paths.length > 0
      ? collab.allowed_paths
      : (collab.is_owner ? ["*"] : ["*"]);
    setEditAllowedPaths(paths);
    setEditFeedback(null);
    setIsEditModalOpen(true);
  };

  // Save Edit Collaborator
  const handleSaveEditCollab = async () => {
    if (!editingCollab) return;
    setIsSavingEdit(true);
    setEditFeedback(null);
    try {
      const chosenLevel = getLevelDef(editLevelId);
      const res = await API.updateCollaboratorClearance({
        username: editingCollab.login,
        permission: editPermission,
        role: editRoleName.trim() || undefined,
        role_name: editRoleName.trim() || undefined,
        level: chosenLevel.rank,
        security_level: chosenLevel.rank,
        security_level_id: chosenLevel.id,
        allowed_paths: editAllowedPaths,
        repo: currentRepoName,
      });

      if (res.ok && res.data.success) {
        setEditFeedback({ type: "success", message: res.data.message });
        await fetchCollaborators();
        await fetchAuditLogs();
        setTimeout(() => {
          setIsEditModalOpen(false);
          setEditingCollab(null);
          setEditFeedback(null);
        }, 1500);
      } else {
        setEditFeedback({
          type: "error",
          message: (res.data as any)?.error || "Falha ao salvar alterações do colaborador.",
        });
      }
    } catch (err: any) {
      setEditFeedback({ type: "error", message: err.message });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Handle Remove Collaborator
  const handleRemoveCollaborator = async (username: string) => {
    if (
      !window.confirm(
        `Tem certeza que deseja remover @${username} da governança e do repositório?`,
      )
    ) {
      return;
    }
    try {
      const res = await API.removeCollaborator(username, currentRepoName);
      if (res.ok) {
        fetchCollaborators();
        fetchAuditLogs();
      }
    } catch (err) {
      console.warn("[GovernanceSubView] Erro ao remover colaborador:", err);
    }
  };

  // Handle Apply Branch Protection
  const handleApplyProtection = async () => {
    if (branchProtection?.enabled) return;
    setIsApplyingProtection(true);
    setProtectionFeedback(null);
    try {
      const res = await API.applyBranchProtection({
        min_approvals: quorumRules?.min_approvals_default || 1,
        enforce_admins: true,
        dismiss_stale_reviews: true,
        repo: currentRepoName,
      });

      if (res.ok && res.data.success) {
        setProtectionFeedback({ type: "success", message: res.data.message });
        fetchQuorumAndProtection();
        fetchAuditLogs();
      } else {
        setProtectionFeedback({
          type: "error",
          message: res.data.error || "Falha ao aplicar branch protection.",
        });
      }
    } catch (err: any) {
      setProtectionFeedback({ type: "error", message: err.message });
    } finally {
      setIsApplyingProtection(false);
    }
  };

  // Handle Save Quorum Rules
  const handleSaveQuorum = async (newApprovals: number) => {
    setIsSavingQuorum(true);
    try {
      const res = await API.updateQuorumRules({
        repo: currentRepoName,
        rules: { min_approvals_default: newApprovals },
      });
      if (res.ok && res.data.rules) {
        setQuorumRules(res.data.rules);
        fetchAuditLogs();
      }
    } catch (err) {
      console.warn("[GovernanceSubView] Erro ao salvar quórum:", err);
    } finally {
      setIsSavingQuorum(false);
    }
  };

  // Handle Unlock Level
  const handleUnlockLevel = async (levelId: string) => {
    const inputVal = levelInputs[levelId];
    if (!inputVal) return;
    setUnlockErrors((prev) => ({ ...prev, [levelId]: "" }));

    const res = await unlockLevel(levelId, inputVal);
    if (res.success) {
      setLevelInputs((prev) => ({ ...prev, [levelId]: "" }));
      setUnlockErrors((prev) => ({ ...prev, [levelId]: "" }));
    } else {
      setUnlockErrors((prev) => ({
        ...prev,
        [levelId]: res.error || "Passphrase incorreta. Falha de validação criptográfica.",
      }));
    }
  };

  // Handle Generate AI Token
  const handleGenerateToken = async () => {
    setIsGeneratingToken(true);
    try {
      await generateAIToken(
        unlockedLevels.length > 0 ? unlockedLevels[0] : 0,
        60,
      );
      fetchAuditLogs();
    } finally {
      setIsGeneratingToken(false);
    }
  };

  // Copy AI Token
  const handleCopyToken = () => {
    if (activeAIToken?.token) {
      navigator.clipboard.writeText(activeAIToken.token);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  // Handle Scan Secrets
  const handleScanSecrets = async () => {
    setIsScanningSecrets(true);
    try {
      const res = await API.scanSecrets(currentRepoName);
      if (res.ok && res.data) {
        setSecretScanResult({
          scanned: true,
          hasSecrets: res.data.hasSecrets,
          violations: res.data.violations || [],
        });
      }
    } catch (err) {
      console.warn("[GovernanceSubView] Erro no scan de segredos:", err);
    } finally {
      setIsScanningSecrets(false);
    }
  };

  return (
    <div
      style={{
        flex: 1,
        height: "100%",
        overflowY: "auto",
        background: "var(--color-surface, #1e1e2e)",
        color: "var(--color-on-surface, #cdd6f4)",
        padding: "24px 32px",
        fontFamily: "var(--font-sans, system-ui)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <ShieldCheck size={22} color="var(--color-primary, #6366f1)" />
          <div>
            <h1
              style={{
                fontSize: "20px",
                fontWeight: 600,
                margin: 0,
                color: "var(--color-on-surface, #cdd6f4)",
              }}
            >
              Governança
            </h1>
            <p
              style={{
                fontSize: "13px",
                margin: 0,
                color: "var(--color-outline, #a6adc8)",
              }}
            >
              Controle de acesso, proteção de branch e cofres criptográficos
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Badge variant={isSoloMode ? "neutral" : "success"} size="md">
            {isSoloMode ? "Modo Solo" : "Modo Equipe"}
          </Badge>

          {activeTab === "members" && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsInviteModalOpen(true)}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <UserPlus size={15} />
              <span>Convidar</span>
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          borderBottom:
            "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.08))",
          marginBottom: "20px",
        }}
      >
        <button
          onClick={() => setActiveTab("members")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
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
          }}
        >
          <Users size={16} />
          <span>Colaboradores ({collaborators.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("quorum")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            background: "none",
            border: "none",
            borderBottom:
              activeTab === "quorum"
                ? "2px solid var(--color-primary, #6366f1)"
                : "2px solid transparent",
            color:
              activeTab === "quorum"
                ? "var(--color-primary, #6366f1)"
                : "var(--color-outline, #a6adc8)",
            fontWeight: activeTab === "quorum" ? 600 : 500,
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          <GitBranch size={16} />
          <span>Proteção</span>
        </button>

        <button
          onClick={() => setActiveTab("vault")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            background: "none",
            border: "none",
            borderBottom:
              activeTab === "vault"
                ? "2px solid var(--color-primary, #6366f1)"
                : "2px solid transparent",
            color:
              activeTab === "vault"
                ? "var(--color-primary, #6366f1)"
                : "var(--color-outline, #a6adc8)",
            fontWeight: activeTab === "vault" ? 600 : 500,
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          <Key size={16} />
          <span>Chaves</span>
          {unlockedLevels.length > 1 && (
            <Badge variant="success" size="xs">
              {unlockedLevels.length - 1} ativas
            </Badge>
          )}
        </button>

        <button
          onClick={() => setActiveTab("audit")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            background: "none",
            border: "none",
            borderBottom:
              activeTab === "audit"
                ? "2px solid var(--color-primary, #6366f1)"
                : "2px solid transparent",
            color:
              activeTab === "audit"
                ? "var(--color-primary, #6366f1)"
                : "var(--color-outline, #a6adc8)",
            fontWeight: activeTab === "audit" ? 600 : 500,
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          <History size={16} />
          <span>Auditoria</span>
        </button>
      </div>

      {/* TAB 1: COLABORADORES */}
      {activeTab === "members" && (
        <div>
          {githubAuthError && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "8px",
                background: "rgba(234, 179, 8, 0.1)",
                border: "1px solid rgba(234, 179, 8, 0.3)",
                color: "#fde047",
                marginBottom: "16px",
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
              <div style={{ flex: 1 }}>
                Token do GitHub expirado ou inválido. Atualize em{" "}
                <strong>Configurações &gt; Autenticação</strong> para
                sincronizar os membros remotos.
              </div>
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
              marginBottom: "12px",
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
              <span>Sincronizar GitHub</span>
            </Button>
          </div>

          {/* Members Table */}
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
                  <th style={{ padding: "10px 16px" }}>Colaborador</th>
                  <th style={{ padding: "10px 16px" }}>Cargo / Função</th>
                  <th style={{ padding: "10px 16px" }}>Permissão Git</th>
                  <th style={{ padding: "10px 16px" }}>Nível</th>
                  <th style={{ padding: "10px 16px" }}>Rotas / Pastas Permitidas</th>
                  <th style={{ padding: "10px 16px" }}>Chave X25519</th>
                  <th style={{ padding: "10px 16px", textAlign: "right" }}>
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {collaborators.map((collab) => {
                  const levelDef = getLevelDef(
                    collab.security_level_id || collab.security_level,
                  );
                  return (
                    <tr
                      key={collab.login}
                      style={{
                        borderBottom:
                          "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.04))",
                        fontSize: "13px",
                      }}
                    >
                      <td style={{ padding: "10px 16px" }}>
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
                              width: "28px",
                              height: "28px",
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
                              {collab.is_owner && (
                                <span
                                  style={{
                                    marginLeft: "6px",
                                    fontSize: "10px",
                                    padding: "1px 6px",
                                    borderRadius: "10px",
                                    background: "rgba(239, 68, 68, 0.15)",
                                    color: "#ef4444",
                                    fontWeight: 600,
                                  }}
                                >
                                  Owner
                                </span>
                              )}
                            </div>
                            <a
                              href={collab.html_url}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                fontSize: "11px",
                                color: "var(--color-outline, #a6adc8)",
                                textDecoration: "none",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "3px",
                              }}
                            >
                              GitHub <ExternalLink size={10} />
                            </a>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: "10px 16px" }}>
                        <span
                          style={{
                            color: "var(--color-on-surface-variant, #bac2de)",
                          }}
                        >
                          {collab.role_name || collab.role ||
                            (collab.is_owner ? "Tech Lead" : "Engenheiro")}
                        </span>
                      </td>

                      <td style={{ padding: "10px 16px" }}>
                        <Badge
                          variant={
                            collab.permission === "admin"
                              ? "danger"
                              : collab.permission === "push"
                                ? "primary"
                                : "neutral"
                          }
                          size="xs"
                        >
                          {collab.permission}
                        </Badge>
                      </td>

                      <td style={{ padding: "10px 16px" }}>
                        <span
                          style={{
                            padding: "3px 10px",
                            borderRadius: "14px",
                            fontSize: "12px",
                            fontWeight: 600,
                            backgroundColor: levelDef.color + "15",
                            borderColor: levelDef.color + "40",
                            borderWidth: "1px",
                            borderStyle: "solid",
                            color: levelDef.color,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                        >
                          <Shield size={12} />
                          {levelDef.name} (Rank {levelDef.rank})
                        </span>
                      </td>

                      <td style={{ padding: "10px 16px" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                          {collab.allowed_paths && (collab.allowed_paths.includes("*") || collab.allowed_paths.includes("/**")) ? (
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                padding: "2px 8px",
                                borderRadius: "12px",
                                backgroundColor: "rgba(139, 92, 246, 0.15)",
                                border: "1px solid rgba(139, 92, 246, 0.4)",
                                color: "#8b5cf6",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>
                                all_inclusive
                              </span>
                              Todas as Pastas (*)
                            </span>
                          ) : Array.isArray(collab.allowed_paths) && collab.allowed_paths.length > 0 ? (
                            collab.allowed_paths.map((route: string) => (
                              <span
                                key={route}
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 500,
                                  padding: "2px 8px",
                                  borderRadius: "12px",
                                  backgroundColor: "rgba(99, 102, 241, 0.12)",
                                  border: "1px solid rgba(99, 102, 241, 0.3)",
                                  color: "#6366f1",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "3px",
                                }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>
                                  folder
                                </span>
                                {route.replace(/\/\*\*$/, "")}
                              </span>
                            ))
                          ) : (
                            <span style={{ fontSize: "11px", color: "var(--color-outline, #a6adc8)" }}>Nenhuma</span>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: "10px 16px" }}>
                        {keymap?.members?.[collab.login]?.fingerprint ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "2px 8px",
                              borderRadius: "12px",
                              backgroundColor: "rgba(16, 185, 129, 0.1)",
                              border: "1px solid rgba(16, 185, 129, 0.3)",
                              color: "#10b981",
                              fontSize: "11px",
                              fontFamily: "monospace",
                            }}
                            title={`Chave Pública X25519: ${keymap.members[collab.login].fingerprint}`}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>
                              key
                            </span>
                            {keymap.members[collab.login].fingerprint}
                          </span>
                        ) : (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "2px 8px",
                              borderRadius: "12px",
                              backgroundColor: "rgba(255, 255, 255, 0.05)",
                              border: "1px solid rgba(255, 255, 255, 0.1)",
                              color: "var(--color-outline)",
                              fontSize: "11px",
                            }}
                          >
                            Pendente
                          </span>
                        )}
                      </td>

                      <td style={{ padding: "10px 16px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => handleOpenEditModal(collab)}
                            style={{ padding: "4px 8px" }}
                            title="Editar permissões, cargo e rotas do colaborador"
                          >
                            <Edit2 size={13} />
                          </Button>
                          {!collab.is_owner && (
                            <Button
                              variant="danger"
                              size="xs"
                              onClick={() =>
                                handleRemoveCollaborator(collab.login)
                              }
                              style={{ padding: "4px 8px" }}
                              title="Remover colaborador"
                            >
                              <Trash2 size={13} />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* TAB 2: PROTEÇÃO */}
      {activeTab === "quorum" && (
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
                <h3 style={{ fontSize: "15px", fontWeight: 600, margin: 0 }}>
                  Quórum de Aprovação
                </h3>
              </div>
              <Badge variant={isSoloMode ? "neutral" : "success"} size="sm">
                {isSoloMode ? "Modo Solo" : "Modo Equipe"}
              </Badge>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span
                style={{
                  fontSize: "13px",
                  color: "var(--color-outline, #a6adc8)",
                }}
              >
                Aprovações mínimas obrigatórias por PR:
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
                  width: "54px",
                  padding: "4px 8px",
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
                <h3 style={{ fontSize: "15px", fontWeight: 600, margin: 0 }}>
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
              de Pull Request para qualquer alteração.
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
              disabled={Boolean(branchProtection?.enabled) || isApplyingProtection}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                opacity: branchProtection?.enabled ? 0.8 : 1,
                cursor: branchProtection?.enabled ? "not-allowed" : "pointer",
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
        </div>
      )}

      {/* TAB 3: CHAVES */}
      {activeTab === "vault" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* AI Secure Context Pipe */}
          <Card variant="flat" padding="md">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "8px",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <Bot size={18} color="#818cf8" />
                <h3 style={{ fontSize: "15px", fontWeight: 600, margin: 0 }}>
                  Token Efêmero para IA & CLI
                </h3>
              </div>

              {activeAIToken && (
                <Badge variant="success" size="xs">
                  ● Token Ativo (1h)
                </Badge>
              )}
            </div>

            <p
              style={{
                fontSize: "13px",
                color: "var(--color-outline, #a6adc8)",
                margin: "0 0 14px 0",
              }}
            >
              Gera token efêmero de 1 hora para ferramentas CLI locais (Antigravity CLI, Cursor, Claude Code) acessarem memórias cifradas via localhost sem expor senhas em texto plano.
            </p>

            {activeAIToken ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  background: "var(--color-surface-container-high, #1e1e2e)",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border:
                    "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.1))",
                }}
              >
                <Terminal size={15} color="#a6adc8" />
                <code
                  style={{
                    fontSize: "12px",
                    fontFamily: "monospace",
                    color: "#89b4fa",
                    flex: 1,
                  }}
                >
                  {activeAIToken.token}
                </code>

                <Button
                  variant="outline"
                  size="xs"
                  onClick={handleCopyToken}
                  style={{ display: "flex", alignItems: "center", gap: "4px" }}
                >
                  {copiedToken ? (
                    <Check size={13} color="#10b981" />
                  ) : (
                    <Copy size={13} />
                  )}
                  <span>{copiedToken ? "Copiado!" : "Copiar"}</span>
                </Button>

                <Button
                  variant="primary"
                  size="xs"
                  onClick={handleGenerateToken}
                  disabled={isGeneratingToken}
                >
                  Renovar
                </Button>
              </div>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={handleGenerateToken}
                disabled={isGeneratingToken}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Key size={14} />
                <span>
                  {isGeneratingToken ? "Gerando..." : "Gerar Token para IA"}
                </span>
              </Button>
            )}
          </Card>

          {/* Key Management Linear List */}
          <Card variant="flat" padding="none" style={{ overflow: "hidden" }}>
            <div
              style={{
                padding: "14px 16px",
                borderBottom:
                  "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.08))",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <h3 style={{ fontSize: "14px", fontWeight: 600, margin: 0 }}>
                  Níveis de Segurança & Desbloqueio em Memória
                </h3>
                <span
                  style={{
                    fontSize: "12px",
                    color: "var(--color-outline, #a6adc8)",
                  }}
                >
                  Validação criptográfica em tempo real via Canary AES-256-GCM.
                </span>
              </div>

              {unlockedLevels.length > 1 && (
                <Button variant="danger" size="xs" onClick={lockAll}>
                  Bloquear Todas
                </Button>
              )}
            </div>

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
                  }}
                >
                  <th style={{ padding: "10px 16px" }}>Nível & Rank</th>
                  <th style={{ padding: "10px 16px" }}>Status</th>
                  <th style={{ padding: "10px 16px" }}>
                    Desbloqueio com Passphrase
                  </th>
                </tr>
              </thead>
              <tbody>
                {securityLevels.map((lvl) => {
                  const isUnlocked =
                    unlockedLevelIds.includes(lvl.id) ||
                    unlockedLevels.includes(lvl.rank);
                  const isPublic = lvl.rank === 999 || lvl.id === "public";
                  const errMessage = unlockErrors[lvl.id];

                  return (
                    <tr
                      key={lvl.id}
                      style={{
                        borderBottom:
                          "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.04))",
                        fontSize: "13px",
                      }}
                    >
                      <td style={{ padding: "12px 16px", width: "260px" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 600,
                              padding: "2px 8px",
                              borderRadius: "12px",
                              backgroundColor: lvl.color + "15",
                              borderColor: lvl.color + "40",
                              borderWidth: "1px",
                              borderStyle: "solid",
                              color: lvl.color,
                            }}
                          >
                            {lvl.name} (Rank {lvl.rank})
                          </span>
                        </div>
                      </td>

                      <td style={{ padding: "12px 16px", width: "160px" }}>
                        <Badge
                          variant={
                            isPublic
                              ? "neutral"
                              : isUnlocked
                                ? "success"
                                : "warning"
                          }
                          size="xs"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          {isPublic ? (
                            <span>Público</span>
                          ) : isUnlocked ? (
                            <>
                              <Unlock size={12} />
                              <span>Desbloqueado</span>
                            </>
                          ) : (
                            <>
                              <Lock size={12} />
                              <span>Bloqueado</span>
                            </>
                          )}
                        </Badge>
                      </td>

                      <td style={{ padding: "12px 16px" }}>
                        {isPublic ? (
                          <span
                            style={{
                              color: "var(--color-outline, #a6adc8)",
                              fontSize: "12px",
                            }}
                          >
                            Texto plano sem criptografia
                          </span>
                        ) : isUnlocked ? (
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => lockLevel(lvl.id)}
                          >
                            Bloquear Nível
                          </Button>
                        ) : (
                          <div>
                            <div
                              style={{
                                display: "flex",
                                gap: "8px",
                                maxWidth: "340px",
                              }}
                            >
                              <input
                                type="password"
                                placeholder={`Passphrase para ${lvl.name}...`}
                                value={levelInputs[lvl.id] || ""}
                                onChange={(e) =>
                                  setLevelInputs({
                                    ...levelInputs,
                                    [lvl.id]: e.target.value,
                                  })
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    handleUnlockLevel(lvl.id);
                                  }
                                }}
                                style={{
                                  flex: 1,
                                  padding: "4px 8px",
                                  borderRadius: "6px",
                                  background:
                                    "var(--color-surface-container-high, #1e1e2e)",
                                  color: "var(--color-on-surface, #cdd6f4)",
                                  border:
                                    "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.12))",
                                  fontSize: "12px",
                                }}
                              />
                              <Button
                                variant="primary"
                                size="xs"
                                onClick={() => handleUnlockLevel(lvl.id)}
                              >
                                Desbloquear
                              </Button>
                            </div>
                            {errMessage && (
                              <div
                                style={{
                                  fontSize: "11px",
                                  color: "#ef4444",
                                  marginTop: "4px",
                                }}
                              >
                                {errMessage}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          {/* Secret Scanning Card */}
          <Card variant="flat" padding="md">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "10px",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <Search size={18} color="#f59e0b" />
                <h3 style={{ fontSize: "15px", fontWeight: 600, margin: 0 }}>
                  Scanner de Segredos & Conformidade Git
                </h3>
              </div>

              <Button
                variant="outline"
                size="xs"
                onClick={handleScanSecrets}
                disabled={isScanningSecrets}
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <RefreshCw
                  size={13}
                  className={isScanningSecrets ? "animate-spin" : ""}
                />
                <span>{isScanningSecrets ? "Escanear..." : "Escanear Agora"}</span>
              </Button>
            </div>

            <p
              style={{
                fontSize: "13px",
                color: "var(--color-outline, #a6adc8)",
                margin: "0 0 12px 0",
              }}
            >
              Verifica se existem tokens de API (GitHub PATs, OpenAI Keys, AWS) ou documentos marcados como confidenciais sem criptografia no repositório.
            </p>

            {secretScanResult && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "6px",
                  background: secretScanResult.hasSecrets
                    ? "rgba(239, 68, 68, 0.15)"
                    : "rgba(16, 185, 129, 0.15)",
                  color: secretScanResult.hasSecrets ? "#ef4444" : "#10b981",
                  fontSize: "13px",
                }}
              >
                {secretScanResult.hasSecrets ? (
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: "6px" }}>
                      ⚠️ Foram encontrados segredos ou documentos confidenciais desprotegidos:
                    </div>
                    <ul style={{ margin: 0, paddingLeft: "20px" }}>
                      {secretScanResult.violations.map((v, i) => (
                        <li key={i} style={{ marginBottom: "2px" }}>
                          <code>{v.file}</code> — {v.reason} ({v.type})
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <CheckCircle2 size={16} />
                    <span>Nenhum segredo em texto plano detectado no repositório.</span>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 4: AUDITORIA */}
      {activeTab === "audit" && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: "12px",
            }}
          >
            <Button
              variant="outline"
              size="xs"
              onClick={fetchAuditLogs}
              disabled={isLoadingAudit}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <RefreshCw
                size={13}
                className={isLoadingAudit ? "animate-spin" : ""}
              />
              <span>Atualizar</span>
            </Button>
          </div>

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
                  }}
                >
                  <th style={{ padding: "10px 16px" }}>Data / Hora</th>
                  <th style={{ padding: "10px 16px" }}>Ação</th>
                  <th style={{ padding: "10px 16px" }}>Autor</th>
                  <th style={{ padding: "10px 16px" }}>Alvo</th>
                  <th style={{ padding: "10px 16px" }}>Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        padding: "20px",
                        textAlign: "center",
                        color: "var(--color-outline, #a6adc8)",
                      }}
                    >
                      Nenhum registro de auditoria no histórico recente.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr
                      key={log.id}
                      style={{
                        borderBottom:
                          "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.04))",
                        fontSize: "13px",
                      }}
                    >
                      <td
                        style={{
                          padding: "10px 16px",
                          color: "var(--color-outline, #a6adc8)",
                          fontSize: "12px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {new Date(log.timestamp).toLocaleString("pt-BR")}
                      </td>
                      <td style={{ padding: "10px 16px" }}>
                        <Badge variant="neutral" size="xs">
                          {log.action}
                        </Badge>
                      </td>
                      <td
                        style={{
                          padding: "10px 16px",
                          fontWeight: 600,
                          color: "#89b4fa",
                        }}
                      >
                        {log.actor}
                      </td>
                      <td
                        style={{
                          padding: "10px 16px",
                          color: "var(--color-on-surface-variant, #bac2de)",
                        }}
                      >
                        {log.target || "—"}
                      </td>
                      <td
                        style={{
                          padding: "10px 16px",
                          color: "var(--color-on-surface, #cdd6f4)",
                        }}
                      >
                        {log.details}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* Invite Modal */}
      {isInviteModalOpen && (
        <Modal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          title="Convidar Colaborador"
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              padding: "8px 0",
            }}
          >
            <FormField label="Nome de Usuário no GitHub">
              <input
                type="text"
                placeholder="Ex: octocat"
                value={inviteUsername}
                onChange={(e) => setInviteUsername(e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  background: "var(--color-surface-container-high, #1e1e2e)",
                  color: "var(--color-on-surface, #cdd6f4)",
                  border:
                    "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.12))",
                  fontSize: "13px",
                }}
              />
            </FormField>

            <FormField label="Cargo / Função">
              <input
                type="text"
                placeholder="Ex: Engenheiro de IA, Tech Lead"
                value={inviteRoleName}
                onChange={(e) => setInviteRoleName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  background: "var(--color-surface-container-high, #1e1e2e)",
                  color: "var(--color-on-surface, #cdd6f4)",
                  border:
                    "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.12))",
                  fontSize: "13px",
                }}
              />
            </FormField>

            <FormField label="Permissão GitHub">
              <select
                value={invitePermission}
                onChange={(e) => setInvitePermission(e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  background: "var(--color-surface-container-high, #1e1e2e)",
                  color: "var(--color-on-surface, #cdd6f4)",
                  border:
                    "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.12))",
                  fontSize: "13px",
                }}
              >
                <option value="push">push (Escrita - Criar branch e PR)</option>
                <option value="pull">pull (Leitura)</option>
                <option value="admin">admin (Administrador)</option>
              </select>
            </FormField>

            <FormField label="Nível de Segurança Inicial">
              <select
                value={inviteLevelId}
                onChange={(e) => setInviteLevelId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  background: "var(--color-surface-container-high, #1e1e2e)",
                  color: "var(--color-on-surface, #cdd6f4)",
                  border:
                    "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.12))",
                  fontSize: "13px",
                }}
              >
                {securityLevels.map((lvl) => (
                  <option key={lvl.id} value={lvl.id}>
                    {lvl.name} (Rank {lvl.rank})
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Rotas / Pastas Autorizadas (Escopo de Acesso)">
              <div style={{ marginTop: "4px" }}>
                <FolderTreePicker
                  tree={tree || []}
                  selectedPaths={inviteAllowedPaths}
                  onChange={setInviteAllowedPaths}
                />
              </div>
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

      {/* Edit Collaborator Modal */}
      {isEditModalOpen && editingCollab && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingCollab(null);
          }}
          title={`Editar Colaborador @${editingCollab.login}`}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              padding: "8px 0",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "10px",
                borderRadius: "8px",
                background: "var(--color-surface-container-high, #1e1e2e)",
                border: "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.08))",
              }}
            >
              <img
                src={editingCollab.avatar_url}
                alt={editingCollab.login}
                style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#313244" }}
              />
              <div>
                <div style={{ fontWeight: 600, color: "var(--color-on-surface, #cdd6f4)", fontSize: "14px" }}>
                  @{editingCollab.login}
                </div>
                <div style={{ fontSize: "11px", color: "var(--color-outline, #a6adc8)" }}>
                  {editingCollab.is_owner ? "Proprietário do Repositório" : "Membro da Governança"}
                </div>
              </div>
            </div>

            <FormField label="Cargo / Função">
              <input
                type="text"
                placeholder="Ex: Tech Lead, Desenvolvedor Backend, CFO"
                value={editRoleName}
                onChange={(e) => setEditRoleName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  background: "var(--color-surface-container-high, #1e1e2e)",
                  color: "var(--color-on-surface, #cdd6f4)",
                  border:
                    "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.12))",
                  fontSize: "13px",
                }}
              />
            </FormField>

            <FormField label="Permissão Git no Repositório">
              <select
                value={editPermission}
                onChange={(e) => setEditPermission(e.target.value)}
                disabled={editingCollab.is_owner}
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  background: "var(--color-surface-container-high, #1e1e2e)",
                  color: "var(--color-on-surface, #cdd6f4)",
                  border:
                    "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.12))",
                  fontSize: "13px",
                }}
              >
                <option value="pull">pull (Leitura apenas)</option>
                <option value="triage">triage (Triagem de Issues e PRs)</option>
                <option value="push">push (Escrita - Criar branches e PRs)</option>
                <option value="maintain">maintain (Manutenção)</option>
                <option value="admin">admin (Administrador pleno)</option>
              </select>
            </FormField>

            <FormField label="Nível de Segurança / Clearance">
              <select
                value={editLevelId}
                onChange={(e) => setEditLevelId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  background: "var(--color-surface-container-high, #1e1e2e)",
                  color: "var(--color-on-surface, #cdd6f4)",
                  border:
                    "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.12))",
                  fontSize: "13px",
                }}
              >
                {securityLevels.map((lvl) => (
                  <option key={lvl.id} value={lvl.id}>
                    {lvl.name} (Rank {lvl.rank})
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Rotas / Pastas Autorizadas (Escopo de Acesso)">
              <div style={{ marginTop: "4px" }}>
                <FolderTreePicker
                  tree={tree || []}
                  selectedPaths={editAllowedPaths}
                  onChange={setEditAllowedPaths}
                />
              </div>
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
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingCollab(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveEditCollab}
                disabled={isSavingEdit}
              >
                {isSavingEdit ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

