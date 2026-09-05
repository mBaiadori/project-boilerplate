// =============================================================================
// COMPONENT: MULTI-MODEL AI CONFIGURATION MODAL (PERSISTENT MULTI-PROVIDER)
// =============================================================================
import { API } from '../api.js';

export function initAIModal() {
  const modal = document.getElementById('ai-settings-modal');
  const btnOpen = document.getElementById('btn-open-ai-modal');
  const btnClose = document.getElementById('btn-close-ai-modal');
  const btnCancel = document.getElementById('btn-cancel-ai-modal');
  const btnSave = document.getElementById('btn-save-ai-modal');
  const providerCards = document.querySelectorAll('.provider-card-option');
  
  const aiModelSelect = document.getElementById('ai-model-select');
  const aiModelInput = document.getElementById('ai-model-input');
  const btnRefreshModels = document.getElementById('btn-refresh-ai-models');
  const btnToggleCustomModel = document.getElementById('btn-toggle-custom-model');
  const aiModelHint = document.getElementById('ai-model-hint');
  
  const aiApiKeyGroup = document.getElementById('ai-api-key-group');
  const aiApiKeyInput = document.getElementById('ai-api-key-input');
  const aiKeyHint = document.getElementById('ai-key-hint');
  
  const aiCustomEndpointGroup = document.getElementById('ai-custom-endpoint-group');
  const aiCustomEndpointInput = document.getElementById('ai-custom-endpoint-input');
  const chatStatusBadge = document.getElementById('chat-status-badge');

  let selectedProvider = 'gemini';
  let providersData = {};
  let isCustomModelMode = false;

  const PROVIDER_METADATA = {
    gemini: {
      name: 'Google Gemini',
      defaultModel: 'gemini-3.5-flash',
      modelHint: 'Modelos de alto raciocínio e latência ultrabaixa pelo Google AI Studio.',
      keyHint: '<a href="https://aistudio.google.com/app/apikey" target="_blank" style="color: var(--primary); text-decoration: none;">Obter chave gratuita no Google AI Studio ↗</a>',
      needsKey: true,
      hasEndpoint: false
    },
    openai: {
      name: 'OpenAI',
      defaultModel: 'gpt-4o',
      modelHint: 'Modelos GPT-4o, GPT-4o-mini e reasoning models (o1, o3-mini).',
      keyHint: '<a href="https://platform.openai.com/api-keys" target="_blank" style="color: var(--primary); text-decoration: none;">Obter chave na OpenAI ↗</a>',
      needsKey: true,
      hasEndpoint: false
    },
    anthropic: {
      name: 'Anthropic Claude',
      defaultModel: 'claude-3-5-sonnet-20241022',
      modelHint: 'Modelos de referência para escrita de especificações e código (Claude 3.5 / 3.7).',
      keyHint: '<a href="https://console.anthropic.com/settings/keys" target="_blank" style="color: var(--primary); text-decoration: none;">Obter chave na Anthropic ↗</a>',
      needsKey: true,
      hasEndpoint: false
    },
    deepseek: {
      name: 'DeepSeek API',
      defaultModel: 'deepseek-chat',
      modelHint: 'Modelos DeepSeek-V3 e DeepSeek-R1 via nuvem oficial.',
      keyHint: '<a href="https://platform.deepseek.com/api_keys" target="_blank" style="color: var(--primary); text-decoration: none;">Obter chave no DeepSeek ↗</a>',
      needsKey: true,
      hasEndpoint: false
    },
    local: {
      name: 'Ollama Local',
      defaultModel: 'deepseek-r1:latest',
      modelHint: 'Execução 100% local, privada e offline através do seu servidor Ollama.',
      keyHint: '<span class="material-symbols-outlined icon-xs" style="vertical-align: middle; color: #10b981;">check_circle</span> 100% Grátis & Offline (Nenhuma chave necessária)',
      needsKey: false,
      hasEndpoint: true
    }
  };

  /**
   * Refreshes provider status badges across cards
   */
  function updateProviderBadges(providersMap, activeProviderId) {
    providerCards.forEach(card => {
      const pId = card.dataset.provider;
      const pData = providersMap ? providersMap[pId] : null;
      const badgeEl = card.querySelector('.provider-status-badge');
      if (!badgeEl) return;

      const isConfigured = pData ? pData.configured : false;
      const isActive = pId === activeProviderId;

      badgeEl.className = 'provider-status-badge';

      if (isActive) {
        badgeEl.classList.add('active-chat');
        badgeEl.innerHTML = '<span class="status-dot"></span><span class="status-text">Ativo</span>';
      } else if (isConfigured) {
        badgeEl.classList.add('configured');
        badgeEl.innerHTML = '<span class="status-dot"></span><span class="status-text">Pronto</span>';
      } else {
        badgeEl.classList.add('unconfigured');
        badgeEl.innerHTML = '<span class="status-dot"></span><span class="status-text">Não Configurado</span>';
      }
    });
  }

  /**
   * Fetches models list from backend for the selected provider
   */
  async function loadModelsForProvider(provider, preselectModel = null) {
    if (!aiModelSelect) return;

    const meta = PROVIDER_METADATA[provider] || PROVIDER_METADATA.gemini;
    const currentVal = preselectModel || aiModelSelect.value || meta.defaultModel;

    aiModelSelect.innerHTML = '<option value="">Buscando modelos no servidor...</option>';
    aiModelSelect.disabled = true;
    if (btnRefreshModels) btnRefreshModels.disabled = true;

    try {
      const pData = providersData[provider] || {};
      const { ok, data } = await API.getAIModels({
        provider,
        api_key: aiApiKeyInput ? aiApiKeyInput.value.trim() : (pData.api_key || ''),
        custom_endpoint: aiCustomEndpointInput ? aiCustomEndpointInput.value.trim() : (pData.custom_endpoint || '')
      });

      aiModelSelect.innerHTML = '';

      if (ok && data && Array.isArray(data.models) && data.models.length > 0) {
        data.models.forEach(m => {
          const opt = document.createElement('option');
          opt.value = m;
          opt.textContent = m;
          if (m === currentVal) opt.selected = true;
          aiModelSelect.appendChild(opt);
        });

        // If currentVal was not in list, add it
        if (!data.models.includes(currentVal) && currentVal) {
          const customOpt = document.createElement('option');
          customOpt.value = currentVal;
          customOpt.textContent = `${currentVal} (Salvo)`;
          customOpt.selected = true;
          aiModelSelect.prepend(customOpt);
        }

        if (aiModelHint) {
          if (data.source === 'live') {
            aiModelHint.innerHTML = `<span style="color: #10b981;">● Conectado:</span> ${data.models.length} modelos disponíveis em tempo real.`;
          } else {
            aiModelHint.textContent = meta.modelHint;
          }
        }
      } else {
        // Fallback default
        const opt = document.createElement('option');
        opt.value = meta.defaultModel;
        opt.textContent = meta.defaultModel;
        opt.selected = true;
        aiModelSelect.appendChild(opt);
        if (aiModelHint) aiModelHint.textContent = meta.modelHint;
      }
    } catch (err) {
      console.warn('Erro ao carregar lista de modelos:', err);
      aiModelSelect.innerHTML = `<option value="${meta.defaultModel}">${meta.defaultModel}</option>`;
      if (aiModelHint) aiModelHint.textContent = meta.modelHint;
    } finally {
      aiModelSelect.disabled = false;
      if (btnRefreshModels) btnRefreshModels.disabled = false;
      if (aiModelInput) aiModelInput.value = aiModelSelect.value;
    }
  }

  /**
   * Selects a provider card and loads its specific saved configurations
   */
  function selectProvider(p, triggerModelFetch = true) {
    selectedProvider = p;
    providerCards.forEach(card => {
      const isMatch = card.dataset.provider === p;
      card.classList.toggle('selected', isMatch);
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = isMatch;
    });

    const meta = PROVIDER_METADATA[p] || PROVIDER_METADATA.gemini;
    const pData = providersData[p] || {};

    if (aiKeyHint) aiKeyHint.innerHTML = meta.keyHint;
    if (aiApiKeyGroup) aiApiKeyGroup.style.display = meta.needsKey ? 'flex' : 'none';
    if (aiApiKeyInput) aiApiKeyInput.value = pData.has_key ? '••••••••••••••••' : '';
    
    if (aiCustomEndpointGroup) aiCustomEndpointGroup.style.display = meta.hasEndpoint ? 'flex' : 'none';
    if (aiCustomEndpointInput) {
      aiCustomEndpointInput.value = pData.custom_endpoint || meta.custom_endpoint || 'http://localhost:11434/v1';
    }

    const savedModel = pData.model || meta.defaultModel;
    if (aiModelInput) aiModelInput.value = savedModel;

    if (triggerModelFetch) {
      loadModelsForProvider(p, savedModel);
    }
  }

  /**
   * Initializes modal data from server
   */
  async function loadSettings() {
    try {
      const { ok, data } = await API.getAISettings();
      if (ok && data) {
        providersData = data.providers || {};
        const activeProvider = data.active_provider || 'gemini';
        updateProviderBadges(providersData, activeProvider);
        selectProvider(activeProvider, true);
      }
    } catch (err) {
      console.warn('Não foi possível carregar configurações de IA:', err);
    }
  }

  function open() {
    modal.style.display = 'flex';
    loadSettings();
  }

  function close() {
    modal.style.display = 'none';
  }

  if (btnOpen) btnOpen.addEventListener('click', open);
  if (btnClose) btnClose.addEventListener('click', close);
  if (btnCancel) btnCancel.addEventListener('click', close);
  if (chatStatusBadge) chatStatusBadge.addEventListener('click', open);

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display === 'flex') close();
  });

  providerCards.forEach(card => {
    card.addEventListener('click', () => {
      const p = card.dataset.provider;
      selectProvider(p, true);
    });
  });

  if (aiModelSelect) {
    aiModelSelect.addEventListener('change', () => {
      if (aiModelInput) aiModelInput.value = aiModelSelect.value;
    });
  }

  if (btnRefreshModels) {
    btnRefreshModels.addEventListener('click', () => {
      loadModelsForProvider(selectedProvider, aiModelSelect.value);
    });
  }

  if (btnToggleCustomModel) {
    btnToggleCustomModel.addEventListener('click', () => {
      isCustomModelMode = !isCustomModelMode;
      if (isCustomModelMode) {
        aiModelSelect.style.display = 'none';
        aiModelInput.style.display = 'block';
        aiModelInput.focus();
        btnToggleCustomModel.innerHTML = '<span class="material-symbols-outlined icon-xs">list</span> Lista';
      } else {
        aiModelInput.style.display = 'none';
        aiModelSelect.style.display = 'block';
        btnToggleCustomModel.innerHTML = '<span class="material-symbols-outlined icon-xs">edit</span> Digitar';
        if (aiModelInput.value.trim()) {
          loadModelsForProvider(selectedProvider, aiModelInput.value.trim());
        }
      }
    });
  }

  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      const provider = selectedProvider;
      const model = (isCustomModelMode ? aiModelInput.value : (aiModelSelect.value || aiModelInput.value)).trim();
      const raw_key = aiApiKeyInput ? aiApiKeyInput.value.trim() : '';
      const api_key = raw_key.includes('••••') ? '' : raw_key;
      const custom_endpoint = aiCustomEndpointInput ? aiCustomEndpointInput.value.trim() : '';

      btnSave.disabled = true;
      btnSave.textContent = 'Salvando...';

      try {
        const { ok, data } = await API.saveAISettings({ provider, model, api_key, custom_endpoint });
        if (ok && data.success) {
          providersData = (data.all_providers && data.all_providers.providers) ? data.all_providers.providers : providersData;
          updateProviderBadges(providersData, provider);

          close();
          if (chatStatusBadge) {
            chatStatusBadge.innerHTML = `<span class="material-symbols-outlined icon-xs">bolt</span> ${model}`;
          }
          document.querySelectorAll('.ai-copilot-model-name-label').forEach(el => {
            el.textContent = model;
          });
        } else {
          alert('Erro ao salvar provedor de IA.');
        }
      } catch (err) {
        alert('Erro de conexão ao salvar configurações de IA.');
      } finally {
        btnSave.disabled = false;
        btnSave.innerHTML = '<span class="material-symbols-outlined icon-xs">save</span> Salvar Provedor';
      }
    });
  }

  // Pre-fetch settings on startup
  loadSettings();

  return {
    open,
    close,
    selectProvider,
    loadSettings,
    setModel(m) {
      if (aiModelInput) aiModelInput.value = m;
      if (aiModelSelect) {
        aiModelSelect.value = m;
      }
    }
  };
}
