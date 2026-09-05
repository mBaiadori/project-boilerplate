// =============================================================================
// VIEW MODULE: TEMPLATE STORE & CATÁLOGO DE TEMPLATES (S & PROJETO)
// =============================================================================
import { API } from "../api.js";

export function initTemplatesView({ onUseTemplateInEditor }) {
  const templatesGridContainer = document.getElementById(
    "templates-grid-container",
  );
  const btnOpenNewTemplate = document.getElementById("btn-open-new-template");
  const btnOpenTplAiDirect = document.getElementById("btn-open-tpl-ai-direct");
  const tabStoreAll = document.getElementById("tab-store-all");
  const tabStoreProject = document.getElementById("tab-store-project");
  const countInstalledTpls = document.getElementById("count-installed-tpls");
  const storeCategoryFilters = document.getElementById(
    "store-category-filters",
  );
  const storeSearchInput = document.getElementById("store-search-input");

  // Modal Elements
  const templateEditorModal = document.getElementById("template-editor-modal");
  const btnCloseTplModal = document.getElementById("btn-close-tpl-modal");
  const btnCancelTplModal = document.getElementById("btn-cancel-tpl-modal");
  const btnSaveTplModal = document.getElementById("btn-save-tpl-modal");
  const tplModalTitle = document.getElementById("tpl-modal-title");
  const tplIdInput = document.getElementById("tpl-id-input");
  const tplTitleInput = document.getElementById("tpl-title-input");
  const tplCategoryInput = document.getElementById("tpl-category-input");
  const tplDescInput = document.getElementById("tpl-desc-input");
  const tplFilenameInput = document.getElementById("tpl-filename-input");
  const tplAssistantInput = document.getElementById("tpl-assistant-input");
  const tplContentInput = document.getElementById("tpl-content-input");
  const tplCreatePrCheck = document.getElementById("tpl-create-pr-check");
  const tplAiIdeaInput = document.getElementById("tpl-ai-idea-input");
  const btnGenerateTplAi = document.getElementById("btn-generate-tpl-ai");

  let currentTab = "store"; // 'store' | 'project'
  let currentCategory = "all";
  let searchQuery = "";
  let cachedStoreTemplates = [];
  let cachedInstalledTemplates = [];

  // 1. Tab Switching
  if (tabStoreAll) {
    tabStoreAll.addEventListener("click", () => {
      currentTab = "store";
      tabStoreAll.classList.add("active");
      tabStoreProject.classList.remove("active");
      renderTemplates();
    });
  }
  if (tabStoreProject) {
    tabStoreProject.addEventListener("click", () => {
      currentTab = "project";
      tabStoreProject.classList.add("active");
      tabStoreAll.classList.remove("active");
      renderTemplates();
    });
  }

  // 2. Category Filters
  if (storeCategoryFilters) {
    storeCategoryFilters.addEventListener("click", (e) => {
      const chip = e.target.closest(".store-filter-chip");
      if (!chip) return;
      document
        .querySelectorAll(".store-filter-chip")
        .forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      currentCategory = chip.dataset.category || "all";
      renderTemplates();
    });
  }

  // 3. Search Input
  if (storeSearchInput) {
    storeSearchInput.addEventListener("input", () => {
      searchQuery = storeSearchInput.value.trim().toLowerCase();
      renderTemplates();
    });
  }

  // 4. Modal Triggers
  if (btnOpenNewTemplate) {
    btnOpenNewTemplate.addEventListener("click", () =>
      openTemplateEditorModal(),
    );
  }
  if (btnOpenTplAiDirect) {
    btnOpenTplAiDirect.addEventListener("click", () => {
      openTemplateEditorModal();
      if (tplAiIdeaInput) tplAiIdeaInput.focus();
    });
  }

  function openTemplateEditorModal(tpl = null) {
    if (tpl) {
      tplModalTitle.textContent = `Customizar Template: ${tpl.title}`;
      tplIdInput.value = tpl.id || "";
      tplTitleInput.value = tpl.title || "";
      tplCategoryInput.value = tpl.category || "";
      tplDescInput.value = tpl.description || "";
      tplFilenameInput.value = tpl.default_filename || "";
      tplAssistantInput.value = tpl.assistant_prompt || "";
      tplContentInput.value = tpl.content || "";
    } else {
      tplModalTitle.textContent = "Novo Template";
      tplIdInput.value = "";
      tplTitleInput.value = "";
      tplCategoryInput.value = "Domain-Driven Design";
      tplDescInput.value = "";
      tplFilenameInput.value = "novo-template.md";
      tplAssistantInput.value = "";
      tplContentInput.value =
        '---\nid: "custom-template"\ntitle: "Novo Template"\ntype: "spec"\nversion: "1.0.0"\nstatus: "draft"\nlayer: "L4_ARTIFACT"\n---\n\n# Novo Documento\n\nDescreva as seções oficiais aqui...\n';
    }
    tplAiIdeaInput.value = "";
    templateEditorModal.style.display = "flex";
  }

  function closeTemplateEditorModal() {
    templateEditorModal.style.display = "none";
  }

  btnCloseTplModal.addEventListener("click", closeTemplateEditorModal);
  btnCancelTplModal.addEventListener("click", closeTemplateEditorModal);

  templateEditorModal.addEventListener("click", (e) => {
    if (e.target === templateEditorModal) closeTemplateEditorModal();
  });

  // AI Template Generator Assistant
  btnGenerateTplAi.addEventListener("click", async () => {
    const idea = tplAiIdeaInput.value.trim();
    if (!idea) {
      alert("Descreva a ideia para o assistente gerar o template.");
      return;
    }

    btnGenerateTplAi.disabled = true;
    btnGenerateTplAi.textContent = "Gerando com IA...";

    try {
      const { ok, data } = await API.generateTemplateAI(idea);
      if (ok && data.generated) {
        const g = data.generated;
        if (g.title) tplTitleInput.value = g.title;
        if (g.category) tplCategoryInput.value = g.category;
        if (g.description) tplDescInput.value = g.description;
        if (g.default_filename) tplFilenameInput.value = g.default_filename;
        if (g.assistant_prompt) tplAssistantInput.value = g.assistant_prompt;
        if (g.content) tplContentInput.value = g.content;
      } else if (ok && data.raw) {
        tplContentInput.value = data.raw;
      } else {
        alert(data.error || "Erro na geração com IA.");
      }
    } catch (e) {
      alert("Erro ao conectar com o gerador de templates.");
    } finally {
      btnGenerateTplAi.disabled = false;
      btnGenerateTplAi.innerHTML = '<span class="material-symbols-outlined icon-xs">auto_awesome</span> Gerar com IA';
    }
  });

  btnSaveTplModal.addEventListener("click", async () => {
    const id = tplIdInput.value.trim();
    const title = tplTitleInput.value.trim();
    const category = tplCategoryInput.value.trim() || "Geral";
    const description = tplDescInput.value.trim();
    const default_filename = tplFilenameInput.value.trim() || "template.md";
    const assistant_prompt = tplAssistantInput.value.trim();
    const content = tplContentInput.value;
    const create_pr = tplCreatePrCheck.checked;

    if (!title || !content) {
      alert("Por favor informe o título e o conteúdo do template.");
      return;
    }

    btnSaveTplModal.disabled = true;
    btnSaveTplModal.textContent = "Salvando...";

    try {
      const { ok, data } = await API.saveTemplate({
        id,
        title,
        category,
        description,
        default_filename,
        assistant_prompt,
        content,
        create_pr,
      });
      if (ok && data.success) {
        alert(data.message || "Template salvo com sucesso!");
        closeTemplateEditorModal();
        await loadTemplatesCatalog();
      }
    } catch (e) {
      alert("Erro ao salvar template.");
    } finally {
      btnSaveTplModal.disabled = false;
      btnSaveTplModal.innerHTML = '<span class="material-symbols-outlined icon-xs">save</span> Salvar Template';
    }
  });

  async function loadTemplatesCatalog() {
    templatesGridContainer.innerHTML =
      '<div class="loading-state">Carregando Template Store...</div>';
    try {
      const [storeRes, installedRes] = await Promise.all([
        API.getTemplateStore(),
        API.getInstalledTemplates(),
      ]);

      cachedStoreTemplates =
        storeRes.data?.templates || storeRes.templates || [];
      cachedInstalledTemplates = installedRes.data?.installed_templates || [];

      if (countInstalledTpls) {
        countInstalledTpls.textContent = cachedInstalledTemplates.length;
      }

      renderTemplates();
    } catch (err) {
      templatesGridContainer.innerHTML =
        '<div class="empty-state">Erro ao carregar catálogo de templates.</div>';
    }
  }

  function renderTemplates() {
    templatesGridContainer.innerHTML = "";
    const sourceList =
      currentTab === "store" ? cachedStoreTemplates : cachedInstalledTemplates;

    const filtered = sourceList.filter((tpl) => {
      // Category filter
      if (currentCategory !== "all") {
        const cat = (tpl.category || "").toLowerCase();
        const target = currentCategory.toLowerCase();
        if (
          !cat.includes(target) &&
          !(tpl.badge || "").toLowerCase().includes(target)
        ) {
          return false;
        }
      }
      // Text search
      if (searchQuery) {
        const t = (tpl.title || "").toLowerCase();
        const d = (tpl.description || "").toLowerCase();
        const c = (tpl.category || "").toLowerCase();
        const f = (tpl.default_filename || "").toLowerCase();
        if (
          !t.includes(searchQuery) &&
          !d.includes(searchQuery) &&
          !c.includes(searchQuery) &&
          !f.includes(searchQuery)
        ) {
          return false;
        }
      }
      return true;
    });

    if (filtered.length === 0) {
      templatesGridContainer.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; padding: 32px; text-align: center;">
          <div style="margin-bottom: 8px;"><span class="material-symbols-outlined icon-xl" style="color: var(--md-sys-color-outline);">inventory_2</span></div>
          <h3>Nenhum template encontrado</h3>
          <p class="subtitle">${currentTab === "project" ? "Nenhum template instalado localmente ainda. Acesse a aba Template Store e instale templates padrão!" : "Nenhum template coincide com o filtro selecionado."}</p>
        </div>
      `;
      return;
    }

    const installedIds = new Set(
      cachedInstalledTemplates.map((t) => t.id || t.default_filename),
    );

    filtered.forEach((tpl) => {
      const card = document.createElement("div");
      card.className = "template-card";

      const isInstalled =
        currentTab === "project" ||
        installedIds.has(tpl.id) ||
        installedIds.has(tpl.default_filename);

      let badgeClass = "info";
      const bLower = (tpl.badge || "").toLowerCase();
      if (bLower.includes("l1") || bLower.includes("t0")) badgeClass = "t0";
      else if (bLower.includes("l2") || bLower.includes("t1"))
        badgeClass = "t1";
      else if (bLower.includes("l3") || bLower.includes("t2"))
        badgeClass = "t2";

      const cleanTitle =
        (tpl.title || "").replace(/^[^\w\s\u00C0-\u017F]+/gi, "").trim() ||
        tpl.title;
      const cleanBadge =
        (tpl.badge || "").replace(/^[^\w\s\u00C0-\u017F]+/gi, "").trim() ||
        tpl.badge;

      card.innerHTML = `
        <div class="template-card-header">
          <span class="pill">${escapeHtml(tpl.category || "Geral")}</span>
          <div style="display: flex; gap: 4px; align-items: center;">
            ${isInstalled ? `<span class="pill-dot protected" style="font-size: 10px;"><span class="dot"></span> Instalado</span>` : ""}
            ${cleanBadge ? `<span class="tree-badge-mini ${badgeClass}">${escapeHtml(cleanBadge)}</span>` : ""}
          </div>
        </div>
        <div class="template-card-body">
          <h3 class="template-title">${escapeHtml(cleanTitle)}</h3>
          <p class="template-desc">${escapeHtml(tpl.description || "")}</p>
          ${
            tpl.assistant_prompt
              ? `
            <div class="template-assistant-box" title="${escapeHtml(tpl.assistant_prompt)}">
              <span class="assistant-tag">Assistente</span>
              <span class="assistant-prompt-preview">${escapeHtml(tpl.assistant_prompt)}</span>
            </div>
          `
              : ""
          }
          <div class="template-code-preview">
            <code>${escapeHtml((tpl.content || "").trim().substring(0, 150))}...</code>
          </div>
        </div>
        <div class="template-card-footer">
          <div style="display: flex; gap: 4px;">
            ${
              tpl.is_custom || currentTab === "project"
                ? `
              <button class="btn-tree-action delete" style="font-size: 13px; padding: 4px 6px;" onclick="window.deleteTemplateAction('${tpl.id}')" title="Remover Template">
                <span class="material-symbols-outlined icon-xs">close</span>
              </button>
            `
                : ""
            }
            <button class="btn btn-secondary btn-sm" onclick="window.editTemplateAction('${tpl.id}')" title="Customizar / Duplicar Template">
              <span class="material-symbols-outlined icon-xs">edit</span>
            </button>
          </div>
          <div class="template-footer-right" style="display: flex; gap: 6px;">
            ${
              !isInstalled
                ? `
              <button class="btn btn-secondary btn-sm" onclick="window.installTemplateToProject('${tpl.id}')" title="Instalar este template na pasta templates/ do projeto">
                <span class="material-symbols-outlined icon-xs">download</span> Instalar
              </button>
            `
                : ""
            }
            <button class="btn btn-primary btn-sm" onclick="window.createFileFromTemplate('${tpl.id}')" title="Criar novo documento no projeto a partir deste template">
              <span class="material-symbols-outlined icon-xs">add</span> Usar
            </button>
          </div>
        </div>
      `;

      templatesGridContainer.appendChild(card);
    });
  }

  window.installTemplateToProject = async function (templateId) {
    try {
      const { ok, data } = await API.installTemplate(templateId);
      if (ok && data.success) {
        alert(data.message || "Template instalado no projeto!");
        await loadTemplatesCatalog();
      } else {
        alert(data.error || "Erro ao instalar template.");
      }
    } catch (e) {
      alert("Erro ao conectar com o servidor para instalar o template.");
    }
  };

  window.editTemplateAction = async function (id) {
    const data = await API.getTemplateStore();
    const tpls = data.data?.templates || data.templates || [];
    const tpl =
      tpls.find((t) => t.id === id) ||
      cachedInstalledTemplates.find((t) => t.id === id);
    if (tpl) openTemplateEditorModal(tpl);
  };

  window.deleteTemplateAction = async function (id) {
    if (confirm("Tem certeza que deseja remover este template?")) {
      const { ok, data } = await API.deleteTemplate(id);
      if (ok && data.success) {
        await loadTemplatesCatalog();
      }
    }
  };

  window.createFileFromTemplate = async function (templateId) {
    const data = await API.getTemplateStore();
    const tpls = data.data?.templates || data.templates || [];
    const tpl =
      tpls.find((t) => t.id === templateId) ||
      cachedInstalledTemplates.find((t) => t.id === templateId);
    if (!tpl) return;

    const domainName = prompt(
      `Informe o nome do Domínio / Feature para aplicar o template "${tpl.title}":`,
      "novo-modulo",
    );
    if (!domainName || !domainName.trim()) return;

    const cleanName = domainName.trim().toLowerCase().replace(/\s+/g, "-");
    let targetPath = "";
    if (
      tpl.suggested_folder &&
      tpl.suggested_folder.includes("[nome-do-dominio]")
    ) {
      targetPath =
        tpl.suggested_folder.replace(/\[nome-do-dominio\]/g, cleanName) +
        `/${tpl.default_filename}`;
    } else if (tpl.suggested_folder === "domains") {
      targetPath = `domains/${cleanName}/${tpl.default_filename}`;
    } else if (tpl.suggested_folder) {
      targetPath = `${tpl.suggested_folder}/${cleanName}.md`;
    } else {
      targetPath = `${cleanName}.md`;
    }

    const customContent = tpl.content
      .replace(/\[NOME-DO-DOMINIO\]/g, cleanName.toUpperCase())
      .replace(/\[nome-do-dominio\]/g, cleanName)
      .replace(/\[NOME-DA-FEATURE\]/g, cleanName.toUpperCase())
      .replace(/\[FEATURE\]/g, cleanName.toUpperCase());

    try {
      const { ok, data: resData } = await API.createProjectFile({
        path: targetPath,
        is_folder: false,
        content: customContent,
      });
      if (ok && resData.success) {
        alert(`Arquivo "${targetPath}" criado com sucesso no projeto!`);
        if (onUseTemplateInEditor) {
          onUseTemplateInEditor(targetPath, tpl.assistant_prompt);
        }
      }
    } catch (e) {
      alert("Erro ao criar arquivo a partir do template.");
    }
  };

  return {
    loadTemplatesCatalog,
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
