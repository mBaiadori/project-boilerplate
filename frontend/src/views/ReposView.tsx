import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Repo, RepoDiagnosis } from "../types";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import { API } from "../services/api";
import {
  Button,
  IconButton,
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  FormField,
  Input,
  SearchInput,
  Badge,
  EmptyState,
  Spinner,
  Switch,
} from "../components/ui";
import {
  Plus,
  LogOut,
  X,
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
} from "lucide-react";
import { FirstRunWizard } from "../components/onboarding/FirstRunWizard";
import { DeleteRepoModal } from "../components/modals/DeleteRepoModal";
import { EditRepoModal } from "../components/modals/EditRepoModal";
import { CloneRepoModal } from "../components/modals/CloneRepoModal";
import { RepoSetupWizardModal } from "../components/modals/RepoSetupWizardModal";
import { CreateOrgModal } from "../components/modals/CreateOrgModal";

interface ReposViewProps {
  onSelectRepo?: (repo: Repo) => void;
}

export const ReposView: React.FC<ReposViewProps> = ({ onSelectRepo }) => {
  const navigate = useNavigate();
  const { user, logout, provider } = useAuth();
  const providerLabel =
    provider === "forgejo"
      ? "Forgejo"
      : provider === "github"
        ? "GitHub"
        : "Modo Local";
  const { repos, loadRepos, selectRepo, isLoading } = useWorkspace();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrg, setSelectedOrg] = useState("all");
  const [openingRepoName, setOpeningRepoName] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [repoToDelete, setRepoToDelete] = useState<Repo | null>(null);
  const [modalMode, setModalMode] = useState<"delete" | "unlink">("delete");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCreateOrgModalOpen, setIsCreateOrgModalOpen] = useState(false);

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

  // Create Repo State
  const [isCreatingRepo, setIsCreatingRepo] = useState(false);
  const [newRepoName, setNewRepoName] = useState("");
  const [newRepoDesc, setNewRepoDesc] = useState(
    "Repositório com regras de Governança",
  );
  const [newRepoApprovals, setNewRepoApprovals] = useState(1);
  const [newRepoProtection, setNewRepoProtection] = useState(true);
  const [newRepoPrivate, setNewRepoPrivate] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleCreateRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRepoName.trim()) return;
    setIsSubmitting(true);

    try {
      const res = await API.createRepo({
        name: newRepoName.trim(),
        owner: selectedOrg === "all" ? user?.login : selectedOrg,
        description: newRepoDesc,
        required_approvals: newRepoApprovals,
        enable_protection: newRepoProtection,
        is_private: newRepoPrivate,
      });

      if (res.ok && res.data?.repo) {
        await loadRepos();
        setIsCreatingRepo(false);
        setNewRepoName("");
        if (res.data.is_ready === false) {
          setWizardRepo(res.data.repo);
          setWizardDiagnosis(res.data.diagnosis || null);
          setIsWizardOpen(true);
        } else {
          await handleOpenRepo(res.data.repo);
        }
      }
    } catch (err) {
      console.error("[ReposView] Erro ao criar repositório:", err);
    } finally {
      setIsSubmitting(false);
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
  const orgs = Array.from(
    new Set(
      repos
        .map((r) => r.owner || (r.full_name ? r.full_name.split("/")[0] : ""))
        .filter((o) => o && o.toLowerCase() !== (user?.login || "").toLowerCase() && o !== "local"),
    ),
  );

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
          <div
            className="user-badge"
            style={{ display: "flex", alignItems: "center", gap: "12px" }}
          >
            <img
              id="user-avatar"
              src={
                user?.avatar_url ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || "User")}&background=1a73e8&color=fff`
              }
              alt="Avatar"
              style={{ width: "36px", height: "36px", borderRadius: "50%" }}
            />
            <div>
              <h3
                id="user-name"
                style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}
              >
                {user?.name || user?.login || "Desenvolvedor"}
              </h3>
              <span
                id="user-login"
                style={{ fontSize: "12px", color: "var(--text-muted)" }}
              >
                @{user?.login || "local"}
              </span>
            </div>
          </div>

          <div className="nav-actions" style={{ display: "flex", gap: "8px" }}>
            <Button
              id="btn-open-onboarding"
              variant="subtle"
              size="sm"
              leftIcon={<Sparkles size={15} />}
              onClick={() => setShowOnboarding(true)}
            >
              Assistente / Onboarding
            </Button>
            <Button
              id="btn-open-create-org"
              variant="secondary"
              size="sm"
              leftIcon={<Building2 size={15} />}
              onClick={() => setIsCreateOrgModalOpen(true)}
            >
              Nova Organização
            </Button>
            <Button
              id="btn-open-create-repo"
              variant={isCreatingRepo ? "secondary" : "primary"}
              size="sm"
              leftIcon={isCreatingRepo ? <X size={15} /> : <Plus size={15} />}
              onClick={() => setIsCreatingRepo(!isCreatingRepo)}
            >
              {isCreatingRepo ? "Fechar Painel" : "Novo Repositório"}
            </Button>
            <Button
              id="btn-logout"
              variant="ghost"
              size="sm"
              leftIcon={<LogOut size={15} />}
              onClick={logout}
            >
              Desconectar
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
          {/* Card de Criação de Repositório */}
          {isCreatingRepo && (
            <Card
              id="create-repo-card"
              variant="elevated"
              style={{ marginBottom: 24 }}
            >
              <CardHeader
                title="Criar Novo Repositório com Governança"
                subtitle="Inicialize o repositório com branch protection e templates SDD oficiais"
                actions={
                  <IconButton
                    size="sm"
                    tooltip="Fechar"
                    onClick={() => setIsCreatingRepo(false)}
                  >
                    <X size={16} />
                  </IconButton>
                }
              />
              <form onSubmit={handleCreateRepo}>
                <CardContent
                  style={{ display: "flex", flexDirection: "column", gap: 14 }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 2fr",
                      gap: 16,
                    }}
                  >
                    <FormField label="Proprietário / Organização:">
                      <select
                        id="create-repo-owner"
                        className="ui-input"
                        value={selectedOrg}
                        onChange={(e) => setSelectedOrg(e.target.value)}
                      >
                        <option value="all">
                          {user?.login} (Conta Pessoal)
                        </option>
                        {orgs.map((o) => (
                          <option key={o} value={o}>
                            {o} (Organização)
                          </option>
                        ))}
                      </select>
                    </FormField>

                    <FormField label="Nome do Repositório:" required>
                      <Input
                        id="create-repo-name"
                        placeholder="ex: fintech-billing"
                        value={newRepoName}
                        onChange={(e) => setNewRepoName(e.target.value)}
                        required
                        autoFocus
                      />
                    </FormField>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "2fr 1fr",
                      gap: 16,
                    }}
                  >
                    <FormField label="Descrição:">
                      <Input
                        id="create-repo-desc"
                        value={newRepoDesc}
                        onChange={(e) => setNewRepoDesc(e.target.value)}
                      />
                    </FormField>

                    <FormField label="Aprovações necessárias:">
                      <select
                        id="create-repo-approvals"
                        className="ui-input"
                        value={newRepoApprovals}
                        onChange={(e) =>
                          setNewRepoApprovals(Number(e.target.value))
                        }
                      >
                        <option value="1">1 Aprovação (1-of-N)</option>
                        <option value="2">2 Aprovações</option>
                      </select>
                    </FormField>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                      marginTop: 4,
                    }}
                  >
                    <Switch
                      id="create-repo-protection"
                      checked={newRepoProtection}
                      onChange={setNewRepoProtection}
                      label={
                        <span>
                          Bloquear branch <code>main</code> (Exige PR
                          obrigatório)
                        </span>
                      }
                      description="Garante que nenhuma alteração direta seja feita sem revisão"
                    />

                    <Switch
                      id="create-repo-private"
                      checked={newRepoPrivate}
                      onChange={setNewRepoPrivate}
                      label={`Repositório Privado no ${providerLabel}`}
                      description="Visível apenas para você e colaboradores autorizados"
                    />
                  </div>
                </CardContent>

                <CardFooter>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsCreatingRepo(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    id="btn-submit-create-repo"
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={isSubmitting}
                    disabled={!newRepoName.trim()}
                  >
                    Criar Repositório
                  </Button>
                </CardFooter>
              </form>
            </Card>
          )}

          {/* Cabeçalho da Seção de Repositórios & Barra de Ferramentas */}
          <div className="repos-section-header" style={{ marginBottom: 20 }}>
            <div className="section-title" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h2 style={{ fontSize: "18px", fontWeight: 600, margin: 0 }}>Seus Repositórios</h2>
                <Badge id="repos-count-badge" variant="primary">
                  {filteredRepos.length} repositório(s)
                </Badge>
              </div>

              <div style={{ width: 280 }}>
                <SearchInput
                  id="repos-search-input"
                  placeholder="Buscar repositório por nome ou descrição..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onClear={() => setSearchTerm("")}
                />
              </div>
            </div>

            {/* Filtros em Chips por Organização / Conta */}
            <div className="repos-org-chips">
              <button
                type="button"
                className={`chip-filter-btn ${selectedOrg === "all" ? "active" : ""}`}
                onClick={() => setSelectedOrg("all")}
              >
                <span>Todas as contas</span>
                <span className="chip-count">{repos.length}</span>
              </button>

              {user?.login && (
                <button
                  type="button"
                  className={`chip-filter-btn ${selectedOrg === user.login ? "active" : ""}`}
                  onClick={() => setSelectedOrg(user.login)}
                >
                  <User size={13} />
                  <span>Pessoal (@{user.login})</span>
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
                  <span>Locais</span>
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
                <Spinner size="lg" message="Carregando repositórios..." />
              </div>
            ) : filteredRepos.length === 0 ? (
              <div style={{ gridColumn: "1 / -1" }}>
                <EmptyState
                  icon={<FolderGit2 size={44} strokeWidth={1.4} />}
                  title="Nenhum repositório encontrado"
                  description="Tente ajustar os filtros ou clique em 'Novo Repositório' acima para começar."
                  action={
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<Plus size={15} />}
                      onClick={() => setIsCreatingRepo(true)}
                    >
                      Novo Repositório
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
                        ? `Carregando ${repo.name}...`
                        : `Abrir Dashboard do projeto ${repo.full_name || repo.name}`
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
                              Vinculado
                            </Badge>
                          ) : (
                            <Badge
                              variant="neutral"
                              size="sm"
                              icon={<Globe size={11} style={{ marginRight: 3 }} />}
                            >
                              Não vinculado
                            </Badge>
                          )}

                          {repo.is_local ? (
                            <Badge
                              variant="neutral"
                              size="sm"
                              icon={<HardDrive size={11} style={{ marginRight: 3 }} />}
                            >
                              Local
                            </Badge>
                          ) : isOwner ? (
                            <Badge
                              variant="primary"
                              size="sm"
                              icon={<User size={11} style={{ marginRight: 3 }} />}
                            >
                              Proprietário
                            </Badge>
                          ) : isOrg ? (
                            <Badge
                              variant="neutral"
                              size="sm"
                              icon={<Building2 size={11} style={{ marginRight: 3 }} />}
                            >
                              Org
                            </Badge>
                          ) : (
                            <Badge
                              variant="warning"
                              size="sm"
                              icon={<Users size={11} style={{ marginRight: 3 }} />}
                            >
                              Colaborador
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
                            {repo.is_private ? "Privado" : "Público"}
                          </Badge>
                        </div>
                      </div>

                      <p
                        className={`repo-desc ${repo.description ? "" : "empty"}`}
                        title={repo.description || ""}
                      >
                        {repo.description ||
                          "Repositório de especificações e governança"}
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
                              title="Editar configurações do repositório (Nome, Descrição, Visibilidade)"
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
                              title="Clonar repositório existente"
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
                            title="Desvincular do Context OS (liberar espaço em disco)"
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
                            title={repo.is_local ? "Excluir repositório local" : "Excluir repositório remoto"}
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
                            <span>Abrindo...</span>
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

      <CreateOrgModal
        isOpen={isCreateOrgModalOpen}
        onClose={() => setIsCreateOrgModalOpen(false)}
        onCreated={async (newOrg) => {
          await loadRepos();
          setSelectedOrg(newOrg.login);
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
