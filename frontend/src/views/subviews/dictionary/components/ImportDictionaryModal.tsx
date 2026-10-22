import React from "react";
import { AlertCircle, Check, Upload } from "lucide-react";
import { Button, FormField, Modal, Spinner, Textarea } from "../../../../components/ui";

interface ImportDictionaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  importJsonText: string;
  setImportJsonText: (val: string) => void;
  importError: string;
  isSaving: boolean;
  onApplyImport: () => void;
}

export const ImportDictionaryModal: React.FC<ImportDictionaryModalProps> = ({
  isOpen,
  onClose,
  importJsonText,
  setImportJsonText,
  importError,
  isSaving,
  onApplyImport,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Importar Dicionário JSON"
      subtitle="Cole um array de termos ou objeto com a propriedade 'terms' para atualizar o dicionário"
      icon={<Upload size={18} />}
      size="md"
      footer={
        <>
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onApplyImport}
            disabled={!importJsonText.trim() || isSaving}
            icon={isSaving ? <Spinner size="sm" /> : <Check size={14} />}
          >
            {isSaving ? "Importando..." : "Substituir Dicionário"}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <FormField
          label="Conteúdo JSON"
          required
          helperText="Formato: [{ 'term': '...', 'codename': '...', 'domain': '...', 'category': '...', 'definition': '...', 'context': '...', 'synonyms': [...] }]"
        >
          <Textarea
            id="dict-import-textarea"
            rows={8}
            placeholder={`[\n  {\n    "term": "Chave de Idempotência",\n    "codename": "IDEMPOTENCY_KEY",\n    "domain": "arquitetura",\n    "category": "Value Object",\n    "definition": "Identificador exclusivo para evitar duplicidade de operações.",\n    "context": "apis, mensageria",\n    "synonyms": ["Idempotency Key", "Chave Única"]\n  }\n]`}
            value={importJsonText}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setImportJsonText(e.target.value)}
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "12px",
            }}
          />
        </FormField>

        {importError && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "6px",
              background: "var(--color-error-container, #fee2e2)",
              color: "var(--color-error, #b91c1c)",
              fontSize: "12.5px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <AlertCircle size={16} />
            <span>{importError}</span>
          </div>
        )}
      </div>
    </Modal>
  );
};
