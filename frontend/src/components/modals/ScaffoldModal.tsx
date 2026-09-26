import React, { useState } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { API } from "../../services/api";

interface ScaffoldModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: "rfc" | "prd" | "spec" | "notes" | "doc";
  onCreated?: (filePath: string) => void;
}

interface DocPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  defaultFolder: string;
  generateContent: (title: string, slug: string) => string;
}

const PRESETS: DocPreset[] = [
  {
    id: "rfc",
    name: "RFC / Proposta",
    description: "Proposta técnica e decisão para o time",
    icon: "forum",
    defaultFolder: "rfcs",
    generateContent: (title) => `---
title: "${title}"
status: "draft"
type: "rfc"
date: "${new Date().toISOString().split("T")[0]}"
---

# RFC: ${title}

## 1. Resumo Executivo
Breve descrição da proposta e do problema que ela resolve.

## 2. Motivação & Contexto
Por que precisamos desta alteração agora?

## 3. Solução Proposta
Detalhamento técnico da implementação recomendada.

## 4. Alternativas Consideradas & Trade-offs
- **Alternativa 1:** Razão do descarte.
- **Riscos / Custos:** O que assumimos.
`,
  },
  {
    id: "prd",
    name: "PRD / Produto",
    description: "Requisitos de produto e jornada de usuário",
    icon: "lightbulb",
    defaultFolder: "docs/product",
    generateContent: (title) => `---
title: "${title}"
status: "draft"
type: "prd"
date: "${new Date().toISOString().split("T")[0]}"
---

# PRD: ${title}

## 1. Problema & Oportunidade
Qual dor do cliente ou meta de negócio estamos atacando?

## 2. Objetivos & Métricas de Sucesso
- **Meta Principal:** Objetivo claro.
- **KPIs:** Como saberemos se tivemos sucesso?

## 3. Histórias de Usuário & Escopo
- **Como** [usuário], **eu quero** [ação], **para** [benefício].

### No Escopo (In-Scope)
- [ ] Item 1

### Fora de Escopo (Out-of-Scope)
- O que não faremos nesta versão.
`,
  },
  {
    id: "spec",
    name: "Tech Spec / API",
    description: "Especificação técnica e contratos de interface",
    icon: "code",
    defaultFolder: "docs/specs",
    generateContent: (title) => `---
title: "${title}"
status: "draft"
type: "tech-spec"
version: "1.0.0"
---

# Tech Spec: ${title}

## 1. Visão Geral do Componente
Descrição técnica, dependências e integrações.

## 2. Contratos de API & Tipagem
\`\`\`json
{
  "endpoint": "/api/v1/resource",
  "status": "active"
}
\`\`\`

## 3. Validações & Regras
- [ ] Validação de entrada.
- [ ] Tratamento de erros.
`,
  },
  {
    id: "notes",
    name: "Ata / Notas",
    description: "Alinhamento, ata de reunião e decisões",
    icon: "event_note",
    defaultFolder: "notes",
    generateContent: (title) => `---
title: "${title}"
status: "approved"
type: "meeting-notes"
date: "${new Date().toISOString().split("T")[0]}"
---

# 📝 ${title}

- **Data:** ${new Date().toISOString().split("T")[0]}
- **Participantes:** @equipe

## 1. Pauta
1. Tópico 1
2. Tópico 2

## 2. Decisões Acordadas
- ✅ Decisão principal

## 3. Próximos Passos
- [ ] Ação 1 (@responsável)
`,
  },
];

