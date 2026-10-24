import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_AI_SETTINGS, PROJECT_ROOT } from './constants.js';

describe('Config Coherence & Defaults (C2)', () => {
  it('DEFAULT_AI_SETTINGS must be standardized across the codebase', () => {
    assert.strictEqual(DEFAULT_AI_SETTINGS.provider, 'gemini');
    assert.strictEqual(DEFAULT_AI_SETTINGS.model, 'gemini-2.5-flash');
    assert.ok(Array.isArray(DEFAULT_AI_SETTINGS.allowed_tools));
  });

  it('config.example.json must strictly match DEFAULT_AI_SETTINGS', () => {
    const examplePath = path.join(PROJECT_ROOT, 'config.example.json');
    if (fs.existsSync(examplePath)) {
      const exampleJson = JSON.parse(fs.readFileSync(examplePath, 'utf-8'));
      assert.strictEqual(exampleJson.ai_settings.provider, DEFAULT_AI_SETTINGS.provider);
      assert.strictEqual(exampleJson.ai_settings.model, DEFAULT_AI_SETTINGS.model);
    }
  });
});
