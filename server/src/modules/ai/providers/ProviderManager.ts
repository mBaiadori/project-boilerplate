import { IAgentProvider, ProviderId, ProviderStatus } from './provider.types.js';
import { DirectApiProvider } from './DirectApiProvider.js';
import { AntigravityAdapter } from './AntigravityAdapter.js';
import { ClaudeCodeAdapter } from './ClaudeCodeAdapter.js';

export class ProviderManager {
  private providers = new Map<ProviderId, IAgentProvider>();
  private defaultProviderId: ProviderId = 'antigravity';

  constructor() {
    this.registerProvider(new DirectApiProvider());
    this.registerProvider(new AntigravityAdapter());
    this.registerProvider(new ClaudeCodeAdapter());
  }

  registerProvider(provider: IAgentProvider): void {
    this.providers.set(provider.id, provider);
  }

  getProvider(id?: ProviderId): IAgentProvider {
    const targetId = id || this.defaultProviderId;
    const provider = this.providers.get(targetId);
    if (!provider) {
      // Fallback para o primeiro disponível ou direct-api
      return this.providers.get('antigravity') || this.providers.get('direct-api') || this.providers.values().next().value!;
    }
    return provider;
  }

  async listProviders(): Promise<ProviderStatus[]> {
    const statuses: ProviderStatus[] = [];
    for (const provider of this.providers.values()) {
      try {
        const st = await provider.getStatus();
        statuses.push(st);
      } catch {
        statuses.push({
          id: provider.id,
          name: provider.name,
          description: provider.description,
          mode: provider.mode,
          isAvailable: false,
          isAuthenticated: false,
          statusMessage: 'Erro ao verificar disponibilidade',
          capabilities: provider.capabilities,
        });
      }
    }
    return statuses;
  }
}

export const providerManager = new ProviderManager();
