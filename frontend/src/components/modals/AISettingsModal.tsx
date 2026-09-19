import React, { useState, useEffect } from 'react';
import { useAI } from '../../context/AIContext';
import { API } from '../../services/api';

const PROVIDERS = [
  { id: 'gemini', name: 'Google Gemini', desc: 'Gemini 3.5 Flash / 1.5 Pro', needsKey: true, hasEndpoint: false },
  { id: 'openai', name: 'OpenAI', desc: 'GPT-4o / GPT-4o-mini', needsKey: true, hasEndpoint: false },
  { id: 'anthropic', name: 'Anthropic Claude', desc: 'Claude 3.5 Sonnet', needsKey: true, hasEndpoint: false },
  { id: 'deepseek', name: 'DeepSeek API', desc: 'DeepSeek V3 / R1', needsKey: true, hasEndpoint: false },
  { id: 'local', name: 'Ollama Local', desc: 'Offline & Sem Chave', needsKey: false, hasEndpoint: true, defaultEndpoint: 'http://localhost:11434/v1' }
];

export const AISettingsModal: React.FC = () => {
  const { isSettingsModalOpen, closeSettingsModal, aiSettings, saveAISettings } = useAI();
  const [selectedProvider, setSelectedProvider] = useState('gemini');
  const [model, setModel] = useState('gemini-3.5-flash');
  const [apiKey, setApiKey] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [modelsList, setModelsList] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isCustomModelInput, setIsCustomModelInput] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (aiSettings) {
      setSelectedProvider(aiSettings.active_provider || 'gemini');
      setModel(aiSettings.active_model || 'gemini-3.5-flash');
      const prov = aiSettings.providers?.[aiSettings.active_provider || 'gemini'];
      if (prov) {
        setEndpoint(prov.custom_endpoint || '');
      }
    }
  }, [aiSettings, isSettingsModalOpen]);

  if (!isSettingsModalOpen) return null;

  const currentProviderConfig = PROVIDERS.find(p => p.id === selectedProvider) || PROVIDERS[0];

  const handleFetchModels = async () => {
    setIsLoadingModels(true);
    setStatusMessage(null);
    try {
      const res = await API.getAIModels({
        provider: selectedProvider,
        api_key: apiKey,
        custom_endpoint: endpoint
      });
      if (res.ok && res.data.models && res.data.models.length > 0) {
        setModelsList(res.data.models);
        if (!res.data.models.includes(model) && res.data.models[0]) {
          setModel(res.data.models[0]);
        }
        setStatusMessage({ text: `Encontrados ${res.data.models.length} modelos disponíveis`, type: 'success' });
      } else {
        setStatusMessage({ text: 'Não foi possível listar modelos automaticamente.', type: 'error' });
      }
    } catch (err) {
      setStatusMessage({ text: 'Erro ao conectar com provedor.', type: 'error' });
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleSave = async () => {
    const success = await saveAISettings(selectedProvider, model, apiKey || undefined, endpoint || undefined);
    if (success) {
      setStatusMessage({ text: 'Configurações de IA salvas com sucesso!', type: 'success' });
      setTimeout(() => {
        closeSettingsModal();
      }, 700);
    } else {
      setStatusMessage({ text: 'Erro ao salvar configurações.', type: 'error' });
    }
  };

  return (
    <div id="ai-settings-modal" className="modal-backdrop" style={{ display: 'flex' }}>
      <div className="modal-box ai-modal-box">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div>
              <h3>Configurar Provedor de IA</h3>
              <span className="subtitle">Escolha o modelo para parear com o Agentic Chat</span>
            </div>
          </div>
          <button className="btn-close" aria-label="Fechar" onClick={closeSettingsModal}>
            <span className="material-symbols-outlined icon-sm">close</span>
          </button>
        </div>

        <div className="modal-body" style={{ gap: '16px' }}>
          {/* Provider Visual Radio Selection */}
          <div className="provider-grid-selector">
            {PROVIDERS.map(p => {
              const provState = aiSettings?.providers?.[p.id];
              const isConfigured = provState ? provState.configured : false;
              const isSelected = selectedProvider === p.id;

              return (
                <label
                  key={p.id}
                  className={`provider-card-option ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedProvider(p.id);
                    if (p.id === 'local' && !endpoint) setEndpoint(p.defaultEndpoint || '');
                  }}
                >
                  <input
                    type="radio"
                    name="ai-provider-radio"
                    value={p.id}
                    checked={isSelected}
                    onChange={() => setSelectedProvider(p.id)}
                  />
                  <div className="p-info">
                    <span className="p-title">{p.name}</span>
                    <span className="p-desc">{p.desc}</span>
                    <div className={`provider-status-badge ${isConfigured ? 'configured' : 'unconfigured'}`}>
                      <span className="status-dot"></span>
                      <span className="status-text">{isConfigured ? 'Pronto / Ativo' : 'Não configurado'}</span>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label htmlFor="ai-model-select" style={{ marginBottom: 0 }}>Modelo de IA:</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  className="btn btn-ghost btn-xs"
                  type="button"
                  title="Consultar modelos disponíveis"
                  onClick={handleFetchModels}
                  disabled={isLoadingModels}
                  style={{ fontSize: '11px', padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <span className="material-symbols-outlined icon-xs">refresh</span>
                  {isLoadingModels ? 'Buscando...' : 'Buscar no Servidor'}
                </button>
                <button
                  className="btn btn-ghost btn-xs"
                  type="button"
                  onClick={() => setIsCustomModelInput(!isCustomModelInput)}
                  style={{ fontSize: '11px', padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <span className="material-symbols-outlined icon-xs">edit</span>
                  {isCustomModelInput ? 'Lista' : 'Digitar'}
                </button>
              </div>
            </div>

            {isCustomModelInput ? (
              <input
                id="ai-model-select"
                type="text"
                className="form-input"
                placeholder="Ex: gemini-2.5-flash, deepseek-chat"
                value={model}
                onChange={e => setModel(e.target.value)}
              />
            ) : (
              <select
                id="ai-model-select"
                className="form-select"
                value={model}
                onChange={e => setModel(e.target.value)}
              >
                {modelsList.length > 0 ? (
                  modelsList.map(m => <option key={m} value={m}>{m}</option>)
                ) : (
                  <>
                    <option value={model}>{model} (Atual)</option>
                    <option value="gemini-3.5-flash">gemini-3.5-flash (Padrão)</option>
                    <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                    <option value="gpt-4o">gpt-4o</option>
                    <option value="claude-3-5-sonnet-latest">claude-3-5-sonnet-latest</option>
                    <option value="deepseek-chat">deepseek-chat</option>
                    <option value="deepseek-r1:latest">deepseek-r1:latest</option>
                  </>
                )}
              </select>
            )}
          </div>

          {currentProviderConfig.needsKey && (
            <div className="form-group">
              <label htmlFor="ai-api-key">API Key do Provedor:</label>
              <input
                id="ai-api-key"
                type="password"
                className="form-input"
                placeholder="Insira sua chave de API (opcional se já definida no ambiente)"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
              />
            </div>
          )}

          {currentProviderConfig.hasEndpoint && (
            <div className="form-group">
              <label htmlFor="ai-custom-endpoint">Endpoint Customizado (Ollama / Local):</label>
              <input
                id="ai-custom-endpoint"
                type="text"
                className="form-input"
                placeholder="http://localhost:11434/v1"
                value={endpoint}
                onChange={e => setEndpoint(e.target.value)}
              />
            </div>
          )}

          {statusMessage && (
            <div style={{
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '13px',
              backgroundColor: statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: statusMessage.type === 'success' ? '#10b981' : '#ef4444'
            }}>
              {statusMessage.text}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={closeSettingsModal}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave}>Salvar & Ativar</button>
        </div>
      </div>
    </div>
  );
};
