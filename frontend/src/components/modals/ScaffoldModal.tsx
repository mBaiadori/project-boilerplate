import React, { useState } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { API } from "../../services/api";
import { Modal, Button, FormField, Input } from "../ui";
import {
  FilePlus,
  MessageSquare,
  Lightbulb,
  Code2,
  CalendarCheck,
} from "lucide-react";

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
  icon: React.ReactNode;
  defaultFolder: string;
  generateContent: (title: string, slug: string) => string;
}

const PRESETS: DocPreset[] = [
  {
    id: "rfc",
    name: "RFC / Proposta",
    description: "Proposta técnica e decisão para o time",
    icon: <MessageSquare size={20} />,
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
    icon: <Lightbulb size={20} />,
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
    icon: <Code2 size={20} />,
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
    icon: <CalendarCheck size={20} />,
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FilePlus size={20} style={{ color: "var(--md-sys-color-primary, #1a73e8)" }} />
          <span>Criar Novo Documento</span>
        </div>
      }
      subtitle="Escolha um modelo e estruture um documento no workspace"
      footer={
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", width: "100%" }}>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleConfirm}
            isLoading={isSubmitting}
          >
            Criar Documento
          </Button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Grade de Modelos */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 10,
          }}
        >
          {PRESETS.map((preset) => {
            const isSelected = preset.id === selectedPresetId;
            return (
              <div
                key={preset.id}
                onClick={() => handleSelectPreset(preset)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: 12,
                  borderRadius: 8,
                  border: isSelected
                    ? "2px solid var(--md-sys-color-primary, #1a73e8)"
                    : "1px solid var(--md-sys-color-outline-variant, #dadce0)",
                  background: isSelected
                    ? "var(--md-sys-color-primary-container, #d2e3fc)"
                    : "var(--md-sys-color-surface, #ffffff)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <div
                  style={{
                    color: isSelected
                      ? "var(--md-sys-color-on-primary-container, #041e49)"
                      : "var(--md-sys-color-on-surface-variant, #5f6368)",
                  }}
                >
                  {preset.icon}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <strong
                    style={{
                      fontSize: "13px",
                      color: isSelected
                        ? "var(--md-sys-color-on-primary-container, #041e49)"
                        : "var(--md-sys-color-on-surface, #202124)",
                    }}
                  >
                    {preset.name}
                  </strong>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "var(--md-sys-color-on-surface-variant, #5f6368)",
                    }}
                  >
                    {preset.description}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Campos de Pasta e Nome */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FormField label="Pasta de Destino:">
            <Input
              id="scaffold-folder"
              placeholder="ex: docs, rfcs, notes"
              value={targetFolder}
              onChange={(e) => setTargetFolder(e.target.value)}
            />
          </FormField>

          <FormField label="Nome do Arquivo (Slug):">
            <Input
              id="scaffold-doc-name"
              placeholder="ex: autenticacao-oauth"
              value={docName}
              onChange={(e) => handleSlugChange(e.target.value)}
            />
          </FormField>
        </div>

        <FormField label="Título do Documento:">
          <Input
            id="scaffold-doc-title"
            placeholder="ex: Proposta de Autenticação OAuth2 e SSO"
            value={docTitle}
            onChange={(e) => setDocTitle(e.target.value)}
          />
        </FormField>

        {/* Preview do Caminho Gerado */}
        <div
          style={{
            background: "var(--md-sys-color-surface-container-low, #f8f9fa)",
            padding: "10px 14px",
            borderRadius: 6,
            fontSize: "12.5px",
            border: "1px solid var(--md-sys-color-outline-variant, #dadce0)",
          }}
        >
          <span style={{ color: "var(--md-sys-color-on-surface-variant, #5f6368)" }}>
            Arquivo gerado:{" "}
          </span>
          <code
            style={{
              fontFamily: "var(--md-sys-typescale-font-code, monospace)",
              fontWeight: 600,
              color: "var(--md-sys-color-primary, #1a73e8)",
            }}
          >
            {targetPath}
          </code>
        </div>
      </div>
    </Modal>
  );
};
