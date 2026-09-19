import React, { useState, useEffect, useCallback } from 'react';
import type { DictionaryTerm } from '../../types';
import { API } from '../../services/api';

export const DictionarySubView: React.FC = () => {
  const [terms, setTerms] = useState<DictionaryTerm[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [inputTerm, setInputTerm] = useState('');
  const [inputCodename, setInputCodename] = useState('');
  const [inputAliases, setInputAliases] = useState('');
  const [inputDefinition, setInputDefinition] = useState('');
  const [inputStatus, setInputStatus] = useState('approved');

  const loadDictionary = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await API.getDictionary();
      if (res.ok && res.data && Array.isArray(res.data.terms)) {
        setTerms(res.data.terms);
      }
    } catch (err) {
      console.error('[DictionarySubView] Erro ao buscar dicionário:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDictionary();
  }, [loadDictionary]);

  const handleOpenNewTerm = () => {
    setEditingIndex(null);
    setInputTerm('');
    setInputCodename('');
    setInputAliases('');
    setInputDefinition('');
    setInputStatus('approved');
    setIsModalOpen(true);
  };

  const handleEditTerm = (t: DictionaryTerm, idx: number) => {
    setEditingIndex(idx);
    setInputTerm(t.term || '');
    setInputCodename(t.codename || '');
    setInputAliases(t.context || '');
    setInputDefinition(t.definition || '');
    setInputStatus('approved');
    setIsModalOpen(true);
  };

  const handleDeleteTerm = async (idx: number) => {
    if (!window.confirm('Tem certeza que deseja remover este termo do dicionário?')) return;
    const updated = terms.filter((_, i) => i !== idx);
    try {
      await API.saveDictionary(updated);
      setTerms(updated);
    } catch (err) {
      console.error('Erro ao deletar termo:', err);
    }
  };

  const handleSaveTerm = async () => {
    if (!inputTerm.trim()) return;
    const termItem: DictionaryTerm = {
      term: inputTerm.trim(),
      codename: inputCodename.trim() || inputTerm.trim().toUpperCase().replace(/\s+/g, '_'),
      definition: inputDefinition.trim(),
      context: inputAliases.trim()
    };

    let updated: DictionaryTerm[];
    if (editingIndex !== null) {
      updated = [...terms];
      updated[editingIndex] = termItem;
    } else {
      updated = [...terms, termItem];
    }

    try {
      await API.saveDictionary(updated);
      setTerms(updated);
      setIsModalOpen(false);
    } catch (err) {
      console.error('[DictionarySubView] Erro ao salvar termo:', err);
    }
  };

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(terms, null, 2));
  };

  const filteredTerms = terms.filter(t =>
    t.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.codename && t.codename.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (t.definition && t.definition.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (t.context && t.context.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div id="subview-dictionary" className="dash-subview" style={{ display: 'block', width: '100%', height: '100%', overflowY: 'auto' }}>
      <div className="templates-view-wrapper">
        <div className="template-store-header">
          <div className="templates-header" style={{ marginBottom: 0 }}>
            <div>
              <h2>Dicionário Ubíquo & Vocabulário Oficial</h2>
              <p className="subtitle">
                Termos operacionais obrigatórios, definições de negócio e codenames persistidos em <code>project/dictionary.json</code>.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                id="btn-copy-dict-json"
                className="btn btn-secondary btn-sm"
                title="Copiar estrutura JSON completa"
                type="button"
                onClick={handleCopyJSON}
              >
                <span className="material-symbols-outlined icon-xs">content_copy</span>
                Copiar JSON
              </button>
              <button
                id="btn-open-new-term"
                className="btn btn-primary btn-sm"
                title="Cadastrar novo termo no vocabulário"
                type="button"
                onClick={handleOpenNewTerm}
              >
                <span className="material-symbols-outlined icon-xs">add</span>
                Novo Termo
              </button>
            </div>
          </div>

          {/* Filter Bar & Search */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginTop: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span id="count-dict-terms" style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                {filteredTerms.length} termo(s)
              </span>
            </div>

            <div className="store-search-box">
              <input
                type="text"
                id="dict-search-input"
                placeholder="Buscar termos, sinônimos ou definições..."
                spellCheck="false"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Dictionary Table List */}
        <div className="dict-table-container">
          <table className="dict-table" id="dict-table">
            <thead>
              <tr>
                <th style={{ width: '25%' }}>Termo / Conceito</th>
                <th style={{ width: '20%' }}>Code Name</th>
                <th style={{ width: '45%' }}>Definição Inequívoca</th>
                <th style={{ width: '10%', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody id="dict-terms-tbody">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="loading-state" style={{ textAlign: 'center', padding: '24px' }}>
                    Carregando termos...
                  </td>
                </tr>
              ) : filteredTerms.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    Nenhum termo encontrado.
                  </td>
                </tr>
              ) : (
                filteredTerms.map((t, idx) => (
                  <tr key={idx}>
                    <td>
                      <strong>{t.term}</strong>
                      {t.context && (
                        <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>
                          Aliases: {t.context}
                        </span>
                      )}
                    </td>
                    <td>
                      <code>{t.codename}</code>
                    </td>
                    <td style={{ color: 'var(--text-body)', lineHeight: '1.45' }}>
                      {t.definition}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        className="btn btn-ghost btn-xs"
                        type="button"
                        onClick={() => handleEditTerm(t, idx)}
                        title="Editar termo"
                      >
                        <span className="material-symbols-outlined icon-xs">edit</span>
                      </button>
                      <button
                        className="btn btn-ghost btn-xs"
                        type="button"
                        onClick={() => handleDeleteTerm(idx)}
                        title="Remover termo"
                        style={{ color: '#ef4444' }}
                      >
                        <span className="material-symbols-outlined icon-xs">delete</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Cadastrar / Editar Termo */}
      {isModalOpen && (
        <div id="dict-term-modal" className="modal-backdrop" style={{ display: 'flex' }}>
          <div className="modal-box" style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <div>
                <h3 id="dict-modal-title" style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>
                  {editingIndex !== null ? 'Editar Termo' : 'Novo Termo do Dicionário Ubíquo'}
                </h3>
                <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                  Defina o significado inequívoco e associe aos domínios
                </span>
              </div>
              <button id="btn-close-dict-modal" className="btn-close" aria-label="Fechar" type="button" onClick={() => setIsModalOpen(false)}>
                <span className="material-symbols-outlined icon-sm">close</span>
              </button>
            </div>
            <div className="modal-body" style={{ padding: '18px 22px', gap: '14px' }}>
              <div className="form-group">
                <label htmlFor="dict-input-term">Nome do Termo / Conceito (*):</label>
                <input
                  type="text"
                  id="dict-input-term"
                  placeholder="ex: Chave de Idempotência ou Bounded Context"
                  spellCheck="false"
                  value={inputTerm}
                  onChange={e => {
                    setInputTerm(e.target.value);
                    if (!inputCodename) {
                      setInputCodename(e.target.value.toUpperCase().replace(/\s+/g, '_'));
                    }
                  }}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label htmlFor="dict-input-codename">Code Name (Identificador no Código - sem espaços/especiais) (*):</label>
                <input
                  type="text"
                  id="dict-input-codename"
                  placeholder="ex: IDEMPOTENCY_KEY ou PIX_PAYMENT"
                  spellCheck="false"
                  value={inputCodename}
                  onChange={e => setInputCodename(e.target.value)}
                />
                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                  Nome oficial usado em código-fonte, entidades e APIs (apenas letras, números e underline).
                </span>
              </div>

              <div className="form-group">
                <label htmlFor="dict-input-aliases">Sinônimos / Aliases (separados por vírgula):</label>
                <input
                  type="text"
                  id="dict-input-aliases"
                  placeholder="ex: Idempotency Key, Chave Única"
                  spellCheck="false"
                  value={inputAliases}
                  onChange={e => setInputAliases(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="dict-input-definition">Definição / Significado Inequívoco (*):</label>
                <textarea
                  id="dict-input-definition"
                  className="import-paste-textarea"
                  style={{ height: '110px' }}
                  placeholder="Descreva o significado exato no contexto da arquitetura e negócio..."
                  spellCheck="false"
                  value={inputDefinition}
                  onChange={e => setInputDefinition(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="dict-input-status">Status do Termo:</label>
                <select id="dict-input-status" value={inputStatus} onChange={e => setInputStatus(e.target.value)}>
                  <option value="approved">Aprovado (Oficial)</option>
                  <option value="in_review">Em Revisão</option>
                  <option value="draft">Rascunho</option>
                </select>
              </div>
            </div>
            <div className="modal-footer" style={{ padding: '12px 22px' }}>
              <button id="btn-cancel-dict-modal" className="btn btn-ghost btn-sm" type="button" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </button>
              <button id="btn-save-dict-modal" className="btn btn-primary btn-sm" type="button" onClick={handleSaveTerm} disabled={!inputTerm.trim()}>
                Salvar Termo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
