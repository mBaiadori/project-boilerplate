import React, { useState, useEffect, useCallback } from 'react';
import type { DictionaryTerm } from '../../types';
import { API } from '../../services/api';
import { useAI } from '../../context/AIContext';
import {
  Card,
  CardHeader,
  CardContent,
  Modal,
  FormField,
  Input,
  SearchInput,
  Textarea,
  Button,
  IconButton,
  Badge,
  EmptyState,
  Spinner,
} from '../../components/ui';
import { BookA, Copy, Plus, Edit3, Trash2, Check, Sparkles } from 'lucide-react';

export const DictionarySubView: React.FC = () => {
  const { setDynamicContext } = useAI();
  const [terms, setTerms] = useState<DictionaryTerm[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

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

  useEffect(() => {
    if (terms.length > 0) {
      setDynamicContext({
        filePath: 'dictionary.json',
        content: JSON.stringify(terms, null, 2),
        badge: '📚 Dicionário de Dados',
      });
    }
    return () => {
      setDynamicContext(null);
    };
  }, [terms, setDynamicContext]);

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
      context: inputAliases.trim(),
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
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredTerms = terms.filter((t) =>
    t.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.codename && t.codename.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (t.definition && t.definition.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (t.context && t.context.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div id="subview-dictionary" style={{ padding: '24px 32px', maxWidth: '1400px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: 'var(--color-on-surface)', letterSpacing: '-0.02em' }}>
              Dicionário Ubíquo & Vocabulário Oficial
            </h1>
            <Badge variant="primary" size="md">
              {terms.length} {terms.length === 1 ? 'termo' : 'termos'}
            </Badge>
          </div>
          <p style={{ margin: '6px 0 0 0', fontSize: '13.5px', color: 'var(--color-on-surface-variant)' }}>
            Termos operacionais obrigatórios, definições de negócio e codenames persistidos em <code style={{ fontFamily: 'var(--font-mono, monospace)', background: 'var(--color-surface-container-high)', padding: '2px 6px', borderRadius: '4px' }}>project/dictionary.json</code>.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Button
            id="btn-copy-dict-json"
            variant="secondary"
            size="md"
            onClick={handleCopyJSON}
            icon={copied ? <Check size={16} style={{ color: 'var(--color-success)' }} /> : <Copy size={16} />}
          >
            {copied ? 'Copiado!' : 'Copiar JSON'}
          </Button>

          <Button
            id="btn-open-new-term"
            variant="primary"
            size="md"
            onClick={handleOpenNewTerm}
            icon={<Plus size={16} />}
          >
            Novo Termo
          </Button>
        </div>
      </div>

      {/* Main Table Card */}
      <Card>
        <CardHeader
          title="Termos & Conceitos Cadastrados"
          subtitle="Vocabulário padronizado consumido pelo Copilot e pelos agentes autônomos"
          action={
            <div style={{ width: '320px' }}>
              <SearchInput
                id="dict-search-input"
                placeholder="Buscar termos, sinônimos ou definições..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClear={() => setSearchTerm('')}
              />
            </div>
          }
        />
        <CardContent style={{ padding: 0 }}>
          {isLoading ? (
            <div style={{ padding: '48px 0', display: 'flex', justifyContent: 'center' }}>
              <Spinner size="lg" message="Carregando dicionário..." />
            </div>
          ) : filteredTerms.length === 0 ? (
            <div style={{ padding: '32px 0' }}>
              <EmptyState
                icon={<BookA size={40} />}
                title={searchTerm ? 'Nenhum termo correspondente' : 'Dicionário Vazio'}
                description={
                  searchTerm
                    ? `Nenhum termo encontrado com "${searchTerm}". Tente outra busca.`
                    : 'Cadastre termos e codenames para que os desenvolvedores e a IA usem a mesma terminologia.'
                }
                actionLabel={searchTerm ? undefined : 'Cadastrar Primeiro Termo'}
                onAction={searchTerm ? undefined : handleOpenNewTerm}
              />
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'var(--color-surface-container)', borderBottom: '1px solid var(--color-outline-variant)' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-on-surface-variant)', width: '25%' }}>Termo / Conceito</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-on-surface-variant)', width: '20%' }}>Code Name</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-on-surface-variant)', width: '45%' }}>Definição Inequívoca</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--color-on-surface-variant)', width: '10%', textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTerms.map((t, idx) => (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: '1px solid var(--color-outline-variant)',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-container)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-on-surface)' }}>{t.term}</div>
                        {t.context && (
                          <div style={{ fontSize: '11.5px', color: 'var(--color-outline)', marginTop: '2px' }}>
                            Aliases: {t.context}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                        <code
                          style={{
                            fontFamily: 'var(--font-mono, monospace)',
                            background: 'var(--color-surface-container-high)',
                            padding: '3px 7px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            color: 'var(--color-primary)',
                            border: '1px solid var(--color-outline-variant)',
                          }}
                        >
                          {t.codename}
                        </code>
                      </td>
                      <td style={{ padding: '12px 16px', verticalAlign: 'top', color: 'var(--color-on-surface-variant)', lineHeight: 1.5 }}>
                        {t.definition}
                      </td>
                      <td style={{ padding: '12px 16px', verticalAlign: 'top', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <IconButton
                          icon={<Edit3 size={15} />}
                          variant="ghost"
                          size="sm"
                          tooltip="Editar termo"
                          onClick={() => handleEditTerm(t, idx)}
                        />
                        <IconButton
                          icon={<Trash2 size={15} />}
                          variant="ghost"
                          size="sm"
                          tooltip="Remover termo"
                          onClick={() => handleDeleteTerm(idx)}
                          style={{ color: 'var(--color-error)' }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: Cadastrar / Editar Termo */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingIndex !== null ? 'Editar Termo' : 'Novo Termo do Dicionário Ubíquo'}
        subtitle="Defina o significado inequívoco e associe aos domínios"
        icon={<Sparkles size={18} />}
        size="md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveTerm}
              disabled={!inputTerm.trim()}
              icon={<Check size={14} />}
            >
              Salvar Termo
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveTerm();
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
        >
          <FormField
            label="Nome do Termo / Conceito"
            required
            helperText="ex: Chave de Idempotência ou Bounded Context"
          >
            <Input
              id="dict-input-term"
              placeholder="ex: Chave de Idempotência"
              value={inputTerm}
              onChange={(e) => {
                setInputTerm(e.target.value);
                if (!inputCodename) {
                  setInputCodename(e.target.value.toUpperCase().replace(/\s+/g, '_'));
                }
              }}
              autoFocus
            />
          </FormField>

          <FormField
            label="Code Name (Identificador no Código)"
            required
            helperText="Nome oficial usado em código, entidades e APIs (letras, números e underline)."
          >
            <Input
              id="dict-input-codename"
              placeholder="ex: IDEMPOTENCY_KEY ou PIX_PAYMENT"
              value={inputCodename}
              onChange={(e) => setInputCodename(e.target.value)}
            />
          </FormField>

          <FormField
            label="Sinônimos / Aliases"
            helperText="Termos alternativos separados por vírgula."
          >
            <Input
              id="dict-input-aliases"
              placeholder="ex: Idempotency Key, Chave Única"
              value={inputAliases}
              onChange={(e) => setInputAliases(e.target.value)}
            />
          </FormField>

          <FormField
            label="Definição / Significado Inequívoco"
            required
            helperText="Descreva o significado exato no contexto da arquitetura e negócio."
          >
            <Textarea
              id="dict-input-definition"
              rows={4}
              placeholder="Descreva o significado exato no contexto da arquitetura e negócio..."
              value={inputDefinition}
              onChange={(e) => setInputDefinition(e.target.value)}
            />
          </FormField>

          <FormField label="Status do Termo">
            <select
              id="dict-input-status"
              value={inputStatus}
              onChange={(e) => setInputStatus(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md, 8px)',
                border: '1px solid var(--color-outline-variant)',
                background: 'var(--color-surface-container)',
                color: 'var(--color-on-surface)',
                fontSize: '13px',
                outline: 'none',
              }}
            >
              <option value="approved">Aprovado (Oficial)</option>
              <option value="in_review">Em Revisão</option>
              <option value="draft">Rascunho</option>
            </select>
          </FormField>
        </form>
      </Modal>
    </div>
  );
};
