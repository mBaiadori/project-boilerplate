import { describe, it, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { loadConfig, saveConfig } from '../../config/storage.js';
import { vaultService, VAULT_KEYS } from './vault.service.js';
import { CONFIG_PATH } from '../../config/constants.js';

describe('Storage <-> VaultService Integração', () => {
  const TEST_GH_TOKEN = 'ghp_IntegrationTestToken1234567890abcdefgh';
  const TEST_AI_KEY = 'ai_IntegrationTestKey9876543210zyxwvutsrq';

  // Guarda o estado real do usuário para restaurar depois (o teste usa o cofre/config reais)
  const originalGhToken = vaultService.getSecret(VAULT_KEYS.GITHUB_TOKEN);
  const originalAiKey = vaultService.getSecret(VAULT_KEYS.AI_API_KEY);
  const originalConfigRaw = fs.existsSync(CONFIG_PATH) ? fs.readFileSync(CONFIG_PATH, 'utf-8') : null;

  after(() => {
    if (originalGhToken) vaultService.setSecret(VAULT_KEYS.GITHUB_TOKEN, originalGhToken);
    else vaultService.deleteSecret(VAULT_KEYS.GITHUB_TOKEN);
    if (originalAiKey) vaultService.setSecret(VAULT_KEYS.AI_API_KEY, originalAiKey);
    else vaultService.deleteSecret(VAULT_KEYS.AI_API_KEY);
    if (originalConfigRaw !== null) fs.writeFileSync(CONFIG_PATH, originalConfigRaw, 'utf-8');
  });

  it('saveConfig deve persistir segredos no cofre e NÃO gravar em texto puro no config.json em disco', () => {
    const cfg = loadConfig();
    cfg.token = TEST_GH_TOKEN;
    if (!cfg.ai_settings) cfg.ai_settings = {} as any;
    cfg.ai_settings.api_key = TEST_AI_KEY;

    // Salva a configuração
    saveConfig(cfg);

    // 1. Verifica se os segredos estão gravados no cofre nativo do SO
    assert.strictEqual(vaultService.getSecret(VAULT_KEYS.GITHUB_TOKEN), TEST_GH_TOKEN);
    assert.strictEqual(vaultService.getSecret(VAULT_KEYS.AI_API_KEY), TEST_AI_KEY);

    // 2. Lê o arquivo físico de disco diretamente
    assert.strictEqual(fs.existsSync(CONFIG_PATH), true);
    const rawDiskContent = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const diskJson = JSON.parse(rawDiskContent);

    // 3. Garante que o arquivo em disco NÃO contém o token nem a chave de API em texto puro
    assert.strictEqual(diskJson.token, '');
    assert.strictEqual(diskJson.ai_settings.api_key, '');
    assert.strictEqual(rawDiskContent.includes(TEST_GH_TOKEN), false);
    assert.strictEqual(rawDiskContent.includes(TEST_AI_KEY), false);

    // 4. loadConfig deve conseguir ler os segredos diretamente do cofre para a memória
    const reloaded = loadConfig();
    assert.strictEqual(reloaded.token, TEST_GH_TOKEN);
    assert.strictEqual(reloaded.ai_settings.api_key, TEST_AI_KEY);
    assert.strictEqual(reloaded.authenticated, true);
  });
});
