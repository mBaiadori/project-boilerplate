let KeyringEntry: any = null;
let keyringInitAttempted = false;

function getKeyringEntryClass() {
  if (keyringInitAttempted) return KeyringEntry;
  keyringInitAttempted = true;
  try {
    const req = typeof require !== 'undefined' ? require : null;
    if (req) {
      const mod = req('@napi-rs/keyring');
      KeyringEntry = mod?.Entry || mod?.default?.Entry || mod;
    }
  } catch (err: any) {
    console.warn('[VaultService] Módulo nativo @napi-rs/keyring não disponível:', err?.message || err);
  }
  return KeyringEntry;
}

export const VAULT_KEYS = {
  GITHUB_TOKEN: 'github_token',
  AI_API_KEY: 'ai_api_key',
} as const;

export type VaultKey = typeof VAULT_KEYS[keyof typeof VAULT_KEYS] | string;

export class VaultService {
  private readonly serviceName = 'ContextOS';
  private readonly fallbackStore = new Map<string, string>();

  /**
   * Obtém um segredo armazenado no cofre nativo do Sistema Operacional (Keychain/DPAPI/SecretService)
   */
  getSecret(key: VaultKey): string | null {
    const Entry = getKeyringEntryClass();
    if (Entry) {
      try {
        const entry = new Entry(this.serviceName, key);
        const secret = entry.getPassword();
        if (secret) return secret;
      } catch (err: any) {
        console.warn(`[VaultService] Aviso ao ler segredo '${key}' do cofre nativo:`, err?.message || err);
      }
    }
    return this.fallbackStore.get(key) || null;
  }

  /**
   * Salva um segredo no cofre nativo do Sistema Operacional
   */
  setSecret(key: VaultKey, secret: string): boolean {
    const trimmed = secret?.trim() || '';
    if (!trimmed) {
      return this.deleteSecret(key);
    }
    const Entry = getKeyringEntryClass();
    let savedInKeyring = false;
    if (Entry) {
      try {
        const entry = new Entry(this.serviceName, key);
        entry.setPassword(trimmed);
        savedInKeyring = true;
      } catch (err: any) {
        console.warn(`[VaultService] Aviso ao gravar segredo '${key}' no cofre nativo:`, err?.message || err);
      }
    }
    this.fallbackStore.set(key, trimmed);
    return true;
  }

  /**
   * Remove um segredo do cofre nativo do Sistema Operacional
   */
  deleteSecret(key: VaultKey): boolean {
    const Entry = getKeyringEntryClass();
    if (Entry) {
      try {
        const entry = new Entry(this.serviceName, key);
        entry.deletePassword();
      } catch {
        // Ignora erro se item não existir
      }
    }
    this.fallbackStore.delete(key);
    return true;
  }

  /**
   * Verifica se o segredo existe e possui valor não vazio no cofre do SO
   */
  hasSecret(key: VaultKey): boolean {
    const val = this.getSecret(key);
    return Boolean(val && val.length > 0);
  }
}

export const vaultService = new VaultService();

