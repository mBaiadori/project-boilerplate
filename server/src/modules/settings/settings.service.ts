import { loadConfig, saveConfig } from '../../config/storage.js';

export class SettingsService {
  getSettings() {
    const cfg = loadConfig();
    return {
      settings: cfg.settings || {
        template_creator_prompt: '',
        global_system_prompt: '',
        auto_pr_on_save: false,
      },
      ai_settings: cfg.ai_settings || {},
    };
  }

  saveSettings(settingsData: any) {
    const cfg = loadConfig();
    cfg.settings = {
      ...cfg.settings,
      ...settingsData,
    };
    saveConfig(cfg);
    return {
      success: true,
      settings: cfg.settings,
    };
  }

  getAISettings() {
    const cfg = loadConfig();
    const ai = cfg.ai_settings || {
      provider: 'gemini',
      model: 'gemini-3.5-flash',
      api_key: process.env.GEMINI_API_KEY || '',
      custom_endpoint: 'http://localhost:11434/v1',
    };

    return {
      provider: ai.provider,
      model: ai.model,
      active_model: ai.model,
      has_key: Boolean(ai.api_key || process.env.GEMINI_API_KEY),
      custom_endpoint: ai.custom_endpoint,
    };
  }

  saveAISettings(aiData: any) {
    const cfg = loadConfig();
    cfg.ai_settings = {
      ...cfg.ai_settings,
      ...aiData,
    };
    saveConfig(cfg);
    return {
      success: true,
      ai_settings: this.getAISettings(),
    };
  }

  getAvailableModels() {
    return {
      providers: [
        {
          id: 'gemini',
          name: 'Google Gemini',
          models: [
            { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Ultra Rápido)' },
            { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Raciocínio Complexo)' },
            { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
          ],
        },
        {
          id: 'openai',
          name: 'OpenAI',
          models: [
            { id: 'gpt-4o', name: 'GPT-4o (Omni)' },
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
            { id: 'o3-mini', name: 'o3 Mini (Reasoning)' },
          ],
        },
        {
          id: 'anthropic',
          name: 'Anthropic Claude',
          models: [
            { id: 'claude-3-7-sonnet', name: 'Claude 3.7 Sonnet (Hybrid Reasoning)' },
            { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet' },
            { id: 'claude-3-5-haiku', name: 'Claude 3.5 Haiku' },
          ],
        },
        {
          id: 'ollama',
          name: 'Ollama (Local)',
          models: [
            { id: 'llama3.3', name: 'Llama 3.3 70B' },
            { id: 'deepseek-r1', name: 'DeepSeek R1 (Local)' },
            { id: 'qwen2.5-coder', name: 'Qwen 2.5 Coder' },
          ],
        },
      ],
    };
  }
}

export const settingsService = new SettingsService();
