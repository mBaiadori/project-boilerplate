import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useAI } from '../../context/AIContext';
import { API } from '../../services/api';

export const SettingsSubView: React.FC = () => {
  const { user, logout } = useAuth();
  const { aiSettings, saveSettings: saveAISettings } = useAI();

  // AI Provider State
  const [provider, setProvider] = useState<string>('gemini');
  const [model, setModel] = useState<string>('gemini-3.5-flash');
  const [apiKey, setApiKey] = useState<string>('');
  const [endpoint, setEndpoint] = useState<string>('http://localhost:11434/v1');

  // Prompts State
  const [globalPrompt, setGlobalPrompt] = useState<string>('');
  const [tplCreatorPrompt, setTplCreatorPrompt] = useState<string>('');
  const [autoPROn, setAutoPROn] = useState<boolean>(true);

  // Status feedback
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    if (aiSettings) {
      setProvider(aiSettings.active_provider || 'gemini');
      setModel(aiSettings.active_model || 'gemini-3.5-flash');
      setEndpoint(aiSettings.custom_endpoint || 'http://localhost:11434/v1');
    }
  }, [aiSettings]);

  const loadProjectSettings = useCallback(async () => {
    try {
      const res = await API.getSettings();
      if (res) {
        if (res.system_prompts?.global) {
          setGlobalPrompt(res.system_prompts.global);
        }
        if (res.system_prompts?.template_creator) {
          setTplCreatorPrompt(res.system_prompts.template_creator);
        }
        if (res.governance?.auto_pr !== undefined) {
          setAutoPROn(res.governance.auto_pr);
        }
      }
    } catch (err) {
      console.error('[SettingsSubView] Erro ao carregar configurações:', err);
    }
  }, []);

  useEffect(() => {
    loadProjectSettings();
  }, [loadProjectSettings]);

  const handleSaveAISettings = async () => {
    setSaveStatus('Salvando configurações de IA...');
    try {
      await saveAISettings({
        active_provider: provider,
        active_model: model,
        api_keys: apiKey ? { [provider]: apiKey } : undefined,
        custom_endpoint: provider === 'local' ? endpoint : undefined
      });
      setSaveStatus('Configurações de IA salvas com sucesso!');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error('Erro ao salvar IA:', err);
      setSaveStatus('Erro ao salvar IA.');
    }
  };

  const handleSaveAllSettings = async () => {
    setSaveStatus('Salvando todas as configurações...');
    try {
      await handleSaveAISettings();
      await API.saveSettings({
        system_prompts: {
          global: globalPrompt,
          template_creator: tplCreatorPrompt
        },
        governance: {
          auto_pr: autoPROn
        }
      });
      setSaveStatus('Todas as configurações foram sincronizadas com sucesso!');
      setTimeout(() => setSaveStatus(null), 3500);
    } catch (err) {
      console.error('Erro ao salvar configurações:', err);
      setSaveStatus('Erro ao salvar configurações.');
    }
  };

  return (
    <div id="subview-settings" className="dash-subview" style={{ display: 'block', width: '100%', height: '100%', overflowY: 'auto' }}>
      <div className="settings-view-wrapper">
        <div style={{ marginBottom: '24px' }}>
          <h2>Configurações & Governança</h2>
          <p className="subtitle">
            Gerencie o motor de Inteligência Artificial, prompts mestre, regras de governança e credenciais da conta.
          </p>
        </div>

        {saveStatus && (
          <div style={{ padding: '10px 16px', background: 'var(--bg-subtle, #eff6ff)', border: '1px solid var(--primary, #3b82f6)', borderRadius: '8px', color: 'var(--primary, #2563eb)', marginBottom: '16px', fontSize: '13px', fontWeight: 600 }}>
            {saveStatus}
          </div>
        )}

        {/* SEÇÃO 1: MOTOR DE INTELIGÊNCIA ARTIFICIAL (IA) */}
        <div className="gov-card" style={{ marginBottom: '24px' }}>
          <div className="gov-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined icon-lg" style={{ color: 'var(--md-sys-color-primary, #2563eb)' }}>
                smart_toy
              </span>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px' }}>Provedor de Inteligência Artificial & Modelos</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                  Escolha o provedor de LLM utilizado pelo assistente em tempo real e geradores.
                </p>
              </div>
            </div>
            <span className="pill-dot success" id="settings-ai-status-pill">
              <span className="dot"></span> Ativo
            </span>
          </div>

          {/* Provider Selection Cards Grid */}
          <div
            className="provider-cards-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: '12px',
              margin: '16px 0'
            }}
          >
            <div
              className={`provider-card-option ${provider === 'gemini' ? 'selected' : ''}`}
              data-provider="gemini"
              onClick={() => { setProvider('gemini'); setModel('gemini-3.5-flash'); }}
              style={{ padding: '12px', border: '1.5px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', background: 'var(--bg-surface)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <strong>Google Gemini</strong>
                <input type="radio" name="settings-ai-provider" value="gemini" checked={provider === 'gemini'} onChange={() => {}} />
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>Flash 3.5 & Pro</span>
            </div>

            <div
              className={`provider-card-option ${provider === 'openai' ? 'selected' : ''}`}
              data-provider="openai"
              onClick={() => { setProvider('openai'); setModel('gpt-4o'); }}
              style={{ padding: '12px', border: '1.5px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', background: 'var(--bg-surface)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <strong>OpenAI</strong>
                <input type="radio" name="settings-ai-provider" value="openai" checked={provider === 'openai'} onChange={() => {}} />
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>GPT-4o & o3-mini</span>
            </div>

            <div
              className={`provider-card-option ${provider === 'anthropic' ? 'selected' : ''}`}
              data-provider="anthropic"
              onClick={() => { setProvider('anthropic'); setModel('claude-3-5-sonnet-20241022'); }}
              style={{ padding: '12px', border: '1.5px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', background: 'var(--bg-surface)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <strong>Anthropic</strong>
                <input type="radio" name="settings-ai-provider" value="anthropic" checked={provider === 'anthropic'} onChange={() => {}} />
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>Claude 3.5 Sonnet</span>
            </div>

            <div
              className={`provider-card-option ${provider === 'deepseek' ? 'selected' : ''}`}
              data-provider="deepseek"
              onClick={() => { setProvider('deepseek'); setModel('deepseek-chat'); }}
              style={{ padding: '12px', border: '1.5px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', background: 'var(--bg-surface)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <strong>DeepSeek</strong>
                <input type="radio" name="settings-ai-provider" value="deepseek" checked={provider === 'deepseek'} onChange={() => {}} />
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>V3 & R1 Reasoner</span>
            </div>

            <div
              className={`provider-card-option ${provider === 'local' ? 'selected' : ''}`}
              data-provider="local"
              onClick={() => { setProvider('local'); setModel('llama3.2'); }}
              style={{ padding: '12px', border: '1.5px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', background: 'var(--bg-surface)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <strong>Ollama Local</strong>
                <input type="radio" name="settings-ai-provider" value="local" checked={provider === 'local'} onChange={() => {}} />
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>Offline / Localhost</span>
            </div>
          </div>

          {/* Model & API Key Inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '10px' }}>
            <div className="form-group">
              <label htmlFor="settings-ai-model-input">Modelo Selecionado:</label>
              <input
                type="text"
                id="settings-ai-model-input"
                value={model}
                onChange={e => setModel(e.target.value)}
              />
              <span id="settings-ai-model-hint" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                Modelos recomendados: gemini-3.5-flash, gemini-3-flash-preview, gpt-4o
              </span>
            </div>

            <div className="form-group" id="settings-ai-key-group">
              <label htmlFor="settings-ai-key-input">Chave de API (API Key):</label>
              <input
                type="password"
                id="settings-ai-key-input"
                placeholder="Cole sua chave aqui..."
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
              />
            </div>
          </div>

          {provider === 'local' && (
            <div className="form-group" id="settings-ai-endpoint-group" style={{ marginTop: '10px' }}>
              <label htmlFor="settings-ai-endpoint-input">Endpoint Local (Ollama / vLLM):</label>
              <input
                type="text"
                id="settings-ai-endpoint-input"
                value={endpoint}
                onChange={e => setEndpoint(e.target.value)}
              />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
            <button
              id="btn-save-ai-settings-direct"
              className="btn btn-primary btn-sm"
              type="button"
              onClick={handleSaveAISettings}
            >
              Salvar Motor de IA
            </button>
          </div>
        </div>

        {/* SEÇÃO 2: PROMPTS MESTRE & GOVERNANÇA DA IA */}
        <div className="gov-card" style={{ marginBottom: '24px' }}>
          <div className="gov-card-header">
            <div>
              <h3 style={{ margin: 0, fontSize: '15px' }}>Prompts Mestre do Sistema</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Defina as diretrizes oficiais injetadas nos assistentes e geradores.
              </p>
            </div>
            <span className="pill-dot info">
              <span className="dot"></span> System Prompts
            </span>
          </div>

          <div className="form-group" style={{ marginTop: '14px' }}>
            <label htmlFor="sys-global-system-prompt">
              <strong>Prompt Global do Antigravity Agent (Chat no Workspace):</strong>
            </label>
            <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: '2px 0 6px 0' }}>
              Instrução base injetada em todas as conversas do Agentic Chat.
            </p>
            <textarea
              id="sys-global-system-prompt"
              rows={5}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}
              value={globalPrompt}
              onChange={e => setGlobalPrompt(e.target.value)}
              placeholder="Você é o Arquiteto e Assistente Oficial de Especificações..."
            />
          </div>

          <div className="form-group" style={{ marginTop: '14px' }}>
            <label htmlFor="sys-template-creator-prompt">
              <strong>Prompt do Criador de Templates:</strong>
            </label>
            <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: '2px 0 6px 0' }}>
              Meta-prompt que orienta a IA na geração de novos templates estruturados.
            </p>
            <textarea
              id="sys-template-creator-prompt"
              rows={4}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}
              value={tplCreatorPrompt}
              onChange={e => setTplCreatorPrompt(e.target.value)}
              placeholder="Gere templates no padrão oficial de governança com frontmatter estruturado..."
            />
          </div>
        </div>

        {/* SEÇÃO 3: REGRAS DE GOVERNANÇA & GIT */}
        <div className="gov-card" style={{ marginBottom: '24px' }}>
          <div className="gov-card-header">
            <div>
              <h3 style={{ margin: 0, fontSize: '15px' }}>Governança de Pull Requests & Git</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Fluxo de aprovação e acúmulo de alterações no workspace.
              </p>
            </div>
          </div>

          <div className="form-group-checkbox" style={{ marginTop: '14px' }}>
            <label>
              <input
                type="checkbox"
                id="sys-auto-pr-check"
                checked={autoPROn}
                onChange={e => setAutoPROn(e.target.checked)}
              />
              <span>
                <strong>Modo Ágil:</strong> Permitir edição contínua no workspace acumulando alterações em 1 único PR unificado
              </span>
            </label>
          </div>
        </div>

        {/* SEÇÃO 4: CONTA GITHUB & CONEXÃO */}
        <div className="gov-card">
          <div className="gov-card-header">
            <div>
              <h3 style={{ margin: 0, fontSize: '15px' }}>Conexão GitHub & Sessão</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Credenciais e conta vinculada ao framework.
              </p>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '14px',
              padding: '12px',
              background: 'var(--bg-surface)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img
                id="settings-user-avatar"
                src={user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=6366f1&color=fff`}
                alt="Avatar"
                style={{ width: '38px', height: '38px', borderRadius: '50%' }}
              />
              <div>
                <strong id="settings-user-name" style={{ fontSize: '13.5px', color: 'var(--text-normal)', display: 'block' }}>
                  {user?.name || 'Usuário Autenticado'}
                </strong>
                <span id="settings-user-login" style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                  @{user?.login || 'github'}
                </span>
              </div>
            </div>

            <button
              id="btn-settings-logout"
              className="btn btn-secondary btn-sm"
              type="button"
              style={{ color: '#ef4444' }}
              onClick={logout}
            >
              Desconectar Conta
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '18px' }}>
            <button
              id="btn-save-system-settings"
              className="btn btn-primary"
              type="button"
              onClick={handleSaveAllSettings}
            >
              Salvar Todas as Configurações
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
