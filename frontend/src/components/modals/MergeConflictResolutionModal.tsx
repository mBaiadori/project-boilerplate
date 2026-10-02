import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Button } from '../ui';
import { Check, ShieldAlert } from 'lucide-react';

interface ConflictBlock {
  id: string;
  startIndex: number;
  endIndex: number;
  oursLabel: string;
  oursContent: string;
  theirsLabel: string;
  theirsContent: string;
  resolution: 'ours' | 'theirs' | 'both_ours_first' | 'both_theirs_first' | 'custom';
  customContent?: string;
}

interface MergeConflictResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  filePath: string;
  content: string;
  onSaveResolved: (resolvedContent: string) => void;
}

export const MergeConflictResolutionModal: React.FC<MergeConflictResolutionModalProps> = ({
  isOpen,
  onClose,
  filePath,
  content,
  onSaveResolved,
}) => {
  const [conflictBlocks, setConflictBlocks] = useState<ConflictBlock[]>([]);
  const [activeTab, setActiveTab] = useState<'visual' | 'preview'>('visual');

  // Parseia os blocos de conflito do texto
  useEffect(() => {
    if (!content) {
      setConflictBlocks([]);
      return;
    }

    const regex = /<<<<<<< (.*?)\r?\n([\s\S]*?)\r?\n=======\r?\n([\s\S]*?)\r?\n>>>>>>> (.*?)(?:\r?\n|$)/g;
    const blocks: ConflictBlock[] = [];
    let match: RegExpExecArray | null;
    let idx = 0;

    while ((match = regex.exec(content)) !== null) {
      blocks.push({
        id: `conflict_${idx++}`,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        oursLabel: match[1] || 'Sua Versão (Local)',
        oursContent: match[2] || '',
        theirsContent: match[3] || '',
        theirsLabel: match[4] || 'Versão Remota (Git)',
        resolution: 'ours', // Padrão: mantém nossa versão local
      });
    }

    setConflictBlocks(blocks);
  }, [content]);

  // Reconstrói o texto completo aplicando as escolhas de resolução
  const resolvedFullText = useMemo(() => {
    if (conflictBlocks.length === 0) return content;

    let result = '';
    let lastIndex = 0;

    for (const block of conflictBlocks) {
      result += content.substring(lastIndex, block.startIndex);

      let chosenText = '';
      if (block.resolution === 'ours') {
        chosenText = block.oursContent;
      } else if (block.resolution === 'theirs') {
        chosenText = block.theirsContent;
      } else if (block.resolution === 'both_ours_first') {
        chosenText = `${block.oursContent}\n${block.theirsContent}`;
      } else if (block.resolution === 'both_theirs_first') {
        chosenText = `${block.theirsContent}\n${block.oursContent}`;
      } else if (block.resolution === 'custom') {
        chosenText = block.customContent ?? block.oursContent;
      }

      result += chosenText;
      if (chosenText && !chosenText.endsWith('\n')) {
        result += '\n';
      }

      lastIndex = block.endIndex;
    }

    result += content.substring(lastIndex);
    return result;
  }, [content, conflictBlocks]);

  const handleSetBlockResolution = (
    id: string,
    resolution: ConflictBlock['resolution'],
    custom?: string
  ) => {
    setConflictBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, resolution, customContent: custom ?? b.customContent } : b))
    );
  };

  const handleResolveAll = (choice: 'ours' | 'theirs') => {
    setConflictBlocks((prev) => prev.map((b) => ({ ...b, resolution: choice })));
  };

  const handleSaveAndFinish = () => {
    onSaveResolved(resolvedFullText);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldAlert size={20} color="var(--color-tertiary, #eab308)" />
          <span>Resolução Visual de Conflito de Merge</span>
        </div>
      }
      size="xl"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleResolveAll('ours')}
            >
              Aceitar Tudo Local
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleResolveAll('theirs')}
            >
              Aceitar Tudo Remoto
            </Button>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSaveAndFinish}>
              <Check size={16} style={{ marginRight: '6px' }} />
              Concluir & Salvar Arquivo Limpo
            </Button>
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Banner Informativo */}
        <div
          style={{
            padding: '12px 16px',
            background: 'var(--color-surface-container, rgba(255,255,255,0.04))',
            borderRadius: 'var(--radius-md, 8px)',
            border: '1px solid var(--color-outline-variant, rgba(255,255,255,0.1))',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-on-surface)' }}>
              Arquivo: <code style={{ color: 'var(--color-primary)' }}>{filePath}</code>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-outline)', marginTop: '2px' }}>
              Detectamos {conflictBlocks.length} ponto(s) de colisão de linhas. Escolha a versão desejada para cada seção antes de salvar no Git.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setActiveTab('visual')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                background: activeTab === 'visual' ? 'var(--color-primary)' : 'transparent',
                color: activeTab === 'visual' ? 'var(--color-on-primary, #fff)' : 'var(--color-outline)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              Comparação Visual
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                background: activeTab === 'preview' ? 'var(--color-primary)' : 'transparent',
                color: activeTab === 'preview' ? 'var(--color-on-primary, #fff)' : 'var(--color-outline)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              Pré-visualização do Resultado
            </button>
          </div>
        </div>

        {activeTab === 'preview' ? (
          <div
            style={{
              maxHeight: '520px',
              overflowY: 'auto',
              background: 'var(--color-surface-container-lowest, #121212)',
              border: '1px solid var(--color-outline-variant, #2e2e2e)',
              borderRadius: '8px',
              padding: '16px',
              fontFamily: 'monospace',
              fontSize: '12px',
              whiteSpace: 'pre-wrap',
              lineHeight: '1.6',
            }}
          >
            {resolvedFullText}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '550px', overflowY: 'auto' }}>
            {conflictBlocks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-outline)' }}>
                Nenhum conflito restante neste documento.
              </div>
            ) : (
              conflictBlocks.map((block, index) => (
                <div
                  key={block.id}
                  style={{
                    border: '1px solid var(--color-outline-variant, rgba(255,255,255,0.12))',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    background: 'var(--color-surface-container-low, rgba(0,0,0,0.2))',
                  }}
                >
                  {/* Cabeçalho do Conflito */}
                  <div
                    style={{
                      padding: '8px 16px',
                      background: 'var(--color-surface-container, rgba(255,255,255,0.06))',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: '1px solid var(--color-outline-variant, rgba(255,255,255,0.08))',
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: '12px', color: 'var(--color-tertiary, #eab308)' }}>
                      Conflito #{index + 1} de {conflictBlocks.length}
                    </span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => handleSetBlockResolution(block.id, 'ours')}
                        style={{
                          fontSize: '11px',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          border: block.resolution === 'ours' ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                          background: block.resolution === 'ours' ? '#10b98125' : 'transparent',
                          color: block.resolution === 'ours' ? '#10b981' : 'var(--color-outline)',
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        ✓ Manter Local
                      </button>
                      <button
                        onClick={() => handleSetBlockResolution(block.id, 'theirs')}
                        style={{
                          fontSize: '11px',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          border: block.resolution === 'theirs' ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
                          background: block.resolution === 'theirs' ? '#3b82f625' : 'transparent',
                          color: block.resolution === 'theirs' ? '#3b82f6' : 'var(--color-outline)',
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        ✓ Manter Remoto
                      </button>
                      <button
                        onClick={() => handleSetBlockResolution(block.id, 'both_ours_first')}
                        style={{
                          fontSize: '11px',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          border: block.resolution === 'both_ours_first' ? '1px solid var(--color-primary)' : '1px solid rgba(255,255,255,0.1)',
                          background: block.resolution === 'both_ours_first' ? 'var(--color-primary-container, #6366f125)' : 'transparent',
                          color: 'var(--color-outline)',
                          cursor: 'pointer',
                        }}
                      >
                        Combinar Ambas
                      </button>
                    </div>
                  </div>

                  {/* Comparativo de 2 Colunas */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: '120px' }}>
                    {/* Coluna Local */}
                    <div
                      style={{
                        padding: '12px',
                        borderRight: '1px solid var(--color-outline-variant, rgba(255,255,255,0.08))',
                        background: block.resolution === 'ours' || block.resolution === 'both_ours_first' ? 'rgba(16, 185, 129, 0.05)' : 'transparent',
                      }}
                    >
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#10b981', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>computer</span>
                        {block.oursLabel}
                      </div>
                      <pre
                        style={{
                          margin: 0,
                          fontSize: '12px',
                          fontFamily: 'monospace',
                          whiteSpace: 'pre-wrap',
                          color: 'var(--color-on-surface)',
                          lineHeight: '1.5',
                        }}
                      >
                        {block.oursContent || '<vazio>'}
                      </pre>
                    </div>

                    {/* Coluna Remota */}
                    <div
                      style={{
                        padding: '12px',
                        background: block.resolution === 'theirs' || block.resolution === 'both_theirs_first' ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                      }}
                    >
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#3b82f6', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>cloud</span>
                        {block.theirsLabel}
                      </div>
                      <pre
                        style={{
                          margin: 0,
                          fontSize: '12px',
                          fontFamily: 'monospace',
                          whiteSpace: 'pre-wrap',
                          color: 'var(--color-on-surface)',
                          lineHeight: '1.5',
                        }}
                      >
                        {block.theirsContent || '<vazio>'}
                      </pre>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
