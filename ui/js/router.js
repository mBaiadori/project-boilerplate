// =============================================================================
// CENTRALIZED SPA ROUTER (HASH ROUTING, DEEP LINKING & BROWSER HISTORY)
// =============================================================================

class AppRouter {
  constructor() {
    this.listeners = new Set();
    this.guards = new Set();
    this.currentRoute = null;
    this.isNavigating = false;

    // Escuta mudanças de hash e histórico do browser
    window.addEventListener('hashchange', () => this._handleHashChange());
  }

  /**
   * Inicializa o router e processa a URL inicial
   */
  init() {
    this._handleHashChange();
  }

  /**
   * Registra um callback para quando a rota mudar
   * @param {Function} callback (route) => void
   * @returns {Function} Função para desinscrever o listener
   */
  onRouteChange(callback) {
    this.listeners.add(callback);
    if (this.currentRoute) {
      callback(this.currentRoute);
    }
    return () => this.listeners.delete(callback);
  }

  /**
   * Registra uma função guard (pode cancelar ou redirecionar navegação)
   * @param {Function} guard (toRoute, fromRoute) => boolean | string
   */
  registerGuard(guard) {
    this.guards.add(guard);
    return () => this.guards.delete(guard);
  }

  /**
   * Faz o parse da hash atual
   * Ex: #/workspace/my-repo/editor?file=domains/auth.md&line=10
   */
  parseHash(hashString = window.location.hash) {
    let clean = (hashString || '').replace(/^#\/?/, '');
    if (!clean) clean = 'auth';

    const [pathPart, queryPart] = clean.split('?');
    const segments = pathPart.split('/').filter(Boolean);

    const query = {};
    if (queryPart) {
      const searchParams = new URLSearchParams(queryPart);
      for (const [key, value] of searchParams.entries()) {
        query[key] = value;
      }
    }

    let routeName = 'unknown';
    let repo = null;
    let subview = null;

    if (segments[0] === 'auth') {
      routeName = 'auth';
    } else if (segments[0] === 'repos') {
      routeName = 'repos';
    } else if (segments[0] === 'workspace') {
      routeName = 'workspace';
      repo = decodeURIComponent(segments[1] || '');
      subview = segments[2] || 'project';
    } else {
      routeName = segments[0] || 'auth';
    }

    return {
      raw: hashString,
      path: '/' + segments.join('/'),
      segments,
      routeName,
      repo,
      subview,
      query
    };
  }

  /**
   * Obtém a rota ativa atual
   */
  getRoute() {
    if (!this.currentRoute) {
      this.currentRoute = this.parseHash();
    }
    return this.currentRoute;
  }

  /**
   * Navega para um caminho com parâmetros opcionais
   * @param {string} path Ex: '/workspace/repo-name/editor' ou '/repos'
   * @param {object} queryParams Ex: { file: 'domains/auth.md' }
   * @param {boolean} replace Se true, usa replaceState (não adiciona entrada no histórico)
   */
  navigate(path, queryParams = {}, replace = false) {
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    const searchParams = new URLSearchParams();

    Object.entries(queryParams || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        searchParams.set(k, v);
      }
    });

    const queryString = searchParams.toString();
    const newHash = `#/${cleanPath}${queryString ? '?' + queryString : ''}`;

    if (window.location.hash === newHash) {
      return;
    }

    if (replace) {
      const currentUrl = window.location.href.split('#')[0] + newHash;
      window.history.replaceState(null, '', currentUrl);
      this._handleHashChange();
    } else {
      window.location.hash = newHash;
    }
  }

  /**
   * Atualiza ou adiciona parâmetros de query na rota atual sem recarregar a subview
   * @param {object} params Novas queries
   * @param {boolean} replace Padrão true para não poluir o histórico com cada tecla/filtro
   */
  setQuery(params = {}, replace = true) {
    const route = this.getRoute();
    const mergedQuery = { ...route.query, ...params };

    // Remove chaves nulas ou indefinidas
    Object.keys(mergedQuery).forEach(k => {
      if (mergedQuery[k] === undefined || mergedQuery[k] === null || mergedQuery[k] === '') {
        delete mergedQuery[k];
      }
    });

    this.navigate(route.path, mergedQuery, replace);
  }

  /**
   * Manipulador interno de evento hashchange
   */
  async _handleHashChange() {
    if (this.isNavigating) return;
    this.isNavigating = true;

    try {
      const newRoute = this.parseHash();
      const fromRoute = this.currentRoute;

      // Executa Guards
      for (const guard of this.guards) {
        const result = await guard(newRoute, fromRoute);
        if (result === false) {
          // Reverte hash anterior se cancelado
          if (fromRoute && fromRoute.raw) {
            window.location.hash = fromRoute.raw;
          }
          this.isNavigating = false;
          return;
        } else if (typeof result === 'string') {
          // Redirecionamento ordenado pelo guard
          this.isNavigating = false;
          this.navigate(result, {}, true);
          return;
        }
      }

      this.currentRoute = newRoute;

      // Notifica todos os ouvintes
      this.listeners.forEach(cb => {
        try {
          cb(newRoute, fromRoute);
        } catch (err) {
          console.error('[Router] Erro no listener de rota:', err);
        }
      });
    } finally {
      this.isNavigating = false;
    }
  }
}

export const Router = new AppRouter();
