import React, { useState, useEffect } from 'react';

export interface SlashCommandItem {
  id: string;
  title: string;
  desc: string;
  icon: string;
  category: string;
  template: string;
}

export const SLASH_COMMANDS: SlashCommandItem[] = [
  { id: 'h1', title: 'Título 1', desc: 'Seção principal do documento', icon: 'format_h1', category: 'Estrutura', template: '\n# ' },
  { id: 'h2', title: 'Título 2', desc: 'Subseção intermediária', icon: 'format_h2', category: 'Estrutura', template: '\n## ' },
  { id: 'h3', title: 'Título 3', desc: 'Subtítulo detalhado', icon: 'format_h3', category: 'Estrutura', template: '\n### ' },
  { id: 'bullet', title: 'Lista de Marcadores', desc: 'Lista simples com marcadores', icon: 'format_list_bulleted', category: 'Listas', template: '\n- ' },
  { id: 'number', title: 'Lista Numerada', desc: 'Lista com numeração sequencial', icon: 'format_list_numbered', category: 'Listas', template: '\n1. ' },
  { id: 'todo', title: 'Lista de Tarefas', desc: 'Checklist interativo de tarefas', icon: 'check_box', category: 'Listas', template: '\n- [ ] ' },
  { id: 'callout', title: 'Caixa de Destaque', desc: 'Nota importante ou aviso', icon: 'info', category: 'Avançado', template: '\n> [!NOTE]\n> ' },
  { id: 'code', title: 'Bloco de Código', desc: 'Trecho de código com syntax highlight', icon: 'code', category: 'Avançado', template: '\n```typescript\n\n```\n' },
  { id: 'table', title: 'Tabela Dinâmica', desc: 'Tabela com linhas e colunas', icon: 'table_chart', category: 'Avançado', template: '\n| Coluna 1 | Coluna 2 |\n|---|---|\n| Item 1 | Item 2 |\n' },
  { id: 'mermaid', title: 'Diagrama Mermaid', desc: 'Fluxograma ou arquitetura visual', icon: 'schema', category: 'Avançado', template: '\n```mermaid\ngraph TD\n  A[Início] --> B[Processo]\n```\n' },
  { id: 'divider', title: 'Divisor', desc: 'Linha horizontal de separação', icon: 'horizontal_rule', category: 'Estrutura', template: '\n---\n' }
];

interface SlashMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (cmd: SlashCommandItem) => void;
  position: { top: number; left: number };
  filterText: string;
}

export const SlashMenu: React.FC<SlashMenuProps> = ({
  isOpen,
  onClose,
  onSelect,
  position,
  filterText
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = SLASH_COMMANDS.filter(cmd =>
    cmd.title.toLowerCase().includes(filterText.toLowerCase()) ||
    cmd.desc.toLowerCase().includes(filterText.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [filterText]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % (filtered.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filtered.length) % (filtered.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          onSelect(filtered[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex, onSelect, onClose]);

  if (!isOpen || filtered.length === 0) return null;

  return (
    <div
      className="notion-slash-menu"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-outline-variant)',
        borderRadius: '8px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
        zIndex: 100,
        width: '280px',
        maxHeight: '320px',
        overflowY: 'auto',
        padding: '6px'
      }}
    >
      <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-outline)', padding: '4px 8px', fontWeight: 700 }}>
        Comandos Básicos
      </div>
      {filtered.map((cmd, idx) => (
        <div
          key={cmd.id}
          className={`slash-menu-item ${idx === selectedIndex ? 'selected' : ''}`}
          onClick={() => onSelect(cmd)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 10px',
            borderRadius: '6px',
            cursor: 'pointer',
            background: idx === selectedIndex ? 'var(--color-primary-container)' : 'transparent',
            color: idx === selectedIndex ? 'var(--color-on-primary-container)' : 'var(--color-on-surface)'
          }}
          onMouseEnter={() => setSelectedIndex(idx)}
        >
          <span className="material-symbols-outlined icon-sm" style={{ color: 'var(--color-primary)' }}>
            {cmd.icon}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <strong style={{ fontSize: '13px' }}>{cmd.title}</strong>
            <span style={{ fontSize: '11px', color: 'var(--color-outline)' }}>{cmd.desc}</span>
          </div>
        </div>
      ))}
    </div>
  );
};
