import React, { useState, useMemo } from "react";
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
  RefreshCw,
  Edit3,
  Copy,
  Link2,
} from "lucide-react";
import { FirstRunWizard } from "../components/onboarding/FirstRunWizard";
import { DeleteRepoModal } from "../components/modals/DeleteRepoModal";
import { EditRepoModal } from "../components/modals/EditRepoModal";
import { CloneRepoModal } from "../components/modals/CloneRepoModal";
import { RepoSetupWizardModal } from "../components/modals/RepoSetupWizardModal";
import { CreateRepoModal } from "../components/modals/CreateRepoModal";
import { CreateOrgModal } from "../components/modals/CreateOrgModal";
import { LinkOrgModal } from "../components/modals/LinkOrgModal";

interface ReposViewProps {
  onSelectRepo?: (repo: Repo) => void;
}

export const ReposView: React.FC<ReposViewProps> = ({ onSelectRepo }) => {
  const { t } = useTranslation(["repos", "common"]);
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { repos, loadRepos, selectRepo, isLoading, orgs: contextOrgs, loadOrgs } = useWorkspace();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrg, setSelectedOrg] = useState("all");
  const [openingRepoName, setOpeningRepoName] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [repoToDelete, setRepoToDelete] = useState<Repo | null>(null);
  const [modalMode, setModalMode] = useState<"delete" | "unlink">("delete");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCreateOrgModalOpen, setIsCreateOrgModalOpen] = useState(false);
  const [isLinkOrgModalOpen, setIsLinkOrgModalOpen] = useState(false);
  const [isReloading, setIsReloading] = useState(false);

  // Edit & Clone Repo Modals State
  const [repoToEdit, setRepoToEdit] = useState<Repo | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [repoToClone, setRepoToClone] = useState<Repo | null>(null);
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);

  // Repo Setup Wizard State
  const [wizardRepo, setWizardRepo] = useState<Repo | null>(null);
  const [wizardDiagnosis, setWizardDiagnosis] = useState<RepoDiagnosis | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  // Check if onboarding is needed
  React.useEffect(() => {
    API.getOnboardingStatus()
      .then((status) => {
        if (status?.needed) {
          setShowOnboarding(true);
        }
      })
      .catch(() => {});
  }, []);

  // Create Repo Modal State
  const [isCreateRepoModalOpen, setIsCreateRepoModalOpen] = useState(false);

  const handleReloadAll = async () => {
    setIsReloading(true);
    try {
      await Promise.all([loadRepos(), loadOrgs?.()]);
    } finally {
      setIsReloading(false);
    }
  };

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
        navigate(`/repo/${encodeURIComponent(repo.name)}/editor`);
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
    navigate(`/repo/${encodeURIComponent(activeRepo.name)}/editor`);
  };

  // Get list of unique organizations/owners
  const orgs = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of contextOrgs || []) {
      if (o.login && o.login.toLowerCase() !== (user?.login || "").toLowerCase()) {
        map.set(o.login.toLowerCase(), o.login);
      }
    }
    for (const r of repos) {
      const owner = r.owner || (r.full_name ? r.full_name.split("/")[0] : "");
      if (owner && owner.toLowerCase() !== (user?.login || "").toLowerCase() && owner !== "local") {
        map.set(owner.toLowerCase(), owner);
      }
    }
    return Array.from(map.values());
  }, [contextOrgs, repos, user?.login]);

  const hasLocalRepos = repos.some((r) => r.is_local);

  const filteredRepos = repos.filter((r) => {
    const owner = (
      r.owner || (r.full_name ? r.full_name.split("/")[0] : "")
    ).toLowerCase();

    let matchesOrg = true;
    if (selectedOrg === "all") {
      matchesOrg = true;
    } else if (selectedOrg === "local") {
      matchesOrg = Boolean(r.is_local);
    } else if (selectedOrg.toLowerCase() === (user?.login || "").toLowerCase()) {
      matchesOrg = owner === (user?.login || "").toLowerCase() || Boolean(r.is_owner);
    } else {
      matchesOrg = owner === selectedOrg.toLowerCase();
    }

    const name = (r.name || "").toLowerCase();
    const desc = (r.description || "").toLowerCase();
    const full = (r.full_name || "").toLowerCase();
    const q = searchTerm.toLowerCase().trim();

    const matchesSearch =
      !q ||
      name.includes(q) ||
      desc.includes(q) ||
      full.includes(q) ||
      owner.includes(q);

    return matchesOrg && matchesSearch;
  });

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


          {/* Cabeçalho da Seção de Repositórios & Barra de Ferramentas */}
          <div className="repos-section-header" style={{ marginBottom: 20 }}>
            <div className="section-title" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h2 style={{ fontSize: "18px", fontWeight: 600, margin: 0 }}>{t("repos:sectionTitle")}</h2>
                <Badge id="repos-count-badge" variant="primary">
                  {t("repos:reposCount", { count: filteredRepos.length })}
                </Badge>
              </div>

              <div style={{ width: 280 }}>
                <SearchInput
                  id="repos-search-input"
                  placeholder={t("repos:searchPlaceholder")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onClear={() => setSearchTerm("")}
                />
              </div>
            </div>

            {/* Ações: Novo Repositório, Vincular Organização, Criar no GitHub e Recarregar */}
            <div
              className="repos-actions-row"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                flexWrap: "wrap",
                marginBottom: 4,
              }}
            >
              <Button
                id="btn-open-create-repo"
                variant="primary"
                size="sm"
                leftIcon={<Plus size={15} />}
                onClick={() => setIsCreateRepoModalOpen(true)}
              >
                {t("repos:navNewRepo")}
              </Button>
              <Button
                id="btn-open-link-org"
                variant="secondary"
                size="sm"
                leftIcon={<Link2 size={15} />}
                onClick={() => setIsLinkOrgModalOpen(true)}
              >
                Vincular Organização
              </Button>
              <Button
                id="btn-open-create-org"
                variant="outline"
                size="sm"
                leftIcon={<Building2 size={15} />}
                onClick={() => setIsCreateOrgModalOpen(true)}
              >
                Criar no GitHub
              </Button>
              <Button
                id="btn-reload-repos-orgs"
                variant="ghost"
                size="sm"
                leftIcon={<RefreshCw size={14} className={isReloading || isLoading ? "animate-spin" : ""} />}
                onClick={handleReloadAll}
                disabled={isReloading || isLoading}
              >
                Recarregar
              </Button>
            </div>

            {/* Filtros em Chips por Organização / Conta */}
            <div className="repos-org-chips">
              <button
                type="button"
                className={`chip-filter-btn ${selectedOrg === "all" ? "active" : ""}`}
                onClick={() => setSelectedOrg("all")}
              >
                <span>{t("repos:filterAllAccounts")}</span>
                <span className="chip-count">{repos.length}</span>
              </button>

              {user?.login && (
                <button
                  type="button"
                  className={`chip-filter-btn ${selectedOrg === user.login ? "active" : ""}`}
                  onClick={() => setSelectedOrg(user.login)}
                >
                  <User size={13} />
                  <span>{t("repos:filterPersonal", { user: user.login })}</span>
                  <span className="chip-count">
                    {
                      repos.filter(
                        (r) =>
                          (r.owner || "").toLowerCase() === user.login.toLowerCase() ||
                          r.is_owner,
                      ).length
                    }
                  </span>
                </button>
              )}

              {orgs.map((o) => (
                <button
                  key={o}
                  type="button"
                  className={`chip-filter-btn ${selectedOrg === o ? "active" : ""}`}
                  onClick={() => setSelectedOrg(o)}
                >
                  <Building2 size={13} />
                  <span>@{o}</span>
                  <span className="chip-count">
                    {
                      repos.filter(
                        (r) => (r.owner || "").toLowerCase() === o.toLowerCase(),
                      ).length
                    }
                  </span>
                </button>
              ))}

              {hasLocalRepos && (
                <button
                  type="button"
                  className={`chip-filter-btn ${selectedOrg === "local" ? "active" : ""}`}
                  onClick={() => setSelectedOrg("local")}
                >
                  <HardDrive size={13} />
                  <span>{t("repos:filterLocal")}</span>
                  <span className="chip-count">
                    {repos.filter((r) => r.is_local).length}
                  </span>
                </button>
              )}
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

      <LinkOrgModal
        isOpen={isLinkOrgModalOpen}
        onClose={() => setIsLinkOrgModalOpen(false)}
        onOpenCreate={() => setIsCreateOrgModalOpen(true)}
        onLinked={async (linkedOrg) => {
          await Promise.all([loadOrgs?.(), loadRepos()]);
          setSelectedOrg(linkedOrg.login);
        }}
      />

      <CreateOrgModal
        isOpen={isCreateOrgModalOpen}
        onClose={() => setIsCreateOrgModalOpen(false)}
        onOpenLinkModal={() => setIsLinkOrgModalOpen(true)}
      />

      <CreateRepoModal
        isOpen={isCreateRepoModalOpen}
        onClose={() => setIsCreateRepoModalOpen(false)}
        defaultOwner={selectedOrg}
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
    </div>
  );
};
