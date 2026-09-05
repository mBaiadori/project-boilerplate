// =============================================================================
// GOVERNANCE BOILERPLATE — GITHUB AUTH & BRANCH PROTECTION (1-OF-N APPROVALS)
// =============================================================================

// Screens
const viewAuth = document.getElementById('view-auth');
const viewRepos = document.getElementById('view-repos');

// Screen 1: Auth
const patTokenInput = document.getElementById('pat-token-input');
const btnTokenLogin = document.getElementById('btn-token-login');

// Screen 2: Repos
const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');
const userLogin = document.getElementById('user-login');
const btnLogout = document.getElementById('btn-logout');
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
const reposCountBadge = document.getElementById('repos-count-badge');
const reposListGrid = document.getElementById('repos-list-grid');

// =============================================================================
// INITIALIZATION & APP STATE
// =============================================================================
async function checkStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();

    if (data.authenticated && data.user) {
      showScreen('view-repos');
      loadReposView(data.user);
    } else {
      showScreen('view-auth');
    }
  } catch (err) {
    showScreen('view-auth');
  }
}

function showScreen(screenId) {
  viewAuth.style.display = 'none';
  viewRepos.style.display = 'none';
  const target = document.getElementById(screenId);
  if (target) target.style.display = 'flex';
}

// =============================================================================
// SCREEN 1: AUTHENTICATION
// =============================================================================
function setupAuthEvents() {
  btnTokenLogin.addEventListener('click', async () => {
    const token = patTokenInput.value.trim();
    if (!token) {
      alert('Por favor, cole seu token PAT do GitHub no campo.');
      return;
    }

    btnTokenLogin.disabled = true;
    btnTokenLogin.textContent = 'Autenticando no GitHub...';

    try {
      const res = await fetch('/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showScreen('view-repos');
        loadReposView(data.user);
      } else {
        alert(`Erro de autenticação: ${data.error || 'Token inválido'}`);
      }
    } catch (err) {
      alert('Erro de comunicação com o servidor local.');
    } finally {
      btnTokenLogin.disabled = false;
      btnTokenLogin.innerHTML = '<span class="material-symbols-outlined icon-xs">login</span> Conectar Conta & Acessar Repositórios';
    }
  });
}

// =============================================================================
// SCREEN 2: REPOSITORIES & CREATION WITH BRANCH PROTECTION
// =============================================================================
function setupReposEvents() {
  btnLogout.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    showScreen('view-auth');
  });

  btnOpenCreateRepo.addEventListener('click', () => {
    createRepoCard.style.display = 'flex';
  });

  btnCancelCreate.addEventListener('click', () => {
    createRepoCard.style.display = 'none';
  });

  btnSubmitCreateRepo.addEventListener('click', handleCreateRepoWithProtection);
}

async function loadReposView(user) {
  if (user) {
    userAvatar.src = user.avatar_url;
    userName.textContent = user.name || user.login;
    userLogin.textContent = `@${user.login}`;
  }

  reposListGrid.innerHTML = '<div class="loading-state">Buscando repositórios na sua conta do GitHub...</div>';

  try {
    const res = await fetch('/api/repos');
    const data = await res.json();

    if (data.user) {
      userAvatar.src = data.user.avatar_url;
      userName.textContent = data.user.name || data.user.login;
      userLogin.textContent = `@${data.user.login}`;
    }

    createRepoOwner.innerHTML = `<option value="${data.user?.login}">${data.user?.login} (Conta Pessoal)</option>`;
    if (data.orgs && data.orgs.length > 0) {
      data.orgs.forEach(o => {
        createRepoOwner.innerHTML += `<option value="${o.login}">${o.login} (Organização)</option>`;
      });
    }

    renderReposList(data.repos || []);
  } catch (err) {
    reposListGrid.innerHTML = '<div class="empty-state">Erro ao buscar repositórios no GitHub.</div>';
  }
}

function renderReposList(repos = []) {
  reposCountBadge.textContent = `${repos.length} repositório(s)`;
  reposListGrid.innerHTML = '';

  if (repos.length === 0) {
    reposListGrid.innerHTML = `
      <div class="empty-state">
        Nenhum repositório encontrado na sua conta do GitHub.<br>
        Clique em <strong>Criar Novo Repositório</strong> acima para criar o primeiro!
      </div>
    `;
    return;
  }

  repos.forEach(repo => {
    const card = document.createElement('div');
    card.className = 'repo-card';
    card.innerHTML = `
      <div>
        <div class="repo-top">
          <span class="repo-title" style="display: flex; align-items: center; gap: 6px;">
            <span class="material-symbols-outlined icon-sm">inventory_2</span>
            ${escapeHtml(repo.name)}
          </span>
          <span class="pill ${repo.is_private ? '' : 'public'}" style="display: inline-flex; align-items: center; gap: 4px;">
            <span class="material-symbols-outlined icon-xs">${repo.is_private ? 'lock' : 'public'}</span>
            ${repo.is_private ? 'Privado' : 'Público'}
          </span>
        </div>
        <p class="repo-desc">${escapeHtml(repo.description || 'Sem descrição no GitHub.')}</p>
      </div>

      <div class="repo-tags">
        <span class="pill">branch: ${escapeHtml(repo.default_branch || 'main')}</span>
        <button class="btn btn-secondary btn-sm" onclick="protectExistingRepo('${repo.full_name}', '${repo.default_branch || 'main'}')">
          <span class="material-symbols-outlined icon-xs">shield</span> Bloquear branch main (1 aprovação)
        </button>
        <a href="${repo.html_url}" target="_blank" class="repo-link">Ver no GitHub ↗</a>
      </div>
    `;

    reposListGrid.appendChild(card);
  });
}

window.protectExistingRepo = async function(repo_full_name, branch) {
  try {
    const res = await fetch('/api/repos/protect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo_full_name, branch, required_approvals: 1 })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      alert(data.message);
    } else {
      alert(`Aviso: ${data.error || 'Não foi possível aplicar a regra de proteção'}`);
    }
  } catch (err) {
    alert('Erro de comunicação ao aplicar proteção de branch.');
  }
};

async function handleCreateRepoWithProtection() {
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
  btnSubmitCreateRepo.textContent = 'Criando no GitHub e aplicando regra de proteção...';

  try {
    const res = await fetch('/api/repos/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, owner, description, enable_protection, required_approvals, is_private })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      alert(`Repositório criado no GitHub!\n${data.message}`);
      createRepoCard.style.display = 'none';
      createRepoName.value = '';
      await loadReposView();
    } else {
      alert(`Erro na criação: ${data.error || 'Falha na API'}`);
    }
  } catch (err) {
    alert('Erro de comunicação com o servidor.');
  } finally {
    btnSubmitCreateRepo.disabled = false;
    btnSubmitCreateRepo.innerHTML = '<span class="material-symbols-outlined icon-xs">rocket_launch</span> Criar no GitHub com Branch Protection';
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

window.addEventListener('DOMContentLoaded', () => {
  setupAuthEvents();
  setupReposEvents();
  checkStatus();
});
