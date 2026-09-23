import React, { useState, useMemo } from 'react';
import { marked } from 'marked';
import { generateVisualMarkdownDiffHtml, computeVisualDiffStats } from '../../utils/rich-diff';

interface VisualMarkdownDiffProps {
  oldContent: string;
  newContent: string;
  oldTitle?: string;
  newTitle?: string;
  fileName?: string;
  blameData?: Array<{ line: number; author: string; date: string; commit: string; content: string }>;
  showAuthorship?: boolean;
  onRestoreOldVersion?: () => void;
  onClose?: () => void;
}

export const VisualMarkdownDiff: React.FC<VisualMarkdownDiffProps> = ({
  oldContent,
  newContent,
  oldTitle = 'Versão Base Publicada',
  newTitle = 'Rascunho Atual (Em Edição)',
  fileName,
  blameData,
  showAuthorship = false,
  onRestoreOldVersion,
  onClose,
}) => {
  const [viewMode, setViewMode] = useState<'inline' | 'split'>('inline');

  const stats = useMemo(() => {
    return computeVisualDiffStats(oldContent, newContent);
  }, [oldContent, newContent]);

  const inlineDiffHtml = useMemo(() => {
    return generateVisualMarkdownDiffHtml(oldContent, newContent);
  }, [oldContent, newContent]);

  const oldRenderedHtml = useMemo(() => {
    return marked.parse(oldContent || '') as string;
  }, [oldContent]);

  const newRenderedHtml = useMemo(() => {
    return marked.parse(newContent || '') as string;
  }, [newContent]);

  return (
    <div className="visual-markdown-diff-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-surface, #ffffff)', overflow: 'hidden' }}>
      
      {/* Top Controls & Metrics Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: '1px solid var(--border-color, #e2e8f0)',
          background: 'var(--bg-surface-secondary, #f8fafc)',
          gap: '12px',
          flexWrap: 'wrap'
        }}
      >
        {/* Left: File name & Diff Summary */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--primary, #3b82f6)', fontSize: '20px' }}>
            compare
          </span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <strong style={{ fontSize: '13.5px', color: 'var(--text-heading, #0f172a)' }}>
                {fileName || 'Comparação Visual do Documento'}
              </strong>
              {stats.hasChanges ? (
                <div style={{ display: 'flex', gap: '6px', fontSize: '11.5px', fontFamily: 'var(--font-mono)' }}>
                  <span style={{ color: '#16a34a', background: '#dcfce7', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                    +{stats.addedWords} palavras (+{stats.addedLines} linhas)
                  </span>
                  <span style={{ color: '#dc2626', background: '#fee2e2', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                    -{stats.removedWords} palavras (-{stats.removedLines} linhas)
                  </span>
                </div>
              ) : (
                <span className="badge badge-neutral" style={{ fontSize: '11px' }}>Idêntico (Sem alterações)</span>
              )}
            </div>
            <span style={{ fontSize: '11.5px', color: 'var(--text-muted, #64748b)', display: 'block', marginTop: '2px' }}>
              Comparando <strong>{oldTitle}</strong> com <strong>{newTitle}</strong>
            </span>
          </div>
        </div>

        {/* Right: View mode switcher & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* View Mode Switcher */}
          <div style={{ display: 'inline-flex', background: 'var(--border-color, #e2e8f0)', padding: '2px', borderRadius: '6px' }}>
            <button
              type="button"
              onClick={() => setViewMode('inline')}
              style={{
                padding: '4px 10px',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                background: viewMode === 'inline' ? '#ffffff' : 'transparent',
                color: viewMode === 'inline' ? 'var(--primary, #2563eb)' : 'var(--text-muted, #64748b)',
                boxShadow: viewMode === 'inline' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span className="material-symbols-outlined icon-xs">view_stream</span>
              Unificado (Inline)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              style={{
                padding: '4px 10px',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                background: viewMode === 'split' ? '#ffffff' : 'transparent',
                color: viewMode === 'split' ? 'var(--primary, #2563eb)' : 'var(--text-muted, #64748b)',
                boxShadow: viewMode === 'split' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span className="material-symbols-outlined icon-xs">vertical_split</span>
              Lado a Lado (Split)
            </button>
          </div>

          {onRestoreOldVersion && (
            <button
              type="button"
              className="btn btn-secondary btn-xs"
              onClick={onRestoreOldVersion}
              title="Restaurar o conteúdo da versão antiga para o documento ativo"
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <span className="material-symbols-outlined icon-xs">history_toggle_off</span>
              Restaurar Esta Versão
            </button>
          )}

          {onClose && (
            <button
              type="button"
              className="btn-icon-subtle"
              onClick={onClose}
              title="Fechar modo de comparação"
            >
              <span className="material-symbols-outlined icon-sm">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Diff Render Canvas */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
        
        {/* INLINE VIEW */}
        {viewMode === 'inline' && (
          <div
            className="prose markdown-rendered rich-visual-diff-body"
            style={{ maxWidth: '840px', margin: '0 auto', lineHeight: '1.7', fontSize: '14.5px' }}
            dangerouslySetInnerHTML={{ __html: inlineDiffHtml }}
          />
        )}

        {/* SPLIT VIEW (LADO A LADO) */}
        {viewMode === 'split' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', maxWidth: '1280px', margin: '0 auto', height: '100%' }}>
            {/* Left Column: Old Version */}
            <div style={{ border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '8px', overflow: 'hidden', background: 'var(--bg-surface, #ffffff)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '8px 14px', background: '#fef2f2', borderBottom: '1px solid #fecaca', color: '#991b1b', fontWeight: 600, fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="material-symbols-outlined icon-xs">remove_circle_outline</span>
                {oldTitle}
              </div>
              <div
                className="prose markdown-rendered"
                style={{ padding: '20px', overflowY: 'auto', flex: 1, fontSize: '14px', opacity: 0.85 }}
                dangerouslySetInnerHTML={{ __html: oldRenderedHtml || '<p style="color:#64748b;font-style:italic">Documento vazio na versão base.</p>' }}
              />
            </div>

            {/* Right Column: New Version */}
            <div style={{ border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '8px', overflow: 'hidden', background: 'var(--bg-surface, #ffffff)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '8px 14px', background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', color: '#166534', fontWeight: 600, fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="material-symbols-outlined icon-xs">add_circle_outline</span>
                {newTitle}
              </div>
              <div
                className="prose markdown-rendered"
                style={{ padding: '20px', overflowY: 'auto', flex: 1, fontSize: '14px' }}
                dangerouslySetInnerHTML={{ __html: newRenderedHtml || '<p style="color:#64748b;font-style:italic">Documento vazio na versão atual.</p>' }}
              />
            </div>
          </div>
        )}

        {/* Authorship & Contributors Overlay */}
        {showAuthorship && blameData && blameData.length > 0 && (
          <div style={{ marginTop: '32px', borderTop: '1px solid var(--border-color, #e2e8f0)', paddingTop: '16px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)' }}>
              Anotações de Autoria & Contribuidores
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '200px', overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
              {blameData.map((b, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '3px 8px', borderRadius: '4px', background: 'var(--bg-surface-secondary, #f8fafc)' }}>
                  <span style={{ color: 'var(--text-dim)', width: '32px' }}>L{b.line}</span>
                  <span className="badge badge-neutral" style={{ fontSize: '11px' }}>#{b.commit.slice(0, 7)}</span>
                  <strong style={{ color: 'var(--text-heading)', minWidth: '120px' }}>{b.author}</strong>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', minWidth: '80px' }}>{b.date}</span>
                  <span style={{ color: 'var(--text-normal)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {b.content}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Scoped Visual Diff Styles */}
      <style>{`
        .rich-visual-diff-body .rich-diff-ins,
        .rich-visual-diff-body ins {
          background-color: #dcfce7 !important;
          color: #166534 !important;
          text-decoration: none !important;
          padding: 1px 4px !important;
          border-radius: 3px !important;
          border-bottom: 2px solid #86efac !important;
          font-weight: 500 !important;
        }

        .rich-visual-diff-body .rich-diff-del,
        .rich-visual-diff-body del {
          background-color: #fee2e2 !important;
          color: #991b1b !important;
          text-decoration: line-through !important;
          padding: 1px 4px !important;
          border-radius: 3px !important;
          opacity: 0.75 !important;
          margin-right: 4px !important;
        }

        .rich-visual-diff-body .rich-diff-added {
          background-color: rgba(220, 252, 231, 0.3) !important;
          border-left: 3px solid #22c55e !important;
          padding-left: 10px !important;
          margin: 6px 0 !important;
          border-radius: 0 4px 4px 0 !important;
        }

        .rich-visual-diff-body .rich-diff-removed {
          background-color: rgba(254, 226, 226, 0.3) !important;
          border-left: 3px solid #ef4444 !important;
          padding-left: 10px !important;
          margin: 6px 0 !important;
          border-radius: 0 4px 4px 0 !important;
        }

        .rich-visual-diff-body .rich-diff-modified {
          padding: 4px 0 !important;
          margin: 4px 0 !important;
        }
      `}</style>
    </div>
  );
};
