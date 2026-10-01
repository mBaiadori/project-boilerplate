import { Entry } from '@napi-rs/keyring';

export const VAULT_KEYS = {
  GITHUB_TOKEN: 'github_token',
  AI_API_KEY: 'ai_api_key',
} as const;

export type VaultKey = typeof VAULT_KEYS[keyof typeof VAULT_KEYS] | string;

export class VaultService {
  private readonly serviceName = 'ContextOS';

  /**
   * Obtém um segredo armazenado no cofre nativo do Sistema Operacional (Keychain/DPAPI/SecretService)
   */
  getSecret(key: VaultKey): string | null {
    try {
      const entry = new Entry(this.serviceName, key);
      const secret = entry.getPassword();
      return secret || null;
    } catch (err: any) {
      console.error(`[VaultService] Erro ao ler segredo '${key}' do cofre do SO:`, err?.message || err);
      return null;
    }
  }

  /**
   * Salva um segredo no cofre nativo do Sistema Operacional
   */
  setSecret(key: VaultKey, secret: string): boolean {
    try {
      const trimmed = secret?.trim() || '';
      if (!trimmed) {
        return this.deleteSecret(key);
      }
      const entry = new Entry(this.serviceName, key);
      entry.setPassword(trimmed);
      return true;
    } catch (err: any) {
      console.error(`[VaultService] Erro ao gravar segredo '${key}' no cofre do SO:`, err?.message || err);
      return false;
    }
  }

  /**
   * Remove um segredo do cofre nativo do Sistema Operacional
   */
  deleteSecret(key: VaultKey): boolean {
    try {
      const entry = new Entry(this.serviceName, key);
      entry.deletePassword();
      return true;
    } catch (err: any) {
      // Ignora erro se item não existir
      return false;
    }
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
