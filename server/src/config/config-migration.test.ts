import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadConfig, saveConfig } from './storage.js';
import { CONFIG_PATH } from './constants.js';

describe('C8: local_mode sentinel migration to explicit mode field', () => {
  let backupConfig: string | null = null;

  beforeEach(() => {
    if (!CONFIG_PATH.startsWith(os.tmpdir())) {
      throw new Error(`ABORT: CONFIG_PATH ("${CONFIG_PATH}") está fora de os.tmpdir(). Os testes devem rodar em ambiente isolado via scripts/run-tests.mjs.`);
    }
    if (fs.existsSync(CONFIG_PATH)) {
      backupConfig = fs.readFileSync(CONFIG_PATH, 'utf-8');
    }
  });

  afterEach(() => {
    if (backupConfig !== null) {
      fs.writeFileSync(CONFIG_PATH, backupConfig, 'utf-8');
    }
  });

  test('loadConfig deve migrar token="local_mode" para mode="local" e limpar token sentinela', () => {
    // Escreve config legada contendo token: "local_mode"
    const legacy = {
      authenticated: false,
      token: 'local_mode',
      user: { login: 'local_dev' }
    };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(legacy, null, 2), 'utf-8');

    const cfg = loadConfig();
    assert.strictEqual(cfg.mode, 'local', 'mode deve ser explicitamente "local"');
    assert.strictEqual(cfg.token, '', 'token sentinela "local_mode" deve ser esvaziado');
  });

  test('loadConfig deve inferir mode="remote" quando há token válido', () => {
    const remoteCfg = {
      authenticated: true,
      token: 'ghp_secretValidToken12345',
      user: { login: 'github_user' }
    };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(remoteCfg, null, 2), 'utf-8');

    const cfg = loadConfig();
    assert.strictEqual(cfg.mode, 'remote', 'mode deve ser "remote" quando há token');
  });
});
