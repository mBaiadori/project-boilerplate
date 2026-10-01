import { ITranslationProvider, TranslationEngineInfo } from '../translation.types.js';
import { LightweightLocalProvider } from './LightweightLocalProvider.js';
import { AiContextualProvider } from './AiContextualProvider.js';

export class TranslationProviderManager {
  private providers = new Map<string, ITranslationProvider>();

  constructor() {
    this.register(new LightweightLocalProvider());
    this.register(new AiContextualProvider());
  }

  register(provider: ITranslationProvider) {
    this.providers.set(provider.id, provider);
  }

  getProvider(providerId?: string): ITranslationProvider {
    const id = providerId || 'lightweight-local';
    const provider = this.providers.get(id);
    if (!provider) {
      // Fallback para o primeiro provedor registrado
      const defaultProvider = this.providers.get('lightweight-local') || Array.from(this.providers.values())[0];
      if (!defaultProvider) {
        throw new Error('Nenhum provedor de tradução disponível.');
      }
      return defaultProvider;
    }
    return provider;
  }

  listEngines(): TranslationEngineInfo[] {
    return Array.from(this.providers.values()).map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      isLocal: p.isLocal,
    }));
  }
}

export const translationProviderManager = new TranslationProviderManager();
