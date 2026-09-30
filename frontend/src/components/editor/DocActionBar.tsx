import React, { useState } from "react";
import { API } from "../../services/api";
import { Button, IconButton, Modal, FormField, Textarea } from "../ui";
import {
  Copy,
  FileText,
  Download,
  FolderOpen,
  Upload,
  RefreshCw,
  Check,
  UploadCloud,
} from "lucide-react";

interface DocActionBarProps {
  filePath: string;
  content: string;
  onImportContent: (newContent: string) => void;
  onReload: () => void;
}

export const DocActionBar: React.FC<DocActionBarProps> = ({
  filePath,
  content,
  onImportContent,
  onReload,
}) => {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [copiedNotification, setCopiedNotification] = useState<string | null>(
    null,
  );

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const lineCount = content.split("\n").length;

  const showNotification = (msg: string) => {
    setCopiedNotification(msg);
    setTimeout(() => setCopiedNotification(null), 2000);
  };

  const handleOpenInOS = async () => {
    try {
      const res = await API.openInOS(filePath);
      if (res.ok) {
        showNotification("Aberto no PC!");
      } else {
        alert(
          res.data?.error ||
            "Não foi possível abrir o arquivo no sistema operacional.",
        );
      }
    } catch {
      alert("Erro ao comunicar com o servidor.");
    }
  };

  const handleCopyPath = () => {
    navigator.clipboard.writeText(filePath);
    showNotification("Caminho copiado!");
  };

  const handleCopyFullDoc = () => {
    navigator.clipboard.writeText(content);
    showNotification("Documento copiado!");
  };

  const handleExportMarkdown = () => {
    const filename = filePath.split("/").pop() || "document.md";
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".md") ? filename : `${filename}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        onImportContent(text);
        setIsImportModalOpen(false);
        showNotification("Arquivo importado com sucesso!");
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmPasteImport = () => {
    if (importText.trim()) {
      onImportContent(importText);
      setIsImportModalOpen(false);
      setImportText("");
      showNotification("Conteúdo importado com sucesso!");
    }
  };

  return (
    <>
      <div
        className="doc-action-bar"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 16px",
          borderBottom: "1px solid var(--color-outline-variant)",
          background: "var(--color-surface-container-low)",
          fontSize: "12px",
        }}
      >
        {/* Left: Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyPath}
            title="Copiar Caminho Relativo"
            icon={<Copy size={13} />}
          >
            Caminho
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyFullDoc}
            title="Copiar Todo o Conteúdo Markdown"
            icon={<FileText size={13} />}
          >
            Copiar Tudo
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleExportMarkdown}
            title="Exportar como Arquivo .md"
            icon={<Download size={13} />}
          >
            Exportar
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpenInOS}
            title="Abrir no gerenciador de arquivos do PC"
            icon={<FolderOpen size={13} />}
          >
            Abrir
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsImportModalOpen(true)}
            title="Importar Markdown Externo"
            icon={<Upload size={13} />}
          >
            Importar
          </Button>

          <IconButton
            variant="ghost"
            size="sm"
            onClick={onReload}
            tooltip="Recarregar do Disco"
            icon={<RefreshCw size={14} />}
          />
        </div>

        {/* Right: Notification & Counters */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            color: "var(--color-outline)",
          }}
        >
          {copiedNotification && (
            <span
              style={{
                color: "var(--color-success)",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Check size={14} /> {copiedNotification}
            </span>
          )}
          <span>{wordCount} palavras</span>
          <span>&bull;</span>
          <span>{lineCount} linhas</span>
        </div>
      </div>

      {/* Import Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Importar Documento Markdown"
        icon={<UploadCloud size={18} />}
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsImportModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmPasteImport}
              disabled={!importText.trim()}
              icon={<Check size={14} />}
            >
              Substituir Documento
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <FormField
            label="Opção 1: Selecionar arquivo do computador (.md)"
            helperText="Selecione um arquivo .md, .txt ou .markdown para carregar o conteúdo."
          >
            <input
              type="file"
              accept=".md,.txt,.markdown"
              onChange={handleFileUpload}
              style={{
                fontSize: "12.5px",
                color: "var(--color-on-surface)",
                padding: "6px 0",
              }}
            />
          </FormField>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                flex: 1,
                height: "1px",
                background: "var(--color-outline-variant)",
              }}
            />
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--color-outline)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              OU
            </span>
            <div
              style={{
                flex: 1,
                height: "1px",
                background: "var(--color-outline-variant)",
              }}
            />
          </div>

          <FormField
            label="Opção 2: Colar Markdown diretamente"
            helperText="Cole o código markdown bruto que substituirá o documento ativo."
          >
            <Textarea
              rows={6}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="# Cole o conteúdo Markdown aqui..."
              style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: "12.5px",
              }}
            />
          </FormField>
        </div>
      </Modal>
    </>
  );
};
