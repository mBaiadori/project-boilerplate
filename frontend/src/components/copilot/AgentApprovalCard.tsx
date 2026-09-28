import React, { useState } from 'react';
import { ShieldCheck, Check, X, Send } from 'lucide-react';

interface AgentApprovalCardProps {
  prompt: string;
  sessionId: string;
  providerName?: string;
  onApprove: (sessionId: string, customInput?: string) => Promise<void>;
  onReject: (sessionId: string) => Promise<void>;
}

export const AgentApprovalCard: React.FC<AgentApprovalCardProps> = ({
  prompt,
  sessionId,
  providerName = 'Antigravity Agent',
  onApprove,
  onReject,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      await onApprove(sessionId, customInput.trim() || undefined);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    setIsSubmitting(true);
    try {
      await onReject(sessionId);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        margin: '12px 0',
        padding: '14px 16px',
        backgroundColor: 'var(--surface-elevated, #1e293b)',
        border: '1px solid var(--accent-primary, #3b82f6)',
        borderRadius: '10px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#60a5fa', fontWeight: 600, fontSize: '13px' }}>
        <ShieldCheck size={18} />
        <span>Aprovação Solicitada por {providerName}</span>
      </div>

      <div
        style={{
          fontSize: '13px',
          color: 'var(--text-primary, #f1f5f9)',
          backgroundColor: 'rgba(0,0,0,0.2)',
          padding: '10px 12px',
          borderRadius: '6px',
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          borderLeft: '3px solid #3b82f6',
        }}
      >
        {prompt}
      </div>

      {showCustomInput ? (
        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="Digite instrução adicional ou ajuste..."
            style={{
              flex: 1,
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid var(--border-color, #475569)',
              backgroundColor: 'var(--surface-base, #0f172a)',
              color: 'var(--text-primary, #f8fafc)',
              fontSize: '12px',
            }}
          />
          <button
            onClick={handleApprove}
            disabled={isSubmitting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 12px',
              borderRadius: '6px',
              backgroundColor: '#3b82f6',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            <Send size={13} />
            Enviar
          </button>
        </div>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '4px' }}>
        <button
          type="button"
          onClick={() => setShowCustomInput(!showCustomInput)}
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            fontSize: '11px',
            cursor: 'pointer',
            textDecoration: 'underline',
            padding: 0,
          }}
        >
          {showCustomInput ? 'Ocultar resposta customizada' : '+ Responder com texto customizado'}
        </button>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={handleReject}
            disabled={isSubmitting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 12px',
              borderRadius: '6px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              color: '#f87171',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            <X size={14} />
            Recusar (n)
          </button>

          <button
            type="button"
            onClick={handleApprove}
            disabled={isSubmitting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 14px',
              borderRadius: '6px',
              backgroundColor: '#22c55e',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <Check size={14} />
            Aprovar (y)
          </button>
        </div>
      </div>
    </div>
  );
};
