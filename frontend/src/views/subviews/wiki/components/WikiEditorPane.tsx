import React from "react";
import { Check } from "lucide-react";
import { Button, FormField, Input, Textarea } from "../../../../components/ui";
import { CATEGORY_META, type WikiEntry } from "../types";

interface WikiEditorPaneProps {
  activeEntry: WikiEntry | null;
  onCancel: () => void;
  onSave: () => void;
  editCategory: string;
  setEditCategory: (val: string) => void;
  editTitle: string;
  setEditTitle: (val: string) => void;
  editSlug: string;
  setEditSlug: (val: string) => void;
  editContent: string;
  setEditContent: (val: string) => void;
}

export const WikiEditorPane: React.FC<WikiEditorPaneProps> = ({
  activeEntry,
  onCancel,
  onSave,
  editCategory,
  setEditCategory,
  editTitle,
  setEditTitle,
  editSlug,
  setEditSlug,
  editContent,
  setEditContent,
}) => {
  return (
    <div
      style={{
        maxWidth: "800px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--color-outline-variant)",
          paddingBottom: "14px",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "var(--color-on-surface)" }}>
          {activeEntry ? "Editar Nota do Wiki" : "Nova Nota no Wiki"}
        </h3>
        <div style={{ display: "flex", gap: "8px" }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={onCancel}
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onSave}
            disabled={!editTitle.trim()}
            icon={<Check size={14} />}
          >
            Salvar Nota
          </Button>
        </div>
      </div>

      <FormField label="Categoria">
        <select
          value={editCategory}
          onChange={(e) => setEditCategory(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: "var(--radius-md, 8px)",
            border: "1px solid var(--color-outline-variant)",
            background: "var(--color-surface-container)",
            color: "var(--color-on-surface)",
            fontSize: "13px",
            outline: "none",
          }}
        >
          {Object.entries(CATEGORY_META).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Título da Nota" required>
        <Input
          placeholder="ex: ADR 0002: Cache Distribuído com Redis"
          value={editTitle}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setEditTitle(e.target.value);
            if (!editSlug) {
              setEditSlug(
                e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9\-_]/g, "-")
              );
            }
          }}
        />
      </FormField>

      <FormField label="Slug (Identificador do Arquivo)">
        <Input
          placeholder="ex: 0002-cache-redis"
          value={editSlug}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditSlug(e.target.value)}
        />
      </FormField>

      <FormField label="Conteúdo Markdown" required>
        <Textarea
          rows={16}
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "13px",
            lineHeight: 1.6,
          }}
          placeholder="## Contexto & Decisão..."
          value={editContent}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditContent(e.target.value)}
        />
      </FormField>
    </div>
  );
};
