import React from "react";
import { Edit2, Trash2, Check, X, Plus } from "lucide-react";
import { ColorDotPicker } from "./ColorDotPicker";
import type { TaxonomyItem, DocumentMetadataItem } from "../../types";

export interface TaxonomyChipEditorProps {
  items: Array<TaxonomyItem | DocumentMetadataItem>;
  editingIndex: number | null;
  editName: string;
  editColor: string;
  onStartEdit: (index: number) => void;
  onEditNameChange: (val: string) => void;
  onEditColorChange: (val: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onRequestRemove: (index: number) => void;
  isAdding: boolean;
  newName: string;
  newColor: string;
  onStartAdd: () => void;
  onNewNameChange: (val: string) => void;
  onNewColorChange: (val: string) => void;
  onSaveAdd: () => void;
  onCancelAdd: () => void;
  placeholder?: string;
  addTooltip?: string;
}

export const TaxonomyChipEditor: React.FC<TaxonomyChipEditorProps> = ({
  items,
  editingIndex,
  editName,
  editColor,
  onStartEdit,
  onEditNameChange,
  onEditColorChange,
  onSaveEdit,
  onCancelEdit,
  onRequestRemove,
  isAdding,
  newName,
  newColor,
  onStartAdd,
  onNewNameChange,
  onNewColorChange,
  onSaveAdd,
  onCancelAdd,
  placeholder = "item...",
  addTooltip = "Adicionar item",
}) => {
  return (
    <div className="ui-row ui-row--wrap ui-row--align-center ui-row--xs">
      {items.map((item, idx) => {
        const isEditing = editingIndex === idx;
        const color = item.color || "#3b82f6";
        const name = (item as any).name || (item as any).id || "";

        if (isEditing) {
          return (
            <div
              key={idx}
              className="ui-taxonomy-chip-edit"
              style={{
                backgroundColor: `${editColor}16`,
                border: `1.5px solid ${editColor}`,
                color: editColor,
              }}
            >
              <ColorDotPicker
                color={editColor}
                onChange={onEditColorChange}
                size={14}
              />
              <input
                type="text"
                value={editName}
                onChange={(e) => onEditNameChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSaveEdit();
                  if (e.key === "Escape") onCancelEdit();
                }}
                className="ui-taxonomy-chip-edit__input"
                style={{
                  width: `${Math.max(editName.length, 6)}ch`,
                  color: editColor,
                }}
                autoFocus
              />
              <button
                type="button"
                onClick={onSaveEdit}
                className="ui-taxonomy-chip__action-btn"
                style={{ color: editColor }}
                title="Salvar (Enter)"
              >
                <Check size={12} />
              </button>
              <button
                type="button"
                onClick={onCancelEdit}
                className="ui-taxonomy-chip__action-btn ui-text-muted"
                title="Cancelar (Esc)"
              >
                <X size={12} />
              </button>
            </div>
          );
        }

        return (
          <div
            key={idx}
            className="ui-taxonomy-chip"
            style={{
              backgroundColor: `${color}14`,
              border: `1px solid ${color}40`,
              color: color,
            }}
          >
            <div
              className="ui-taxonomy-chip__dot"
              style={{ backgroundColor: color }}
            />
            <span
              onClick={() => onStartEdit(idx)}
              className="ui-taxonomy-chip__label"
              title="Clique para editar"
            >
              {name.toUpperCase()}
            </span>
            <div className="ui-taxonomy-chip__actions">
              <button
                type="button"
                onClick={() => onStartEdit(idx)}
                className="ui-taxonomy-chip__action-btn"
                style={{ color: color }}
                title="Editar"
              >
                <Edit2 size={10} />
              </button>
              <button
                type="button"
                onClick={() => onRequestRemove(idx)}
                className="ui-taxonomy-chip__action-btn"
                style={{ color: color }}
                title="Remover"
              >
                <Trash2 size={10} />
              </button>
            </div>
          </div>
        );
      })}

      {/* Botão + ou Chip de Adicionar */}
      {isAdding ? (
        <div
          className="ui-taxonomy-chip-edit"
          style={{
            backgroundColor: `${newColor}16`,
            border: `1.5px solid ${newColor}`,
            color: newColor,
          }}
        >
          <ColorDotPicker
            color={newColor}
            onChange={onNewColorChange}
            size={14}
          />
          <input
            type="text"
            placeholder={placeholder}
            value={newName}
            onChange={(e) => onNewNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSaveAdd();
              if (e.key === "Escape") onCancelAdd();
            }}
            className="ui-taxonomy-chip-edit__input"
            style={{
              width: `${Math.max(newName.length, 10)}ch`,
              color: newColor,
            }}
            autoFocus
          />
          <button
            type="button"
            onClick={onSaveAdd}
            disabled={!newName.trim()}
            className="ui-taxonomy-chip__action-btn"
            style={{
              color: newColor,
              opacity: newName.trim() ? 0.9 : 0.4,
              cursor: newName.trim() ? "pointer" : "default",
            }}
            title="Criar (Enter)"
          >
            <Check size={12} />
          </button>
          <button
            type="button"
            onClick={onCancelAdd}
            className="ui-taxonomy-chip__action-btn ui-text-muted"
            title="Cancelar (Esc)"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onStartAdd}
          className="ui-chip-add-btn"
          title={addTooltip}
        >
          <Plus size={13} />
        </button>
      )}
    </div>
  );
};
