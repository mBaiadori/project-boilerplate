import React from 'react';
import { Spinner } from '../ui/Spinner';

interface LoadingPaneProps {
  message?: string;
}

export const LoadingPane: React.FC<LoadingPaneProps> = ({ message = 'Carregando módulo...' }) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        width: '100%',
        padding: '32px',
        color: 'var(--text-muted, #888)'
      }}
    >
      <Spinner size="md" message={message} />
    </div>
  );
};
