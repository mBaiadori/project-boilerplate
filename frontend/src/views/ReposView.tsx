import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Repo, RepoDiagnosis } from "../types";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { API } from "../services/api";
import { LanguageSwitcher } from "../components/common/LanguageSwitcher";
import { AccountSwitcherMenu } from "../components/auth/AccountSwitcherMenu";
import {
  Button,
  SearchInput,
  Badge,
  EmptyState,
  Spinner,
} from "../components/ui";
import {
  Plus,
  LogOut,
  FolderGit2,
  Lock,
  Globe,
  GitBranch,
  Building2,
  ArrowRight,
  Sparkles,
  Trash2,
  Unlink,
  User,
  Users,
  HardDrive,
  Edit3,
  Copy,
  Shield,
} from "lucide-react";
import { FirstRunWizard } from "../components/onboarding/FirstRunWizard";
import { DeleteRepoModal } from "../components/modals/DeleteRepoModal";
import { EditRepoModal } from "../components/modals/EditRepoModal";
import { CloneRepoModal } from "../components/modals/CloneRepoModal";
import { RepoSetupWizardModal } from "../components/modals/RepoSetupWizardModal";
import { CreateRepoModal } from "../components/modals/CreateRepoModal";
import { OrgGovernanceModal } from "../components/modals/OrgGovernanceModal";
import { RepoGovernanceModal } from "../components/modals/RepoGovernanceModal";

interface ReposViewProps {
  onSelectRepo?: (repo: Repo) => void;
}

