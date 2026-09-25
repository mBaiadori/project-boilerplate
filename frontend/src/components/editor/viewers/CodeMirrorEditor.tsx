import React, { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { python } from '@codemirror/lang-python';
import { sql } from '@codemirror/lang-sql';
import { yaml } from '@codemirror/lang-yaml';
import { getFileExtension, getLanguageLabel } from '../../../utils/file-types';
import { useWorkspace } from '../../../context/WorkspaceContext';
import { FileCode, Save, Laptop } from 'lucide-react';
import { API } from '../../../services/api';

interface CodeMirrorEditorProps {
  filePath: string;
  content: string;
  onChange: (value: string) => void;
  onOpenDiffModal?: () => void;
}

// Clean Light Theme for CodeMirror matching Google Material 3
const lightEditorTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: '#ffffff',
      color: '#1e293b',
      height: '100%',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace',
      fontSize: '13.5px',
    },
    '.cm-scroller': {
      overflow: 'auto',
      fontFamily: 'inherit',
    },
    '.cm-content': {
      caretColor: '#1a73e8',
      padding: '16px 48px 48px 16px',
    },
    '.cm-gutters': {
      backgroundColor: '#f8f9fa',
      color: '#94a3b8',
      borderRight: '1px solid #e2e8f0',
      paddingRight: '8px',
      userSelect: 'none',
    },
    '.cm-activeLineGutter': {
      backgroundColor: '#e8eaed',
      color: '#1a73e8',
      fontWeight: 'bold',
    },
    '.cm-activeLine': {
      backgroundColor: '#f8fafc',
    },
    '&.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: '#d2e3fc !important',
    },
    '.cm-line': {
      padding: '0 4px',
    },
    '.cm-foldPlaceholder': {
      backgroundColor: '#e2e8f0',
      border: 'none',
      color: '#64748b',
      padding: '0 4px',
      borderRadius: '3px',
    },
  },
  { dark: false }
);

export const CodeMirrorEditor: React.FC<CodeMirrorEditorProps> = ({
  filePath,
  content,
  onChange,
}) => {
  const { saveStatus, isSaving, saveCurrentFile, hasUnsavedChanges } = useWorkspace();
  const ext = getFileExtension(filePath);
  const langLabel = getLanguageLabel(filePath);

  const extensions = useMemo(() => {
    const exts = [lightEditorTheme];
    if (['ts', 'tsx'].includes(ext)) {
      exts.push(javascript({ typescript: true, jsx: ext === 'tsx' }));
    } else if (['js', 'jsx', 'mjs', 'cjs'].includes(ext)) {
      exts.push(javascript({ jsx: ext === 'jsx' }));
    } else if (ext === 'json') {
      exts.push(json());
    } else if (['html', 'htm'].includes(ext)) {
      exts.push(html());
    } else if (['css', 'scss', 'less'].includes(ext)) {
      exts.push(css());
    } else if (ext === 'py') {
      exts.push(python());
    } else if (ext === 'sql') {
      exts.push(sql());
    } else if (['yaml', 'yml'].includes(ext)) {
      exts.push(yaml());
    }
    return exts;
  }, [ext]);

  const [openedInOS, setOpenedInOS] = React.useState(false);

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveCurrentFile();
    }
  };

  return (
    <div
      className="code-editor-container"
      onKeyDown={handleKeyDown}
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
      {/* Top Action Bar - Clean Light */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 24px',
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          fontSize: '13px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <FileCode size={16} style={{ color: '#1a73e8', flexShrink: 0 }} />
          <span style={{ fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {filePath}
          </span>
          <span
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '4px',
              background: '#e8f0fe',
              color: '#1a73e8',
              fontWeight: 600,
            }}
          >
            {langLabel}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '12px',
              color: saveStatus === 'Erro' ? '#d93025' : saveStatus === 'Salvando...' ? '#f29900' : '#64748b',
              fontWeight: 500,
              marginRight: '4px',
            }}
          >
            {isSaving ? 'Salvando...' : saveStatus}
          </span>

          <button
            onClick={handleOpenInOS}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              borderRadius: '6px',
              background: openedInOS ? '#dcfce7' : '#f8fafc',
              border: '1px solid',
              borderColor: openedInOS ? '#86efac' : '#e2e8f0',
              color: openedInOS ? '#16a34a' : '#334155',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500,
            }}
            title="Abrir no gerenciador de arquivos do PC"
          >
            <Laptop size={14} />
            {openedInOS ? 'Aberto no PC!' : 'Abrir no PC'}
          </button>

          <button
            onClick={() => saveCurrentFile()}
            disabled={isSaving || !hasUnsavedChanges}
            title="Salvar arquivo (Ctrl+S / Cmd+S)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 14px',
              borderRadius: '6px',
              border: hasUnsavedChanges ? 'none' : '1px solid #e2e8f0',
              background: hasUnsavedChanges ? '#1a73e8' : '#f8f9fa',
              color: hasUnsavedChanges ? '#ffffff' : '#94a3b8',
              cursor: hasUnsavedChanges ? 'pointer' : 'default',
              fontSize: '12px',
              fontWeight: 600,
              transition: 'all 0.15s ease',
              boxShadow: hasUnsavedChanges ? '0 1px 3px rgba(26, 115, 232, 0.25)' : 'none',
            }}
          >
            <Save size={14} />
            Salvar
          </button>
        </div>
      </div>

      {/* CodeMirror Canvas with generous right padding */}
      <div style={{ flex: 1, overflow: 'auto', position: 'relative', background: '#ffffff' }}>
        <CodeMirror
          value={content}
          height="100%"
          theme="light"
          extensions={extensions}
          onChange={(val) => onChange(val)}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLineGutter: true,
            highlightSpecialChars: true,
            history: true,
            foldGutter: true,
            drawSelection: true,
            dropCursor: true,
            allowMultipleSelections: true,
            indentOnInput: true,
            syntaxHighlighting: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            rectangularSelection: true,
            crosshairCursor: true,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
            closeBracketsKeymap: true,
            defaultKeymap: true,
            searchKeymap: true,
            historyKeymap: true,
            foldKeymap: true,
            completionKeymap: true,
            lintKeymap: true,
          }}
        />
      </div>
    </div>
  );
};
export default CodeMirrorEditor;
