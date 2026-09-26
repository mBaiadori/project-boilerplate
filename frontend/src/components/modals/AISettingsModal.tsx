import React, { useState, useEffect, useMemo } from 'react';
import { useAI } from '../../context/AIContext';
import { API } from '../../services/api';
import { SelectDropdown, type SelectOption } from '../common/SelectDropdown';

const PROVIDERS = [
  { id: 'gemini', name: 'Google Gemini', desc: 'Gemini 2.5 Flash / 2.5 Pro', needsKey: true, hasEndpoint: false },
  { id: 'openai', name: 'OpenAI', desc: 'GPT-4o / GPT-4o-mini', needsKey: true, hasEndpoint: false },
  { id: 'anthropic', name: 'Anthropic Claude', desc: 'Claude 3.7 & 3.5 Sonnet', needsKey: true, hasEndpoint: false },
  { id: 'deepseek', name: 'DeepSeek API', desc: 'DeepSeek V3 / R1', needsKey: true, hasEndpoint: false },
  { id: 'local', name: 'Ollama Local', desc: 'Offline & Sem Chave', needsKey: false, hasEndpoint: true, defaultEndpoint: 'http://localhost:11434/v1' }
];

interface DetailedModelItem {
  id: string;
  name: string;
  description?: string;
}

export const AISettingsModal: React.FC = () => {
  const { isSettingsModalOpen, closeSettingsModal, aiSettings, saveAISettings } = useAI();
  const [selectedProvider, setSelectedProvider] = useState('gemini');
  const [model, setModel] = useState('gemini-2.5-flash');
  const [apiKey, setApiKey] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [modelsList, setModelsList] = useState<DetailedModelItem[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isDynamicList, setIsDynamicList] = useState(false);
  const [isCustomModelInput, setIsCustomModelInput] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    if (aiSettings) {
      const activeProv = aiSettings.active_provider || 'gemini';
      setSelectedProvider(activeProv);
      setModel(aiSettings.active_model || (activeProv === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o'));
      const prov = aiSettings.providers?.[activeProv];
      if (prov) {
        setEndpoint(prov.custom_endpoint || '');
      }
    }
  }, [aiSettings, isSettingsModalOpen]);

  const fetchModelsForProvider = async (provId: string, customKey?: string, customEp?: string) => {
    setIsLoadingModels(true);
    try {
      const res = await API.getAIModels({
        provider: provId,
        api_key: customKey || apiKey || undefined,
        custom_endpoint: customEp || endpoint || undefined,
      });

      if (res.ok && res.data) {
        let items: DetailedModelItem[] = [];
        if (res.data.detailedModels && res.data.detailedModels.length > 0) {
          items = res.data.detailedModels;
        } else if (res.data.models && res.data.models.length > 0) {
          items = res.data.models.map((m: any) => typeof m === 'string' ? { id: m, name: m } : m);
        }

        if (items.length > 0) {
          setModelsList(items);
          setIsDynamicList(Boolean(res.data.isDynamic));
          const exists = items.some((m) => m.id === model);
          if (!exists && items[0]) {
            setModel(items[0].id);
          }
          if (res.data.isDynamic) {
            setStatusMessage({ text: res.data.message || `Carregados ${items.length} modelos dinamicamente via API`, type: 'success' });
          }
        }
      }
    } catch (err) {
      console.warn('[AISettingsModal] Erro ao buscar modelos:', err);
    } finally {
      setIsLoadingModels(false);
    }
  };

  useEffect(() => {
    if (isSettingsModalOpen) {
      fetchModelsForProvider(selectedProvider);
    }
  }, [selectedProvider, isSettingsModalOpen]);

  // Transform modelsList to SelectOption array
  const selectOptions: SelectOption[] = useMemo(() => {
    if (modelsList.length === 0) {
      return [
        { value: model, label: model, description: 'Modelo ativo selecionado' },
        { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: 'Alta velocidade e capacidades multimodais', badge: 'Flash', badgeType: 'success' },
        { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: 'Raciocínio complexo e codificação profunda', badge: 'Pro', badgeType: 'warning' },
        { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', description: 'Modelo versátil', badge: 'Flash', badgeType: 'info' },
      ];
    }

    return modelsList.map((m) => {
      let badge: string | undefined;
      let badgeType: 'primary' | 'success' | 'warning' | 'neutral' | 'info' = 'primary';

      if (m.id.includes('pro')) {
        badge = 'Pro';
        badgeType = 'warning';
      } else if (m.id.includes('flash')) {
        badge = 'Flash';
        badgeType = 'success';
      } else if (m.id.includes('reason') || m.id.includes('r1')) {
        badge = 'Reasoner';
        badgeType = 'info';
      }

      return {
        value: m.id,
        label: m.name !== m.id ? m.name : m.id,
        description: m.description || m.id,
        icon: 'smart_toy',
        badge,
        badgeType,
      };
    });
  }, [modelsList, model]);

  if (!isSettingsModalOpen) return null;

  const currentProviderConfig = PROVIDERS.find(p => p.id === selectedProvider) || PROVIDERS[0];

  const handleManualFetchModels = () => {
    setStatusMessage(null);
    fetchModelsForProvider(selectedProvider, apiKey, endpoint);
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
              <span className="subtitle">Escolha o provedor e modelo de LLM ativo</span>
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

          {currentProviderConfig.needsKey && (
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label htmlFor="ai-api-key" style={{ marginBottom: 0 }}>API Key do Provedor:</label>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Necessária para consulta de modelos e chat
                </span>
              </div>
              <input
                id="ai-api-key"
                type="password"
                className="form-input"
                placeholder="Insira sua chave de API (opcional se já definida no ambiente)"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                onBlur={() => {
                  if (apiKey.trim()) {
                    fetchModelsForProvider(selectedProvider, apiKey, endpoint);
                  }
                }}
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
                onBlur={() => fetchModelsForProvider(selectedProvider, apiKey, endpoint)}
              />
            </div>
          )}

          <div className="form-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label htmlFor="ai-model-select" style={{ marginBottom: 0 }}>Modelo de IA:</label>
                {isDynamicList && (
                  <span className="badge badge-success" style={{ fontSize: '10px', padding: '1px 6px' }}>
                    API Dinâmica
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  className="btn btn-ghost btn-xs"
                  type="button"
                  title="Consultar modelos disponíveis na API do provedor"
                  onClick={handleManualFetchModels}
                  disabled={isLoadingModels}
                  style={{ fontSize: '11px', padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <span className={`material-symbols-outlined icon-xs ${isLoadingModels ? 'spinning' : ''}`}>
                    {isLoadingModels ? 'progress_activity' : 'refresh'}
                  </span>
                  {isLoadingModels ? 'Consultando...' : 'Atualizar Modelos'}
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
                placeholder="Ex: gemini-2.5-flash, gemini-2.5-pro, gpt-4o"
                value={model}
                onChange={e => setModel(e.target.value)}
              />
            ) : (
              <SelectDropdown
                id="ai-model-select"
                value={model}
                options={selectOptions}
                onChange={(val) => setModel(val)}
                placeholder="Selecione o modelo de IA..."
                searchable={selectOptions.length > 5}
                searchPlaceholder="Filtrar modelos (ex: flash, pro, 2.5)..."
                leadingIcon="smart_toy"
              />
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
