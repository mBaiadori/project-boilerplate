import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Repo } from "../types";
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
  LayoutGrid,
  List,
  FolderGit2,
  Lock,
  Globe,
  GitBranch,
  ShieldCheck,
  Building2,
  ArrowRight,
} from "lucide-react";

interface ReposViewProps {
  onSelectRepo?: (repo: Repo) => void;
}

export const ReposView: React.FC<ReposViewProps> = ({ onSelectRepo }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { repos, loadRepos, selectRepo, isLoading } = useWorkspace();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrg, setSelectedOrg] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [openingRepoName, setOpeningRepoName] = useState<string | null>(null);

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
      await selectRepo(repo);
      navigate(`/repo/${encodeURIComponent(repo.name)}/editor`);
    } catch (err) {
      console.error("[ReposView] Erro ao abrir repositório:", err);
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
        await handleOpenRepo(res.data.repo);
      }
    } catch (err) {
      console.error("[ReposView] Erro ao criar repositório:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get list of unique organizations/owners
  const orgs = Array.from(
    new Set(
      repos
        .map((r) => r.owner || (r.full_name ? r.full_name.split("/")[0] : ""))
        .filter(Boolean),
    ),
  );

  const filteredRepos = repos.filter((r) => {
    const owner = (
      r.owner || (r.full_name ? r.full_name.split("/")[0] : "")
    ).toLowerCase();
    const matchesOrg =
      selectedOrg === "all" || owner === selectedOrg.toLowerCase();

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
                <CardContent style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}>
                    <FormField label="Proprietário / Organização:">
                      <select
                        id="create-repo-owner"
                        className="ui-input"
                        value={selectedOrg}
                        onChange={(e) => setSelectedOrg(e.target.value)}
                      >
                        <option value="all">{user?.login} (Conta Pessoal)</option>
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

                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
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

                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
                    <Switch
                      id="create-repo-protection"
                      checked={newRepoProtection}
                      onChange={setNewRepoProtection}
                      label={<span>Bloquear branch <code>main</code> (Exige PR obrigatório)</span>}
                      description="Garante que nenhuma alteração direta seja feita sem revisão"
                    />

                    <Switch
                      id="create-repo-private"
                      checked={newRepoPrivate}
                      onChange={setNewRepoPrivate}
                      label="Repositório Privado no GitHub"
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
          <div className="repos-section-header">
            <div className="section-title">
              <h2>Seus Repositórios</h2>
              <Badge id="repos-count-badge" variant="primary">
                {filteredRepos.length} repositório(s)
              </Badge>
            </div>

            {/* Barra de Ferramentas: Busca, Filtro de Org e Alternador de Modo */}
            <div className="repos-toolbar" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 280 }}>
                <SearchInput
                  id="repos-search-input"
                  placeholder="Buscar repositório por nome ou descrição..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onClear={() => setSearchTerm("")}
                />
              </div>

              <div className="repos-filters-actions" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <select
                  className="ui-input"
                  style={{
                    height: 38,
                    fontSize: "12.5px",
                    borderRadius: "20px",
                    width: "auto",
                  }}
                  value={selectedOrg}
                  onChange={(e) => setSelectedOrg(e.target.value)}
                >
                  <option value="all">Todas as contas e organizações</option>
                  {user?.login && (
                    <option value={user.login}>
                      Conta Pessoal (@{user.login})
                    </option>
                  )}
                  {orgs
                    .filter(
                      (o) => o.toLowerCase() !== user?.login.toLowerCase(),
                    )
                    .map((o) => (
                      <option key={o} value={o}>
                        Org: {o}
                      </option>
                    ))}
                </select>

                <div
                  className="view-mode-segmented"
                  role="group"
                  aria-label="Modo de visualização"
                >
                  <button
                    id="btn-view-grid"
                    className={`view-mode-btn ${viewMode === "grid" ? "active" : ""}`}
                    title="Visualização em Grade"
                    type="button"
                    onClick={() => setViewMode("grid")}
                  >
                    <LayoutGrid size={16} />
                    <span className="btn-label">Grade</span>
                  </button>
                  <button
                    id="btn-view-list"
                    className={`view-mode-btn ${viewMode === "list" ? "active" : ""}`}
                    title="Visualização em Lista"
                    type="button"
                    onClick={() => setViewMode("list")}
                  >
                    <List size={16} />
                    <span className="btn-label">Lista</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Grade / Lista de Repositórios */}
          <div
            id="repos-list-grid"
            className={`repos-grid ${viewMode === "list" ? "list-view" : ""}`}
          >
            {isLoading ? (
              <div style={{ gridColumn: "1 / -1", padding: 40, textAlign: "center" }}>
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
                    {isOpening && (
                      <div className="repo-card-shimmer-progress"></div>
                    )}
                    <div className="repo-card-main">
                      <div className="repo-top">
                        <div className="repo-header-info">
                          <div
                            className={`repo-icon-wrap ${isOpening ? "is-loading" : ""}`}
                            aria-hidden="true"
                          >
                            {isOpening ? (
                              <span className="material-symbols-outlined icon-sm spinning">
                                progress_activity
                              </span>
                            ) : (
                              <FolderGit2 size={20} />
                            )}
                          </div>
                          <div className="repo-titles-group">
                            {isOrg && (
                              <span className="repo-owner-tag">
                                <Building2 size={13} style={{ marginRight: 3 }} />
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

                        <Badge
                          variant={repo.is_private ? "warning" : "success"}
                          size="sm"
                          icon={
                            repo.is_private ? (
                              <Lock size={12} style={{ marginRight: 3 }} />
                            ) : (
                              <Globe size={12} style={{ marginRight: 3 }} />
                            )
                          }
                        >
                          {repo.is_private ? "Privado" : "Público"}
                        </Badge>
                      </div>

                      <p
                        className={`repo-desc ${repo.description ? "" : "empty"}`}
                        title={repo.description || ""}
                      >
                        {repo.description ||
                          "Repositório com regras de Governança"}
                      </p>
                    </div>

                    <div className="repo-footer">
                      <div className="repo-footer-left">
                        <Badge variant="neutral" size="sm" icon={<GitBranch size={12} style={{ marginRight: 3 }} />}>
                          {repo.default_branch || "main"}
                        </Badge>
                        <Badge variant="success" size="sm" icon={<ShieldCheck size={12} style={{ marginRight: 3 }} />}>
                          Protegido
                        </Badge>
                      </div>

                      <div className="repo-footer-right">
                        {isOpening ? (
                          <div
                            className="repo-card-opening-pill"
                            title="Carregando workspace..."
                          >
                            <span className="material-symbols-outlined spinning icon-xs">
                              progress_activity
                            </span>
                            <span>Carregando...</span>
                          </div>
                        ) : (
                          <ArrowRight size={16} style={{ color: "var(--text-muted)" }} />
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
    </div>
  );
};
