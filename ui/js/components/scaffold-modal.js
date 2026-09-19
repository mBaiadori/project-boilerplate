// =============================================================================
// COMPONENT: SCAFFOLD WIZARD MODAL (CRIAÇÃO DE ESPECIFICAÇÕES E ADRs)
// =============================================================================
import { API } from '../api.js';

export function initScaffoldModal({ onScaffoldSuccess }) {
  const modalBackdrop = document.getElementById('scaffold-wizard-modal');
  const btnClose = document.getElementById('btn-close-scaffold-modal');
  const btnCancel = document.getElementById('btn-cancel-scaffold');
  const btnConfirm = document.getElementById('btn-confirm-scaffold');

  // Type Selection Buttons
  const typeBtns = document.querySelectorAll('.scaffold-type-tab');

  // Inputs
  const inputFeatureName = document.getElementById('scaffold-feature-name');
  const inputFeatureTitle = document.getElementById('scaffold-feature-title');
  const previewPathCode = document.getElementById('scaffold-preview-path');

  let activeType = 'spec'; // 'spec' | 'adr'

  async function openModal(defaultType = 'spec') {
    activeType = defaultType;
    if (modalBackdrop) modalBackdrop.style.display = 'flex';
    setTypeTab(activeType);
    updatePathPreview();
  }

  function closeModal() {
    if (modalBackdrop) modalBackdrop.style.display = 'none';
  }

  function setTypeTab(type) {
    activeType = type;
    typeBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === type);
    });
    updatePathPreview();
  }

  function updatePathPreview() {
    if (!previewPathCode) return;
    const rawName = (inputFeatureName?.value || '').trim().toLowerCase().replace(/[^a-z0-9\-_]/g, '-').replace(/-+/g, '-');
    const fallbackName = activeType === 'adr' ? 'adr-001' : 'minha-especificacao';
    const name = rawName || fallbackName;

    if (activeType === 'adr') {
      previewPathCode.textContent = `adrs/${name}.md`;
    } else {
      previewPathCode.textContent = `specs/${name}.md`;
    }
  }

  if (inputFeatureName) {
    inputFeatureName.oninput = () => {
      if (inputFeatureTitle && !inputFeatureTitle.dataset.manualEdited) {
        inputFeatureTitle.value = inputFeatureName.value.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      }
      updatePathPreview();
    };
  }

  if (inputFeatureTitle) {
    inputFeatureTitle.oninput = () => {
      inputFeatureTitle.dataset.manualEdited = 'true';
    };
  }

  typeBtns.forEach(btn => {
    btn.addEventListener('click', () => setTypeTab(btn.dataset.type));
  });

  if (btnClose) btnClose.onclick = closeModal;
  if (btnCancel) btnCancel.onclick = closeModal;

  if (btnConfirm) {
    btnConfirm.addEventListener('click', async () => {
      btnConfirm.disabled = true;
      btnConfirm.textContent = 'Criando...';

      const rawName = (inputFeatureName?.value || '').trim().toLowerCase().replace(/[^a-z0-9\-_]/g, '-').replace(/-+/g, '-');
      const fallbackName = activeType === 'adr' ? 'adr-001' : 'nova-especificacao';
      const name = rawName || fallbackName;
      const title = (inputFeatureTitle?.value || name).trim();
      const targetPath = activeType === 'adr' ? `adrs/${name}.md` : `specs/${name}.md`;

      const defaultContent = activeType === 'adr' 
        ? `---
title: "${title}"
status: "proposed"
type: "adr"
date: "${new Date().toISOString().split('T')[0]}"
---

# 🏛️ ${title}

## Contexto & Declaração do Problema
Descreva o contexto e o problema de engenharia ou arquitetura que motiva esta decisão.

## Decisão Proposta
Qual solução foi escolhida e qual padrão arquitetural será aplicado.

## Consequências
- **Positivas:** Ganhos de performance, clareza, manutenibilidade.
- **Negativas / Trade-offs:** Custos, complexidade adicional, migrações necessárias.
`
        : `---
title: "${title}"
status: "draft"
type: "specification"
version: "1.0.0"
---

# 📋 ${title}

> Especificação funcional e técnica detalhada.

## 🎯 Objetivo & Escopo
Descreva o escopo e o comportamento esperado desta funcionalidade.

## ⚙️ Regras de Negócio & Invariantes
1. **Regra 1:** Descrição detalhada da regra de negócio.
2. **Regra 2:** Critérios de validação e restrições.

## 🧪 Cenários de Aceitação (BDD)
\`\`\`gherkin
Cenário: Execução com sucesso
  Dado que o usuário está autenticado
  Quando solicitar a operação
  Então o sistema deve processar e retornar 200 OK
\`\`\`
`;

      try {
        const { ok, data } = await API.createFile({
          path: targetPath,
          content: defaultContent,
          is_dir: false
        });

        if (ok) {
          closeModal();
          if (onScaffoldSuccess) {
            onScaffoldSuccess(targetPath);
          }
        } else {
          alert('Erro ao criar arquivo: ' + (data?.error || 'Erro desconhecido.'));
        }
      } catch (err) {
        alert('Erro ao conectar com o servidor para criar o arquivo.');
      } finally {
        btnConfirm.disabled = false;
        btnConfirm.textContent = 'Criar & Abrir no Editor';
      }
    });
  }

  return {
    open: openModal,
    close: closeModal
  };
}
