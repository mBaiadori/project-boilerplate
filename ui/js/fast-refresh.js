// =============================================================================
// FAST REFRESH CLIENT (LIVE RELOAD VIA SERVER-SENT EVENTS)
// =============================================================================

export function initFastRefresh() {
  let eventSource = null;
  let isReconnecting = false;

  function connect() {
    eventSource = new EventSource('/api/events');

    eventSource.onopen = () => {
      if (isReconnecting) {
        console.log('[Fast Refresh] Reconectado com sucesso!');
        isReconnecting = false;
      }
    };

    eventSource.addEventListener('reload', (e) => {
      console.log('[Fast Refresh] Alteração de arquivo detectada no servidor! Recarregando...');
      showReloadToast();
      setTimeout(() => {
        window.location.reload();
      }, 250);
    });

    eventSource.onerror = () => {
      isReconnecting = true;
      eventSource.close();
      // Retry in 1.5s (in case python server is restarting)
      setTimeout(connect, 1500);
    };
  }

  function showReloadToast() {
    let toast = document.getElementById('fast-refresh-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'fast-refresh-toast';
      toast.style.position = 'fixed';
      toast.style.bottom = '20px';
      toast.style.right = '20px';
      toast.style.background = 'var(--md-sys-color-primary, #0284c7)';
      toast.style.color = 'var(--md-sys-color-on-primary, #ffffff)';
      toast.style.padding = '8px 14px';
      toast.style.borderRadius = '8px';
      toast.style.fontWeight = '600';
      toast.style.fontSize = '12px';
      toast.style.zIndex = '99999';
      toast.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
      toast.style.display = 'inline-flex';
      toast.style.alignItems = 'center';
      toast.style.gap = '6px';
      toast.innerHTML = '<span class="material-symbols-outlined icon-xs">bolt</span> Fast Refresh: Atualizando...';
      document.body.appendChild(toast);
    }
  }

  connect();
}
