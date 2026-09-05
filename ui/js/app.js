// =============================================================================
// MAIN APP ORCHESTRATOR & ROUTER (ES MODULES)
// =============================================================================
import { API } from './api.js';
import { Router } from './router.js';
import { initAuthView } from './auth.js';
import { initReposView } from './repos.js';
import { initDashboardView } from './dashboard.js';
import { initFastRefresh } from './fast-refresh.js';

// Screen Elements
const viewAuth = document.getElementById('view-auth');
const viewRepos = document.getElementById('view-repos');
const viewDashboard = document.getElementById('view-dashboard');

function showScreen(screenId) {
  [viewAuth, viewRepos, viewDashboard].forEach(el => {
    if (el) el.style.display = 'none';
  });
  const target = document.getElementById(screenId);
  if (target) target.style.display = target.id === 'view-dashboard' ? 'flex' : 'flex';
}

window.addEventListener('DOMContentLoaded', async () => {
  // 0. Ativar Fast Refresh em tempo real
  initFastRefresh();

  let currentUser = null;
  let currentActiveRepo = null;

  // 1. Dashboard View
  const dashboardView = initDashboardView({
    onBackToRepos: () => {
      Router.navigate('/repos');
    }
  });

  // 2. Repositories View
  const reposView = initReposView({
    onSelectRepo: (repo) => {
      currentActiveRepo = repo;
      Router.navigate(`/workspace/${encodeURIComponent(repo.name)}/project`);
    },
    onLogout: () => {
      currentUser = null;
      currentActiveRepo = null;
      Router.navigate('/auth');
    }
  });

  // 3. Auth View
  initAuthView({
    onLoginSuccess: (user) => {
      currentUser = user;
      const route = Router.getRoute();
      if (route.routeName === 'workspace' && route.repo) {
        Router.navigate(`/workspace/${encodeURIComponent(route.repo)}/${route.subview || 'project'}`, route.query, true);
      } else {
        Router.navigate('/repos');
      }
    }
  });

  // 4. Router Orchestration
  Router.onRouteChange(async (route) => {
    try {
      const status = await API.getStatus();
      const isAuthenticated = status.authenticated && status.user;

      if (!isAuthenticated) {
        currentUser = null;
        currentActiveRepo = null;
        showScreen('view-auth');
        if (route.routeName !== 'auth') {
          Router.navigate('/auth', {}, true);
        }
        return;
      }

      currentUser = status.user;

      if (route.routeName === 'auth') {
        if (status.active_repo) {
          currentActiveRepo = status.active_repo;
          Router.navigate(`/workspace/${encodeURIComponent(status.active_repo.name)}/project`, {}, true);
        } else {
          Router.navigate('/repos', {}, true);
        }
        return;
      }

      if (route.routeName === 'repos') {
        showScreen('view-repos');
        reposView.load(currentUser);
        return;
      }

      if (route.routeName === 'workspace') {
        showScreen('view-dashboard');
        const repoName = route.repo;

        // Se o repo não estiver ativo ou for diferente do atual
        if (!currentActiveRepo || currentActiveRepo.name !== repoName) {
          const reposRes = await API.getRepos();
          let matchedRepo = null;
          if (reposRes.ok && Array.isArray(reposRes.data.repos)) {
            matchedRepo = reposRes.data.repos.find(r => r.name === repoName);
          }

          if (!matchedRepo) {
            matchedRepo = { name: repoName, full_name: repoName };
          }

          await API.selectRepo(matchedRepo);
          currentActiveRepo = matchedRepo;
          await dashboardView.open(matchedRepo, route.subview || 'project', route.query);
        } else {
          // Repositório já ativo, apenas chaveia subview e propaga query params
          dashboardView.switchSubview(route.subview || 'project', route.query, true);
        }
        return;
      }

      // Rota padrão se desconhecida
      Router.navigate('/repos', {}, true);
    } catch (err) {
      console.error('[App] Erro na navegação de rota:', err);
      showScreen('view-auth');
    }
  });

  // 5. Inicializa o Roteador
  Router.init();
});
