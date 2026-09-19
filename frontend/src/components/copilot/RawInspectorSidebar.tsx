import React from 'react';

interface RawInspectorSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  rawPayload: any;
  rawResponse: any;
  docPath?: string;
}

export const RawInspectorSidebar: React.FC<RawInspectorSidebarProps> = ({
  isOpen,
  onClose,
  rawPayload,
  rawResponse,
  docPath = 'index.md'
}) => {
  if (!isOpen) return null;

  const handleExport = () => {
    const dataStr = JSON.stringify({ rawPayload, rawResponse }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `raw-telemetry-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <aside className="ai-copilot-prompt-sidebar ai-copilot-raw-sidebar" style={{ display: 'flex' }}>
      <div className="ai-prompt-sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <span className="material-symbols-outlined icon-sm" style={{ color: 'var(--primary, #2563eb)', flexShrink: 0 }}>
            terminal
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <strong style={{ fontSize: '13px', color: 'var(--text-heading, #0f172a)', whiteSpace: 'nowrap' }}>
              Inspetor RAW & Telemetria
            </strong>
            <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Context OS &bull; <span className="ai-copilot-history-path-tag">{docPath}</span>
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            className="btn btn-ghost btn-xs ai-copilot-export-raw-btn"
            type="button"
            title="Exportar histórico RAW para arquivo JSON"
            style={{ fontSize: '10.5px', padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
            onClick={handleExport}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>download</span> Exportar
          </button>
          <button
            className="btn-icon ai-copilot-close-raw-sidebar-btn"
            type="button"
            title="Fechar inspetor RAW"
            onClick={onClose}
          >
            <span className="material-symbols-outlined icon-sm">close</span>
          </button>
        </div>
      </div>

      <div className="ai-raw-sidebar-body" style={{ padding: '14px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-heading, #0f172a)', display: 'block', marginBottom: '6px' }}>
            Último Payload Enviado (Context OS):
          </span>
          <pre style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', fontSize: '11px', fontFamily: 'var(--font-mono, monospace)', border: '1px solid var(--border-color, #e2e8f0)', overflowX: 'auto', maxHeight: '240px' }}>
            {JSON.stringify(rawPayload || { note: 'Nenhum payload registrado nesta sessão' }, null, 2)}
          </pre>
        </div>

        <div>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-heading, #0f172a)', display: 'block', marginBottom: '6px' }}>
            Última Resposta / Stream do Servidor:
          </span>
          <pre style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', fontSize: '11px', fontFamily: 'var(--font-mono, monospace)', border: '1px solid var(--border-color, #e2e8f0)', overflowX: 'auto', maxHeight: '240px' }}>
            {JSON.stringify(rawResponse || { note: 'Aguardando resposta do modelo' }, null, 2)}
          </pre>
        </div>
      </div>
    </aside>
  );
};