export const ScaffoldModal: React.FC<ScaffoldModalProps> = ({
  isOpen,
  onClose,
  defaultType = "rfc",
  onCreated,
}) => {
  const { loadTree, loadFile } = useWorkspace();
  const [selectedPresetId, setSelectedPresetId] = useState<string>(
    defaultType === "spec" ? "spec" : "rfc",
  );
  const [targetFolder, setTargetFolder] = useState<string>("docs");
  const [docName, setDocName] = useState("");
  const [docTitle, setDocTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const currentPreset =
    PRESETS.find((p) => p.id === selectedPresetId) || PRESETS[0];

  const handleSelectPreset = (preset: DocPreset) => {
    setSelectedPresetId(preset.id);
    setTargetFolder(preset.defaultFolder);
  };

  const rawSlug = docName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\-_]/g, "-")
    .replace(/-+/g, "-");
  const slug =
    rawSlug ||
    (selectedPresetId === "rfc" ? "rfc-001-proposta" : "meu-documento");
  const finalFolder = targetFolder.trim().replace(/^\/+|\/+$/g, "");
  const targetPath = finalFolder ? `${finalFolder}/${slug}.md` : `${slug}.md`;

  const handleSlugChange = (val: string) => {
    setDocName(val);
    if (!docTitle) {
      setDocTitle(
        val.replace(/[-_]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      );
    }
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    const title = docTitle.trim() || slug;
    const content = currentPreset.generateContent(title, slug);

    try {
      const res = await API.createProjectFile({
        path: targetPath,
        content,
      });

      if (res.ok) {
        await loadTree();
        await loadFile(targetPath);
        if (onCreated) onCreated(targetPath);
        onClose();
      }
    } catch (err) {
      console.error("[ScaffoldModal] Erro ao criar documento:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="scaffold-wizard-modal"
      className="modal-backdrop"
      style={{ display: "flex" }}
    >
      <div className="modal-box" style={{ maxWidth: "620px" }}>
        <div className="modal-header">
          <div>
            <h3>Criar Novo Documento</h3>
            <span className="subtitle">
              Escolha um modelo ou estruture livremente um documento para su
            </span>
          </div>
          <button className="btn-close" aria-label="Fechar" onClick={onClose}>
            <span className="material-symbols-outlined icon-sm">close</span>
          </button>
        </div>

        <div className="modal-body" style={{ gap: "16px" }}>
          {/* Preset Selector Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "10px",
            }}
          >
            {PRESETS.map((preset) => {
              const isSelected = preset.id === selectedPresetId;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px",
                    borderRadius: "8px",
                    border: isSelected
                      ? "2px solid var(--color-primary, #6366f1)"
                      : "1px solid var(--color-outline-variant, #e2e8f0)",
                    background: isSelected
                      ? "var(--color-primary-container, #eef2ff)"
                      : "var(--color-surface, #ffffff)",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{
                      fontSize: "22px",
                      color: isSelected
                        ? "var(--color-primary, #6366f1)"
                        : "var(--color-on-surface-variant, #64748b)",
                    }}
                  >
                    {preset.icon}
                  </span>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                    }}
                  >
                    <strong
                      style={{
                        fontSize: "13px",
                        color: "var(--color-on-surface, #1e293b)",
                      }}
                    >
                      {preset.name}
                    </strong>
                    <span
                      style={{
                        fontSize: "11px",
                        color: "var(--color-outline, #64748b)",
                      }}
                    >
                      {preset.description}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
            }}
          >
            <div className="form-group">
              <label htmlFor="scaffold-folder">Pasta de Destino:</label>
              <input
                id="scaffold-folder"
                type="text"
                className="form-input"
                placeholder="ex: docs, rfcs, notes"
                value={targetFolder}
                onChange={(e) => setTargetFolder(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="scaffold-doc-name">Nome do Arquivo (Slug):</label>
              <input
                id="scaffold-doc-name"
                type="text"
                className="form-input"
                placeholder="ex: autenticacao-oauth, release-v1"
                value={docName}
                onChange={(e) => handleSlugChange(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="scaffold-doc-title">Título do Documento:</label>
            <input
              id="scaffold-doc-title"
              type="text"
              className="form-input"
              placeholder="ex: Proposta de Autenticação OAuth2 e SSO"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
            />
          </div>

          <div
            style={{
              background: "var(--color-surface-container, #f8fafc)",
              padding: "10px 14px",
              borderRadius: "6px",
              fontSize: "12px",
              border: "1px solid var(--color-outline-variant, #e2e8f0)",
            }}
          >
            <span style={{ color: "var(--color-outline, #64748b)" }}>
              Arquivo gerado:{" "}
            </span>
            <code
              style={{
                fontFamily: "var(--font-mono, monospace)",
                fontWeight: 600,
                color: "var(--color-primary, #6366f1)",
              }}
            >
              {targetPath}
            </code>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Criando..." : "Criar Documento"}
          </button>
        </div>
      </div>
    </div>
  );
};
