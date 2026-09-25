import React, { useState } from 'react';
import { FileQuestion, Download, Laptop } from 'lucide-react';
import { getFileExtension, getLanguageLabel } from '../../../utils/file-types';
import { API } from '../../../services/api';

interface GenericFileViewerProps {
  filePath: string;
}

export const GenericFileViewer: React.FC<GenericFileViewerProps> = ({ filePath }) => {
  const [openedInOS, setOpenedInOS] = useState(false);
  const ext = getFileExtension(filePath);
  const label = getLanguageLabel(filePath);
  const fileUrl = `/api/project/file/raw?path=${encodeURIComponent(filePath)}`;

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

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = fileUrl;
    a.download = filePath.split('/').pop() || 'arquivo';
    a.click();
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        width: '100%',
        background: '#ffffff',
        color: '#1e293b',
        padding: '32px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '72px',
          height: '72px',
          borderRadius: '16px',
          background: '#f1f5f9',
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '20px',
        }}
      >
        <FileQuestion size={36} style={{ color: '#1a73e8' }} />
      </div>

      <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 600, color: '#1e293b' }}>
        {filePath.split('/').pop()}
      </h3>
      <p style={{ margin: '0 0 24px 0', fontSize: '13px', color: '#64748b', maxWidth: '400px' }}>
        Tipo: {label} (.{ext})
        <br />
        Este arquivo não possui uma visualização direta no navegador. Você pode abri-lo com o aplicativo padrão do seu computador ou baixá-lo.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={handleOpenInOS}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 20px',
            borderRadius: '8px',
            background: openedInOS ? '#16a34a' : '#1a73e8',
            color: '#ffffff',
            border: 'none',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '13px',
            boxShadow: '0 2px 6px rgba(26, 115, 232, 0.3)',
            transition: 'background 0.15s ease',
          }}
        >
          <Laptop size={16} />
          {openedInOS ? 'Aberto no PC!' : 'Abrir no PC'}
        </button>

        <button
          onClick={handleDownload}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 20px',
            borderRadius: '8px',
            background: '#f1f5f9',
            color: '#334155',
            border: '1px solid #cbd5e1',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          <Download size={16} />
          Baixar Arquivo
        </button>
      </div>
    </div>
  );
};
export default GenericFileViewer;
