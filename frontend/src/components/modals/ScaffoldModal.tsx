import React, { useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { API } from '../../services/api';

interface ScaffoldModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: 'spec' | 'adr';
  onCreated?: (filePath: string) => void;
}

export const ScaffoldModal: React.FC<ScaffoldModalProps> = ({
  isOpen,
  onClose,
  defaultType = 'spec',
  onCreated
}) => {
  const { loadTree, loadFile } = useWorkspace();
  const [activeType, setActiveType] = useState<'spec' | 'adr'>(defaultType);
  const [featureName, setFeatureName] = useState('');
  const [featureTitle, setFeatureTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const rawName = featureName.trim().toLowerCase().replace(/[^a-z0-9\-_]/g, '-').replace(/-+/g, '-');
  const fallbackName = activeType === 'adr' ? 'adr-001' : 'minha-especificacao';
  const name = rawName || fallbackName;
  const targetPath = activeType === 'adr' ? `adrs/${name}.md` : `specs/${name}.md`;

  const handleNameChange = (val: string) => {
    setFeatureName(val);
    if (!featureTitle) {
      setFeatureTitle(val.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
    }
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    const title = featureTitle.trim() || name;

    const defaultContent = activeType === 'adr'
      ? `---
title: "${title}"
status: "proposed"
type: "adr"
date: "${new Date().toISOString().split('T')[0]}"
---

# 🏛️ ${title}

## Contexto & Declaração do Problema
Descreva o contexto e o problema de engenharia ou arquitetura que motiva esta decisão.

## Decisão Proposta
Qual alternativa foi escolhida e qual o racional técnico?

## Consequências
- **Positivas:** Ganhos e benefícios esperados.
- **Negativas / Riscos:** Trade-offs assumidos.
`
      : `---
title: "${title}"
status: "draft"
type: "spec"
version: "1.0.0"
---

# 📄 ${title}

## 1. Visão Geral & Objetivos
Descreva a proposta de valor, escopo funcional e objetivos desta especificação técnica.

## 2. Requisitos Funcionais
- [ ] Operação principal implementada.
- [ ] Validações de entrada e tratamento de erros.

## 3. Contratos de Dados & Arquitetura
Especifique as interfaces, tipos e integrações.
`;

    try {
      const res = await API.createProjectFile({
        path: targetPath,
        content: defaultContent
      });

      if (res.ok) {
        await loadTree();
        await loadFile(targetPath);
        if (onCreated) onCreated(targetPath);
        onClose();
      }
    } catch (err) {
      console.error('[ScaffoldModal] Erro ao criar documento:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="scaffold-wizard-modal" className="modal-backdrop" style={{ display: 'flex' }}>
      <div className="modal-box" style={{ maxWidth: '580px' }}>
        <div className="modal-header">
          <div>
            <h3>Criar Nova Especificação / Documento</h3>
            <span className="subtitle">Gere documentos técnicos padronizados com metadados oficiais</span>
          </div>
          <button className="btn-close" aria-label="Fechar" onClick={onClose}>
            <span className="material-symbols-outlined icon-sm">close</span>
          </button>
        </div>

        <div className="modal-body" style={{ gap: '16px' }}>
          {/* Entity Type Selector Tabs */}
          <div className="scaffold-type-tabs">
            <button
              className={`scaffold-type-tab ${activeType === 'spec' ? 'active' : ''}`}
              type="button"
              onClick={() => setActiveType('spec')}
            >
              <span className="tab-badge">
                <span className="material-symbols-outlined icon-xs">description</span>
              </span>
              <div className="tab-info">
                <strong>Especificação Técnica</strong>
                <span>Documento funcional / técnico</span>
              </div>
            </button>
            <button
              className={`scaffold-type-tab ${activeType === 'adr' ? 'active' : ''}`}
              type="button"
              onClick={() => setActiveType('adr')}
            >
              <span className="tab-badge">
                <span className="material-symbols-outlined icon-xs">gavel</span>
              </span>
              <div className="tab-info">
                <strong>Decisão (ADR)</strong>
                <span>Architecture Decision Record</span>
              </div>
            </button>
          </div>

          <div className="form-group">
            <label htmlFor="scaffold-feature-name">Identificador / Nome do Arquivo (Slug):</label>
            <input
              id="scaffold-feature-name"
              type="text"
              className="form-input"
              placeholder="ex: autenticacao-jwt, pagamentos-pix"
              value={featureName}
              onChange={e => handleNameChange(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="scaffold-feature-title">Título Humanizado:</label>
            <input
              id="scaffold-feature-title"
              type="text"
              className="form-input"
              placeholder="ex: Autenticação JWT com Refresh Token"
              value={featureTitle}
              onChange={e => setFeatureTitle(e.target.value)}
            />
          </div>

          <div style={{ background: 'var(--color-surface-container)', padding: '10px 14px', borderRadius: '6px', fontSize: '12px' }}>
            <span style={{ color: 'var(--color-outline)' }}>Caminho de destino: </span>
            <code style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-primary)' }}>{targetPath}</code>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Criando...' : 'Criar Documento'}
          </button>
        </div>
      </div>
    </div>
  );
};
