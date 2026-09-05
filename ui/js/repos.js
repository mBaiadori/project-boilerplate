// =============================================================================
// REPOSITORIES VIEW CONTROLLER (GOOGLE MATERIAL DESIGN 3)
// =============================================================================
import { API } from './api.js';
import { MaterialDropdown } from './components/material-dropdown.js';

export function initReposView({ onSelectRepo, onLogout }) {
  // User Navbar Elements
  const userAvatar = document.getElementById('user-avatar');
  const userName = document.getElementById('user-name');
  const userLogin = document.getElementById('user-login');
  const btnLogout = document.getElementById('btn-logout');

  // Create Repo Modal / Panel Elements
  const btnOpenCreateRepo = document.getElementById('btn-open-create-repo');
  const createRepoCard = document.getElementById('create-repo-card');
  const btnCancelCreate = document.getElementById('btn-cancel-create');
  const createRepoOwner = document.getElementById('create-repo-owner');
  const createRepoName = document.getElementById('create-repo-name');
  const createRepoDesc = document.getElementById('create-repo-desc');
  const createRepoApprovals = document.getElementById('create-repo-approvals');
  const createRepoProtection = document.getElementById('create-repo-protection');
  const createRepoPrivate = document.getElementById('create-repo-private');
  const btnSubmitCreateRepo = document.getElementById('btn-submit-create-repo');

  // Toolbar & Repos Elements
  const reposCountBadge = document.getElementById('repos-count-badge');
  const reposListGrid = document.getElementById('repos-list-grid');
  const reposSearchInput = document.getElementById('repos-search-input');
  const btnClearSearch = document.getElementById('btn-clear-search');
  const orgDropdownContainer = document.getElementById('repos-org-dropdown-container');
  const btnViewGrid = document.getElementById('btn-view-grid');
  const btnViewList = document.getElementById('btn-view-list');

  // Internal State
  let rawRepos = [];
  let currentUser = null;
  let userOrgs = [];
  let currentSearchQuery = '';
  let currentSelectedOrg = 'all';
  let currentViewMode = localStorage.getItem('repos_view_mode') || 'grid';
  let orgDropdown = null;

  // Initialize MaterialDropdown component for Organization Filter
  if (orgDropdownContainer) {
    orgDropdown = new MaterialDropdown({
      container: orgDropdownContainer,
      placeholder: 'Todas as organizações',
      leadingIcon: 'corporate_fare',
      searchable: true,
      options: [
        { value: 'all', label: 'Todas as contas e organizações', icon: 'corporate_fare', badge: 0 }
      ],
      selectedValue: 'all',
      ariaLabel: 'Filtrar repositórios por Organização',
      onChange: (value) => {
        currentSelectedOrg = value || 'all';
        filterAndRenderRepos();
      }
    });
  }

  // Apply initial view mode
  applyViewMode(currentViewMode);

  // ---------------------------------------------------------------------------
  // AUTH & CREATE ACTIONS
  // ---------------------------------------------------------------------------
  btnLogout.addEventListener('click', async () => {
    await API.logout();
    onLogout();
  });

  btnOpenCreateRepo.addEventListener('click', () => {
    createRepoCard.style.display = 'flex';
  });

  btnCancelCreate.addEventListener('click', () => {
    createRepoCard.style.display = 'none';
  });

  btnSubmitCreateRepo.addEventListener('click', async () => {
    const name = createRepoName.value.trim();
    const owner = createRepoOwner.value;
    const description = createRepoDesc.value.trim();
    const required_approvals = parseInt(createRepoApprovals.value || 1);
    const enable_protection = createRepoProtection.checked;
    const is_private = createRepoPrivate.checked;

    if (!name) {
      alert('Informe o nome do repositório.');
      return;
    }

    btnSubmitCreateRepo.disabled = true;
    btnSubmitCreateRepo.textContent = 'Criando no GitHub e aplicando proteção...';

    try {
      const { ok, data } = await API.createRepo({
        name, owner, description, enable_protection, required_approvals, is_private
      });

      if (ok && data.success) {
        createRepoCard.style.display = 'none';
        createRepoName.value = '';
        onSelectRepo(data.repo);
      } else {
        alert(`Erro na criação: ${data.error || 'Falha na API'}`);
      }
    } catch (err) {
      alert('Erro de comunicação com o servidor.');
    } finally {
      btnSubmitCreateRepo.disabled = false;
      btnSubmitCreateRepo.innerHTML = '<span class="material-symbols-outlined icon-xs">rocket_launch</span> Criar no GitHub com Branch Protection';
    }
  });

  // ---------------------------------------------------------------------------
  // SEARCH & FILTER EVENTS
  // ---------------------------------------------------------------------------
  if (reposSearchInput) {
    reposSearchInput.addEventListener('input', (e) => {
      currentSearchQuery = (e.target.value || '').trim().toLowerCase();
      if (btnClearSearch) {
        btnClearSearch.style.display = currentSearchQuery ? 'flex' : 'none';
      }
      filterAndRenderRepos();
    });

    reposSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        resetSearch();
      }
    });
  }

  if (btnClearSearch) {
    btnClearSearch.addEventListener('click', () => {
      resetSearch();
    });
  }

  // ---------------------------------------------------------------------------
  // VIEW MODE SWITCHER (GRID vs LIST)
  // ---------------------------------------------------------------------------
  if (btnViewGrid) {
    btnViewGrid.addEventListener('click', () => {
      applyViewMode('grid');
    });
  }

  if (btnViewList) {
    btnViewList.addEventListener('click', () => {
      applyViewMode('list');
    });
  }

  function applyViewMode(mode) {
    currentViewMode = mode;
    localStorage.setItem('repos_view_mode', mode);

    if (mode === 'list') {
      reposListGrid.classList.add('repos-view-list');
      if (btnViewList) btnViewList.classList.add('active');
      if (btnViewGrid) btnViewGrid.classList.remove('active');
    } else {
      reposListGrid.classList.remove('repos-view-list');
      if (btnViewGrid) btnViewGrid.classList.add('active');
      if (btnViewList) btnViewList.classList.remove('active');
    }
  }

  function resetSearch() {
    if (reposSearchInput) {
      reposSearchInput.value = '';
    }
    currentSearchQuery = '';
    if (btnClearSearch) {
      btnClearSearch.style.display = 'none';
    }
    filterAndRenderRepos();
  }

  // ---------------------------------------------------------------------------
  // LOAD & DATA RETRIEVAL
  // ---------------------------------------------------------------------------
  return {
    async load(user) {
      if (user) {
        currentUser = user;
        userAvatar.src = user.avatar_url || '';
        userName.textContent = user.name || user.login;
        userLogin.textContent = `@${user.login}`;
      }

      reposListGrid.innerHTML = `
        <div class="repos-empty-state" style="border: none;">
          <div class="repos-empty-icon" style="background: var(--md-sys-color-primary-container); color: var(--md-sys-color-primary);">
            <span class="material-symbols-outlined icon-md">sync</span>
          </div>
          <div class="repos-empty-title">Buscando repositórios no GitHub...</div>
          <div class="repos-empty-desc">Conectando à sua conta e organizações associadas.</div>
        </div>
      `;

      try {
        const { ok, data } = await API.getRepos();
        if (ok) {
          if (data.user) {
            currentUser = data.user;
            userAvatar.src = data.user.avatar_url || '';
            userName.textContent = data.user.name || data.user.login;
            userLogin.textContent = `@${data.user.login}`;
          }

          userOrgs = data.orgs || [];
          rawRepos = data.repos || [];

          // Popular select de criação com conta e orgs
          populateCreateRepoOwners(currentUser, userOrgs);

          // Popular dropdown customizado de filtro por Organização
          populateOrgFilterOptions(currentUser, userOrgs, rawRepos);

          // Renderizar catálogo
          filterAndRenderRepos();
        } else {
          reposListGrid.innerHTML = `
            <div class="repos-empty-state">
              <div class="repos-empty-icon">
                <span class="material-symbols-outlined icon-md">error</span>
              </div>
              <div class="repos-empty-title">Erro ao buscar repositórios</div>
              <div class="repos-empty-desc">${escapeHtml(data?.error || 'Não foi possível carregar a lista do GitHub.')}</div>
            </div>
          `;
        }
      } catch (err) {
        reposListGrid.innerHTML = `
          <div class="repos-empty-state">
            <div class="repos-empty-icon">
              <span class="material-symbols-outlined icon-md">cloud_off</span>
            </div>
            <div class="repos-empty-title">Erro de conexão</div>
            <div class="repos-empty-desc">Falha na comunicação com o servidor local.</div>
          </div>
        `;
      }
    }
  };

  // ---------------------------------------------------------------------------
  // FILTERING & RENDERING
  // ---------------------------------------------------------------------------
  function populateCreateRepoOwners(user, orgs) {
    if (!createRepoOwner) return;
    createRepoOwner.innerHTML = `<option value="${user?.login}">${user?.login} (Conta Pessoal)</option>`;
    if (orgs && orgs.length > 0) {
      orgs.forEach(o => {
        createRepoOwner.innerHTML += `<option value="${o.login}">${o.login} (Organização)</option>`;
      });
    }
  }

  function populateOrgFilterOptions(user, orgs, repos) {
    if (!orgDropdown) return;

    // Contar repositórios por owner
    const counts = { all: repos.length };
    const userLoginLower = (user?.login || '').toLowerCase();
    
    // Obter todos os owners únicos presentes nos repositórios
    const allOwners = new Set();
    if (user?.login) allOwners.add(user.login);
    (orgs || []).forEach(o => { if (o.login) allOwners.add(o.login); });

    repos.forEach(r => {
      const owner = r.owner || (r.full_name ? r.full_name.split('/')[0] : '');
      if (owner) {
        allOwners.add(owner);
        const key = owner.toLowerCase();
        counts[key] = (counts[key] || 0) + 1;
      }
    });

    const options = [
      {
        value: 'all',
        label: 'Todas as contas e organizações',
        icon: 'corporate_fare',
        badge: counts.all || 0,
        subtitle: 'Todos os repositórios acessíveis'
      }
    ];

    if (user?.login) {
      const personalCount = counts[userLoginLower] || 0;
      options.push({
        value: user.login,
        label: `Conta Pessoal: @${user.login}`,
        icon: 'account_circle',
        badge: personalCount,
        subtitle: 'Repositórios pessoais'
      });
    }

    allOwners.forEach(owner => {
      if (owner.toLowerCase() !== userLoginLower) {
        const orgCount = counts[owner.toLowerCase()] || 0;
        options.push({
          value: owner,
          label: `Org: ${owner}`,
          icon: 'apartment',
          badge: orgCount,
          subtitle: 'Organização GitHub'
        });
      }
    });

    orgDropdown.setOptions(options);
    orgDropdown.setValue(currentSelectedOrg || 'all', false);
  }

  function filterAndRenderRepos() {
    let filtered = rawRepos.slice();

    // 1. Filtro por Organização / Owner
    if (currentSelectedOrg && currentSelectedOrg !== 'all') {
      const targetOrg = currentSelectedOrg.toLowerCase();
      filtered = filtered.filter(repo => {
        const owner = (repo.owner || (repo.full_name ? repo.full_name.split('/')[0] : '')).toLowerCase();
        return owner === targetOrg;
      });
    }

    // 2. Filtro por busca textual (nome, descrição, owner)
    if (currentSearchQuery) {
      filtered = filtered.filter(repo => {
        const name = (repo.name || '').toLowerCase();
        const desc = (repo.description || '').toLowerCase();
        const full = (repo.full_name || '').toLowerCase();
        const owner = (repo.owner || '').toLowerCase();
        return name.includes(currentSearchQuery) ||
               desc.includes(currentSearchQuery) ||
               full.includes(currentSearchQuery) ||
               owner.includes(currentSearchQuery);
      });
    }

    renderReposList(filtered, rawRepos.length);
  }

  function renderReposList(repos = [], totalCount = 0) {
    if (reposCountBadge) {
      if (repos.length === totalCount) {
        reposCountBadge.textContent = `${totalCount} repositório(s)`;
      } else {
        reposCountBadge.textContent = `Exibindo ${repos.length} de ${totalCount} repositórios`;
      }
    }

    reposListGrid.innerHTML = '';

    // Estado vazio quando não houver repositórios
    if (repos.length === 0) {
      if (rawRepos.length === 0) {
        reposListGrid.innerHTML = `
          <div class="repos-empty-state">
            <div class="repos-empty-icon">
              <span class="material-symbols-outlined icon-md">inventory_2</span>
            </div>
            <div class="repos-empty-title">Nenhum repositório encontrado</div>
            <div class="repos-empty-desc">
              Não encontramos repositórios na sua conta do GitHub.<br>
              Clique em <strong>Novo Repositório</strong> acima para criar o primeiro!
            </div>
          </div>
        `;
      } else {
        reposListGrid.innerHTML = `
          <div class="repos-empty-state">
            <div class="repos-empty-icon">
              <span class="material-symbols-outlined icon-md">search_off</span>
            </div>
            <div class="repos-empty-title">Nenhum repositório corresponde aos filtros</div>
            <div class="repos-empty-desc">
              Tente buscar por outro termo ou selecione outra organização.
            </div>
            <button id="btn-reset-all-filters" class="btn btn-secondary btn-sm btn-reset-filters" type="button">
              <span class="material-symbols-outlined icon-xs">filter_alt_off</span>
              Limpar Filtros
            </button>
          </div>
        `;

        const btnReset = document.getElementById('btn-reset-all-filters');
        if (btnReset) {
          btnReset.addEventListener('click', () => {
            currentSearchQuery = '';
            currentSelectedOrg = 'all';
            if (reposSearchInput) reposSearchInput.value = '';
            if (btnClearSearch) btnClearSearch.style.display = 'none';
            if (orgDropdown) orgDropdown.setValue('all', false);
            filterAndRenderRepos();
          });
        }
      }
      return;
    }

    // Renderizar cards/linhas
    repos.forEach(repo => {
      const card = document.createElement('div');
      card.className = 'repo-card';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.title = `Abrir Dashboard do projeto ${repo.full_name || repo.name}`;

      const owner = repo.owner || (repo.full_name ? repo.full_name.split('/')[0] : '');
      const isOrg = owner && currentUser && owner.toLowerCase() !== currentUser.login.toLowerCase();

      card.innerHTML = `
        <div class="repo-card-main">
          <div class="repo-top">
            <div class="repo-header-info">
              <div class="repo-icon-wrap" aria-hidden="true">
                <span class="material-symbols-outlined icon-sm">inventory_2</span>
              </div>
              <div class="repo-titles-group">
                ${isOrg ? `<span class="repo-owner-tag"><span class="material-symbols-outlined icon-xs" style="font-size: 13px;">apartment</span> @${escapeHtml(owner)}</span>` : ''}
                <span class="repo-title" title="${escapeHtml(repo.full_name || repo.name)}">
                  ${escapeHtml(repo.name)}
                </span>
              </div>
            </div>

            <span class="repo-visibility-pill ${repo.is_private ? 'private' : 'public'}">
              <span class="material-symbols-outlined icon-xs">${repo.is_private ? 'lock' : 'public'}</span>
              <span>${repo.is_private ? 'Privado' : 'Público'}</span>
            </span>
          </div>

          <p class="repo-desc ${repo.description ? '' : 'empty'}" title="${escapeHtml(repo.description || '')}">
            ${escapeHtml(repo.description || 'Sem descrição no GitHub.')}
          </p>
        </div>

        <div class="repo-footer">
          <div class="repo-footer-left">
            <span class="repo-branch-pill" title="Branch padrão">
              <span class="material-symbols-outlined icon-xs" style="font-size: 14px;">call_split</span>
              ${escapeHtml(repo.default_branch || 'main')}
            </span>

            <button
              class="btn-protect-repo"
              type="button"
              title="Ativar Branch Protection de 1 aprovação nesta branch"
              onclick="event.stopPropagation(); window.protectRepoAction('${escapeHtml(repo.full_name || repo.name)}', '${escapeHtml(repo.default_branch || 'main')}')"
            >
              <span class="material-symbols-outlined icon-xs">shield</span>
              <span>Bloquear main</span>
            </button>
          </div>

          <div class="btn-open-workspace">
            <span>Abrir Dashboard</span>
            <span class="material-symbols-outlined icon-xs">arrow_forward</span>
          </div>
        </div>
      `;

      // Clicar no card abre o Dashboard do repositório
      card.addEventListener('click', async () => {
        card.style.opacity = '0.7';
        try {
          const { ok, data } = await API.selectRepo(repo);
          if (ok) {
            onSelectRepo(data.active_repo);
          }
        } finally {
          card.style.opacity = '1';
        }
      });

      // Suporte a teclado (Enter / Space)
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          card.click();
        }
      });

      reposListGrid.appendChild(card);
    });
  }
}

// -----------------------------------------------------------------------------
// GLOBAL ACTIONS
// -----------------------------------------------------------------------------
window.protectRepoAction = async function(repo_full_name, branch) {
  try {
    const { ok, data } = await API.protectRepo({ repo_full_name, branch, required_approvals: 1 });
    if (ok && data.success) {
      alert(data.message || `Branch ${branch} protegida com sucesso!`);
    } else {
      alert(`Aviso: ${data.error || 'Não foi possível aplicar a regra de proteção'}`);
    }
  } catch (err) {
    alert('Erro ao proteger branch no GitHub.');
  }
};

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
