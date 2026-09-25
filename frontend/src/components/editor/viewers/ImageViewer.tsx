import React, { useState } from 'react';
import { Image as ImageIcon, Download, ZoomIn, ZoomOut, RotateCcw, Laptop } from 'lucide-react';
import { API } from '../../../services/api';

interface ImageViewerProps {
  filePath: string;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ filePath }) => {
  const [scale, setScale] = useState(1);
  const [openedInOS, setOpenedInOS] = useState(false);
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
    a.download = filePath.split('/').pop() || 'imagem';
    a.click();
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: '#f8fafc',
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
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ImageIcon size={16} style={{ color: '#e28743' }} />
          <span style={{ fontWeight: 600, color: '#1e293b' }}>{filePath}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setScale((s) => Math.max(0.2, s - 0.2))}
            title="Diminuir Zoom"
            style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
          >
            <ZoomOut size={16} />
          </button>
          <span style={{ fontSize: '11px', color: '#64748b', width: '40px', textAlign: 'center', fontWeight: 600 }}>
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(5, s + 0.2))}
            title="Aumentar Zoom"
            style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={() => setScale(1)}
            title="Resetar Zoom"
            style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
          >
            <RotateCcw size={16} />
          </button>

          <button
            onClick={handleOpenInOS}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
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
            onClick={handleDownload}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 14px',
              borderRadius: '6px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              color: '#334155',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            <Download size={14} />
            Baixar
          </button>
        </div>
      </div>

      {/* Image Canvas with checkerboard transparency grid */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 48px',
          backgroundImage: `
            linear-gradient(45deg, #f1f5f9 25%, transparent 25%),
            linear-gradient(-45deg, #f1f5f9 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #f1f5f9 75%),
            linear-gradient(-45deg, transparent 75%, #f1f5f9 75%)
          `,
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
        }}
      >
        <img
          src={fileUrl}
          alt={filePath}
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
            transition: 'transform 0.15s ease-out',
            maxWidth: '90%',
            maxHeight: '90%',
            objectFit: 'contain',
            borderRadius: '6px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          }}
        />
      </div>
    </div>
  );
};
export default ImageViewer;
