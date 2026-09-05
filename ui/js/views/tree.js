// =============================================================================
// VIEW MODULE: ÁRVORE DE DOCUMENTOS & EXPLORER (CONFLUENCE-GRADE)
// =============================================================================
import { API } from "../api.js";

export function initTreeView({ onOpenFile, onWorkspaceChanged }) {
  const treeContainer = document.getElementById("tree-nodes-container");
  const btnTreeNewFile = document.getElementById("btn-tree-new-file");
  const btnTreeRefresh = document.getElementById("btn-tree-refresh");
  const treeSearchInput = document.getElementById("tree-search-input");

  // Collapse / Expand Tree Pane
  const workbenchTreePane = document.getElementById("workbench-tree-pane");
  const btnToggleTreePane = document.getElementById("btn-toggle-tree-pane");
  const btnExpandTreePane = document.getElementById("btn-expand-tree-pane");

  // Inline Creator Panel
  const treeCreatePanel = document.getElementById("tree-create-panel");
  const btnCancelTreeCreate = document.getElementById("btn-cancel-tree-create");
  const btnConfirmCancelTree = document.getElementById(
    "btn-confirm-cancel-tree",
  );
  const btnConfirmCreateTree = document.getElementById(
    "btn-confirm-create-tree",
  );
  const treeItemName = document.getElementById("tree-item-name");
  const treeItemType = document.getElementById("tree-item-type");
  const treeItemPathPreview = document.getElementById("tree-item-path-preview");

  // Rename Modal Elements
  const renameModal = document.getElementById("rename-modal");
  const renameOldPath = document.getElementById("rename-old-path");
  const renameNewPath = document.getElementById("rename-new-path");
  const btnCloseRenameModal = document.getElementById("btn-close-rename-modal");
  const btnCancelRename = document.getElementById("btn-cancel-rename");
  const btnConfirmRename = document.getElementById("btn-confirm-rename");

  let customCreationParentFolder = "";
  let activeDocPath = "";
  let cachedTreeNodes = [];

  // Sidebar Collapse / Expand
  if (btnToggleTreePane) {
    btnToggleTreePane.addEventListener("click", () => {
      workbenchTreePane.style.display = "none";
      if (btnExpandTreePane) btnExpandTreePane.style.display = "block";
    });
  }
  if (btnExpandTreePane) {
    btnExpandTreePane.addEventListener("click", () => {
      workbenchTreePane.style.display = "flex";
      btnExpandTreePane.style.display = "none";
    });
  }

  // Path Computation
  function computeTargetPath() {
    const rawName = (treeItemName.value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");
    const type = treeItemType.value;
    const cleanName = rawName || "novo-item";

    let path = "";
    if (customCreationParentFolder) {
      path =
        type === "folder"
          ? `${customCreationParentFolder}/${cleanName}`
          : `${customCreationParentFolder}/${cleanName}.md`;
    } else if (type === "domain-ideacao") {
      path = `domains/${cleanName}/ideacao.md`;
    } else if (type === "domain-kpis") {
      path = `domains/${cleanName}/kpis.md`;
    } else if (type === "bdd-specs") {
      path = `specs/${cleanName}.md`;
    } else if (type === "folder") {
      path = `domains/${cleanName}`;
    } else {
      path = `${cleanName}.md`;
    }

    treeItemPathPreview.innerHTML = `Destino: <code>${path}</code>`;
    return { path, is_folder: type === "folder", cleanName, type };
  }

  treeItemName.addEventListener("input", computeTargetPath);
  treeItemType.addEventListener("change", computeTargetPath);

  btnTreeNewFile.addEventListener("click", () => {
    customCreationParentFolder = "";
    treeItemName.value = "";
    treeCreatePanel.style.display = "flex";
    computeTargetPath();
    treeItemName.focus();
  });

  btnTreeRefresh.addEventListener("click", loadDocumentTree);

  // Search Filter
  if (treeSearchInput) {
    treeSearchInput.addEventListener("input", (e) => {
      const query = (e.target.value || "").trim().toLowerCase();
      filterTree(query);
    });
  }

  function filterTree(query) {
    if (!query) {
      renderTree(cachedTreeNodes);
      return;
    }

    function matchNode(node) {
      const nameMatch = node.name && node.name.toLowerCase().includes(query);
      const pathMatch = node.path && node.path.toLowerCase().includes(query);
      if (node.type === "file") {
        return nameMatch || pathMatch ? node : null;
      }
      if (node.type === "dir") {
        const filteredChildren = (node.children || [])
          .map(matchNode)
          .filter(Boolean);
        if (nameMatch || filteredChildren.length > 0) {
          return { ...node, children: filteredChildren };
        }
      }
      return null;
    }

    const filtered = cachedTreeNodes.map(matchNode).filter(Boolean);
    renderTree(filtered);
  }

  const closeTreeCreatePanel = () => {
    treeCreatePanel.style.display = "none";
    customCreationParentFolder = "";
  };
  btnCancelTreeCreate.addEventListener("click", closeTreeCreatePanel);
  btnConfirmCancelTree.addEventListener("click", closeTreeCreatePanel);

  btnConfirmCreateTree.addEventListener("click", async () => {
    const { path, is_folder, cleanName, type } = computeTargetPath();
    if (!treeItemName.value.trim()) {
      alert("Informe o nome do item.");
      return;
    }

    let initialContent = "";
    if (type === "domain-ideacao") {
      initialContent = `# Domínio: ${cleanName.toUpperCase()}\n\n> Bounded Context: \`${cleanName}\` — Tier 1\n\n## Visão de Negócio\nObjetivos e finalidade deste domínio.\n\n## Entidades Oficiais\n- \`${cleanName}_id\`: Identificador único.\n`;
    } else if (type === "domain-kpis") {
      initialContent = `# Invariantes & KPIs: ${cleanName.toUpperCase()}\n\n- SLA de Resposta: < 200ms\n- Disponibilidade: 99.99%\n`;
    } else if (type === "bdd-specs") {
      initialContent = `# Cenários BDD: ${cleanName.toUpperCase()}\n\nFeature: Gestão de ${cleanName}\n\n  Scenario: Execução com Sucesso\n    Given que o usuário possui permissão\n    When solicita a ação\n    Then a operação é aprovada\n`;
    }

    try {
      const { ok, data } = await API.createProjectFile({
        path,
        is_folder,
        content: initialContent,
      });
      if (ok && data.success) {
        closeTreeCreatePanel();
        cachedTreeNodes = data.tree || [];
        renderTree(cachedTreeNodes);
        if (onWorkspaceChanged) onWorkspaceChanged();
        if (!is_folder && onOpenFile) {
          activeDocPath = path;
          onOpenFile(path);
        }
      }
    } catch (err) {
      alert("Erro ao criar item na árvore.");
    }
  });

  // Rename Modal Operations
  function openRenameModal(path) {
    if (renameModal && renameOldPath && renameNewPath) {
      renameOldPath.value = path;
      renameNewPath.value = path;
      renameModal.style.display = "flex";
      renameNewPath.focus();
      renameNewPath.select();
    }
  }

  function closeRenameModal() {
    if (renameModal) renameModal.style.display = "none";
  }

  if (btnCloseRenameModal)
    btnCloseRenameModal.addEventListener("click", closeRenameModal);
  if (btnCancelRename)
    btnCancelRename.addEventListener("click", closeRenameModal);

  if (btnConfirmRename) {
    btnConfirmRename.addEventListener("click", async () => {
      const old_path = renameOldPath.value.trim();
      const new_path = renameNewPath.value.trim();

      if (!new_path || new_path === old_path) {
        closeRenameModal();
        return;
      }

      try {
        const { ok, data } = await API.renameProjectFile({
          old_path,
          new_path,
        });
        if (ok && data.success) {
          closeRenameModal();
          cachedTreeNodes = data.tree || [];
          renderTree(cachedTreeNodes);
          if (onWorkspaceChanged) onWorkspaceChanged();
          if (activeDocPath === old_path && onOpenFile) {
            activeDocPath = new_path;
            onOpenFile(new_path);
          }
        } else {
          alert(`Erro ao renomear: ${data.error || "Falha na operação"}`);
        }
      } catch (e) {
        alert("Erro ao conectar com o servidor para renomear.");
      }
    });
  }

  async function loadDocumentTree() {
    treeContainer.innerHTML =
      '<div class="loading-state">Carregando documentos...</div>';
    try {
      const data = await API.getProjectTree();
      cachedTreeNodes = data.tree || [];
      renderTree(cachedTreeNodes);
    } catch (err) {
      treeContainer.innerHTML =
        '<div class="empty-state">Erro ao carregar estrutura de arquivos.</div>';
    }
  }

  function renderTree(nodes = []) {
    treeContainer.innerHTML = "";

    // Filtrar para exibir APENAS a estrutura de domínios (removendo templates, engenharia, .github e index.md)
    let domainNodes = [];
    const domainFolder = nodes.find(
      (n) => (n.name === "domains" || n.path === "domains") && n.type === "dir",
    );
    if (domainFolder && domainFolder.children) {
      domainNodes = domainFolder.children;
    } else {
      domainNodes = nodes.filter((n) => {
        const p = (n.path || n.name || "").toLowerCase();
        return (
          !p.startsWith("templates") &&
          !p.startsWith("engenharia") &&
          !p.startsWith("patterns") &&
          !p.startsWith(".github") &&
          p !== "index.md"
        );
      });
    }

    if (!domainNodes || domainNodes.length === 0) {
      treeContainer.innerHTML = `
        <div class="tree-empty-state" style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 28px 14px; gap: 8px; width: 100%; box-sizing: border-box;">
          <div style="margin-bottom: 4px;"><span class="material-symbols-outlined icon-xl" style="color: var(--md-sys-color-outline);">account_tree</span></div>
          <strong style="font-size: 13px; font-weight: 600; color: var(--text-normal); margin: 0;">Nenhum documento cadastrado</strong>
          <p style="font-size: 11px; color: var(--text-muted); line-height: 1.4; margin: 0;">Crie bounded contexts e especificações em <code>domains/</code>.</p>
          <button class="btn btn-primary btn-sm" style="margin-top: 6px; width: 100%; font-size: 11.5px; padding: 6px 10px; display: inline-flex; align-items: center; justify-content: center; gap: 4px;" onclick="document.getElementById('btn-tree-new-file').click()">
            <span>+ Novo Documento</span>
          </button>
        </div>
      `;
      return;
    }

    domainNodes.forEach((node) => {
      treeContainer.appendChild(createTreeNode(node));
    });
  }

  function createTreeNode(node) {
    const el = document.createElement("div");
    el.className = "tree-node";

    if (node.type === "dir") {
      const folderHeader = document.createElement("div");
      folderHeader.className = "tree-folder";
      folderHeader.innerHTML = `
        <div class="tree-folder-left">
          <span class="tree-caret expanded">›</span>
          <span class="tree-folder-name">${escapeHtml(node.name)}</span>
        </div>
        <div class="tree-folder-actions">
          <button class="btn-tree-action" title="Novo arquivo" onclick="window.treeAddInside('${node.path}')"><span class="material-symbols-outlined icon-xs">add</span></button>
          <button class="btn-tree-action" title="Renomear pasta" onclick="window.treeRenamePath('${node.path}')"><span class="material-symbols-outlined icon-xs">edit</span></button>
          <button class="btn-tree-action delete" title="Excluir pasta" onclick="window.treeDeletePath('${node.path}')"><span class="material-symbols-outlined icon-xs">delete</span></button>
        </div>
      `;

      const childrenBox = document.createElement("div");
      childrenBox.className = "tree-children";

      folderHeader.addEventListener("click", (e) => {
        if (e.target.closest(".tree-folder-actions")) return;
        const caret = folderHeader.querySelector(".tree-caret");
        const isCollapsed = childrenBox.classList.toggle("collapsed");
        caret.classList.toggle("expanded", !isCollapsed);
      });

      if (node.children && node.children.length > 0) {
        node.children.forEach((child) => {
          childrenBox.appendChild(createTreeNode(child));
        });
      }

      el.appendChild(folderHeader);
      el.appendChild(childrenBox);
    } else {
      const fileItem = document.createElement("div");
      fileItem.className = `tree-file-item ${node.path === activeDocPath ? "active" : ""}`;

      let dotClass = "dot-default";
      if (node.badge === "T0") dotClass = "dot-t0";
      else if (node.badge === "T1") dotClass = "dot-t1";
      else if (node.badge === "T2") dotClass = "dot-t2";

      fileItem.innerHTML = `
        <div class="tree-file-left">
          <span class="tree-dot ${dotClass}"></span>
          <span class="tree-file-name">${escapeHtml(node.name)}</span>
        </div>
        <div class="tree-file-right">
          ${node.badge ? `<span class="tree-badge-mini ${node.badge.toLowerCase()}">${node.badge}</span>` : ""}
          <div class="tree-file-actions">
            ${
              node.path !== "index.md"
                ? `
              <button class="btn-tree-action" title="Renomear" onclick="window.treeRenamePath('${node.path}')"><span class="material-symbols-outlined icon-xs">edit</span></button>
              <button class="btn-tree-action delete" title="Excluir" onclick="window.treeDeletePath('${node.path}')"><span class="material-symbols-outlined icon-xs">delete</span></button>
            `
                : ""
            }
          </div>
        </div>
      `;

      fileItem.addEventListener("click", (e) => {
        if (e.target.closest(".tree-file-actions")) return;
        document
          .querySelectorAll(".tree-file-item")
          .forEach((f) => f.classList.remove("active"));
        fileItem.classList.add("active");
        activeDocPath = node.path;
        if (onOpenFile) onOpenFile(node.path);
      });

      el.appendChild(fileItem);
    }

    return el;
  }

  // Global window hooks for context actions
  window.treeAddInside = function (dirPath) {
    const panel = document.getElementById("tree-create-panel");
    const nameInput = document.getElementById("tree-item-name");
    if (panel && nameInput) {
      customCreationParentFolder = dirPath;
      nameInput.value = "";
      panel.style.display = "flex";
      document.getElementById("tree-item-path-preview").innerHTML =
        `Destino: <code>${dirPath}/novo-arquivo.md</code>`;
      nameInput.focus();
    }
  };

  window.treeRenamePath = function (path) {
    openRenameModal(path);
  };

  window.treeDeletePath = async function (path) {
    if (
      confirm(
        `Tem certeza que deseja excluir "${path}"? Esta alteração será registrada no workspace e consolidada no PR.`,
      )
    ) {
      try {
        const { ok, data } = await API.deleteProjectFile(path);
        if (ok && data.success) {
          cachedTreeNodes = data.tree || [];
          renderTree(cachedTreeNodes);
          if (onWorkspaceChanged) onWorkspaceChanged();
          if (activeDocPath === path && onOpenFile) {
            activeDocPath = "";
            onOpenFile("");
          }
        }
      } catch (e) {
        alert("Erro ao excluir item.");
      }
    }
  };

  return {
    loadDocumentTree,
    setActiveDoc(path) {
      activeDocPath = path;
      document.querySelectorAll(".tree-file-item").forEach((el) => {
        const nameSpan = el.querySelector(".tree-file-name");
        if (nameSpan && path.endsWith(nameSpan.textContent)) {
          el.classList.add("active");
        } else {
          el.classList.remove("active");
        }
      });
    },
  };
}

function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
