import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { API } from '../../services/api';
import { VisualMarkdownDiff } from '../editor/VisualMarkdownDiff';

interface DiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPROpened?: () => void;
}

export const DiffModal: React.FC<DiffModalProps> = ({ isOpen, onClose, onPROpened }) => {
  const { pendingChanges, guardrailStatus, discardChanges, refreshPendingChanges } = useWorkspace();
  const [prTitle, setPrTitle] = useState('');
  const [prDesc, setPrDesc] = useState('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedDiffs, setExpandedDiffs] = useState<Record<string, boolean>>({});
  const [diffViewMode, setDiffViewMode] = useState<'visual' | 'raw'>('visual');

  useEffect(() => {
    if (isOpen) {
      setPrTitle(`Proposta de Alterações Oficiais (${pendingChanges.length} arquivos)`);
      setPrDesc('');
    }
  }, [isOpen, pendingChanges.length]);

  if (!isOpen) return null;

  const totalAdditions = pendingChanges.reduce((acc, c) => acc + (c.additions || 0), 0);
  const totalDeletions = pendingChanges.reduce((acc, c) => acc + (c.deletions || 0), 0);

  const toggleExpand = (path: string) => {
    setExpandedDiffs(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const handleGenerateSummaryAI = async () => {
    setIsGeneratingSummary(true);
    try {
      const res = await API.generatePRSummaryAI();
      if (res.ok && res.data) {
        if (res.data.title) setPrTitle(res.data.title);
        if (res.data.description) setPrDesc(res.data.description);
      }
    } catch (err) {
      console.error('[DiffModal] Erro ao gerar resumo com IA:', err);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleCreatePR = async () => {
    if (!prTitle.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await API.createUnifiedPR({ title: prTitle, description: prDesc });
      if (res.ok) {
        await refreshPendingChanges();
        if (onPROpened) onPROpened();
        onClose();
      }
    } catch (err) {
      console.error('[DiffModal] Erro ao criar PR:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDiscardAll = async () => {
    if (window.confirm('Tem certeza que deseja descartar todas as alterações pendentes no workspace?')) {
      await discardChanges();
      onClose();
    }
  };

  const handleDiscardFile = async (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Descartar alterações em ${path}?`)) {
      await discardChanges(path);
    }
  };

  return (
    <div id="workspace-diff-modal" className="modal-backdrop" style={{ display: 'flex' }}>
      <div className="modal-box" style={{ maxWidth: '920px', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3>Central de Alterações do Workspace</h3>
              <span className={`badge ${guardrailStatus === 'CLEAN' ? 'badge-success' : 'badge-warning'}`}>
                {guardrailStatus === 'CLEAN' ? 'Conforme' : guardrailStatus}
              </span>
            </div>
            <span className="subtitle">Revise as alterações visualmente antes de submeter a proposta de Pull Request</span>
          </div>
          <button className="btn-close" aria-label="Fechar" onClick={onClose}>
            <span className="material-symbols-outlined icon-sm">close</span>
          </button>
        </div>

        <div className="modal-body" style={{ overflowY: 'auto', flex: 1, gap: '16px' }}>
          {/* Stats Bar & View Mode Toggle */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-surface-container, #f8fafc)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-primary, #2563eb)' }}>description</span>
              <strong>{pendingChanges.length} arquivo(s) modificado(s)</strong>
              <div style={{ display: 'flex', gap: '8px', fontSize: '12.5px', marginLeft: '8px' }}>
                <span style={{ color: '#16a34a', fontWeight: 600 }}>+{totalAdditions} adições</span>
                <span style={{ color: '#dc2626', fontWeight: 600 }}>-{totalDeletions} exclusões</span>
              </div>
            </div>

            {/* Toggle Visual vs Raw */}
            <div style={{ display: 'inline-flex', background: '#e2e8f0', padding: '2px', borderRadius: '6px' }}>
              <button
                type="button"
                onClick={() => setDiffViewMode('visual')}
                style={{
                  padding: '3px 8px',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: diffViewMode === 'visual' ? '#ffffff' : 'transparent',
                  color: diffViewMode === 'visual' ? 'var(--primary, #2563eb)' : '#64748b'
                }}
              >
                Visual Formatado (Doc)
              </button>
              <button
                type="button"
                onClick={() => setDiffViewMode('raw')}
                style={{
                  padding: '3px 8px',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: diffViewMode === 'raw' ? '#ffffff' : 'transparent',
                  color: diffViewMode === 'raw' ? 'var(--primary, #2563eb)' : '#64748b'
                }}
              >
                Patch Git (Código)
              </button>
            </div>
          </div>

          {/* Diffs List */}
          <div className="diff-files-container" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pendingChanges.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-outline, #64748b)' }}>
                Nenhuma alteração pendente no workspace.
              </div>
            ) : (
              pendingChanges.map(change => {
                const isExpanded = expandedDiffs[change.path] !== false; // Default expanded
                return (
                  <div
                    key={change.path}
                    style={{
                      border: '1px solid var(--color-outline-variant, #e2e8f0)',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      background: 'var(--color-surface, #ffffff)'
                    }}
                  >
                    <div
                      onClick={() => toggleExpand(change.path)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: 'var(--color-surface-container-low, #f8fafc)',
                        cursor: 'pointer',
                        userSelect: 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--color-outline)' }}>
                          {isExpanded ? 'expand_more' : 'chevron_right'}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600 }}>
                          {change.path}
                        </span>
                        <span className="badge badge-primary-subtle" style={{ fontSize: '11px' }}>
                          {change.type || 'MODIFIED'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                          className="btn btn-ghost btn-xs"
                          title="Descartar este arquivo"
                          onClick={(e) => handleDiscardFile(change.path, e)}
                          style={{ color: 'var(--color-error, #dc2626)' }}
                        >
                          <span className="material-symbols-outlined icon-xs">delete</span>
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ borderTop: '1px solid var(--border-color, #e2e8f0)' }}>
                        {diffViewMode === 'visual' ? (
                          <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
                            <VisualMarkdownDiff
                              oldContent={change.old_content || ''}
                              newContent={change.new_content || ''}
                              fileName={change.path}
                            />
                          </div>
                        ) : (
                          <pre
                            style={{
                              margin: 0,
                              padding: '12px',
                              fontSize: '12px',
                              fontFamily: 'var(--font-mono)',
                              background: '#0d1117',
                              color: '#e6edf3',
                              overflowX: 'auto',
                              maxHeight: '300px',
                              lineHeight: '1.5'
                            }}
                          >
                            {change.diff_text || change.diff || 'Sem patch de código'}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* PR Metadata Form */}
          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label htmlFor="unified-pr-title-input" style={{ fontWeight: 600, fontSize: '13px' }}>
                Título da Proposta (PR):
              </label>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={handleGenerateSummaryAI}
                disabled={isGeneratingSummary || pendingChanges.length === 0}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}
              >
                <span className="material-symbols-outlined icon-xs">auto_awesome</span>
                {isGeneratingSummary ? 'Gerando...' : 'Resumir com IA'}
              </button>
            </div>
            <input
              id="unified-pr-title-input"
              type="text"
              className="form-input"
              value={prTitle}
              onChange={e => setPrTitle(e.target.value)}
              placeholder="Descreva o propósito deste Pull Request..."
            />

            <label htmlFor="unified-pr-desc-input" style={{ fontWeight: 600, fontSize: '13px', marginTop: '4px' }}>
              Descrição & Justificativa:
            </label>
            <textarea
              id="unified-pr-desc-input"
              rows={3}
              className="form-input"
              value={prDesc}
              onChange={e => setPrDesc(e.target.value)}
              placeholder="Detalhes adicionais, contexto ou instruções para os revisores..."
              style={{ resize: 'vertical' }}
            />
          </div>
        </div>

        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button
            className="btn btn-ghost btn-sm"
            style={{ color: 'var(--color-error, #dc2626)' }}
            onClick={handleDiscardAll}
            disabled={pendingChanges.length === 0}
          >
            Descartar Todas
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancelar</button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleCreatePR}
              disabled={isSubmitting || pendingChanges.length === 0 || !prTitle.trim()}
            >
              {isSubmitting ? 'Criando PR...' : 'Criar Pull Request Oficial'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
