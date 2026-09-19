import React, { useState } from 'react';
import type { Repo } from '../types';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { API } from '../services/api';

interface ReposViewProps {
  onSelectRepo: (repo: Repo) => void;
}

export const ReposView: React.FC<ReposViewProps> = ({ onSelectRepo }) => {
  const { user, logout } = useAuth();
  const { repos, loadRepos, isLoading } = useWorkspace();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrg, setSelectedOrg] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Create Repo Card
  const [isCreatingRepo, setIsCreatingRepo] = useState(false);
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoDesc, setNewRepoDesc] = useState('Repositório com regras de Governança');
  const [newRepoApprovals, setNewRepoApprovals] = useState(1);
  const [newRepoProtection, setNewRepoProtection] = useState(true);
  const [newRepoPrivate, setNewRepoPrivate] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRepoName.trim()) return;
    setIsSubmitting(true);

    try {
      const res = await API.createRepo({
        name: newRepoName.trim(),
        owner: selectedOrg === 'all' ? user?.login : selectedOrg,
        description: newRepoDesc,
        required_approvals: newRepoApprovals,
        enable_protection: newRepoProtection,
        is_private: newRepoPrivate
      });

      if (res.ok && res.data?.repo) {
        await loadRepos();
        setIsCreatingRepo(false);
        setNewRepoName('');
        onSelectRepo(res.data.repo);
      }
    } catch (err) {
      console.error('[ReposView] Erro ao criar repositório:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get list of unique organizations/owners
  const orgs = Array.from(
    new Set(
      repos
        .map(r => r.owner || (r.full_name ? r.full_name.split('/')[0] : ''))
        .filter(Boolean)
    )
  );

  const filteredRepos = repos.filter(r => {
    const owner = (r.owner || (r.full_name ? r.full_name.split('/')[0] : '')).toLowerCase();
    const matchesOrg = selectedOrg === 'all' || owner === selectedOrg.toLowerCase();

    const name = (r.name || '').toLowerCase();
    const desc = (r.description || '').toLowerCase();
    const full = (r.full_name || '').toLowerCase();
    const q = searchTerm.toLowerCase().trim();

    const matchesSearch = !q || name.includes(q) || desc.includes(q) || full.includes(q) || owner.includes(q);

    return matchesOrg && matchesSearch;
  });

  return (
    <div id="view-repos" className="screen-view" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      <div className="repos-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        
        {/* Navbar */}
        <header className="repos-navbar">
          <div className="user-badge" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img
              id="user-avatar"
              src={user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=6366f1&color=fff`}
              alt="Avatar"
              style={{ width: '36px', height: '36px', borderRadius: '50%' }}
            />
            <div>
              <h3 id="user-name" style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>{user?.name || user?.login || 'Desenvolvedor'}</h3>
              <span id="user-login" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>@{user?.login || 'local'}</span>
            </div>
          </div>

          <div className="nav-actions" style={{ display: 'flex', gap: '8px' }}>
            <button
              id="btn-open-create-repo"
              className="btn btn-primary btn-sm"
              type="button"
              onClick={() => setIsCreatingRepo(!isCreatingRepo)}
            >
              <span className="material-symbols-outlined icon-xs">add</span>
              {isCreatingRepo ? 'Fechar Painel' : 'Novo Repositório'}
            </button>
            <button id="btn-logout" className="btn btn-ghost btn-sm" type="button" onClick={logout}>
              Desconectar
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="repos-content" style={{ flex: 1, padding: '24px 32px', maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
          
          {/* Create Repo Form Card */}
          {isCreatingRepo && (
            <div id="create-repo-card" className="card" style={{ padding: '20px', marginBottom: '24px', border: '1.5px solid var(--border-color)', background: 'var(--bg-surface)' }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px' }}>Criar Novo Repositório com Governança</h3>
                  <span className="subtitle" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Inicialize o repositório com branch protection e templates SDD oficiais
                  </span>
                </div>
                <button className="btn-close" type="button" onClick={() => setIsCreatingRepo(false)}>
                  <span className="material-symbols-outlined icon-sm">close</span>
                </button>
              </div>

              <form onSubmit={handleCreateRepo}>
                <div className="form-row">
                  <div className="form-group flex-1">
                    <label htmlFor="create-repo-owner">Proprietário / Organização:</label>
                    <select
                      id="create-repo-owner"
                      className="form-select"
                      value={selectedOrg}
                      onChange={e => setSelectedOrg(e.target.value)}
                    >
                      <option value="all">{user?.login} (Conta Pessoal)</option>
                      {orgs.map(o => (
                        <option key={o} value={o}>{o} (Organização)</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group flex-2">
                    <label htmlFor="create-repo-name">Nome do Repositório:</label>
                    <input
                      type="text"
                      id="create-repo-name"
                      placeholder="ex: fintech-billing"
                      value={newRepoName}
                      onChange={e => setNewRepoName(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group flex-2">
                    <label htmlFor="create-repo-desc">Descrição:</label>
                    <input
                      type="text"
                      id="create-repo-desc"
                      value={newRepoDesc}
                      onChange={e => setNewRepoDesc(e.target.value)}
                    />
                  </div>

                  <div className="form-group flex-1">
                    <label htmlFor="create-repo-approvals">Aprovações necessárias:</label>
                    <select
                      id="create-repo-approvals"
                      className="form-select"
                      value={newRepoApprovals}
                      onChange={e => setNewRepoApprovals(Number(e.target.value))}
                    >
                      <option value="1">1 Aprovação (1-of-N)</option>
                      <option value="2">2 Aprovações</option>
                    </select>
                  </div>
                </div>

                <div className="form-group-checkbox" style={{ marginTop: '8px' }}>
                  <label>
                    <input
                      type="checkbox"
                      id="create-repo-protection"
                      checked={newRepoProtection}
                      onChange={e => setNewRepoProtection(e.target.checked)}
                    />
                    <span>
                      <strong>Bloquear branch <code>main</code></strong> (Exige PR obrigatório antes de merge)
                    </span>
                  </label>
                </div>

                <div className="form-group-checkbox" style={{ marginTop: '4px' }}>
                  <label>
                    <input
                      type="checkbox"
                      id="create-repo-private"
                      checked={newRepoPrivate}
                      onChange={e => setNewRepoPrivate(e.target.checked)}
                    />
                    <span>Repositório Privado no GitHub</span>
                  </label>
                </div>

                <div className="card-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                  <button className="btn btn-ghost btn-sm" type="button" onClick={() => setIsCreatingRepo(false)}>
                    Cancelar
                  </button>
                  <button
                    id="btn-submit-create-repo"
                    className="btn btn-primary btn-sm"
                    type="submit"
                    disabled={isSubmitting || !newRepoName.trim()}
                  >
                    {isSubmitting ? 'Criando no GitHub...' : 'Criar Repositório'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Repos Section Header & Toolbar */}
          <div className="repos-section-header">
            <div className="section-title">
              <h2>Seus Repositórios</h2>
              <span className="badge badge-primary-subtle" id="repos-count-badge">
                {filteredRepos.length} repositório(s)
              </span>
            </div>

            {/* Toolbar: Search Bar, Org Filter & View Switcher */}
            <div className="repos-toolbar">
              <div className="repos-search-box">
                <span className="material-symbols-outlined icon-sm search-icon">search</span>
                <input
                  type="text"
                  id="repos-search-input"
                  placeholder="Buscar repositório por nome ou descrição..."
                  autoComplete="off"
                  spellCheck="false"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    id="btn-clear-search"
                    className="btn-clear-search"
                    type="button"
                    title="Limpar busca"
                    onClick={() => setSearchTerm('')}
                  >
                    <span className="material-symbols-outlined icon-xs">close</span>
                  </button>
                )}
              </div>

              <div className="repos-filters-actions">
                <select
                  className="form-select"
                  style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '18px', border: '1px solid var(--border-color)' }}
                  value={selectedOrg}
                  onChange={e => setSelectedOrg(e.target.value)}
                >
                  <option value="all">Todas as contas e organizações</option>
                  {user?.login && (
                    <option value={user.login}>Conta Pessoal (@{user.login})</option>
                  )}
                  {orgs.filter(o => o.toLowerCase() !== user?.login.toLowerCase()).map(o => (
                    <option key={o} value={o}>Org: {o}</option>
                  ))}
                </select>

                <div className="view-mode-segmented" role="group" aria-label="Modo de visualização">
                  <button
                    id="btn-view-grid"
                    className={`view-mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
                    title="Visualização em Grade"
                    type="button"
                    onClick={() => setViewMode('grid')}
                  >
                    <span className="material-symbols-outlined icon-sm">grid_view</span>
                    <span className="btn-label">Grade</span>
                  </button>
                  <button
                    id="btn-view-list"
                    className={`view-mode-btn ${viewMode === 'list' ? 'active' : ''}`}
                    title="Visualização em Lista"
                    type="button"
                    onClick={() => setViewMode('list')}
                  >
                    <span className="material-symbols-outlined icon-sm">view_list</span>
                    <span className="btn-label">Lista</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Repos Grid / List */}
          <div id="repos-list-grid" className={`repos-grid ${viewMode === 'list' ? 'list-view' : ''}`}>
            {isLoading ? (
              <div className="loading-state">Carregando repositórios...</div>
            ) : filteredRepos.length === 0 ? (
              <div className="repos-empty-state" style={{ gridColumn: '1 / -1' }}>
                <div className="repos-empty-icon">
                  <span className="material-symbols-outlined icon-md">inventory_2</span>
                </div>
                <div className="repos-empty-title">Nenhum repositório encontrado</div>
                <div className="repos-empty-desc">
                  Tente ajustar os filtros ou clique em <strong>Novo Repositório</strong> acima para começar.
                </div>
              </div>
            ) : (
              filteredRepos.map(repo => {
                const owner = repo.owner || (repo.full_name ? repo.full_name.split('/')[0] : '');
                const isOrg = owner && user?.login && owner.toLowerCase() !== user.login.toLowerCase();

                return (
                  <div
                    key={repo.id || repo.name}
                    className="repo-card"
                    role="button"
                    tabIndex={0}
                    title={`Abrir Dashboard do projeto ${repo.full_name || repo.name}`}
                    onClick={() => onSelectRepo(repo)}
                  >
                    <div className="repo-card-main">
                      <div className="repo-top">
                        <div className="repo-header-info">
                          <div className="repo-icon-wrap" aria-hidden="true">
                            <span className="material-symbols-outlined icon-sm">inventory_2</span>
                          </div>
                          <div className="repo-titles-group">
                            {isOrg && (
                              <span className="repo-owner-tag">
                                <span className="material-symbols-outlined icon-xs" style={{ fontSize: '13px' }}>apartment</span> @{owner}
                              </span>
                            )}
                            <span className="repo-title" title={repo.full_name || repo.name}>
                              {repo.name}
                            </span>
                          </div>
                        </div>

                        <span className={`repo-visibility-pill ${repo.is_private ? 'private' : 'public'}`}>
                          <span className="material-symbols-outlined icon-xs">{repo.is_private ? 'lock' : 'public'}</span>
                          <span>{repo.is_private ? 'Privado' : 'Público'}</span>
                        </span>
                      </div>

                      <p className={`repo-desc ${repo.description ? '' : 'empty'}`} title={repo.description || ''}>
                        {repo.description || 'Repositório com regras de Governança'}
                      </p>
                    </div>

                    <div className="repo-footer">
                      <div className="repo-footer-left">
                        <span className="repo-branch-pill" title="Branch padrão">
                          <span className="material-symbols-outlined icon-xs" style={{ fontSize: '13px' }}>alt_route</span>
                          {repo.default_branch || 'main'}
                        </span>
                        <span className="pill-dot protected" title="Branch protegida">
                          <span className="dot"></span> Protegido
                        </span>
                      </div>

                      <div className="repo-footer-right">
                        <span className="material-symbols-outlined icon-xs" style={{ color: 'var(--text-muted)' }}>arrow_forward</span>
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
