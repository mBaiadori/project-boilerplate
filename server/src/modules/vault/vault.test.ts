import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { vaultService, VAULT_KEYS } from './vault.service.js';

describe('VaultService - Armazenamento Nativo no Cofre do SO', () => {
  const TEST_KEY = 'test_unit_token_sample';
  const TEST_SECRET = 'ghp_testToken1234567890abcdefghijklmnopqrstuvwxyz';

  after(() => {
    vaultService.deleteSecret(TEST_KEY);
  });

  it('Deve salvar e recuperar um segredo com perfeição no cofre do SO', () => {
    const saved = vaultService.setSecret(TEST_KEY, TEST_SECRET);
    assert.strictEqual(saved, true);

    const retrieved = vaultService.getSecret(TEST_KEY);
    assert.strictEqual(retrieved, TEST_SECRET);

    const exists = vaultService.hasSecret(TEST_KEY);
    assert.strictEqual(exists, true);
  });

  it('Deve atualizar o valor de um segredo existente', () => {
    const UPDATED_SECRET = 'sk-proj-testUpdatedApiKey9876543210';
    vaultService.setSecret(TEST_KEY, UPDATED_SECRET);

    const retrieved = vaultService.getSecret(TEST_KEY);
    assert.strictEqual(retrieved, UPDATED_SECRET);
  });

  it('Deve deletar um segredo do cofre do SO', () => {
    vaultService.deleteSecret(TEST_KEY);

    const retrieved = vaultService.getSecret(TEST_KEY);
    assert.strictEqual(retrieved, null);

    const exists = vaultService.hasSecret(TEST_KEY);
    assert.strictEqual(exists, false);
  });

  it('Deve remover o segredo se for enviado valor vazio ou nulo no setSecret', () => {
    vaultService.setSecret(TEST_KEY, 'temp_val');
    assert.strictEqual(vaultService.hasSecret(TEST_KEY), true);

    vaultService.setSecret(TEST_KEY, '');
    assert.strictEqual(vaultService.getSecret(TEST_KEY), null);
  });
});
