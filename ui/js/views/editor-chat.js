// =============================================================================
// VIEW MODULE: NOTION-LIKE EDITOR & AGENTIC AI CHAT (CONFLUENCE-GRADE LIGHT THEME)
// =============================================================================
import { API } from "../api.js";
import { AIChatCopilot } from "../components/ai-chat-copilot.js";
import {
  parseFrontmatter,
  serializeFrontmatter,
  stripFrontmatter,
} from "../components/frontmatter-parser.js";
import { NotionEditor } from "../components/notion-editor.js";
import { DraftStoreService } from "../draft-store.js";
import { Router } from "../router.js";

export function initEditorChatView({ onWorkspaceChanged, getActiveRepo }) {
  const getRepoName = () => {
    if (getActiveRepo && getActiveRepo()) return getActiveRepo().name;
    const r = Router.getRoute();
    return r.repo || "default";
  };
  const docPathInput =
    document.getElementById("doc-path-input") ||
    document.getElementById("doc-breadcrumb");
  const btnCopyDocPath = document.getElementById("btn-copy-doc-path");
  const btnSaveDraft = document.getElementById("btn-save-draft");
  const btnReloadDoc = document.getElementById("btn-reload-doc");
  const btnReviewDiffDirect = document.getElementById("btn-review-diff-direct");

  // 3 Icon Actions: Copiar, Exportar, Importar
  const btnCopyDocFull = document.getElementById("btn-copy-doc-full");
  const btnExportMdFile = document.getElementById("btn-export-md-file");
  const btnImportDoc = document.getElementById("btn-import-doc");
  const btnToggleAuditMode = document.getElementById("btn-toggle-audit-mode");
  let isAuditModeActive = false;

  // Import Modal Elements
  const importDocModal = document.getElementById("import-doc-modal");
  const btnCloseImportModal = document.getElementById("btn-close-import-modal");
  const btnCancelImport = document.getElementById("btn-cancel-import");
  const btnConfirmImport = document.getElementById("btn-confirm-import");
  const importDropzone = document.getElementById("import-dropzone");
  const importFileInput = document.getElementById("import-file-input");
  const btnTriggerFileInput = document.getElementById("btn-trigger-file-input");
  const importPasteTextarea = document.getElementById("import-paste-textarea");

  // Metadata Inspector & Governance Form Elements
  const docMetaInspector = document.getElementById("doc-meta-inspector");
  const metaInspectorToggle = document.getElementById("meta-inspector-toggle");
  const btnToggleMetaForm = document.getElementById("btn-toggle-meta-form");
  const metaToggleText = document.getElementById("meta-toggle-text");
  const metaInspectorForm = document.getElementById("meta-inspector-form");
  const metaSummaryPill = document.getElementById("meta-summary-pill");
  const metaInputId = document.getElementById("meta-input-id");
  const metaInputTitle = document.getElementById("meta-input-title");
  const metaInputLayer = document.getElementById("meta-input-layer");
  const metaInputStatus = document.getElementById("meta-input-status");
  const metaInputType = document.getElementById("meta-input-type");
  const metaInputVersion = document.getElementById("meta-input-version");
  const metaInputParent = document.getElementById("meta-input-parent");
  const metaInputPrevStage = document.getElementById("meta-input-prev-stage");
  const metaInputNextStage = document.getElementById("meta-input-next-stage");
  const metaInputFeedback = document.getElementById("meta-input-feedback");
  const projectFilesDatalist = document.getElementById(
    "project-files-datalist",
  );
  const btnAutoGenId = document.getElementById("btn-auto-gen-id");
  const btnAiFillTemplate = document.getElementById("btn-ai-fill-template");

  // AI Idea Fill Modal Elements
  const aiIdeaFillModal = document.getElementById("ai-idea-fill-modal");
  const aiIdeaInputText = document.getElementById("ai-idea-input-text");
  const aiIdeaLayerSelect = document.getElementById("ai-idea-layer-select");
  const btnCloseAiIdeaModal = document.getElementById(
    "btn-close-ai-idea-modal",
  );
  const btnCancelAiIdeaModal = document.getElementById(
    "btn-cancel-ai-idea-modal",
  );
  const btnSubmitAiIdea = document.getElementById("btn-submit-ai-idea");

  // Notion Canvas & Editor Elements
  const canvasElement = document.getElementById("notion-editor-canvas");
  let notionEditor = null;

  // Status Footer Elements
  const saveDraftStatus = document.getElementById("save-draft-status");
  const docWordCount = document.getElementById("doc-word-count");
  const docLineCount = document.getElementById("doc-line-count");

  // AI Assistant Drawer Elements
  const workbenchAiPane = document.getElementById("workbench-ai-pane");
  const btnToggleAiPane = document.getElementById("btn-toggle-ai-pane");
  const btnCloseAiPane = document.getElementById("btn-close-ai-pane");

  // Connectivity & Breadcrumb Bar Elements
  const connLayerPill = document.getElementById("conn-layer-pill");
  const connStatusPill = document.getElementById("conn-status-pill");
  const connBreadcrumbTrail = document.getElementById("conn-breadcrumb-trail");
  const connConsumersBadge = document.getElementById("conn-consumers-badge");
  const connConsumersCount = document.getElementById("conn-consumers-count");
  const dropdownConsumers = document.getElementById("dropdown-consumers");
  const btnToggleConsumersPop = document.getElementById(
    "btn-toggle-consumers-pop",
  );
  const connDepsBadge = document.getElementById("conn-deps-badge");
  const connDepsCount = document.getElementById("conn-deps-count");
  const dropdownDeps = document.getElementById("dropdown-deps");
  const btnToggleDepsPop = document.getElementById("btn-toggle-deps-pop");
  const connLifecycleGroup = document.getElementById("conn-lifecycle-group");
  const btnLifecyclePrev = document.getElementById("btn-lifecycle-prev");
  const btnLifecycleNext = document.getElementById("btn-lifecycle-next");

  let currentFilePath = "index.md";
  let activeAssistantPrompt = "";
  let currentDocContext = null;
  let currentDocMetadata = null;
  let hasDocFrontmatter = false;
  let isMetaFormExpanded = false;

  function triggerDraftAutoSave() {
    if (!currentFilePath) return;
    const repo = getRepoName();
    const body = notionEditor ? notionEditor.getMarkdown() : "";
    DraftStoreService.saveDocDraft(repo, currentFilePath, {
      body,
      metadata: currentDocMetadata,
    });
  }

  // 1. Inicializa o Notion Editor Canvas
  if (canvasElement) {
    notionEditor = new NotionEditor({
      canvasElement,
      onChange: () => {
        updateStats();
        triggerDraftAutoSave();
        if (saveDraftStatus) {
          saveDraftStatus.textContent = "● Rascunho salvo localmente";
          saveDraftStatus.className = "status-indicator unsaved";
        }
      },
      onSave: () => {
        btnSaveDraft?.click();
      },
    });
  }

  // 2. AI Pane Toggling
  function updateAiPaneVisibility(show) {
    if (!workbenchAiPane) return;
    workbenchAiPane.style.display = show ? "flex" : "none";
    if (btnToggleAiPane) {
      btnToggleAiPane.style.display = show ? "none" : "inline-flex";
    }
  }

  if (btnToggleAiPane) {
    btnToggleAiPane.addEventListener("click", () => {
      const isHidden = workbenchAiPane.style.display === "none";
      updateAiPaneVisibility(isHidden);
    });
  }
  if (btnCloseAiPane) {
    btnCloseAiPane.addEventListener("click", () => {
      updateAiPaneVisibility(false);
    });
  }

  const isInitialAiOpen =
    workbenchAiPane && workbenchAiPane.style.display !== "none";
  if (btnToggleAiPane) {
    btnToggleAiPane.style.display = isInitialAiOpen ? "none" : "inline-flex";
  }

  // 3. Stats (Palavras & Linhas)
  function updateStats() {
    if (!notionEditor) return;
    const text = notionEditor.getMarkdown() || "";
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const lines = text.split("\n").length;
    if (docWordCount) docWordCount.textContent = `${words} palavras`;
    if (docLineCount) docLineCount.textContent = `${lines} linhas`;
  }

  // 4. Copiar Caminho e Navegar pelo Caminho Digitado
  if (btnCopyDocPath) {
    btnCopyDocPath.addEventListener("click", () => {
      const pathToCopy = docPathInput
        ? (docPathInput.value || docPathInput.textContent).trim()
        : currentFilePath;
      navigator.clipboard.writeText(pathToCopy);
      const originalHtml = btnCopyDocPath.innerHTML;
      btnCopyDocPath.innerHTML =
        '<svg width="12.5" height="12.5" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
      setTimeout(() => {
        btnCopyDocPath.innerHTML = originalHtml;
      }, 1500);
    });
  }

  if (docPathInput && docPathInput.tagName === "INPUT") {
    docPathInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const targetPath = docPathInput.value.trim();
        if (targetPath && targetPath !== currentFilePath) {
          loadDocument(targetPath);
        }
      }
    });

    docPathInput.addEventListener("change", () => {
      const targetPath = docPathInput.value.trim();
      if (targetPath && targetPath !== currentFilePath) {
        loadDocument(targetPath);
      }
    });
  }

  // 5. Botão de Diffs / PR
  if (btnReviewDiffDirect) {
    btnReviewDiffDirect.addEventListener("click", () => {
      document.getElementById("btn-open-workspace-diff")?.click();
    });
  }

  // 6. Recarregar do Disco
  if (btnReloadDoc) {
    btnReloadDoc.addEventListener("click", () => {
      if (
        confirm(
          "Deseja recarregar o documento do disco? Quaisquer alterações não salvas serão descartadas.",
        )
      ) {
        loadDocument(currentFilePath, activeAssistantPrompt);
      }
    });
  }

  // 7. Botão Copiar Markdown Completo
  if (btnCopyDocFull) {
    btnCopyDocFull.addEventListener("click", () => {
      const body = notionEditor ? notionEditor.getMarkdown() : "";
      const full = serializeFrontmatter(currentDocMetadata, body);
      navigator.clipboard
        .writeText(full)
        .then(() => {
          const originalHtml = btnCopyDocFull.innerHTML;
          btnCopyDocFull.innerHTML =
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
          btnCopyDocFull.classList.add("copied");
          setTimeout(() => {
            btnCopyDocFull.innerHTML = originalHtml;
            btnCopyDocFull.classList.remove("copied");
          }, 1800);
        })
        .catch((err) => {
          console.error("Erro ao copiar documento:", err);
        });
    });
  }

  // 8. Botão Exportar Arquivo .md
  if (btnExportMdFile) {
    btnExportMdFile.addEventListener("click", () => {
      const body = notionEditor ? notionEditor.getMarkdown() : "";
      const full = serializeFrontmatter(currentDocMetadata, body);
      const filename = currentFilePath
        ? currentFilePath.split("/").pop()
        : "document.md";
      const blob = new Blob([full], { type: "text/markdown;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename.endsWith(".md") ? filename : `${filename}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  // 9. Botão e Modal de Importação (.md file ou colar texto)
  if (btnImportDoc && importDocModal) {
    btnImportDoc.addEventListener("click", () => {
      if (importPasteTextarea) importPasteTextarea.value = "";
      if (importFileInput) importFileInput.value = "";
      importDocModal.style.display = "flex";
      setTimeout(() => importPasteTextarea?.focus(), 50);
    });
  }

  if (btnCloseImportModal && importDocModal) {
    btnCloseImportModal.addEventListener("click", () => {
      importDocModal.style.display = "none";
    });
  }
  if (btnCancelImport && importDocModal) {
    btnCancelImport.addEventListener("click", () => {
      importDocModal.style.display = "none";
    });
  }

  if (btnTriggerFileInput && importFileInput) {
    btnTriggerFileInput.addEventListener("click", () => {
      importFileInput.click();
    });
  }

  if (importFileInput) {
    importFileInput.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          if (importPasteTextarea) {
            importPasteTextarea.value = evt.target.result;
          }
        };
        reader.readAsText(file);
      }
    });
  }

  if (importDropzone) {
    importDropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      importDropzone.classList.add("dragover");
    });
    importDropzone.addEventListener("dragleave", () => {
      importDropzone.classList.remove("dragover");
    });
    importDropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      importDropzone.classList.remove("dragover");
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          if (importPasteTextarea) {
            importPasteTextarea.value = evt.target.result;
          }
        };
        reader.readAsText(file);
      }
    });
  }

  if (btnConfirmImport && importDocModal) {
    btnConfirmImport.addEventListener("click", () => {
      const raw = importPasteTextarea ? importPasteTextarea.value.trim() : "";
      if (!raw) {
        alert(
          "Por favor, selecione um arquivo .md ou cole o conteúdo Markdown.",
        );
        return;
      }
      const parsed = parseFrontmatter(raw);
      if (parsed.hasFrontmatter) {
        currentDocMetadata = { ...currentDocMetadata, ...parsed.metadata };
        fillMetadataInputs(currentDocMetadata);
      }
      if (notionEditor) {
        notionEditor.setMarkdown(parsed.body);
      }
      importDocModal.style.display = "none";
      updateStats();
      if (saveDraftStatus) {
        saveDraftStatus.textContent = "● Alterações importadas (não salvas)";
        saveDraftStatus.className = "status-indicator unsaved";
      }
    });
  }

  // 8. Metadata Form Interactions & Synchronization
  function toggleMetaForm(force = null) {
    isMetaFormExpanded = force !== null ? force : !isMetaFormExpanded;
    if (metaInspectorForm) {
      metaInspectorForm.style.display = isMetaFormExpanded ? "flex" : "none";
    }
    if (metaInspectorToggle) {
      metaInspectorToggle.classList.toggle("is-expanded", isMetaFormExpanded);
    }
  }

  if (metaInspectorToggle) {
    metaInspectorToggle.addEventListener("click", (e) => {
      if (["INPUT", "SELECT", "LABEL", "TEXTAREA"].includes(e.target.tagName))
        return;
      toggleMetaForm();
    });
  }
  if (btnToggleMetaForm) {
    btnToggleMetaForm.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleMetaForm();
    });
  }

  function fillMetadataInputs(meta = {}) {
    if (metaInputId) metaInputId.value = meta.id || "";
    if (metaInputTitle) metaInputTitle.value = meta.title || "";
    if (metaInputLayer) metaInputLayer.value = meta.layer || "L4_ARTIFACT";
    if (metaInputStatus) metaInputStatus.value = meta.status || "draft";
    if (metaInputType) metaInputType.value = meta.type || "spec";
    if (metaInputVersion) metaInputVersion.value = meta.version || "1.0.0";
    if (metaInputParent) metaInputParent.value = meta.parent || "";
    if (metaInputPrevStage)
      metaInputPrevStage.value = meta.lifecycle?.previous_stage || "";
    if (metaInputNextStage)
      metaInputNextStage.value = meta.lifecycle?.next_stage || "";
    if (metaInputFeedback) {
      metaInputFeedback.value =
        typeof meta.lifecycle?.feedback_loops === "object"
          ? Object.values(meta.lifecycle.feedback_loops)[0] || ""
          : meta.lifecycle?.feedback_loops || "";
    }
    updateMetaSummary();
  }

  function onMetaInputChange() {
    if (!currentDocMetadata) return;
    currentDocMetadata.id = metaInputId.value.trim();
    currentDocMetadata.title = metaInputTitle.value.trim();
    currentDocMetadata.layer = metaInputLayer.value;
    currentDocMetadata.status = metaInputStatus.value;
    currentDocMetadata.type = metaInputType.value.trim();
    currentDocMetadata.version = metaInputVersion.value.trim();
    currentDocMetadata.parent = metaInputParent.value.trim();

    currentDocMetadata.lifecycle = currentDocMetadata.lifecycle || {};
    currentDocMetadata.lifecycle.previous_stage =
      metaInputPrevStage.value.trim();
    currentDocMetadata.lifecycle.next_stage = metaInputNextStage.value.trim();
    if (metaInputFeedback.value.trim()) {
      currentDocMetadata.lifecycle.feedback_loops =
        metaInputFeedback.value.trim();
    }

    updateMetaSummary();
    triggerDraftAutoSave();
    if (saveDraftStatus) {
      saveDraftStatus.textContent = "● Rascunho salvo localmente";
      saveDraftStatus.className = "status-indicator unsaved";
    }
  }

  [
    metaInputId,
    metaInputTitle,
    metaInputLayer,
    metaInputStatus,
    metaInputType,
    metaInputVersion,
    metaInputParent,
    metaInputPrevStage,
    metaInputNextStage,
    metaInputFeedback,
  ].forEach((input) => {
    if (input) {
      input.addEventListener("input", onMetaInputChange);
      input.addEventListener("change", onMetaInputChange);
    }
  });

  function updateMetaSummary() {
    if (!currentDocMetadata) return;
    const l = (currentDocMetadata.layer || "L4")
      .replace("L", "")
      .substring(0, 2);
    const s = currentDocMetadata.status || "draft";
    const t = currentDocMetadata.type || "spec";
    if (metaSummaryPill) {
      metaSummaryPill.innerHTML = `<strong>L${l}</strong> &bull; ${s.toUpperCase()} &bull; <code>${t}</code> &bull; <em>${escapeHtml(currentDocMetadata.id || currentFilePath)}</em>`;
    }
  }

  function generateCanonicalId(title, layer, path, existingDocs = []) {
    const l = (layer || "L4").split("_")[0].toLowerCase();
    let domain = "core";
    if (path && path.startsWith("domains/")) {
      const parts = path.split("/");
      if (parts.length > 1) domain = parts[1].toLowerCase();
    }
    const cleanTitle = (title || "spec")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const baseId = `${l}-${domain}-${cleanTitle}`;
    let candidate = baseId;
    let counter = 2;
    const existingIds = new Set(existingDocs.map((d) => d.id));
    while (existingIds.has(candidate)) {
      candidate = `${baseId}-${counter}`;
      counter++;
    }
    return candidate;
  }

  if (btnAutoGenId) {
    btnAutoGenId.addEventListener("click", async () => {
      try {
        const { ok, data } = await API.getProjectDomainsDocs();
        const existingDocs = ok && data && data.documents ? data.documents : [];
        const genId = generateCanonicalId(
          metaInputTitle ? metaInputTitle.value : "",
          metaInputLayer ? metaInputLayer.value : "L4_ARTIFACT",
          currentFilePath,
          existingDocs,
        );
        if (metaInputId) {
          metaInputId.value = genId;
          onMetaInputChange();
        }
      } catch (e) {
        if (metaInputId) {
          metaInputId.value = generateCanonicalId(
            metaInputTitle?.value,
            metaInputLayer?.value,
            currentFilePath,
          );
          onMetaInputChange();
        }
      }
    });
  }

  // Modal de Ideia com IA
  if (btnAiFillTemplate && aiIdeaFillModal) {
    btnAiFillTemplate.addEventListener("click", () => {
      if (aiIdeaInputText) aiIdeaInputText.value = "";
      if (aiIdeaLayerSelect && metaInputLayer) {
        aiIdeaLayerSelect.value = metaInputLayer.value || "L4_ARTIFACT";
      }
      aiIdeaFillModal.style.display = "flex";
      setTimeout(() => aiIdeaInputText?.focus(), 50);
    });
  }

  if (btnCloseAiIdeaModal && aiIdeaFillModal) {
    btnCloseAiIdeaModal.addEventListener("click", () => {
      aiIdeaFillModal.style.display = "none";
    });
  }
  if (btnCancelAiIdeaModal && aiIdeaFillModal) {
    btnCancelAiIdeaModal.addEventListener("click", () => {
      aiIdeaFillModal.style.display = "none";
    });
  }

  if (btnSubmitAiIdea && aiIdeaFillModal) {
    btnSubmitAiIdea.addEventListener("click", async () => {
      const ideaText = aiIdeaInputText ? aiIdeaInputText.value.trim() : "";
      if (!ideaText) {
        alert("Por favor, descreva sua ideia ou requisito.");
        return;
      }

      const layerChoice = aiIdeaLayerSelect
        ? aiIdeaLayerSelect.value
        : "L4_ARTIFACT";
      btnSubmitAiIdea.disabled = true;
      btnSubmitAiIdea.textContent = "Gerando com IA...";

      try {
        const prompt = `Você é o Arquiteto de Software SDLC especialista no Context OS.
O usuário deseja criar/estruturar a especificação para a seguinte ideia de negócio:
"${ideaText}"
Camada solicitada: ${layerChoice === "auto" ? "Determine a camada oficial mais adequada (L1 a L6)" : layerChoice}.
Caminho atual do arquivo: ${currentFilePath}

Retorne uma especificação oficial completa em Markdown com bloco Frontmatter YAML válido entre '---' contendo:
- id: ID oficial unívoco
- title: Título objetivo
- layer: ${layerChoice === "auto" ? "L1_PROJECT, L2_DOMAIN, L3_SUBDOMAIN, L4_ARTIFACT, L5_BEHAVIOR ou L6_OBSERVABILITY" : layerChoice}
- type: tipo de artefato (ex: spec, flow, entity, kpis, bdd)
- version: "1.0.0"
- status: "draft"
- parent: caminho ou ID do documento pai sugerido
- breadcrumb: lista com { title, path }

E no corpo Markdown, estruture o documento com seções claras, propostas de valor, regras de negócio e critérios de aceitação práticos. Não inclua blocos adicionais fora do markdown retornado.`;

        const res = await API.sendMessageToAI(prompt);
        if (res && res.reply) {
          const parsed = parseFrontmatter(res.reply);
          if (parsed.hasFrontmatter) {
            currentDocMetadata = { ...currentDocMetadata, ...parsed.metadata };
            fillMetadataInputs(currentDocMetadata);
          }
          if (notionEditor) {
            notionEditor.setMarkdown(parsed.body);
          }
          aiIdeaFillModal.style.display = "none";
          updateStats();
          if (saveDraftStatus) {
            saveDraftStatus.textContent =
              "Especificação gerada com IA (não salva)";
            saveDraftStatus.className = "status-indicator unsaved";
          }
        } else {
          alert("Não foi possível gerar a resposta com a IA no momento.");
        }
      } catch (err) {
        console.error("Erro ao gerar com IA:", err);
        alert("Erro ao conectar com assistente de IA.");
      } finally {
        btnSubmitAiIdea.disabled = false;
        btnSubmitAiIdea.innerHTML =
          '<span class="material-symbols-outlined icon-xs">auto_awesome</span> Gerar Especificação';
      }
    });
  }

  async function updateProjectFilesDatalist() {
    if (!projectFilesDatalist) return;
    try {
      const { ok, data } = await API.getProjectDomainsDocs();
      if (ok && data && Array.isArray(data.documents)) {
        projectFilesDatalist.innerHTML = data.documents
          .map(
            (d) =>
              `<option value="${escapeHtml(d.path)}">${escapeHtml(d.title || d.id)} (${escapeHtml(d.layer || "")})</option>`,
          )
          .join("");
      } else {
        const tree = await API.getProjectTree();
        const files = [];
        function collectPaths(node) {
          if (!node) return;
          if (node.type === "file" && node.path) files.push(node.path);
          if (node.children) node.children.forEach(collectPaths);
        }
        collectPaths(tree);
        projectFilesDatalist.innerHTML = files
          .map((f) => `<option value="${escapeHtml(f)}">`)
          .join("");
      }
    } catch (e) {
      // silent datalist failure
    }
  }

  // 9. Salvar no Workspace (Ícone Disquete)
  if (btnSaveDraft) {
    btnSaveDraft.addEventListener("click", async () => {
      const body = notionEditor ? notionEditor.getMarkdown() : "";
      const fullContent = serializeFrontmatter(currentDocMetadata, body);
      const originalHtml = btnSaveDraft.innerHTML;
      btnSaveDraft.disabled = true;

      try {
        const { ok, data } = await API.saveWorkspaceFile({
          path: currentFilePath,
          content: fullContent,
        });
        if (ok && data.success) {
          DraftStoreService.clearDocDraft(getRepoName(), currentFilePath);
          btnSaveDraft.innerHTML =
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
          btnSaveDraft.classList.add("copied");
          if (saveDraftStatus) {
            saveDraftStatus.textContent = "Salvo no workspace";
            saveDraftStatus.className = "status-indicator saved";
          }
          if (onWorkspaceChanged) onWorkspaceChanged();
          setTimeout(() => {
            btnSaveDraft.innerHTML = originalHtml;
            btnSaveDraft.classList.remove("copied");
          }, 1500);
        }
      } catch (err) {
        alert("Erro ao salvar no workspace.");
        btnSaveDraft.innerHTML = originalHtml;
      } finally {
        btnSaveDraft.disabled = false;
      }
    });
  }

  // Modo de Auditoria & GitLens (Autoria e Aprovador por Bloco)
  if (btnToggleAuditMode) {
    btnToggleAuditMode.addEventListener("click", async () => {
      isAuditModeActive = !isAuditModeActive;
      btnToggleAuditMode.classList.toggle("active", isAuditModeActive);

      if (isAuditModeActive) {
        btnToggleAuditMode.title = "Desativar Modo de Auditoria";
        await applyAuditModeBlame();
      } else {
        btnToggleAuditMode.title =
          "Ativar Modo de Auditoria & GitLens (Ver autores e aprovadores por bloco)";
        removeAuditModeBlame();
      }
    });
  }

  async function applyAuditModeBlame() {
    if (!canvasElement) return;
    try {
      const { ok, data } = await API.getFileBlame(currentFilePath);
      const author =
        ok && data && data.author ? data.author : "Arquiteto de Domínio";
      const approver =
        ok && data && data.approver ? data.approver : "Tech Lead / Reviewer";
      const prId = ok && data && data.pr_id ? `#PR-${data.pr_id}` : "";

      canvasElement.classList.add("notion-audit-mode");
      const blocks = canvasElement.querySelectorAll(
        "p, h1, h2, h3, ul, ol, blockquote, .notion-callout, table",
      );
      blocks.forEach((block) => {
        const blameText = prId
          ? `@${author} • ${prId} • Aprovado por ${approver}`
          : `@${author} • Aprovado por ${approver}`;
        block.setAttribute("data-blame", blameText);
      });
    } catch (e) {
      console.warn("Erro ao aplicar blame de auditoria:", e);
    }
  }

  function removeAuditModeBlame() {
    if (!canvasElement) return;
    canvasElement.classList.remove("notion-audit-mode");
    const blocks = canvasElement.querySelectorAll("[data-blame]");
    blocks.forEach((block) => block.removeAttribute("data-blame"));
  }

  // 10. Carregar Documento
  async function loadDocument(
    path = "index.md",
    customAssistantPrompt = "",
    skipDraft = false,
  ) {
    currentFilePath = path;
    activeAssistantPrompt = customAssistantPrompt;
    const repo = getRepoName();

    // Sincroniza query na URL se estivermos no workspace
    const currentRoute = Router.getRoute();
    if (
      currentRoute.routeName === "workspace" &&
      (!currentRoute.subview || currentRoute.subview === "editor")
    ) {
      Router.setQuery({ file: path }, true);
    }

    try {
      const doc = await API.getProjectFile(path);
      const rawContent = doc.content || "";

      const parsed = parseFrontmatter(rawContent);
      hasDocFrontmatter = parsed.hasFrontmatter;
      currentDocMetadata = parsed.metadata;
      currentDocMetadata.path = doc.path;

      // Verifica se existe rascunho local persistido
      const draft = !skipDraft
        ? DraftStoreService.getDocDraft(repo, path)
        : null;
      const hasUnsavedDraft =
        draft &&
        (draft.body !== parsed.body ||
          JSON.stringify(draft.metadata) !== JSON.stringify(parsed.metadata));

      if (hasUnsavedDraft) {
        if (draft.metadata) {
          currentDocMetadata = { ...currentDocMetadata, ...draft.metadata };
        }
        fillMetadataInputs(currentDocMetadata);
        if (notionEditor) {
          notionEditor.setMarkdown(draft.body || "");
        }
        if (saveDraftStatus) {
          saveDraftStatus.innerHTML = `● Rascunho local recuperado <a href="#" id="btn-discard-draft-action" style="color:var(--color-primary);margin-left:6px;text-decoration:underline;">Descartar</a>`;
          saveDraftStatus.className = "status-indicator unsaved";
          setTimeout(() => {
            const discardBtn = document.getElementById(
              "btn-discard-draft-action",
            );
            if (discardBtn) {
              discardBtn.onclick = (e) => {
                e.preventDefault();
                DraftStoreService.clearDocDraft(repo, path);
                loadDocument(path, customAssistantPrompt, true);
              };
            }
          }, 50);
        }
      } else {
        fillMetadataInputs(parsed.metadata);
        if (notionEditor) {
          notionEditor.setMarkdown(parsed.body || "");
        }
        if (saveDraftStatus) {
          saveDraftStatus.textContent = "Pronto";
          saveDraftStatus.className = "status-indicator";
        }
      }

      if (docPathInput) {
        if (docPathInput.tagName === "INPUT") {
          docPathInput.value = doc.path;
        } else {
          docPathInput.textContent = doc.path;
        }
        docPathInput.title = `Caminho completo: ${doc.path}`;
      }
      updateStats();

      initChatGroundedContext(doc.path, customAssistantPrompt);
      await updateConnectivityBar(doc.path);
      await updateProjectFilesDatalist();

      if (isAuditModeActive) {
        await applyAuditModeBlame();
      }
    } catch (err) {
      console.warn("Documento não encontrado ou erro ao carregar:", err);
      if (
        confirm(
          `O documento "${path}" não foi encontrado no workspace.\n\nDeseja criá-lo como um novo documento agora?`,
        )
      ) {
        const defaultTitle = path
          .split("/")
          .pop()
          .replace(".md", "")
          .replace(/[-_]/g, " ");
        const initialMetadata = {
          id: `doc-${Date.now()}`,
          title: defaultTitle,
          layer: "L4_ARTIFACT",
          status: "draft",
          path: path,
          version: "1.0.0",
        };
        currentDocMetadata = initialMetadata;
        fillMetadataInputs(initialMetadata);
        if (notionEditor) {
          notionEditor.setMarkdown(
            `# ${defaultTitle}\n\nComece a documentar aqui...`,
          );
        }
        if (docPathInput) {
          if (docPathInput.tagName === "INPUT") docPathInput.value = path;
          else docPathInput.textContent = path;
        }
        await handleSaveDraft();
        if (onWorkspaceChanged) onWorkspaceChanged();
      }
    }
  }

  // 11. Conectividade e Grafo
  async function updateConnectivityBar(path) {
    try {
      const data = await API.getDocumentContext(path);
      currentDocContext = data;
      const node = data.node || {};

      // Layer & Status Pills
      const layer = node.layer || "L4_ARTIFACT";
      const shortLayer = layer
        .replace("_PROJECT", "")
        .replace("_DOMAIN", "")
        .replace("_SUBDOMAIN", "")
        .replace("_FEATURE", "")
        .replace("_ARTIFACT", "");
      if (connLayerPill) {
        connLayerPill.textContent = shortLayer;
        connLayerPill.className = `layer-pill layer-${shortLayer}`;
      }
      if (connStatusPill) {
        connStatusPill.textContent = (node.status || "ACTIVE").toUpperCase();
      }

      // Breadcrumbs
      if (connBreadcrumbTrail) {
        let breadcrumbItems = [];
        if (Array.isArray(node.breadcrumb) && node.breadcrumb.length > 0) {
          breadcrumbItems = node.breadcrumb;
        } else {
          const parts = path.split("/");
          let accumulated = "";
          breadcrumbItems = parts.map((part, idx) => {
            accumulated = accumulated ? `${accumulated}/${part}` : part;
            return {
              title: part.replace(".md", ""),
              path: accumulated.endsWith(".md")
                ? accumulated
                : `${accumulated}/index.md`,
            };
          });
        }

        connBreadcrumbTrail.innerHTML = breadcrumbItems
          .map((item, idx) => {
            const isLast = idx === breadcrumbItems.length - 1;
            if (isLast) {
              return `<span class="trail-item current">${escapeHtml(item.title || item.name || "")}</span>`;
            }
            return `
            <span class="trail-item link" data-path="${escapeHtml(item.path)}">${escapeHtml(item.title || item.name || "")}</span>
            <span class="trail-sep">/</span>
          `;
          })
          .join("");

        connBreadcrumbTrail
          .querySelectorAll(".trail-item.link")
          .forEach((el) => {
            el.addEventListener("click", () => {
              const targetPath = el.dataset.path;
              if (targetPath) loadDocument(targetPath);
            });
          });
      }

      // Consumers
      const consumers = node.consumers || [];
      if (connConsumersBadge && connConsumersCount && dropdownConsumers) {
        if (consumers.length > 0) {
          connConsumersBadge.style.display = "block";
          connConsumersCount.textContent = consumers.length;
          dropdownConsumers.innerHTML = consumers
            .map(
              (c) => `
            <div class="conn-dropdown-item" data-path="${escapeHtml(c.source_path)}">
              <span class="item-title">${escapeHtml(c.source_title || c.source_path)}</span>
              <span class="item-path">${escapeHtml(c.source_path)} (${c.relation_type || "consumes"})</span>
            </div>
          `,
            )
            .join("");

          dropdownConsumers
            .querySelectorAll(".conn-dropdown-item")
            .forEach((item) => {
              item.addEventListener("click", () => {
                dropdownConsumers.style.display = "none";
                loadDocument(item.dataset.path);
              });
            });
        } else {
          connConsumersBadge.style.display = "none";
          dropdownConsumers.style.display = "none";
        }
      }

      // Dependencies
      const deps = node.dependencies || [];
      if (connDepsBadge && connDepsCount && dropdownDeps) {
        if (deps.length > 0) {
          connDepsBadge.style.display = "block";
          connDepsCount.textContent = deps.length;
          dropdownDeps.innerHTML = deps
            .map(
              (d) => `
            <div class="conn-dropdown-item" data-path="${escapeHtml(d.target_path)}">
              <span class="item-title">${escapeHtml(d.target_title || d.target_path)}</span>
              <span class="item-path">${escapeHtml(d.target_path)} (${d.contract_mode || "sync"})</span>
            </div>
          `,
            )
            .join("");

          dropdownDeps
            .querySelectorAll(".conn-dropdown-item")
            .forEach((item) => {
              item.addEventListener("click", () => {
                dropdownDeps.style.display = "none";
                loadDocument(item.dataset.path);
              });
            });
        } else {
          connDepsBadge.style.display = "none";
          dropdownDeps.style.display = "none";
        }
      }

      // Lifecycle
      const lifecycle = node.lifecycle || {};
      if (connLifecycleGroup && btnLifecyclePrev && btnLifecycleNext) {
        const hasPrev = Boolean(lifecycle.previous_stage);
        const hasNext = Boolean(lifecycle.next_stage);

        if (hasPrev || hasNext) {
          connLifecycleGroup.style.display = "flex";
          btnLifecyclePrev.style.display = hasPrev ? "block" : "none";
          btnLifecycleNext.style.display = hasNext ? "block" : "none";

          if (hasPrev)
            btnLifecyclePrev.onclick = () =>
              loadDocument(lifecycle.previous_stage);
          if (hasNext)
            btnLifecycleNext.onclick = () => loadDocument(lifecycle.next_stage);
        } else {
          connLifecycleGroup.style.display = "none";
        }
      }
    } catch (err) {
      console.warn("Erro ao carregar contexto de conectividade:", err);
    }
  }

  // Popover Toggles
  if (btnToggleConsumersPop && dropdownConsumers) {
    btnToggleConsumersPop.addEventListener("click", (e) => {
      e.stopPropagation();
      const isVisible = dropdownConsumers.style.display === "block";
      dropdownConsumers.style.display = isVisible ? "none" : "block";
      if (dropdownDeps) dropdownDeps.style.display = "none";
    });
  }

  if (btnToggleDepsPop && dropdownDeps) {
    btnToggleDepsPop.addEventListener("click", (e) => {
      e.stopPropagation();
      const isVisible = dropdownDeps.style.display === "block";
      dropdownDeps.style.display = isVisible ? "none" : "block";
      if (dropdownConsumers) dropdownConsumers.style.display = "none";
    });
  }

  document.addEventListener("click", () => {
    if (dropdownConsumers) dropdownConsumers.style.display = "none";
    if (dropdownDeps) dropdownDeps.style.display = "none";
  });

  window.loadDocByPath = (targetPath) => {
    if (targetPath) loadDocument(targetPath);
  };

  // 12. Universal Agentic AI Chat Copilot Integration
  let workbenchCopilot = null;
  if (workbenchAiPane) {
    workbenchCopilot = new AIChatCopilot({
      container: workbenchAiPane,
      resizer: "#resizer-ai",
      storageKey: "governance_workbench_ai_width",
      contextPath: currentFilePath,
      agentName: "Antigravity Agent",
      agentIcon: "",
      modelName: "gemini-3.5-flash",
      defaultSystemPrompt: "",
      getRepoName: () => (getActiveRepo && getActiveRepo() ? getActiveRepo().name : "default"),
      getContent: () => (notionEditor ? notionEditor.getMarkdown() : ""),
      chips: [
        {
          label: "Diagrama Mermaid",
          prompt:
            "Gere um diagrama Mermaid para a arquitetura deste documento.",
        },
        {
          label: "Dicionário Ubíquo",
          prompt:
            "Refine o Dicionário Ubíquo adicionando novas entidades com escopo e regras.",
        },
        {
          label: "Auditar DDD",
          prompt:
            "Audite a aderência deste documento aos princípios de DDD e padrões de arquitetura.",
        },
        {
          label: "Cenário BDD",
          prompt:
            "Proponha um cenário BDD em Gherkin com base nas invariantes deste documento.",
        },
      ],
      onApplyContent: (codeText) => {
        insertIntoEditor(codeText);
      },
      onPromptSaved: async (newPrompt) => {
        if (!currentDocMetadata) currentDocMetadata = {};
        currentDocMetadata.assistant_prompt = newPrompt;
        const body = notionEditor ? notionEditor.getMarkdown() : "";
        const fullContent = serializeFrontmatter(currentDocMetadata, body);
        const { ok, data } = await API.saveWorkspaceFile({
          path: currentFilePath,
          content: fullContent,
        });
        if (ok && data.success) {
          if (saveDraftStatus) {
            saveDraftStatus.textContent = "Salvo no workspace (com prompt)";
            saveDraftStatus.className = "status-indicator saved";
          }
          if (onWorkspaceChanged) onWorkspaceChanged();
        }
      },
      onPromptRestored: async (defaultPrompt) => {
        if (!currentDocMetadata) currentDocMetadata = {};
        if (defaultPrompt) {
          currentDocMetadata.assistant_prompt = defaultPrompt;
        } else {
          delete currentDocMetadata.assistant_prompt;
        }
        const body = notionEditor ? notionEditor.getMarkdown() : "";
        const fullContent = serializeFrontmatter(currentDocMetadata, body);
        const { ok, data } = await API.saveWorkspaceFile({
          path: currentFilePath,
          content: fullContent,
        });
        if (ok && data.success) {
          if (saveDraftStatus) {
            saveDraftStatus.textContent = "Prompt padrão restaurado";
            saveDraftStatus.className = "status-indicator saved";
          }
          if (onWorkspaceChanged) onWorkspaceChanged();
        }
      },
      onClose: () => {
        updateAiPaneVisibility(false);
      },
      getRepoName: () => getRepoName(),
    });
  }

  function initChatGroundedContext(path, assistantPrompt = "") {
    const activePrompt =
      (currentDocMetadata && currentDocMetadata.assistant_prompt) ||
      assistantPrompt ||
      "";
    const isSpecialized = Boolean(activePrompt);
    if (workbenchCopilot) {
      workbenchCopilot.setContext({
        contextPath: path,
        agentName: isSpecialized
          ? "Assistente Especialista"
          : "Antigravity Agent",
        agentIcon: "",
        defaultSystemPrompt: assistantPrompt || "",
        customSystemPrompt: (currentDocMetadata && currentDocMetadata.assistant_prompt) || "",
        welcomeMessage: isSpecialized
          ? `Assistente Especialista ativo no template <code>${path}</code>. Como posso ajudar no preenchimento e refinamento das seções?`
          : `Pareando com você no documento ativo: <code>${path}</code>. Como posso ajudar na modelagem, invariantes ou diagramas?`,
        resetHistory: true,
      });
    }
  }

  function insertIntoEditor(text) {
    if (!notionEditor) return;
    notionEditor.insertTextAtCursor(text);
    updateStats();
    if (saveDraftStatus) {
      saveDraftStatus.textContent = "● Alterações não salvas";
      saveDraftStatus.className = "status-indicator unsaved";
    }
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

  async function loadProjectTaxonomy() {
    try {
      const { ok, data } = await API.getProjectConfig();
      if (!ok || !data || !data.config) return;
      const cfg = data.config;

      // Populate metaInputLayer options
      if (metaInputLayer && cfg.layers && cfg.layers.length > 0) {
        const currentVal = metaInputLayer.value;
        metaInputLayer.innerHTML = cfg.layers
          .map(
            (l) =>
              `<option value="${escapeHtml(l.key)}">${escapeHtml(l.label)}</option>`,
          )
          .join("");
        if (currentVal && cfg.layers.some((l) => l.key === currentVal)) {
          metaInputLayer.value = currentVal;
        }
      }

      // Populate aiIdeaLayerSelect options
      if (aiIdeaLayerSelect && cfg.layers && cfg.layers.length > 0) {
        aiIdeaLayerSelect.innerHTML =
          `<option value="auto">Determinar Automaticamente (IA)</option>` +
          cfg.layers
            .map(
              (l) =>
                `<option value="${escapeHtml(l.key)}">${escapeHtml(l.label)}</option>`,
            )
            .join("");
      }

      // Populate metaInputStatus options
      if (metaInputStatus && cfg.statuses && cfg.statuses.length > 0) {
        const currentVal = metaInputStatus.value;
        metaInputStatus.innerHTML = cfg.statuses
          .map(
            (s) =>
              `<option value="${escapeHtml(s.key)}">${escapeHtml(s.label)}</option>`,
          )
          .join("");
        if (currentVal && cfg.statuses.some((s) => s.key === currentVal)) {
          metaInputStatus.value = currentVal;
        }
      }
    } catch (e) {
      console.warn("Erro ao carregar taxonomia do projeto no editor:", e);
    }
  }

  // Load project taxonomy on initialization
  loadProjectTaxonomy();

  return {
    loadDocument,
    loadProjectTaxonomy,
    getCurrentPath: () => currentFilePath,
    setContent(content, breadcrumb = "index.md", assistantPrompt = "") {
      const parsed = parseFrontmatter(content);
      currentDocMetadata = parsed.metadata;
      fillMetadataInputs(parsed.metadata);
      if (notionEditor) notionEditor.setMarkdown(parsed.body);

      if (docPathInput) {
        if (docPathInput.tagName === "INPUT") docPathInput.value = breadcrumb;
        else docPathInput.textContent = breadcrumb;
        docPathInput.title = `Caminho completo: ${breadcrumb}`;
      }
      activeAssistantPrompt = assistantPrompt;
      updateStats();
      initChatGroundedContext(breadcrumb, assistantPrompt);
    },
  };
}
