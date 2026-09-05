// =============================================================================
// COMPONENT: VERTICAL PANEL RESIZERS WITH LOCALSTORAGE PERSISTENCE
// =============================================================================

const STORAGE_KEY = 'governance_workbench_widths';
const SIDEBAR_COLLAPSED_KEY = 'governance_sidebar_collapsed';

const DEFAULT_WIDTHS = {
  sidebar: 175,
  tree: 260,
  ai: 360
};

export function initPanelResizers() {
  const sidebarPane = document.getElementById('dash-sidebar-nav') || document.querySelector('.dash-sidebar-nav');
  const treePane = document.getElementById('workbench-tree-pane');
  const aiPane = document.getElementById('workbench-ai-pane');
  const btnToggleGlobalSidebar = document.getElementById('btn-toggle-global-sidebar');

  const resizerSidebar = document.getElementById('resizer-sidebar');
  const resizerTree = document.getElementById('resizer-tree');
  const resizerAi = document.getElementById('resizer-ai');

  // 1. Restore saved widths from localStorage
  let savedWidths = DEFAULT_WIDTHS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      savedWidths = { ...DEFAULT_WIDTHS, ...JSON.parse(raw) };
    }
  } catch (e) {
    savedWidths = DEFAULT_WIDTHS;
  }

  // 2. Restore sidebar collapsed state
  const isSidebarCollapsed = localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  if (sidebarPane) {
    if (isSidebarCollapsed) {
      sidebarPane.classList.add('collapsed');
      sidebarPane.style.width = '52px';
    } else if (savedWidths.sidebar) {
      sidebarPane.style.width = `${Math.max(120, Math.min(340, savedWidths.sidebar))}px`;
    }
  }

  if (treePane && savedWidths.tree) {
    treePane.style.width = `${Math.max(160, Math.min(520, savedWidths.tree))}px`;
  }
  if (aiPane && savedWidths.ai) {
    aiPane.style.width = `${Math.max(240, Math.min(650, savedWidths.ai))}px`;
  }

  function saveWidths() {
    try {
      if (sidebarPane && !sidebarPane.classList.contains('collapsed')) {
        savedWidths.sidebar = sidebarPane.offsetWidth;
      }
      const current = {
        sidebar: savedWidths.sidebar,
        tree: treePane ? treePane.offsetWidth : DEFAULT_WIDTHS.tree,
        ai: aiPane ? aiPane.offsetWidth : DEFAULT_WIDTHS.ai
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch (e) {}
  }

  // 3. Sidebar Collapse Toggle Button
  if (btnToggleGlobalSidebar && sidebarPane) {
    btnToggleGlobalSidebar.addEventListener('click', () => {
      const willCollapse = !sidebarPane.classList.contains('collapsed');
      sidebarPane.classList.toggle('collapsed', willCollapse);
      
      if (willCollapse) {
        sidebarPane.style.width = '52px';
      } else {
        const restoreWidth = Math.max(140, savedWidths.sidebar || DEFAULT_WIDTHS.sidebar);
        sidebarPane.style.width = `${restoreWidth}px`;
      }

      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, willCollapse ? 'true' : 'false');
      } catch (e) {}
    });
  }

  // 4. Setup Resizer for Global Sidebar (Left Nav)
  if (resizerSidebar && sidebarPane) {
    setupHorizontalDrag({
      resizer: resizerSidebar,
      onMove: (deltaX, startWidth) => {
        if (sidebarPane.classList.contains('collapsed')) {
          sidebarPane.classList.remove('collapsed');
          localStorage.setItem(SIDEBAR_COLLAPSED_KEY, 'false');
        }
        const newWidth = Math.max(120, Math.min(360, startWidth + deltaX));
        sidebarPane.style.width = `${newWidth}px`;
      },
      getTargetWidth: () => sidebarPane.offsetWidth,
      onEnd: saveWidths
    });
  }

  // 5. Setup Resizer for Docs Explorer Tree
  if (resizerTree && treePane) {
    setupHorizontalDrag({
      resizer: resizerTree,
      onMove: (deltaX, startWidth) => {
        const newWidth = Math.max(150, Math.min(550, startWidth + deltaX));
        treePane.style.width = `${newWidth}px`;
      },
      getTargetWidth: () => treePane.offsetWidth,
      onEnd: saveWidths
    });
  }

  // 6. Setup Resizer for AI Chat Pane (from right)
  if (resizerAi && aiPane) {
    setupHorizontalDrag({
      resizer: resizerAi,
      onMove: (deltaX, startWidth) => {
        const newWidth = Math.max(220, Math.min(650, startWidth - deltaX));
        aiPane.style.width = `${newWidth}px`;
      },
      getTargetWidth: () => aiPane.offsetWidth,
      onEnd: saveWidths
    });
  }
}

function setupHorizontalDrag({ resizer, onMove, getTargetWidth, onEnd }) {
  let isDragging = false;
  let startX = 0;
  let startWidth = 0;

  resizer.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startWidth = getTargetWidth();

    document.body.classList.add('is-resizing');
    resizer.classList.add('active');

    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - startX;
    onMove(deltaX, startWidth);
  });

  document.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    document.body.classList.remove('is-resizing');
    resizer.classList.remove('active');
    if (onEnd) onEnd();
  });
}
