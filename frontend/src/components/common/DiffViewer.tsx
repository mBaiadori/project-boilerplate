import React from 'react';

export interface DiffViewerProps {
  diffText?: string;
  isLoading?: boolean;
  maxHeight?: string;
  emptyMessage?: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  diffText = '',
  isLoading = false,
  maxHeight = '380px',
  emptyMessage = 'Nenhuma alteração de texto detectada neste arquivo (ou arquivo binário).',
}) => {
  if (isLoading) {
    return (
      <div
        className="ui-empty-state"
        style={{
          padding: '20px',
          background: 'var(--md-sys-color-surface-container-low, #f8f9fa)',
          borderRadius: '0 0 var(--md-shape-corner-sm, 8px) var(--md-shape-corner-sm, 8px)',
          borderTop: '1px solid var(--md-sys-color-outline-variant, #dadce0)',
        }}
      >
        <div className="ui-row ui-row--align-center ui-row--sm">
          <span
            className="material-symbols-outlined"
            style={{
              animation: 'spin 1s linear infinite',
              fontSize: '18px',
              color: 'var(--md-sys-color-primary, #1a73e8)',
            }}
          >
            progress_activity
          </span>
          <span className="ui-text-muted" style={{ fontSize: '13px' }}>
            Carregando comparativo detalhado de mudanças...
          </span>
        </div>
      </div>
    );
  }

  if (!diffText || !diffText.trim()) {
    return (
      <div
        style={{
          padding: '16px 20px',
          color: 'var(--md-sys-color-on-surface-variant, #64748b)',
          fontSize: '12.5px',
          fontStyle: 'italic',
          background: 'var(--md-sys-color-surface-container-low, #f8f9fa)',
          borderRadius: '0 0 var(--md-shape-corner-sm, 8px) var(--md-shape-corner-sm, 8px)',
          borderTop: '1px solid var(--md-sys-color-outline-variant, #dadce0)',
        }}
      >
        {emptyMessage}
      </div>
    );
  }

  const lines = diffText.split('\n');

  return (
    <pre className="ui-diff-viewer" style={{ maxHeight }}>
      {lines.map((line, idx) => {
        let lineClass = 'ui-diff-line';

        if (line.startsWith('+') && !line.startsWith('+++')) {
          lineClass += ' ui-diff-line--add';
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          lineClass += ' ui-diff-line--del';
        } else if (line.startsWith('@@')) {
          lineClass += ' ui-diff-line--hunk';
        } else if (
          line.startsWith('diff ') ||
          line.startsWith('index ') ||
          line.startsWith('--- ') ||
          line.startsWith('+++ ')
        ) {
          lineClass += ' ui-diff-line--header';
        }

        return (
          <div key={idx} className={lineClass}>
            <span className="ui-diff-line__num">{idx + 1}</span>
            <span style={{ flex: 1 }}>{line || ' '}</span>
          </div>
        );
      })}
    </pre>
  );
};
