import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import { Table, Plus, Trash2, Search, Code, Save, Download, Laptop } from 'lucide-react';
import { useWorkspace } from '../../../context/WorkspaceContext';
import { API } from '../../../services/api';
import CodeMirrorEditor from './CodeMirrorEditor';

interface CsvEditorProps {
  filePath: string;
  content: string;
  onChange: (value: string) => void;
}

export const CsvEditor: React.FC<CsvEditorProps> = ({
  filePath,
  content,
  onChange,
}) => {
  const { saveStatus, isSaving, saveCurrentFile, hasUnsavedChanges } = useWorkspace();
  const [mode, setMode] = useState<'table' | 'raw'>('table');
  const [data, setData] = useState<string[][]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [openedInOS, setOpenedInOS] = useState(false);
  const isTsv = filePath.endsWith('.tsv');

  const handleOpenInOS = async () => {
    try {
      const res = await API.openInOS(filePath);
      if (res.ok) {
        setOpenedInOS(true);
        setTimeout(() => setOpenedInOS(false), 2000);
      } else {
        alert(res.data?.error || 'Erro ao abrir no sistema operacional.');
      }
    } catch {
      alert('Erro ao conectar com o servidor.');
    }
  };

  // Parse CSV string into 2D array
  useEffect(() => {
    if (!content) {
      setData([['Coluna 1', 'Coluna 2'], ['', '']]);
      return;
    }
    const result = Papa.parse(content, {
      delimiter: isTsv ? '\t' : undefined,
      skipEmptyLines: false,
    });
    if (result.data && Array.isArray(result.data)) {
      setData(result.data as string[][]);
    }
  }, [content, isTsv]);

  const updateTableData = (newData: string[][]) => {
    setData(newData);
    const unparsed = Papa.unparse(newData, {
      delimiter: isTsv ? '\t' : ',',
    });
    onChange(unparsed);
  };

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    const updated = data.map((row, rIdx) => {
      if (rIdx !== rowIndex) return row;
      const newRow = [...row];
      newRow[colIndex] = value;
      return newRow;
    });
    updateTableData(updated);
  };

  const handleAddRow = () => {
    const colCount = data[0]?.length || 2;
    const newRow = new Array(colCount).fill('');
    updateTableData([...data, newRow]);
  };

  const handleAddColumn = () => {
    const updated = data.map((row, idx) => [...row, idx === 0 ? `Coluna ${row.length + 1}` : '']);
    updateTableData(updated);
  };

  const handleDeleteRow = (rowIndex: number) => {
    if (data.length <= 1) return;
    const updated = data.filter((_, idx) => idx !== rowIndex);
    updateTableData(updated);
  };

  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return data.slice(1);
    const term = searchTerm.toLowerCase();
    return data.slice(1).filter((row) => row.some((cell) => String(cell).toLowerCase().includes(term)));
  }, [data, searchTerm]);

  const headers = data[0] || [];

  const handleExportCsv = () => {
    const blob = new Blob([content], { type: isTsv ? 'text/tab-separated-values' : 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filePath.split('/').pop() || 'tabela.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (mode === 'raw') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '8px 24px', background: '#ffffff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setMode('table')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              borderRadius: '6px',
              background: '#f1f5f9',
              color: '#334155',
              border: '1px solid #e2e8f0',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            <Table size={14} /> Modo Tabela
          </button>
        </div>
        <div style={{ flex: 1 }}>
          <CodeMirrorEditor
            filePath={filePath}
            content={content}
            onChange={onChange}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: '#ffffff',
        color: '#1e293b',
        overflow: 'hidden',
      }}
    >
      {/* Top Toolbar - Light Theme */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 24px',
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          fontSize: '13px',
          flexWrap: 'wrap',
          gap: '12px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Table size={16} style={{ color: '#16a34a' }} />
          <span style={{ fontWeight: 600, color: '#1e293b' }}>{filePath}</span>
          <span
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '4px',
              background: '#dcfce7',
              color: '#16a34a',
              fontWeight: 600,
            }}
          >
            {data.length > 0 ? `${data.length - 1} linhas` : 'Vazio'}
          </span>
        </div>

        {/* Search Input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: '#f8fafc',
            padding: '4px 10px',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
            minWidth: '200px',
          }}
        >
          <Search size={14} style={{ color: '#94a3b8', marginRight: '6px' }} />
          <input
            type="text"
            placeholder="Filtrar dados..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#1e293b',
              fontSize: '12px',
              width: '100%',
            }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handleAddRow}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 12px',
              borderRadius: '6px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              color: '#334155',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            <Plus size={14} /> Linha
          </button>

          <button
            onClick={handleAddColumn}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 12px',
              borderRadius: '6px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              color: '#334155',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            <Plus size={14} /> Coluna
          </button>

          <button
            onClick={() => setMode('raw')}
            title="Alternar para texto bruto"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 12px',
              borderRadius: '6px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              color: '#334155',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            <Code size={14} /> Raw
          </button>

          <button
            onClick={handleOpenInOS}
            title="Abrir no gerenciador de arquivos do PC"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 10px',
              borderRadius: '6px',
              background: openedInOS ? '#dcfce7' : '#f8fafc',
              border: '1px solid',
              borderColor: openedInOS ? '#86efac' : '#e2e8f0',
              color: openedInOS ? '#16a34a' : '#334155',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            <Laptop size={14} />
            {openedInOS ? 'Aberto no PC!' : 'Abrir no PC'}
          </button>

          <button
            onClick={handleExportCsv}
            title="Exportar arquivo"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 10px',
              borderRadius: '6px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              color: '#334155',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            <Download size={14} />
          </button>

          <span
            style={{
              fontSize: '12px',
              color: saveStatus === 'Erro' ? '#d93025' : saveStatus === 'Salvando...' ? '#f29900' : '#64748b',
              fontWeight: 500,
              marginLeft: '4px',
            }}
          >
            {isSaving ? 'Salvando...' : saveStatus}
          </span>

          <button
            onClick={() => saveCurrentFile()}
            disabled={isSaving || !hasUnsavedChanges}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 14px',
              borderRadius: '6px',
              border: hasUnsavedChanges ? 'none' : '1px solid #e2e8f0',
              background: hasUnsavedChanges ? '#16a34a' : '#f8fafc',
              color: hasUnsavedChanges ? '#ffffff' : '#94a3b8',
              cursor: hasUnsavedChanges ? 'pointer' : 'default',
              fontSize: '12px',
              fontWeight: 600,
              boxShadow: hasUnsavedChanges ? '0 1px 3px rgba(22, 163, 74, 0.25)' : 'none',
            }}
          >
            <Save size={14} />
            Salvar
          </button>
        </div>
      </div>

      {/* Interactive Table Container with generous padding */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px 48px 48px 48px' }}>
        <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '10px 12px', width: '45px', color: '#94a3b8', fontWeight: 600, textAlign: 'center' }}>#</th>
                {headers.map((header, colIdx) => (
                  <th key={colIdx} style={{ padding: '10px 12px', color: '#334155', fontWeight: 600, borderRight: '1px solid #e2e8f0' }}>
                    <input
                      type="text"
                      value={header}
                      onChange={(e) => handleCellChange(0, colIdx, e.target.value)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#334155',
                        fontWeight: 600,
                        width: '100%',
                        outline: 'none',
                      }}
                    />
                  </th>
                ))}
                <th style={{ width: '45px' }} />
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, rIdx) => {
                const actualRowIndex = rIdx + 1;
                return (
                  <tr
                    key={rIdx}
                    style={{
                      borderBottom: '1px solid #e2e8f0',
                      background: rIdx % 2 === 0 ? '#ffffff' : '#fcfcfd',
                    }}
                  >
                    <td style={{ padding: '8px 12px', color: '#94a3b8', fontSize: '11px', userSelect: 'none', textAlign: 'center' }}>
                      {actualRowIndex}
                    </td>
                    {headers.map((_, colIdx) => (
                      <td key={colIdx} style={{ padding: '4px 8px', borderRight: '1px solid #f1f5f9' }}>
                        <input
                          type="text"
                          value={row[colIdx] ?? ''}
                          onChange={(e) => handleCellChange(actualRowIndex, colIdx, e.target.value)}
                          style={{
                            width: '100%',
                            background: 'transparent',
                            border: '1px solid transparent',
                            borderRadius: '4px',
                            padding: '5px 8px',
                            color: '#1e293b',
                            fontSize: '13px',
                            outline: 'none',
                            transition: 'all 0.15s ease',
                          }}
                          onFocus={(e) => {
                            e.currentTarget.style.background = '#e8f0fe';
                            e.currentTarget.style.borderColor = '#1a73e8';
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.borderColor = 'transparent';
                          }}
                        />
                      </td>
                    ))}
                    <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                      <button
                        onClick={() => handleDeleteRow(actualRowIndex)}
                        title="Remover linha"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          padding: '4px',
                          borderRadius: '4px',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#dc2626')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
export default CsvEditor;
