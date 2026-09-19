// =============================================================================
// MAIN APP ORCHESTRATOR & ROUTER (ES MODULES)
// =============================================================================
import { API } from './api.js';
import { Router } from './router.js';
import { initAuthView } from './auth.js';
import { initReposView } from './repos.js';
import { initDashboardView } from './dashboard.js';
import { initFastRefresh } from './fast-refresh.js';

function showScreen(screenId) {
  const vAuth = document.getElementById('view-auth');
  const vRepos = document.getElementById('view-repos');
  const vDash = document.getElementById('view-dashboard');
  [vAuth, vRepos, vDash].forEach(el => {
    if (el) el.style.display = 'none';
  });
  const target = document.getElementById(screenId);
  if (target) {
    target.style.display = 'flex';
  }
}

async function initApp() {
  try {
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
        Router.navigate(`/workspace/${encodeURIComponent(repo.name)}/editor`);
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
        showScreen('view-repos');
        reposView.load(user);
        Router.navigate('/repos', {}, true);
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
          showScreen('view-repos');
          reposView.load(currentUser);
          Router.navigate('/repos', {}, true);
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
            await dashboardView.open(matchedRepo, route.subview || 'editor', route.query);
          } else {
            // Repositório já ativo, garante abertura inicial ou chaveia subview
            if (!dashboardView.getActiveRepo()) {
              await dashboardView.open(currentActiveRepo, route.subview || 'editor', route.query);
            } else {
              dashboardView.switchSubview(route.subview || 'editor', route.query, true);
            }
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
  } catch (initErr) {
    console.error('[App] Critical error during initApp:', initErr);
    showScreen('view-auth');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
