import React from 'react';

interface RawInspectorSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  rawPayload: any;
  rawResponse: any;
}

export const RawInspectorSidebar: React.FC<RawInspectorSidebarProps> = ({
  isOpen,
  onClose,
  rawPayload,
  rawResponse
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="copilot-nested-sidebar"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'var(--color-surface)',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        padding: '16px',
        overflowY: 'auto'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid var(--color-outline-variant)', paddingBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-primary)' }}>
            data_object
          </span>
          <strong style={{ fontSize: '14px' }}>Payload Raw & Raciocínio</strong>
        </div>
        <button className="btn-close" onClick={onClose}>
          <span className="material-symbols-outlined icon-sm">close</span>
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-outline)', display: 'block', marginBottom: '6px' }}>
            Último Payload Enviado (Prompt + Injeção de Contexto):
          </span>
          <pre style={{ background: 'var(--color-surface-container-lowest)', padding: '12px', borderRadius: '6px', fontSize: '11px', fontFamily: 'var(--font-mono)', overflowX: 'auto', maxHeight: '200px' }}>
            {JSON.stringify(rawPayload || { note: 'Nenhum payload registrado nesta sessão' }, null, 2)}
          </pre>
        </div>

        <div>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-outline)', display: 'block', marginBottom: '6px' }}>
            Última Resposta Bruta do Servidor:
          </span>
          <pre style={{ background: 'var(--color-surface-container-lowest)', padding: '12px', borderRadius: '6px', fontSize: '11px', fontFamily: 'var(--font-mono)', overflowX: 'auto', maxHeight: '200px' }}>
            {JSON.stringify(rawResponse || { note: 'Nenhuma resposta registrada' }, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
};
