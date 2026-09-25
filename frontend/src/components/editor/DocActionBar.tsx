import React, { useState } from 'react';
import { API } from '../../services/api';

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
  onReload
}) => {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const lineCount = content.split('\n').length;

  const showNotification = (msg: string) => {
    setCopiedNotification(msg);
    setTimeout(() => setCopiedNotification(null), 2000);
  };

  const handleOpenInOS = async () => {
    try {
      const res = await API.openInOS(filePath);
      if (res.ok) {
        showNotification('Aberto no PC!');
      } else {
        alert(res.data?.error || 'Não foi possível abrir o arquivo no sistema operacional.');
      }
    } catch {
      alert('Erro ao comunicar com o servidor.');
    }
  };

  const handleCopyPath = () => {
    navigator.clipboard.writeText(filePath);
    showNotification('Caminho copiado!');
  };

  const handleCopyFullDoc = () => {
    navigator.clipboard.writeText(content);
    showNotification('Documento copiado!');
  };

  const handleExportMarkdown = () => {
    const filename = filePath.split('/').pop() || 'document.md';
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.md') ? filename : `${filename}.md`;
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
        showNotification('Arquivo importado com sucesso!');
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmPasteImport = () => {
    if (importText.trim()) {
      onImportContent(importText);
      setIsImportModalOpen(false);
      setImportText('');
      showNotification('Conteúdo importado com sucesso!');
    }
  };

  return (
    <>
      <div
        className="doc-action-bar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 16px',
          borderBottom: '1px solid var(--color-outline-variant)',
          background: 'var(--color-surface-container-low)',
          fontSize: '12px'
        }}
      >
        {/* Left: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={handleCopyPath}
            title="Copiar Caminho Relativo"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <span className="material-symbols-outlined icon-xs">content_copy</span>
            Caminho
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={handleCopyFullDoc}
            title="Copiar Todo o Conteúdo Markdown"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <span className="material-symbols-outlined icon-xs">file_copy</span>
            Copiar Tudo
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={handleExportMarkdown}
            title="Exportar como Arquivo .md"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <span className="material-symbols-outlined icon-xs">download</span>
            Exportar
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={handleOpenInOS}
            title="Abrir no gerenciador de arquivos do PC (Finder / Explorer)"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <span className="material-symbols-outlined icon-xs">folder_open</span>
            Abrir no PC
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => setIsImportModalOpen(true)}
            title="Importar Markdown Externo"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <span className="material-symbols-outlined icon-xs">upload_file</span>
            Importar
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={onReload}
            title="Recarregar do Disco"
          >
            <span className="material-symbols-outlined icon-xs">refresh</span>
          </button>
        </div>

        {/* Right: Notification & Counters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--color-outline)' }}>
          {copiedNotification && (
            <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>
              ✓ {copiedNotification}
            </span>
          )}
          <span>{wordCount} palavras</span>
          <span>&bull;</span>
          <span>{lineCount} linhas</span>
        </div>
      </div>

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="modal-backdrop" style={{ display: 'flex' }}>
          <div className="modal-box" style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h3>Importar Documento Markdown</h3>
              <button className="btn-close" onClick={() => setIsImportModalOpen(false)}>
                <span className="material-symbols-outlined icon-sm">close</span>
              </button>
            </div>

            <div className="modal-body" style={{ gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Opção 1: Selecionar arquivo do computador (.md)
                </label>
                <input
                  type="file"
                  accept=".md,.txt,.markdown"
                  onChange={handleFileUpload}
                  className="form-input"
                />
              </div>

              <div className="divider"><span>OU</span></div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Opção 2: Colar Markdown diretamente
                </label>
                <textarea
                  rows={6}
                  className="form-input"
                  value={importText}
                  onChange={e => setImportText(e.target.value)}
                  placeholder="# Cole o conteúdo Markdown aqui..."
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setIsImportModalOpen(false)}>Cancelar</button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleConfirmPasteImport}
                disabled={!importText.trim()}
              >
                Substituir Documento
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
