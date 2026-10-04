import React, { useState, useMemo } from 'react';
import { marked } from 'marked';
import {
  generateVisualMarkdownDiffHtml,
  computeVisualDiffStats,
  computeLineDiff,
  type DiffLineItem,
} from '../../utils/rich-diff';

interface VisualMarkdownDiffProps {
  oldContent: string;
  newContent: string;
  oldTitle?: string;
  newTitle?: string;
  fileName?: string;
  initialViewMode?: 'split' | 'lines' | 'inline';
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
  initialViewMode = 'split',
  blameData,
  showAuthorship = false,
  onRestoreOldVersion,
  onClose,
}) => {
  const [viewMode, setViewMode] = useState<'split' | 'lines' | 'inline'>(initialViewMode);

  const stats = useMemo(() => {
    return computeVisualDiffStats(oldContent, newContent);
  }, [oldContent, newContent]);

  const lineDiffItems = useMemo<DiffLineItem[]>(() => {
    return computeLineDiff(oldContent, newContent);
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
    <div
      className="visual-markdown-diff-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-surface, #ffffff)',
        overflow: 'hidden',
      }}
    >
      {/* Top Controls & Metrics Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          borderBottom: '1px solid var(--border-color, #e2e8f0)',
          background: 'var(--bg-surface-secondary, #f8fafc)',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        {/* Left: File name & Diff Summary */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--primary, #2563eb)', fontSize: '20px' }}>
            compare
          </span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <strong style={{ fontSize: '13px', color: 'var(--text-heading, #0f172a)' }}>
                {fileName || 'Comparação de Alterações'}
              </strong>
              {stats.hasChanges ? (
                <div style={{ display: 'flex', gap: '6px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                  <span style={{ color: '#16a34a', background: '#dcfce7', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                    +{stats.addedWords} palavras (+{stats.addedLines} lin)
                  </span>
                  <span style={{ color: '#dc2626', background: '#fee2e2', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                    -{stats.removedWords} palavras (-{stats.removedLines} lin)
                  </span>
                </div>
              ) : (
                <span className="badge badge-neutral" style={{ fontSize: '11px' }}>Idêntico (Sem alterações)</span>
              )}
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', display: 'block', marginTop: '1px' }}>
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
              onClick={() => setViewMode('split')}
              style={{
                padding: '4px 9px',
                border: 'none',
                borderRadius: '4px',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
                background: viewMode === 'split' ? '#ffffff' : 'transparent',
                color: viewMode === 'split' ? 'var(--primary, #2563eb)' : 'var(--text-muted, #64748b)',
                boxShadow: viewMode === 'split' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span className="material-symbols-outlined icon-xs">vertical_split</span>
              Lado a Lado
            </button>
            <button
              type="button"
              onClick={() => setViewMode('inline')}
              style={{
                padding: '4px 9px',
                border: 'none',
                borderRadius: '4px',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
                background: viewMode === 'inline' ? '#ffffff' : 'transparent',
                color: viewMode === 'inline' ? 'var(--primary, #2563eb)' : 'var(--text-muted, #64748b)',
                boxShadow: viewMode === 'inline' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span className="material-symbols-outlined icon-xs">view_stream</span>
              Unificado
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
              Restaurar
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
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', minHeight: 0 }}>
        
        {/* SPLIT VIEW (LADO A LADO - PADRÃO) */}
        {viewMode === 'split' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', height: '100%', minHeight: '380px' }}>
            {/* Left Column: Old Version */}
            <div
              style={{
                border: '1px solid var(--border-color, #e2e8f0)',
                borderRadius: '8px',
                overflow: 'hidden',
                background: 'var(--bg-surface, #ffffff)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  padding: '8px 14px',
                  background: '#fef2f2',
                  borderBottom: '1px solid #fecaca',
                  color: '#991b1b',
                  fontWeight: 600,
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="material-symbols-outlined icon-xs">history</span>
                  <span>{oldTitle}</span>
                </div>
                <span style={{ fontSize: '10px', background: '#fee2e2', padding: '1px 6px', borderRadius: '4px' }}>
                  OFICIAL ATUAL
                </span>
              </div>
              <div
                className="prose markdown-rendered"
                style={{ padding: '16px', overflowY: 'auto', flex: 1, fontSize: '13.5px', opacity: 0.9, lineHeight: 1.6 }}
                dangerouslySetInnerHTML={{
                  __html: oldRenderedHtml || '<p style="color:#64748b;font-style:italic">Documento vazio na versão oficial.</p>',
                }}
              />
            </div>

            {/* Right Column: New Version */}
            <div
              style={{
                border: '1px solid var(--border-color, #e2e8f0)',
                borderRadius: '8px',
                overflow: 'hidden',
                background: 'var(--bg-surface, #ffffff)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  padding: '8px 14px',
                  background: '#f0fdf4',
                  borderBottom: '1px solid #bbf7d0',
                  color: '#166534',
                  fontWeight: 600,
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="material-symbols-outlined icon-xs">check_circle</span>
                  <span>{newTitle}</span>
                </div>
                <span style={{ fontSize: '10px', background: '#dcfce7', padding: '1px 6px', borderRadius: '4px' }}>
                  NOVA PROPOSTA
                </span>
              </div>
              <div
                className="prose markdown-rendered"
                style={{ padding: '16px', overflowY: 'auto', flex: 1, fontSize: '13.5px', lineHeight: 1.6 }}
                dangerouslySetInnerHTML={{
                  __html: newRenderedHtml || '<p style="color:#64748b;font-style:italic">Documento vazio na versão traduzida.</p>',
                }}
              />
            </div>
          </div>
        )}

        {/* LINES VIEW (ESTILO PR / CODE DIFF) */}
        {viewMode === 'lines' && (
          <div
            style={{
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: '8px',
              overflow: 'hidden',
              background: '#0d1117',
              color: '#c9d1d9',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '12px',
              lineHeight: '1.5',
            }}
          >
            <div
              style={{
                padding: '8px 14px',
                background: '#161b22',
                borderBottom: '1px solid #30363d',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ color: '#8b949e', fontWeight: 600 }}>Diff Linha por Linha (Markdown Source)</span>
              <span style={{ color: '#8b949e' }}>{lineDiffItems.length} linhas analisadas</span>
            </div>
            <div style={{ overflowX: 'auto', padding: '6px 0' }}>
              {lineDiffItems.map((item, idx) => {
                const isAdded = item.type === 'added';
                const isRemoved = item.type === 'removed';
                const bg = isAdded ? 'rgba(46, 160, 67, 0.18)' : isRemoved ? 'rgba(248, 81, 73, 0.18)' : 'transparent';
                const textColor = isAdded ? '#7ee787' : isRemoved ? '#ff7b72' : '#c9d1d9';
                const symbol = isAdded ? '+' : isRemoved ? '-' : ' ';

                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      background: bg,
                      color: textColor,
                      padding: '1px 8px',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}
                  >
                    <span style={{ width: '40px', color: '#484f58', textAlign: 'right', paddingRight: '8px', userSelect: 'none' }}>
                      {item.oldLineNumber || ''}
                    </span>
                    <span style={{ width: '40px', color: '#484f58', textAlign: 'right', paddingRight: '12px', userSelect: 'none' }}>
                      {item.newLineNumber || ''}
                    </span>
                    <span style={{ width: '16px', userSelect: 'none', fontWeight: 700 }}>{symbol}</span>
                    <span style={{ flex: 1 }}>{item.content || ' '}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* INLINE VIEW */}
        {viewMode === 'inline' && (
          <div
            className="prose markdown-rendered rich-visual-diff-body"
            style={{ maxWidth: '900px', margin: '0 auto', lineHeight: '1.7', fontSize: '14px' }}
            dangerouslySetInnerHTML={{ __html: inlineDiffHtml }}
          />
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
    </div>
  );
};
