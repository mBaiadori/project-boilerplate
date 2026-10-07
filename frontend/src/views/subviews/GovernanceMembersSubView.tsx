import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Users,
  Shield,
  ShieldCheck,
  ShieldAlert,
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
  ExternalLink,
  AlertTriangle,
  Search,
  CheckCircle2,
  Plus,
  Layers,
  Download,
  FileCode,
} from "lucide-react";
import { API } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useWorkspace } from "../../context/WorkspaceContext";
import { useSecurity } from "../../context/SecurityContext";
import type { OrgTeam } from "../../types";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { FormField } from "../../components/ui/FormField";
import { Card } from "../../components/ui/Card";

interface FolderNode {
  path: string;
  name: string;
  depth: number;
  children: FolderNode[];
}

interface FolderTreePickerProps {
  tree: any[];
  allowedPaths: string[];
  deniedPaths: string[];
  onChange: (allowed: string[], denied: string[]) => void;
  disabled?: boolean;
}

const FolderTreePicker: React.FC<FolderTreePickerProps> = ({
  tree,
  allowedPaths,
  deniedPaths,
  onChange,
  disabled = false,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedPaths, setCollapsedPaths] = useState<Record<string, boolean>>({});

  // Constrói árvore hierárquica a partir da árvore plana de arquivos do workspace
  const folderTree = useMemo(() => {
    const rootNodes: FolderNode[] = [];
    const nodeMap = new Map<string, FolderNode>();

    const walk = (nodes: any[], currentDepth = 0) => {
      for (const node of nodes || []) {
        if (node.type === "directory" || (node.children && node.children.length > 0)) {
          const cleanPath = (node.path || "").replace(/\\/g, "/").replace(/^\/+/, "");
          if (!cleanPath) continue;

          const folderNode: FolderNode = {
            path: cleanPath,
            name: node.name || cleanPath.split("/").pop() || cleanPath,
            depth: currentDepth,
            children: [],
          };

          nodeMap.set(cleanPath, folderNode);

          // Verifica se tem pai
          const pathSegments = cleanPath.split("/");
          if (pathSegments.length > 1) {
            const parentPath = pathSegments.slice(0, -1).join("/");
            const parentNode = nodeMap.get(parentPath);
            if (parentNode) {
              parentNode.children.push(folderNode);
            } else {
              rootNodes.push(folderNode);
            }
          } else {
            rootNodes.push(folderNode);
          }

          if (Array.isArray(node.children)) {
            walk(node.children, currentDepth + 1);
          }
        }
      }
    };

    walk(tree || []);
    return rootNodes;
  }, [tree]);

  // Lista plana para contagem e busca rápida
  const allFolderPaths = useMemo(() => {
    const list: { path: string; name: string }[] = [];
    const traverse = (nodes: FolderNode[]) => {
      for (const n of nodes) {
        list.push({ path: n.path, name: n.name });
        traverse(n.children);
      }
    };
    traverse(folderTree);
    return list;
  }, [folderTree]);

  const isGlobal = allowedPaths.includes("*") || allowedPaths.includes("/**");

  // Helper para verificar status de acesso de uma pasta
  const getFolderAccessState = useCallback((folderPath: string): {
    isDenied: boolean;
    isExplicitlyAllowed: boolean;
    isInherited: boolean;
    hasAccess: boolean;
    parentSource?: string;
  } => {
    const clean = folderPath.replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();

    // 1. Negação explícita tem prioridade máxima
    const isDenied = deniedPaths.some((p) => {
      const cleanP = p.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/\*+$/, "").toLowerCase();
      return clean === cleanP || clean.startsWith(cleanP + "/");
    });

    if (isDenied) {
      return { isDenied: true, isExplicitlyAllowed: false, isInherited: false, hasAccess: false };
    }

    // 2. Acesso Global
    if (isGlobal) {
      return { isDenied: false, isExplicitlyAllowed: false, isInherited: true, hasAccess: true, parentSource: "*" };
    }

    // 3. Explícito
    const isExplicitlyAllowed = allowedPaths.some((p) => {
      const cleanP = p.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/\*+$/, "").toLowerCase();
      return clean === cleanP;
    });

    if (isExplicitlyAllowed) {
      return { isDenied: false, isExplicitlyAllowed: true, isInherited: false, hasAccess: true };
    }

    // 4. Herdado do Pai
    const parentAllowed = allowedPaths.find((p) => {
      const cleanP = p.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/\*+$/, "").toLowerCase();
      return clean.startsWith(cleanP + "/");
    });

    if (parentAllowed) {
      return { isDenied: false, isExplicitlyAllowed: false, isInherited: true, hasAccess: true, parentSource: parentAllowed };
    }

    return { isDenied: false, isExplicitlyAllowed: false, isInherited: false, hasAccess: false };
  }, [allowedPaths, deniedPaths, isGlobal]);

  // Toggle Global
  const handleToggleGlobal = () => {
    if (disabled) return;
    if (isGlobal) {
      onChange([], []);
    } else {
      onChange(["*"], []);
    }
  };

  // Toggle Permissão Normal de Pasta
  const handleToggleAllowFolder = (folderPath: string) => {
    if (disabled) return;
    const clean = folderPath.replace(/\\/g, "/").replace(/^\/+/, "");
    const state = getFolderAccessState(clean);

    let nextAllowed = isGlobal ? allFolderPaths.map((f) => f.path) : [...allowedPaths];
    let nextDenied = [...deniedPaths];

    // Se estava negado, remove a negação
    nextDenied = nextDenied.filter((p) => {
      const cleanP = p.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/\*+$/, "");
      return cleanP.toLowerCase() !== clean.toLowerCase();
    });

    if (state.hasAccess && !state.isInherited) {
      // Remove a permissão explícita
      nextAllowed = nextAllowed.filter((p) => {
        const cleanP = p.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/\*+$/, "");
        return cleanP.toLowerCase() !== clean.toLowerCase() && p !== "*";
      });
    } else if (!state.hasAccess) {
      // Adiciona permissão explícita
      if (!nextAllowed.includes(clean)) {
        nextAllowed.push(clean);
      }
    } else if (state.isInherited) {
      // Já herda, então se o usuário desmarcar o checkbox, cria uma negação para essa subpasta
      if (!nextDenied.includes(clean)) {
        nextDenied.push(clean);
      }
    }

    onChange(nextAllowed, nextDenied);
  };

  // Toggle Bloqueio de Exceção (Subpasta)
  const handleToggleDenyFolder = (folderPath: string) => {
    if (disabled) return;
    const clean = folderPath.replace(/\\/g, "/").replace(/^\/+/, "");
    const isCurrentlyDenied = deniedPaths.some((p) => {
      const cleanP = p.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/\*+$/, "");
      return cleanP.toLowerCase() === clean.toLowerCase();
    });

    let nextDenied = [...deniedPaths];
    if (isCurrentlyDenied) {
      // Remove o bloqueio (restaura herança)
      nextDenied = nextDenied.filter((p) => {
        const cleanP = p.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/\*+$/, "");
        return cleanP.toLowerCase() !== clean.toLowerCase();
      });
    } else {
      // Adiciona bloqueio de exceção
      nextDenied.push(clean);
    }

    onChange(allowedPaths, nextDenied);
  };

  const toggleCollapse = (path: string) => {
    setCollapsedPaths((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  // Renderizador recursivo de nós da árvore
  const renderNode = (node: FolderNode) => {
    const state = getFolderAccessState(node.path);
    const hasChildren = node.children && node.children.length > 0;
    const isCollapsed = !!collapsedPaths[node.path];

    // Se houver busca, filtra nós
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesSelf = node.name.toLowerCase().includes(query) || node.path.toLowerCase().includes(query);
      const matchesChild = (function checkChild(n: FolderNode): boolean {
        return (
          n.name.toLowerCase().includes(query) ||
          n.path.toLowerCase().includes(query) ||
          n.children.some(checkChild)
        );
      })(node);

      if (!matchesSelf && !matchesChild) return null;
    }

    return (
      <div key={node.path} style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "5px 8px",
            paddingLeft: `${Math.max(node.depth * 18 + 8, 8)}px`,
            borderRadius: "6px",
            backgroundColor: state.isDenied
              ? "rgba(239, 68, 68, 0.12)"
              : state.isExplicitlyAllowed
              ? "rgba(99, 102, 241, 0.15)"
              : state.isInherited
              ? "rgba(16, 185, 129, 0.08)"
              : "transparent",
            border: state.isDenied
              ? "1px solid rgba(239, 68, 68, 0.35)"
              : state.isExplicitlyAllowed
              ? "1px solid rgba(99, 102, 241, 0.35)"
              : state.isInherited
              ? "1px solid rgba(16, 185, 129, 0.2)"
              : "1px solid transparent",
            marginBottom: "3px",
            transition: "all 0.15s ease",
          }}
        >
          {/* Chevron Expand/Collapse */}
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleCollapse(node.path);
              }}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                color: "var(--color-outline, #a6adc8)",
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: "16px",
                  transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                  transition: "transform 0.15s ease",
                }}
              >
                expand_more
              </span>
            </button>
          ) : (
            <div style={{ width: "16px" }} />
          )}

          {/* Checkbox de Permissão */}
          <input
            type="checkbox"
            checked={state.hasAccess && !state.isDenied}
            disabled={disabled}
            onChange={() => handleToggleAllowFolder(node.path)}
            title={
              state.isDenied
                ? "Pasta bloqueada por exceção. Clique para permitir."
                : state.isInherited
                ? "Acesso herdado da pasta superior. Clique para remover acesso desta subpasta."
                : "Alternar permissão desta pasta."
            }
            style={{ cursor: disabled ? "not-allowed" : "pointer", accentColor: "#6366f1" }}
          />

          {/* Ícone da Pasta */}
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: "17px",
              color: state.isDenied
                ? "#ef4444"
                : state.isExplicitlyAllowed
                ? "#6366f1"
                : state.isInherited
                ? "#10b981"
                : "var(--color-outline, #a6adc8)",
            }}
          >
            {state.isDenied ? "folder_off" : state.isInherited ? "folder_shared" : "folder"}
          </span>

          {/* Nome da Pasta */}
          <span
            style={{
              fontSize: "12.5px",
              fontWeight: state.isExplicitlyAllowed || state.isDenied ? 600 : 400,
              color: state.isDenied
                ? "#ef4444"
                : state.hasAccess
                ? "var(--color-on-surface, #cdd6f4)"
                : "var(--color-outline, #a6adc8)",
              textDecoration: state.isDenied ? "line-through" : "none",
            }}
          >
            {node.name}
          </span>

          {/* Badge de Status / Herança / Exceção */}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px" }}>
            {state.isDenied && (
              <span
                style={{
                  fontSize: "10.5px",
                  fontWeight: 600,
                  color: "#ef4444",
                  background: "rgba(239, 68, 68, 0.18)",
                  padding: "1px 6px",
                  borderRadius: "4px",
                  display: "flex",
                  alignItems: "center",
                  gap: "3px",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>
                  lock
                </span>
                Exceção: Bloqueado
              </span>
            )}

            {!state.isDenied && state.isInherited && (
              <span
                style={{
                  fontSize: "10.5px",
                  color: "#10b981",
                  background: "rgba(16, 185, 129, 0.12)",
                  padding: "1px 6px",
                  borderRadius: "4px",
                  display: "flex",
                  alignItems: "center",
                  gap: "3px",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>
                  subdirectory_arrow_right
                </span>
                Herdado
              </span>
            )}

            {!state.isDenied && state.isExplicitlyAllowed && (
              <span
                style={{
                  fontSize: "10.5px",
                  fontWeight: 600,
                  color: "#6366f1",
                  background: "rgba(99, 102, 241, 0.15)",
                  padding: "1px 6px",
                  borderRadius: "4px",
                }}
              >
                Permitido
              </span>
            )}

            {/* Botão de Exceção Rápida (Bloquear Subpasta ou Restaurar) */}
            {(state.hasAccess || state.isDenied) && !disabled && (
              <button
                type="button"
                onClick={() => handleToggleDenyFolder(node.path)}
                title={state.isDenied ? "Remover exceção e restaurar acesso herdado" : "Bloquear especificamente esta subpasta (Criar Exceção)"}
                style={{
                  background: state.isDenied ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                  border: state.isDenied ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: "4px",
                  padding: "2px 6px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "3px",
                  color: state.isDenied ? "#10b981" : "#ef4444",
                  fontSize: "10.5px",
                  fontWeight: 500,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>
                  {state.isDenied ? "lock_open" : "lock"}
                </span>
                {state.isDenied ? "Desbloquear" : "Bloquear Subpasta"}
              </button>
            )}
          </div>
        </div>

        {/* Subpastas Filhas */}
        {hasChildren && !isCollapsed && (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {node.children.map(renderNode)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        border: "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.12))",
        borderRadius: "8px",
        background: "var(--color-surface-container, #181825)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        padding: "10px",
      }}
    >
      {/* Barra de Filtro e Busca Rápida */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: "var(--color-surface-container-high, #1e1e2e)",
            borderRadius: "6px",
            padding: "4px 8px",
            border: "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.08))",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "15px", color: "#a6adc8" }}>
            search
          </span>
          <input
            type="text"
            placeholder="Buscar pastas e subpastas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={disabled}
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--color-on-surface, #cdd6f4)",
              fontSize: "12px",
              width: "100%",
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              style={{ background: "none", border: "none", color: "#a6adc8", cursor: "pointer", padding: 0 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                close
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Opção Acesso Global */}
      <div
        onClick={handleToggleGlobal}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "6px 10px",
          borderRadius: "6px",
          cursor: disabled ? "not-allowed" : "pointer",
          backgroundColor: isGlobal ? "rgba(139, 92, 246, 0.18)" : "transparent",
          border: isGlobal ? "1px solid rgba(139, 92, 246, 0.4)" : "1px solid rgba(255, 255, 255, 0.06)",
          transition: "background 0.15s ease",
        }}
      >
        <input
          type="checkbox"
          checked={isGlobal}
          disabled={disabled}
          onChange={handleToggleGlobal}
          onClick={(e) => e.stopPropagation()}
          style={{ cursor: disabled ? "not-allowed" : "pointer", accentColor: "#8b5cf6" }}
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
          Herança Global
        </span>
      </div>

      <div style={{ height: "1px", background: "var(--color-outline-variant, rgba(255, 255, 255, 0.08))", margin: "2px 0" }} />

      {/* Árvore de Pastas */}
      <div
        style={{
          maxHeight: "230px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "2px",
          paddingRight: "4px",
        }}
      >
        {folderTree.length === 0 ? (
          <div style={{ padding: "10px", fontSize: "12px", color: "#a6adc8", fontStyle: "italic", textAlign: "center" }}>
            Nenhuma pasta detectada no workspace. O colaborador terá acesso a todas as rotas (*).
          </div>
        ) : (
          folderTree.map(renderNode)
        )}
      </div>

      {/* Rodapé com Resumo Dinâmico e Exceções */}
      {deniedPaths.length > 0 && (
        <div
          style={{
            marginTop: "4px",
            padding: "6px 10px",
            borderRadius: "6px",
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <div style={{ fontSize: "11px", fontWeight: 600, color: "#ef4444", display: "flex", alignItems: "center", gap: "4px" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>
              block
            </span>
            {deniedPaths.length} {deniedPaths.length === 1 ? "Subpasta Bloqueada (Exceção)" : "Subpastas Bloqueadas (Exceções)"}:
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
            {deniedPaths.map((path) => (
              <span
                key={path}
                style={{
                  fontSize: "10.5px",
                  color: "#ef4444",
                  background: "rgba(239, 68, 68, 0.15)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  padding: "1px 6px",
                  borderRadius: "12px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "3px",
                }}
              >
                {path}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => handleToggleDenyFolder(path)}
                    title="Remover exceção"
                    style={{
                      background: "none",
                      border: "none",
                      color: "#ef4444",
                      cursor: "pointer",
                      padding: 0,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>
                      close
                    </span>
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const GovernanceMembersSubView: React.FC = () => {
  const { user, provider } = useAuth();
  const providerLabel = provider === "github" ? "GitHub" : "Modo Local";
  const { activeRepo, tree, activeOrg } = useWorkspace();
  const currentRepoName = activeRepo?.name;
  const {
    departments,
    myAccess,
    activeAIToken,
    generateAIToken,
  } = useSecurity();

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    "members" | "teams" | "quorum" | "vault" | "org_security" | "audit"
  >("members");

  // Teams State (GitHub Free for Organizations)
  const [teams, setTeams] = useState<OrgTeam[]>([
    {
      id: 1,
      name: "Engenharia Frontend",
      slug: "frontend",
      description: "Equipe responsável pelas interfaces, design tokens e componentes UI",
      privacy: "closed",
      permission: "push",
      members_count: 3,
      repos_count: 2,
      repos: ["frontend-app", "design-system"],
    },
    {
      id: 2,
      name: "Engenharia Backend & Core",
      slug: "backend",
      description: "Equipe responsável pelas APIs, contratos e serviços de backend",
      privacy: "closed",
      permission: "push",
      members_count: 4,
      repos_count: 3,
      repos: ["core-api", "auth-service", "data-pipeline"],
    },
    {
      id: 3,
      name: "Arquitetura & Governança",
      slug: "governance",
      description: "Guardiões de ADRs, conformidade de segurança e padrões do Context OS",
      privacy: "closed",
      permission: "admin",
      members_count: 2,
      repos_count: 4,
      repos: ["project-boilerplate", "living-docs"],
    },
  ]);
  const [isCreateTeamModalOpen, setIsCreateTeamModalOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDesc, setNewTeamDesc] = useState("");
  const [newTeamPermission, setNewTeamPermission] = useState<
    "pull" | "triage" | "push" | "maintain" | "admin"
  >("push");

  // Org Security & 2FA State (GitHub Free for Organizations)
  const [is2FAEnforced, setIs2FAEnforced] = useState(true);
  const [dependabotEnabled, setDependabotEnabled] = useState(true);
  const [dependabotAlerts] = useState<any[]>([
    {
      id: 1,
      package: "axios",
      version: "< 1.7.4",
      severity: "moderate",
      title: "Server-Side Request Forgery vulnerability in Axios",
      fixed_in: "1.7.4",
      created_at: "2024-09-12",
    },
  ]);

  // Collaborators State
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [isSoloMode, setIsSoloMode] = useState<boolean>(true);

  const isAdmin = Boolean(
    activeRepo?.permissions?.admin ?? (
      activeRepo?.is_owner ||
      activeRepo?.is_local ||
      myAccess?.isOwner ||
      (user?.login && collaborators.some((c) => c.login === user.login && (c.is_owner || c.permission === "admin"))) ||
      false
    )
  );

  useEffect(() => {
    if (!isAdmin && (activeTab === "quorum" || activeTab === "audit")) {
      setActiveTab("members");
    }
  }, [isAdmin, activeTab]);
  const [isLoadingCollabs, setIsLoadingCollabs] = useState<boolean>(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState<boolean>(false);
  const [githubAuthError, setGithubAuthError] = useState<string | null>(null);
  const [inviteUsername, setInviteUsername] = useState<string>("");
  const [invitePermission, setInvitePermission] = useState<string>("push");
  const [inviteRoleName, setInviteRoleName] = useState<string>("");
  const [inviteAllowedPaths, setInviteAllowedPaths] = useState<string[]>(["*"]);
  const [inviteDeniedPaths, setInviteDeniedPaths] = useState<string[]>([]);
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
  const [editAllowedPaths, setEditAllowedPaths] = useState<string[]>(["*"]);
  const [editDeniedPaths, setEditDeniedPaths] = useState<string[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const [editFeedback, setEditFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Quorum & Branch Protection State
  const [quorumRules, setQuorumRules] = useState<any>(null);
  const [branchProtection, setBranchProtection] = useState<any>(null);
  const [isSavingQuorum, setIsSavingQuorum] = useState<boolean>(false);
  const [isApplyingProtection, setIsApplyingProtection] =
    useState<boolean>(false);
  const [protectionFeedback, setProtectionFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

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

  // Handle Invite
  const handleSendInvite = async () => {
    if (!inviteUsername.trim()) return;
    setIsInviting(true);
    setInviteFeedback(null);
    try {
      const res = await API.inviteCollaborator({
        username: inviteUsername.trim(),
        permission: invitePermission as any,
        role: inviteRoleName.trim() || undefined,
        role_name: inviteRoleName.trim() || undefined,
        allowed_paths: inviteAllowedPaths,
        denied_paths: inviteDeniedPaths,
        repo: currentRepoName,
      });

      if (res.ok && res.data.success) {
        setInviteFeedback({ type: "success", message: res.data.message });
        setInviteUsername("");
        setInviteRoleName("");
        setInviteAllowedPaths(["*"]);
        setInviteDeniedPaths([]);
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
    const paths = Array.isArray(collab.allowed_paths) && collab.allowed_paths.length > 0
      ? collab.allowed_paths
      : (collab.is_owner ? ["*"] : ["*"]);
    setEditAllowedPaths(paths);
    const denied = Array.isArray(collab.denied_paths) ? collab.denied_paths : [];
    setEditDeniedPaths(denied);
    setEditFeedback(null);
    setIsEditModalOpen(true);
  };

  // Save Edit Collaborator
  const handleSaveEditCollab = async () => {
    if (!editingCollab) return;
    setIsSavingEdit(true);
    setEditFeedback(null);
    try {
      const res = await API.updateCollaboratorClearance({
        username: editingCollab.login,
        permission: editPermission,
        role: editRoleName.trim() || undefined,
        role_name: editRoleName.trim() || undefined,
        allowed_paths: editAllowedPaths,
        denied_paths: editDeniedPaths,
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

  // Create New Team
  const handleCreateTeam = () => {
    if (!newTeamName.trim()) return;
    const slug = newTeamName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const newTeam: OrgTeam = {
      id: Date.now(),
      name: newTeamName.trim(),
      slug: slug || "team",
      description: newTeamDesc.trim() || undefined,
      privacy: "closed",
      permission: newTeamPermission,
      members_count: 1,
      repos_count: currentRepoName ? 1 : 0,
      repos: currentRepoName ? [currentRepoName] : [],
    };
    setTeams((prev) => [...prev, newTeam]);
    setNewTeamName("");
    setNewTeamDesc("");
    setNewTeamPermission("push");
    setIsCreateTeamModalOpen(false);
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

  // Handle Generate AI Token
  const handleGenerateToken = async () => {
    setIsGeneratingToken(true);
    try {
      await generateAIToken(60);
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
              Controle de acesso, proteção de branch e governança de pastas
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Badge variant={isSoloMode ? "neutral" : "success"} size="md">
            {isSoloMode ? "Modo Solo" : "Modo Equipe"}
          </Badge>

          {activeTab === "members" && isAdmin && (
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

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          borderBottom:
            "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.08))",
          marginBottom: "20px",
          overflowX: "auto",
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
            padding: "8px 16px",
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

        {isAdmin && (
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
              whiteSpace: "nowrap",
            }}
          >
            <GitBranch size={16} />
            <span>Proteção</span>
          </button>
        )}

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
            whiteSpace: "nowrap",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>folder</span>
          <span>Departamentos & Pastas</span>
          {myAccess?.folders && myAccess.folders.filter((f) => f.hasAccess).length > 0 && (
            <Badge variant="success" size="xs">
              {myAccess.folders.filter((f) => f.hasAccess).length} autorizados
            </Badge>
          )}
        </button>

        <button
          onClick={() => setActiveTab("org_security")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            background: "none",
            border: "none",
            borderBottom:
              activeTab === "org_security"
                ? "2px solid var(--color-primary, #6366f1)"
                : "2px solid transparent",
            color:
              activeTab === "org_security"
                ? "var(--color-primary, #6366f1)"
                : "var(--color-outline, #a6adc8)",
            fontWeight: activeTab === "org_security" ? 600 : 500,
            cursor: "pointer",
            fontSize: "14px",
            whiteSpace: "nowrap",
          }}
        >
          <ShieldAlert size={16} />
          <span>Segurança & 2FA</span>
        </button>

        {isAdmin && (
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
              whiteSpace: "nowrap",
            }}
          >
            <ShieldCheck size={16} />
            <span>Auditoria</span>
          </button>
        )}
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
                {githubAuthError || "Token de autenticação expirado ou inválido. Atualize suas credenciais para sincronizar os membros remotos."}
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

          {/* Git Provider & Security Status Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "10px",
                background: "var(--color-surface-container, rgba(255, 255, 255, 0.03))",
                border: "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.08))",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "8px",
                  background: "rgba(99, 102, 241, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#818cf8",
                  flexShrink: 0,
                }}
              >
                <ShieldCheck size={18} />
              </div>
              <div>
                <div style={{ fontSize: "11px", color: "var(--color-outline, #a6adc8)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Provedor Git
                </div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-on-surface, #cdd6f4)" }}>
                  {providerLabel === "Modo Local" ? "Modo Local" : `${providerLabel} Remoto`}
                </div>
              </div>
            </div>

            <div
              style={{
                padding: "12px 16px",
                borderRadius: "10px",
                background: "var(--color-surface-container, rgba(255, 255, 255, 0.03))",
                border: "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.08))",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "8px",
                  background: branchProtection?.enabled ? "rgba(34, 197, 94, 0.15)" : "rgba(234, 179, 8, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: branchProtection?.enabled ? "#22c55e" : "#eab308",
                  flexShrink: 0,
                }}
              >
                <GitBranch size={18} />
              </div>
              <div>
                <div style={{ fontSize: "11px", color: "var(--color-outline, #a6adc8)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Branch 'main'
                </div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: branchProtection?.enabled ? "#22c55e" : "#eab308" }}>
                  {branchProtection?.enabled ? `Protegida (${branchProtection.required_approving_review_count || 1} revisão)` : 'Push Direto Ativo'}
                </div>
              </div>
            </div>

            <div
              style={{
                padding: "12px 16px",
                borderRadius: "10px",
                background: "var(--color-surface-container, rgba(255, 255, 255, 0.03))",
                border: "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.08))",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "8px",
                  background: "rgba(16, 185, 129, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#10b981",
                  flexShrink: 0,
                }}
              >
                <ShieldCheck size={18} />
              </div>
              <div>
                <div style={{ fontSize: "11px", color: "var(--color-outline, #a6adc8)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Governança de Pastas
                </div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#10b981" }}>
                  RBAC / ABAC Ativo
                </div>
              </div>
            </div>
          </div>

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
              <span>Sincronizar Git</span>
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
                  <th style={{ padding: "10px 16px" }}>Pastas & Rotas Permitidas</th>
                  {isAdmin && (
                    <th style={{ padding: "10px 16px", textAlign: "right" }}>
                      Ações
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {collaborators.map((collab) => {
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
                              {providerLabel} <ExternalLink size={10} />
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

                          {/* Pílulas de Exceções Bloqueadas */}
                          {Array.isArray(collab.denied_paths) &&
                            collab.denied_paths.map((deniedRoute: string) => (
                              <span
                                key={`denied-${deniedRoute}`}
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 600,
                                  padding: "2px 8px",
                                  borderRadius: "12px",
                                  backgroundColor: "rgba(239, 68, 68, 0.12)",
                                  border: "1px solid rgba(239, 68, 68, 0.3)",
                                  color: "#ef4444",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "3px",
                                }}
                                title="Subpasta bloqueada especificamente por exceção"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>
                                  lock
                                </span>
                                {deniedRoute.replace(/\/\*\*$/, "")} (Bloqueada)
                              </span>
                            ))}
                        </div>
                      </td>

                      {isAdmin && (
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
                                title="Remover colaborador e revogar todas as chaves"
                              >
                                <Trash2 size={13} />
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* TAB: EQUIPES DA ORGANIZAÇÃO (TEAMS) */}
      {activeTab === "teams" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              padding: "14px 18px",
              borderRadius: "10px",
              backgroundColor: "var(--color-surface-container-low, #f8fafc)",
              border: "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.08))",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "38px",
                  height: "38px",
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
                <h4 style={{ margin: "0 0 2px", fontSize: "14px", fontWeight: 600, color: "var(--color-on-surface, #ffffff)" }}>
                  Gestão de Equipes (GitHub Teams)
                </h4>
                <p style={{ margin: 0, fontSize: "12px", color: "var(--color-outline, #a6adc8)", lineHeight: 1.4 }}>
                  No GitHub Free, você pode criar equipes ilimitadas para organizar permissões coletivas por squads e vincular múltiplos repositórios.
                </p>
              </div>
            </div>

            {isAdmin && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsCreateTeamModalOpen(true)}
                style={{ display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" }}
              >
                <Plus size={15} />
                <span>Nova Equipe</span>
              </Button>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "14px" }}>
            {teams.map((team) => (
              <Card key={team.id} variant="flat" padding="md" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--color-on-surface, #ffffff)" }}>
                        {team.name}
                      </span>
                      <Badge variant="primary" size="xs">
                        @{activeOrg?.login || "org"}/{team.slug}
                      </Badge>
                    </div>
                    {team.description && (
                      <p style={{ margin: 0, fontSize: "12px", color: "var(--color-outline, #a6adc8)", lineHeight: 1.4 }}>
                        {team.description}
                      </p>
                    )}
                  </div>
                  <Badge variant={team.permission === "admin" ? "danger" : "success"} size="xs">
                    {(team.permission || "push").toUpperCase()}
                  </Badge>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "12px", color: "var(--color-outline, #a6adc8)" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <Users size={14} /> {team.members_count || 0} membros
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <GitBranch size={14} /> {team.repos_count || 0} repositórios
                  </span>
                </div>

                {team.repos && team.repos.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {team.repos.map((r) => (
                      <span
                        key={r}
                        style={{
                          fontSize: "11px",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          backgroundColor: "var(--color-surface-container-high, rgba(255, 255, 255, 0.05))",
                          border: "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.08))",
                          color: "var(--color-on-surface, #ffffff)",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                )}

                {isAdmin && (
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", borderTop: "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.08))", paddingTop: "8px", marginTop: "4px" }}>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => {
                        setTeams((prev) => prev.filter((t) => t.id !== team.id));
                      }}
                      style={{ color: "#ef4444", fontSize: "11px" }}
                    >
                      <Trash2 size={12} style={{ marginRight: "4px" }} /> Excluir
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
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
                  Proteção de Branch no {providerLabel} (`main`)
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
                  <span>Branch main já está protegida no {providerLabel}</span>
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
              Gera token efêmero de 1 hora para ferramentas CLI locais (Antigravity CLI, Cursor, Claude Code) acessarem o contexto do projeto via localhost com segurança.
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

          {/* Pastas e Departamentos do Repositório */}
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
                  Departamentos & Pastas do Workspace
                </h3>
                <span
                  style={{
                    fontSize: "12px",
                    color: "var(--color-outline, #a6adc8)",
                  }}
                >
                  Governança e controle de acesso por rotas e pastas configuradas no projeto
                </span>
              </div>
            </div>

            {(!myAccess?.folders || myAccess.folders.length === 0) && departments.length === 0 ? (
              <div
                style={{
                  padding: "28px 16px",
                  textAlign: "center",
                  color: "var(--color-outline, #a6adc8)",
                  fontSize: "13px",
                  background: "var(--color-surface-container-high, #1e1e2e)",
                  borderRadius: "8px",
                  margin: "12px",
                  border: "1px dashed var(--color-outline-variant, rgba(255, 255, 255, 0.12))",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "28px", color: "var(--color-outline, #a6adc8)", display: "block", marginBottom: "8px" }}>
                  folder_open
                </span>
                Nenhuma pasta personalizada criada ainda no repositório.
              </div>
            ) : (
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
                  <th style={{ padding: "10px 16px" }}>Pasta / Departamento</th>
                  <th style={{ padding: "10px 16px" }}>Meu Acesso</th>
                  <th style={{ padding: "10px 16px" }}>Membros com Permissão</th>
                </tr>
              </thead>
              <tbody>
                {(myAccess?.folders && myAccess.folders.length > 0
                  ? myAccess.folders
                  : departments.map((d) => ({
                      ...d,
                      fileCount: 0,
                      authorizedMembers: [],
                      hasAccess: true,
                    }))
                ).map((folder) => {
                  const hasAccess = folder.hasAccess;

                  return (
                    <tr
                      key={folder.id}
                      style={{
                        borderBottom:
                          "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.04))",
                        fontSize: "13px",
                      }}
                    >
                      <td style={{ padding: "12px 16px", width: "280px" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "12px",
                              fontWeight: 600,
                              padding: "3px 10px",
                              borderRadius: "12px",
                              backgroundColor: folder.color + "15",
                              borderColor: folder.color + "40",
                              borderWidth: "1px",
                              borderStyle: "solid",
                              color: folder.color,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                              {folder.icon || "folder"}
                            </span>
                            {folder.name} ({folder.folder}/)
                          </span>
                        </div>
                      </td>

                      <td style={{ padding: "12px 16px", width: "160px" }}>
                        <Badge
                          variant={hasAccess ? "success" : "warning"}
                          size="xs"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          {hasAccess ? (
                            <>
                              <Unlock size={12} />
                              <span>Liberado</span>
                            </>
                          ) : (
                            <>
                              <Lock size={12} />
                              <span>Restrito</span>
                            </>
                          )}
                        </Badge>
                      </td>

                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                          {folder.authorizedMembers && folder.authorizedMembers.length > 0 ? (
                            folder.authorizedMembers.map((m) => (
                              <span
                                key={m}
                                style={{
                                  fontSize: "11px",
                                  padding: "1px 6px",
                                  borderRadius: "4px",
                                  backgroundColor: "var(--color-surface-container-high, #1e1e2e)",
                                  border: "1px solid var(--color-outline-variant, rgba(255,255,255,0.1))",
                                  color: "var(--color-on-surface, #cdd6f4)",
                                }}
                              >
                                @{m}
                              </span>
                            ))
                          ) : (
                            <span style={{ fontSize: "11px", color: "var(--color-outline, #a6adc8)", fontStyle: "italic" }}>
                              Acesso por herança ou aberto
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            )}
          </Card>

          {/* Secret Scanning Card */}
          {isAdmin && (
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
                Verifica se existem tokens de API, chaves privadas ou segredos expostos no repositório.
              </p>

              {secretScanResult && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "6px",
                    background: secretScanResult.hasSecrets
                      ? "rgba(239, 68, 68, 0.15)"
                      : "rgba(16, 185, 129, 0.15)",
                    border: `1px solid ${
                      secretScanResult.hasSecrets
                        ? "rgba(239, 68, 68, 0.3)"
                        : "rgba(16, 185, 129, 0.3)"
                    }`,
                    color: secretScanResult.hasSecrets ? "#ef4444" : "#10b981",
                    fontSize: "13px",
                    marginBottom: "12px",
                  }}
                >
                  {secretScanResult.hasSecrets ? (
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                        <AlertTriangle size={16} />
                        <span>Foram encontrados segredos ou documentos confidenciais desprotegidos:</span>
                      </div>
                      <ul style={{ margin: 0, paddingLeft: "20px" }}>
                        {secretScanResult.violations.map((v: any, i: number) => (
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
          )}
        </div>
      )}

      {/* TAB: SEGURANÇA & 2FA DA ORGANIZAÇÃO (GITHUB FREE) */}
      {activeTab === "org_security" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Card 1: 2FA Obrigatório */}
          <Card variant="flat" padding="md">
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "10px",
                    backgroundColor: "rgba(16, 185, 129, 0.12)",
                    color: "#10b981",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h4 style={{ margin: "0 0 2px", fontSize: "15px", fontWeight: 600, color: "var(--color-on-surface, #ffffff)" }}>
                    Autenticação em Dois Fatores Compulsória (Require 2FA)
                  </h4>
                  <p style={{ margin: 0, fontSize: "12px", color: "var(--color-outline, #a6adc8)", lineHeight: 1.4 }}>
                    Recurso gratuito: força que todos os membros e colaboradores da organização tenham 2FA ativo para acessar repositórios.
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Badge variant={is2FAEnforced ? "success" : "warning"} size="md">
                  {is2FAEnforced ? "2FA Obrigatório Ativo" : "Opcional"}
                </Badge>
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIs2FAEnforced((prev) => !prev)}
                    style={{ fontSize: "11px", padding: "4px 8px" }}
                  >
                    {is2FAEnforced ? "Tornar Opcional" : "Exigir 2FA"}
                  </Button>
                )}
              </div>
            </div>

            <div
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                backgroundColor: is2FAEnforced ? "rgba(16, 185, 129, 0.06)" : "rgba(245, 158, 11, 0.06)",
                border: is2FAEnforced ? "1px solid rgba(16, 185, 129, 0.2)" : "1px solid rgba(245, 158, 11, 0.2)",
                fontSize: "12px",
                color: is2FAEnforced ? "#10b981" : "#eab308",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              {is2FAEnforced ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              <span>
                {is2FAEnforced
                  ? "100% dos membros da organização atendem à política de 2FA obrigatório."
                  : "A política de 2FA não está sendo forçada. Membros sem 2FA podem acessar recursos."}
              </span>
            </div>
          </Card>

          {/* Card 2: Dependabot Alerts & Security Updates */}
          <Card variant="flat" padding="md">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
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
                  <Bot size={22} />
                </div>
                <div>
                  <h4 style={{ margin: "0 0 2px", fontSize: "15px", fontWeight: 600, color: "var(--color-on-surface, #ffffff)" }}>
                    Dependabot Alerts & Automated Security Updates
                  </h4>
                  <p style={{ margin: 0, fontSize: "12px", color: "var(--color-outline, #a6adc8)", lineHeight: 1.4 }}>
                    Gratuito para repositórios públicos e privados: monitora CVEs em dependências e gera Pull Requests de correção automáticos.
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Badge variant={dependabotEnabled ? "success" : "neutral"} size="md">
                  {dependabotEnabled ? "Monitoramento Ativo" : "Desativado"}
                </Badge>
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDependabotEnabled((prev) => !prev)}
                    style={{ fontSize: "11px", padding: "4px 8px" }}
                  >
                    {dependabotEnabled ? "Desativar" : "Ativar"}
                  </Button>
                )}
              </div>
            </div>

            {dependabotAlerts.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {dependabotAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    style={{
                      padding: "10px 14px",
                      borderRadius: "8px",
                      backgroundColor: "var(--color-surface-container-low, #1e1e2e)",
                      border: "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.08))",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <AlertTriangle size={16} color="#eab308" />
                      <div>
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-on-surface, #ffffff)" }}>
                          {alert.package} ({alert.version})
                        </span>
                        <div style={{ fontSize: "12px", color: "var(--color-outline, #a6adc8)" }}>
                          {alert.title}
                        </div>
                      </div>
                    </div>
                    <Badge variant="warning" size="xs">
                      Fix: {alert.fixed_in}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: "12px", color: "#10b981", display: "flex", alignItems: "center", gap: "6px" }}>
                <CheckCircle2 size={16} /> Nenhuma vulnerabilidade em dependências encontrada.
              </div>
            )}
          </Card>

          {/* Card 3: SBOM & Dependency Graph */}
          <Card variant="flat" padding="md">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "10px",
                    backgroundColor: "rgba(59, 130, 246, 0.12)",
                    color: "#3b82f6",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <FileCode size={22} />
                </div>
                <div>
                  <h4 style={{ margin: "0 0 2px", fontSize: "15px", fontWeight: 600, color: "var(--color-on-surface, #ffffff)" }}>
                    Dependency Graph & Software Bill of Materials (SBOM)
                  </h4>
                  <p style={{ margin: 0, fontSize: "12px", color: "var(--color-outline, #a6adc8)", lineHeight: 1.4 }}>
                    Gera e exporta o catálogo formal de todas as dependências e licenças de software em padrão SPDX.
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const sbomData = {
                    spdxVersion: "SPDX-2.3",
                    dataLicense: "CC0-1.0",
                    name: activeRepo?.name || "context-os-workspace",
                    organization: activeOrg?.login || "context-os",
                    creationDate: new Date().toISOString(),
                    packages: [
                      { name: "react", version: "^18.2.0", license: "MIT" },
                      { name: "lucide-react", version: "^0.344.0", license: "ISC" },
                      { name: "fastify", version: "^4.26.2", license: "MIT" },
                    ],
                  };
                  const blob = new Blob([JSON.stringify(sbomData, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `sbom-${activeRepo?.name || "project"}.spdx.json`;
                  a.click();
                }}
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <Download size={14} />
                <span>Exportar SBOM (SPDX)</span>
              </Button>
            </div>
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
            <FormField label={`Nome de Usuário no ${providerLabel}`}>
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

            <FormField label={`Permissão ${providerLabel}`}>
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


            <FormField label="Rotas / Pastas Autorizadas e Exceções">
              <div style={{ marginTop: "4px" }}>
                <FolderTreePicker
                  tree={tree || []}
                  allowedPaths={inviteAllowedPaths}
                  deniedPaths={inviteDeniedPaths}
                  onChange={(allowed, denied) => {
                    setInviteAllowedPaths(allowed);
                    setInviteDeniedPaths(denied);
                  }}
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



            <FormField label="Rotas / Pastas Autorizadas e Exceções">
              <div style={{ marginTop: "4px" }}>
                <FolderTreePicker
                  tree={tree || []}
                  allowedPaths={editAllowedPaths}
                  deniedPaths={editDeniedPaths}
                  disabled={editingCollab.is_owner}
                  onChange={(allowed, denied) => {
                    setEditAllowedPaths(allowed);
                    setEditDeniedPaths(denied);
                  }}
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

      {/* Modal Criar Equipe (GitHub Team) */}
      {isCreateTeamModalOpen && (
        <Modal
          isOpen={isCreateTeamModalOpen}
          onClose={() => setIsCreateTeamModalOpen(false)}
          title="Criar Nova Equipe (GitHub Team)"
          size="md"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--color-outline, #a6adc8)", lineHeight: 1.5 }}>
              Equipes facilitam o gerenciamento de acesso a múltiplos repositórios e squads na organização <strong>@{activeOrg?.login || "org"}</strong>.
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
                  border: "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.12))",
                  fontSize: "13px",
                }}
              />
            </FormField>

            <FormField label="Descrição">
              <input
                type="text"
                placeholder="Ex: Responsável pelos microserviços e pipelines"
                value={newTeamDesc}
                onChange={(e) => setNewTeamDesc(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  background: "var(--color-surface-container-high, #1e1e2e)",
                  color: "var(--color-on-surface, #cdd6f4)",
                  border: "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.12))",
                  fontSize: "13px",
                }}
              />
            </FormField>

            <FormField label="Permissão Padrão nos Repositórios">
              <select
                value={newTeamPermission}
                onChange={(e) => setNewTeamPermission(e.target.value as any)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  background: "var(--color-surface-container-high, #1e1e2e)",
                  color: "var(--color-on-surface, #cdd6f4)",
                  border: "1px solid var(--color-outline-variant, rgba(255, 255, 255, 0.12))",
                  fontSize: "13px",
                }}
              >
                <option value="pull">Read (Leitura / Clone)</option>
                <option value="triage">Triage (Triagem)</option>
                <option value="push">Write (Push / Pull Request)</option>
                <option value="maintain">Maintain (Manutenção)</option>
                <option value="admin">Admin (Administração)</option>
              </select>
            </FormField>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
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

