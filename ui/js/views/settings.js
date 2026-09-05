// =============================================================================
// VIEW MODULE: CONFIGURAÇÕES SISTÊMICAS, MOTOR DE IA & SEÇÕES
// =============================================================================
import { API } from '../api.js';

export function initSettingsView({ onLogout } = {}) {
  // Section 1: AI Provider & Models
  const providerCards = document.querySelectorAll('#subview-settings .provider-card-option');
  const aiModelInput = document.getElementById('settings-ai-model-input');
  const aiModelHint = document.getElementById('settings-ai-model-hint');
  const aiKeyGroup = document.getElementById('settings-ai-key-group');
  const aiKeyInput = document.getElementById('settings-ai-key-input');
  const aiKeyHint = document.getElementById('settings-ai-key-hint');
  const aiEndpointGroup = document.getElementById('settings-ai-endpoint-group');
  const aiEndpointInput = document.getElementById('settings-ai-endpoint-input');
  const btnSaveAiDirect = document.getElementById('btn-save-ai-settings-direct');

  // Section 2: Prompts Mestre
  const sysTemplateCreatorPrompt = document.getElementById('sys-template-creator-prompt');
  const sysGlobalSystemPrompt = document.getElementById('sys-global-system-prompt');

  // Section 3: Governança
  const sysAutoPrCheck = document.getElementById('sys-auto-pr-check');
  const btnSaveSystemSettings = document.getElementById('btn-save-system-settings');

  // Section 4: Conta GitHub
  const settingsUserAvatar = document.getElementById('settings-user-avatar');
  const settingsUserName = document.getElementById('settings-user-name');
  const settingsUserLogin = document.getElementById('settings-user-login');
  const btnSettingsLogout = document.getElementById('btn-settings-logout');

  let selectedProvider = 'gemini';

  const PROVIDER_CONFIGS = {
    gemini: {
      defaultModel: 'gemini-3.5-flash',
      modelHint: 'Modelos recomendados: gemini-3.5-flash, gemini-3-flash-preview, gemini-1.5-pro',
      keyHint: '<a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:var(--accent);">Obter chave gratuita no Google AI Studio ↗</a>',
      needsKey: true,
      hasEndpoint: false
    },
    openai: {
      defaultModel: 'gpt-4o',
      modelHint: 'Modelos: gpt-4o, gpt-4o-mini, o3-mini',
      keyHint: '<a href="https://platform.openai.com/api-keys" target="_blank" style="color:var(--accent);">Obter chave na OpenAI ↗</a>',
      needsKey: true,
      hasEndpoint: false
    },
    anthropic: {
      defaultModel: 'claude-3-5-sonnet-20241022',
      modelHint: 'Modelos: claude-3-5-sonnet-20241022, claude-3-5-haiku-20241022',
      keyHint: '<a href="https://console.anthropic.com/settings/keys" target="_blank" style="color:var(--accent);">Obter chave na Anthropic ↗</a>',
      needsKey: true,
      hasEndpoint: false
    },
    deepseek: {
      defaultModel: 'deepseek-chat',
      modelHint: 'Modelos: deepseek-chat, deepseek-reasoner',
      keyHint: '<a href="https://platform.deepseek.com/api_keys" target="_blank" style="color:var(--accent);">Obter chave no DeepSeek ↗</a>',
      needsKey: true,
      hasEndpoint: false
    },
    local: {
      defaultModel: 'deepseek-r1:latest',
      modelHint: 'Modelos locais (Ollama): deepseek-r1:latest, llama3.3:latest, qwen2.5-coder:latest',
      keyHint: '<span class="material-symbols-outlined icon-xs">lightbulb</span> 100% Grátis & Offline (Nenhuma chave necessária)',
      needsKey: false,
      hasEndpoint: true
    }
  };

  // Provider Selection Event Handlers
  providerCards.forEach(card => {
    card.addEventListener('click', () => {
      const p = card.dataset.provider;
      selectProvider(p);
    });
  });

  function selectProvider(p) {
    selectedProvider = p;
    providerCards.forEach(card => {
      const isMatch = card.dataset.provider === p;
      card.classList.toggle('selected', isMatch);
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = isMatch;
    });

    const cfg = PROVIDER_CONFIGS[p] || PROVIDER_CONFIGS.gemini;
    if (aiModelInput && (!aiModelInput.value || !aiModelInput.value.includes(':'))) {
      aiModelInput.value = cfg.defaultModel;
    }
    if (aiModelHint) aiModelHint.textContent = cfg.modelHint;
    if (aiKeyHint) aiKeyHint.innerHTML = cfg.keyHint;
    if (aiKeyGroup) aiKeyGroup.style.display = cfg.needsKey ? 'flex' : 'none';
    if (aiEndpointGroup) aiEndpointGroup.style.display = cfg.hasEndpoint ? 'flex' : 'none';
  }

  async function loadSystemSettings() {
    try {
      const [statusData, settingsData] = await Promise.all([
        API.getStatus(),
        API.getSettings()
      ]);

      // 1. AI Settings
      const ai = statusData.ai_settings || {};
      if (ai.provider) {
        selectProvider(ai.provider);
      }
      if (aiModelInput && ai.model) {
        aiModelInput.value = ai.model;
      }
      if (aiKeyInput && ai.api_key) {
        aiKeyInput.value = ai.api_key;
      }
      if (aiEndpointInput && ai.custom_endpoint) {
        aiEndpointInput.value = ai.custom_endpoint;
      }

      // 2. System Prompts
      const s = settingsData.settings || {};
      if (sysTemplateCreatorPrompt) sysTemplateCreatorPrompt.value = s.template_creator_prompt || '';
      if (sysGlobalSystemPrompt) sysGlobalSystemPrompt.value = s.global_system_prompt || '';
      if (sysAutoPrCheck) sysAutoPrCheck.checked = s.auto_pr_on_save !== false;

      // 3. User GitHub Account
      const user = statusData.user;
      if (user) {
        if (settingsUserAvatar) {
          settingsUserAvatar.src = user.avatar_url;
          settingsUserAvatar.style.display = 'block';
        }
        if (settingsUserName) settingsUserName.textContent = user.name || user.login;
        if (settingsUserLogin) settingsUserLogin.textContent = `@${user.login}`;
      }
    } catch (e) {
      console.error('Erro ao carregar configurações:', e);
    }
  }

  // Save AI Settings Button
  if (btnSaveAiDirect) {
    btnSaveAiDirect.addEventListener('click', async () => {
      btnSaveAiDirect.disabled = true;
      btnSaveAiDirect.textContent = 'Salvando...';
      try {
        const { ok, data } = await API.saveAISettings({
          provider: selectedProvider,
          model: aiModelInput.value.trim(),
          api_key: aiKeyInput.value.trim(),
          custom_endpoint: aiEndpointInput.value.trim()
        });
        if (ok && data.success) {
          alert(`Motor de IA salvo com sucesso (${selectedProvider} - ${aiModelInput.value})!`);
        } else {
          alert('Erro ao salvar motor de IA.');
        }
      } catch (err) {
        alert('Erro ao conectar com o servidor.');
      } finally {
        btnSaveAiDirect.disabled = false;
        btnSaveAiDirect.innerHTML = '<span class="material-symbols-outlined icon-xs">bolt</span> Salvar Motor de IA';
      }
    });
  }

  // Save All Settings
  if (btnSaveSystemSettings) {
    btnSaveSystemSettings.addEventListener('click', async () => {
      btnSaveSystemSettings.disabled = true;
      btnSaveSystemSettings.textContent = 'Salvando...';

      try {
        const [aiRes, setRes] = await Promise.all([
          API.saveAISettings({
            provider: selectedProvider,
            model: aiModelInput.value.trim(),
            api_key: aiKeyInput.value.trim(),
            custom_endpoint: aiEndpointInput.value.trim()
          }),
          API.saveSettings({
            template_creator_prompt: sysTemplateCreatorPrompt.value,
            global_system_prompt: sysGlobalSystemPrompt.value,
            auto_pr_on_save: sysAutoPrCheck.checked
          })
        ]);

        if (aiRes.ok && setRes.ok) {
          alert('Todas as configurações, Motor de IA e Prompts Mestre foram salvos com sucesso!');
        } else {
          alert('Aviso: Alguma configuração não pôde ser salva.');
        }
      } catch (e) {
        alert('Erro ao salvar configurações.');
      } finally {
        btnSaveSystemSettings.disabled = false;
        btnSaveSystemSettings.innerHTML = '<span class="material-symbols-outlined icon-xs">save</span> Salvar Todas as Configurações';
      }
    });
  }

  // Logout from settings
  if (btnSettingsLogout) {
    btnSettingsLogout.addEventListener('click', async () => {
      if (confirm('Tem certeza que deseja desconectar a conta do GitHub?')) {
        await API.logout();
        if (onLogout) onLogout();
        else window.location.reload();
      }
    });
  }

  return {
    loadSystemSettings
  };
}