export const ReposView: React.FC<ReposViewProps> = ({ onSelectRepo }) => {
  const { t } = useTranslation(["repos", "common"]);
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { repos, loadRepos, selectRepo, selectOrg, isLoading, orgs: contextOrgs } = useWorkspace();
  const [searchTerm, setSearchTerm] = useState("");
  const [openingRepoName, setOpeningRepoName] = useState<string | null>(null);
  const [enteringOrgLogin, setEnteringOrgLogin] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [repoToDelete, setRepoToDelete] = useState<Repo | null>(null);
  const [modalMode, setModalMode] = useState<"delete" | "unlink">("delete");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Edit & Clone Repo Modals State
  const [repoToEdit, setRepoToEdit] = useState<Repo | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [repoToClone, setRepoToClone] = useState<Repo | null>(null);
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);

  // Repo Setup Wizard State
  const [wizardRepo, setWizardRepo] = useState<Repo | null>(null);
  const [wizardDiagnosis, setWizardDiagnosis] = useState<RepoDiagnosis | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  // Create Repo Modal State
  const [isCreateRepoModalOpen, setIsCreateRepoModalOpen] = useState(false);

  // Governance Modals State
  const [orgGovernanceTarget, setOrgGovernanceTarget] = useState<string | null>(null);
  const [repoGovernanceTarget, setRepoGovernanceTarget] = useState<{ orgLogin: string; repoName: string } | null>(null);

  // Check if onboarding is needed
  useEffect(() => {
    API.getOnboardingStatus()
      .then((status) => {
        if (status?.needed) {
          setShowOnboarding(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleOpenRepo = async (repo: Repo) => {
    if (openingRepoName) return;
    setOpeningRepoName(repo.name);
    try {
      if (onSelectRepo) {
        onSelectRepo(repo);
      }
      const res = await selectRepo(repo);
      if (res?.is_ready === false) {
        setWizardRepo(repo);
        setWizardDiagnosis(res.diagnosis || null);
        setIsWizardOpen(true);
      } else {
        const owner = repo.owner || (repo.full_name ? repo.full_name.split("/")[0] : "");
        const isOrg = owner && owner !== "local" && !repo.is_local && owner.toLowerCase() !== (user?.login || "").toLowerCase();
        if (isOrg) {
          navigate(`/org/${encodeURIComponent(owner)}/repo/${encodeURIComponent(repo.name)}/editor`);
        } else {
          navigate(`/repo/${encodeURIComponent(repo.name)}/editor`);
        }
      }
    } catch (err) {
      console.error("[ReposView] Erro ao abrir repositório:", err);
    } finally {
      setOpeningRepoName(null);
    }
  };

  const handleWizardComplete = async (activeRepo: Repo) => {
    setIsWizardOpen(false);
    setWizardRepo(null);
    setWizardDiagnosis(null);
    await loadRepos();
    const owner = activeRepo.owner || (activeRepo.full_name ? activeRepo.full_name.split("/")[0] : "");
    const isOrg = owner && owner !== "local" && !activeRepo.is_local && owner.toLowerCase() !== (user?.login || "").toLowerCase();
    if (isOrg) {
      navigate(`/org/${encodeURIComponent(owner)}/repo/${encodeURIComponent(activeRepo.name)}/editor`);
    } else {
      navigate(`/repo/${encodeURIComponent(activeRepo.name)}/editor`);
    }
  };

  // Get list of unique organizations/owners with metadata
  const orgsList = useMemo(() => {
    const map = new Map<
      string,
      { login: string; full_name?: string; avatar_url?: string; description?: string }
    >();

    for (const o of contextOrgs || []) {
      if (o.login && o.login.toLowerCase() !== (user?.login || "").toLowerCase()) {
        map.set(o.login.toLowerCase(), {
          login: o.login,
          full_name: o.full_name || o.login,
          avatar_url: o.avatar_url,
          description: o.description,
        });
      }
    }

    for (const r of repos) {
      const owner = r.owner || (r.full_name ? r.full_name.split("/")[0] : "");
      if (owner && owner.toLowerCase() !== (user?.login || "").toLowerCase() && owner !== "local") {
        if (!map.has(owner.toLowerCase())) {
          map.set(owner.toLowerCase(), {
            login: owner,
            full_name: owner,
          });
        }
      }
    }
    return Array.from(map.values());
  }, [contextOrgs, repos, user?.login]);

  const orgs = useMemo(() => orgsList.map((o) => o.login), [orgsList]);

  // Ação de entrar diretamente na organização
  const handleEnterOrg = async (org: { login: string; full_name?: string }) => {
    if (enteringOrgLogin) return;
    setEnteringOrgLogin(org.login);
    try {
      if (selectOrg) {
        await selectOrg(org.login);
      }
      // Encontra o repositório pertencente a essa organização
      const orgRepos = repos.filter(
        (r) => (r.owner || (r.full_name ? r.full_name.split("/")[0] : "")).toLowerCase() === org.login.toLowerCase()
      );
      if (orgRepos.length > 0) {
        await handleOpenRepo(orgRepos[0]);
      } else {
        // Se a organização ainda não tiver repositório criado/clonado, abre modal de criação de repositório já com a org selecionada
        setIsCreateRepoModalOpen(true);
      }
    } catch (err) {
      console.error("[ReposView] Erro ao entrar na organização:", err);
    } finally {
      setEnteringOrgLogin(null);
    }
  };



  // Sempre lista todos os repositórios abaixo (filtrados apenas pelo termo de busca digitado)
  const filteredRepos = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return repos;

    return repos.filter((r) => {
      const owner = (
        r.owner || (r.full_name ? r.full_name.split("/")[0] : "")
      ).toLowerCase();
      const name = (r.name || "").toLowerCase();
      const desc = (r.description || "").toLowerCase();
      const full = (r.full_name || "").toLowerCase();

      return (
        name.includes(q) ||
        desc.includes(q) ||
        full.includes(q) ||
        owner.includes(q)
      );
    });
  }, [repos, searchTerm]);

  return (
    <div
      id="view-repos"
      className="screen-view"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
      }}
    >
      <div
        className="repos-wrapper"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        {/* Navbar Topo */}
        <header className="repos-navbar">
          <AccountSwitcherMenu />

          <div className="nav-actions" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <LanguageSwitcher variant="subtle" />
            <Button
              id="btn-open-onboarding"
              variant="subtle"
              size="sm"
              leftIcon={<Sparkles size={15} />}
              onClick={() => setShowOnboarding(true)}
            >
              {t("repos:navOnboarding")}
            </Button>
            <Button
              id="btn-logout"
              variant="ghost"
              size="sm"
              leftIcon={<LogOut size={15} />}
              onClick={logout}
            >
              {t("repos:navLogout")}
            </Button>
          </div>
        </header>

        {/* Conteúdo Principal */}
        <main
          className="repos-content"
          style={{
            flex: 1,
            padding: "24px 32px",
            maxWidth: "1100px",
            margin: "0 auto",
            width: "100%",
          }}
        >
          {/* Seção de Organizações (Cards em cima) */}
          {orgsList.length > 0 && (
            <section className="orgs-section">
              <div className="orgs-section-header">
                <div className="orgs-section-title">
                  <Building2 size={18} style={{ color: "var(--primary)" }} />
                  <h3>{t("repos:orgsSectionTitle", "Organizações")}</h3>
                </div>
              </div>

              <div className="orgs-cards-grid">
                {orgsList.map((org) => {
                  const isEntering = enteringOrgLogin === org.login;

                  return (
                    <div
                      key={org.login}
                      className="org-card"
                      role="button"
                      tabIndex={0}
                      title={`Abrir repositório da organização @${org.login}`}
                      onClick={() => handleEnterOrg(org)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleEnterOrg(org);
                        }
                      }}
                    >
                      {org.avatar_url ? (
                        <img src={org.avatar_url} alt={org.login} className="org-card-avatar" />
                      ) : (
                        <div className="org-card-icon-wrap">
                          <Building2 size={20} />
                        </div>
                      )}
                      <div className="org-card-info">
                        <span className="org-card-title">{org.full_name || org.login}</span>
                        <span className="org-card-subtitle">@{org.login}</span>
                      </div>

                      {isEntering && (
                        <div style={{ display: "flex", alignItems: "center", color: "var(--primary)", paddingRight: "4px" }}>
                          <span className="material-symbols-outlined spinning" style={{ fontSize: "16px" }}>
                            progress_activity
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Seção de Repositórios (Abaixo) */}
          <section className="repos-section">
            <div className="repos-section-header" style={{ marginBottom: 20 }}>
              <div className="section-title" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h2 style={{ fontSize: "18px", fontWeight: 600, margin: 0 }}>{t("repos:sectionTitle")}</h2>
                  <Badge id="repos-count-badge" variant="primary">
                    {t("repos:reposCount", { count: filteredRepos.length })}
                  </Badge>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 280 }}>
                    <SearchInput
                      id="repos-search-input"
                      placeholder={t("repos:searchPlaceholder")}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onClear={() => setSearchTerm("")}
                    />
                  </div>

                  <Button
                    id="btn-open-create-repo"
                    variant="primary"
                    size="sm"
                    leftIcon={<Plus size={15} />}
                    onClick={() => setIsCreateRepoModalOpen(true)}
                  >
                    {t("repos:navNewRepo")}
                  </Button>
                </div>
              </div>
            </div>

            {/* Grade de Repositórios */}
            <div
              id="repos-list-grid"
              className="repos-grid"
            >
              {isLoading ? (
                <div
                  style={{
                    gridColumn: "1 / -1",
                    padding: 40,
                    textAlign: "center",
                  }}
                >
                  <Spinner size="lg" message={t("repos:loadingRepos")} />
                </div>
              ) : filteredRepos.length === 0 ? (
                <div style={{ gridColumn: "1 / -1" }}>
                  <EmptyState
                    icon={<FolderGit2 size={44} strokeWidth={1.4} />}
                    title={t("repos:emptyTitle")}
                    description={t("repos:emptyDescription")}
                    action={
                      <Button
                        variant="primary"
                        size="sm"
                        leftIcon={<Plus size={15} />}
                        onClick={() => setIsCreateRepoModalOpen(true)}
                      >
                        {t("repos:emptyAction")}
                      </Button>
                    }
                  />
                </div>
              ) : (
                filteredRepos.map((repo) => {
                  const owner =
                    repo.owner ||
                    (repo.full_name ? repo.full_name.split("/")[0] : "");
                  const isOrg =
                    owner &&
                    user?.login &&
                    owner.toLowerCase() !== user.login.toLowerCase();
                  const isOwner = repo.is_owner ?? (!isOrg && !repo.is_local);
                  const isLinked = Boolean(repo.is_cloned_locally || repo.is_local);
                  const isOpening = openingRepoName === repo.name;
                  const isAnyOpening = Boolean(openingRepoName);

                  return (
                    <div
                      key={repo.id || repo.name}
                      className={`repo-card ${isOpening ? "is-opening" : ""} ${isAnyOpening && !isOpening ? "is-disabled" : ""}`}
                      role="button"
                      tabIndex={isAnyOpening ? -1 : 0}
                      aria-busy={isOpening}
                      aria-disabled={isAnyOpening && !isOpening}
                      title={
                        isOpening
                          ? t("repos:cardLoadingTooltip", { name: repo.name })
                          : t("repos:cardOpenTooltip", { name: repo.full_name || repo.name })
                      }
                      onClick={() => !isAnyOpening && handleOpenRepo(repo)}
                      onKeyDown={(e) => {
                        if (
                          (e.key === "Enter" || e.key === " ") &&
                          !isAnyOpening
                        ) {
                          e.preventDefault();
                          handleOpenRepo(repo);
                        }
                      }}
                    >
                      <div className="repo-card-main">
                        <div className="repo-top">
                          <div className="repo-header-info">
                            <div className="repo-icon-wrap" aria-hidden="true">
                              <FolderGit2 size={20} />
                            </div>
                            <div className="repo-titles-group">
                              {isOrg && (
                                <span className="repo-owner-tag">
                                  <Building2
                                    size={13}
                                    style={{ marginRight: 3 }}
                                  />
                                  @{owner}
                                </span>
                              )}
                              <span
                                className="repo-title"
                                title={repo.full_name || repo.name}
                              >
                                {repo.name}
                              </span>
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {isLinked ? (
                              <Badge
                                variant="success"
                                size="sm"
                                icon={<HardDrive size={11} style={{ marginRight: 3 }} />}
                              >
                                {t("repos:badgeLinked")}
                              </Badge>
                            ) : (
                              <Badge
                                variant="neutral"
                                size="sm"
                                icon={<Globe size={11} style={{ marginRight: 3 }} />}
                              >
                                {t("repos:badgeUnlinked")}
                              </Badge>
                            )}

                            {repo.is_local ? (
                              <Badge
                                variant="neutral"
                                size="sm"
                                icon={<HardDrive size={11} style={{ marginRight: 3 }} />}
                              >
                                {t("repos:badgeLocal")}
                              </Badge>
                            ) : isOwner ? (
                              <Badge
                                variant="primary"
                                size="sm"
                                icon={<User size={11} style={{ marginRight: 3 }} />}
                              >
                                {t("repos:badgeOwner")}
                              </Badge>
                            ) : isOrg ? (
                              <Badge
                                variant="neutral"
                                size="sm"
                                icon={<Building2 size={11} style={{ marginRight: 3 }} />}
                              >
                                {t("repos:badgeOrg")}
                              </Badge>
                            ) : (
                              <Badge
                                variant="warning"
                                size="sm"
                                icon={<Users size={11} style={{ marginRight: 3 }} />}
                              >
                                {t("repos:badgeCollaborator")}
                              </Badge>
                            )}

                            <Badge
                              variant={repo.is_private ? "warning" : "success"}
                              size="sm"
                              icon={
                                repo.is_private ? (
                                  <Lock size={11} style={{ marginRight: 3 }} />
                                ) : (
                                  <Globe size={11} style={{ marginRight: 3 }} />
                                )
                              }
                            >
                              {repo.is_private ? t("repos:badgePrivate") : t("repos:badgePublic")}
                            </Badge>
                          </div>
                        </div>

                        <p
                          className={`repo-desc ${repo.description ? "" : "empty"}`}
                          title={repo.description || ""}
                        >
                          {repo.description || t("repos:cardDefaultDesc")}
                        </p>
                      </div>

                      <div className="repo-footer">
                        <div className="repo-footer-left">
                          <Badge
                            variant="neutral"
                            size="sm"
                            icon={
                              <GitBranch size={11} style={{ marginRight: 3 }} />
                            }
                          >
                            {repo.default_branch || "main"}
                          </Badge>
                        </div>

                        <div className="repo-footer-right" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {(repo.permissions?.admin || isOwner || repo.is_local) && (
                            <>
                              <button
                                type="button"
                                className="btn-edit-repo-card"
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  cursor: "pointer",
                                  padding: "5px 6px",
                                  borderRadius: "6px",
                                  color: "var(--text-muted)",
                                  display: "flex",
                                  alignItems: "center",
                                  transition: "color 0.15s ease, background 0.15s ease",
                                }}
                                title={t("repos:actionEditTooltip")}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRepoToEdit(repo);
                                  setIsEditModalOpen(true);
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = "var(--primary)";
                                  e.currentTarget.style.backgroundColor = "rgba(26, 115, 232, 0.08)";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = "var(--text-muted)";
                                  e.currentTarget.style.backgroundColor = "transparent";
                                }}
                              >
                                <Edit3 size={14} />
                              </button>

                              <button
                                type="button"
                                className="btn-gov-repo-card"
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  cursor: "pointer",
                                  padding: "5px 6px",
                                  borderRadius: "6px",
                                  color: "var(--text-muted)",
                                  display: "flex",
                                  alignItems: "center",
                                  transition: "color 0.15s ease, background 0.15s ease",
                                }}
                                title="Governança, Times e Acessos do Repositório"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const orgLogin = owner || "local";
                                  setRepoGovernanceTarget({ orgLogin, repoName: repo.name });
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = "#4f46e5";
                                  e.currentTarget.style.backgroundColor = "rgba(99, 102, 241, 0.08)";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = "var(--text-muted)";
                                  e.currentTarget.style.backgroundColor = "transparent";
                                }}
                              >
                                <Shield size={14} />
                              </button>

                              <button
                                type="button"
                                className="btn-clone-repo-card"
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  cursor: "pointer",
                                  padding: "5px 6px",
                                  borderRadius: "6px",
                                  color: "var(--text-muted)",
                                  display: "flex",
                                  alignItems: "center",
                                  transition: "color 0.15s ease, background 0.15s ease",
                                }}
                                title={t("repos:actionCloneTooltip")}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRepoToClone(repo);
                                  setIsCloneModalOpen(true);
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = "var(--primary)";
                                  e.currentTarget.style.backgroundColor = "rgba(26, 115, 232, 0.08)";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = "var(--text-muted)";
                                  e.currentTarget.style.backgroundColor = "transparent";
                                }}
                              >
                                <Copy size={14} />
                              </button>
                            </>
                          )}

                          {isLinked && !repo.is_local && (
                            <button
                              type="button"
                              className="btn-unlink-repo-card"
                              style={{
                                background: "transparent",
                                border: "none",
                                cursor: "pointer",
                                padding: "5px 6px",
                                borderRadius: "6px",
                                color: "var(--text-muted)",
                                display: "flex",
                                alignItems: "center",
                                transition: "color 0.15s ease, background 0.15s ease",
                              }}
                              title={t("repos:actionUnlinkTooltip")}
                              onClick={(e) => {
                                e.stopPropagation();
                                setModalMode("unlink");
                                setRepoToDelete(repo);
                                setIsDeleteModalOpen(true);
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = "var(--primary)";
                                e.currentTarget.style.backgroundColor = "rgba(26, 115, 232, 0.08)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = "var(--text-muted)";
                                e.currentTarget.style.backgroundColor = "transparent";
                              }}
                            >
                              <Unlink size={14} />
                            </button>
                          )}

                          {(repo.permissions?.admin || isOwner || repo.is_local) && (
                            <button
                              type="button"
                              className="btn-delete-repo-card"
                              style={{
                                background: "transparent",
                                border: "none",
                                cursor: "pointer",
                                padding: "5px 6px",
                                borderRadius: "6px",
                                color: "var(--text-muted)",
                                display: "flex",
                                alignItems: "center",
                                transition: "color 0.15s ease, background 0.15s ease",
                              }}
                              title={repo.is_local ? t("repos:actionDeleteLocalTooltip") : t("repos:actionDeleteRemoteTooltip")}
                              onClick={(e) => {
                                e.stopPropagation();
                                setModalMode("delete");
                                setRepoToDelete(repo);
                                setIsDeleteModalOpen(true);
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = "#ef4444";
                                e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.08)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = "var(--text-muted)";
                                e.currentTarget.style.backgroundColor = "transparent";
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}

                          {isOpening ? (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 5,
                                color: "var(--primary)",
                                fontSize: "12px",
                                fontWeight: 500,
                              }}
                            >
                              <span
                                className="material-symbols-outlined spinning"
                                style={{ fontSize: "15px" }}
                              >
                                progress_activity
                              </span>
                              <span>{t("repos:cardOpening")}</span>
                            </div>
                          ) : (
                            <ArrowRight
                              size={16}
                              style={{ color: "var(--text-muted)" }}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </main>
      </div>

      <DeleteRepoModal
        isOpen={isDeleteModalOpen}
        repo={repoToDelete}
        initialMode={modalMode}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setRepoToDelete(null);
        }}
        onDeleted={async () => {
          await loadRepos();
        }}
      />

      <EditRepoModal
        isOpen={isEditModalOpen}
        repo={repoToEdit}
        onClose={() => {
          setIsEditModalOpen(false);
          setRepoToEdit(null);
        }}
        onUpdated={async () => {
          await loadRepos();
        }}
      />

      <CloneRepoModal
        isOpen={isCloneModalOpen}
        sourceRepo={repoToClone}
        orgs={orgs}
        userLogin={user?.login}
        onClose={() => {
          setIsCloneModalOpen(false);
          setRepoToClone(null);
        }}
        onCloned={async () => {
          await loadRepos();
        }}
      />

      <CreateRepoModal
        isOpen={isCreateRepoModalOpen}
        onClose={() => setIsCreateRepoModalOpen(false)}
        onCreated={async (newRepo, isReady, diagnosis) => {
          await loadRepos();
          if (isReady === false) {
            setWizardRepo(newRepo);
            setWizardDiagnosis(diagnosis || null);
            setIsWizardOpen(true);
          } else {
            await handleOpenRepo(newRepo);
          }
        }}
      />

      <RepoSetupWizardModal
        isOpen={isWizardOpen}
        repo={wizardRepo}
        diagnosis={wizardDiagnosis}
        onClose={() => {
          setIsWizardOpen(false);
          setWizardRepo(null);
          setWizardDiagnosis(null);
        }}
        onComplete={handleWizardComplete}
      />

      <FirstRunWizard
        isOpen={showOnboarding}
        onCancel={() => setShowOnboarding(false)}
        onComplete={async (repoName) => {
          setShowOnboarding(false);
          await loadRepos();
          navigate(`/repo/${encodeURIComponent(repoName)}/editor`);
        }}
      />

      {orgGovernanceTarget && (
        <OrgGovernanceModal
          isOpen={Boolean(orgGovernanceTarget)}
          onClose={() => setOrgGovernanceTarget(null)}
          orgLogin={orgGovernanceTarget}
        />
      )}

      {repoGovernanceTarget && (
        <RepoGovernanceModal
          isOpen={Boolean(repoGovernanceTarget)}
          onClose={() => setRepoGovernanceTarget(null)}
          orgLogin={repoGovernanceTarget.orgLogin}
          repoName={repoGovernanceTarget.repoName}
        />
      )}
    </div>
  );
};
