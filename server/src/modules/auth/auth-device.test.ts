import { describe, it } from 'node:test';
import assert from 'node:assert';
import { authService } from './auth.service.js';
import { getActiveBearerToken } from '../../utils/git.js';

describe('AuthService - Device Flow (RFC 8628)', () => {
  it('Deve lançar erro amigável se tentar polling sem device_code', async () => {
    await assert.rejects(
      async () => {
        await authService.pollDeviceToken('');
      },
      {
        message: /Código do dispositivo .* é obrigatório/i,
      }
    );
  });

  it('Deve obter o Bearer Token ativo via getActiveBearerToken quando explicitToken for fornecido', () => {
    const token = getActiveBearerToken('ghp_testExplicitToken123');
    assert.strictEqual(token, 'ghp_testExplicitToken123');
  });

  it('Deve ignorar local_mode no getActiveBearerToken para conexões remotas', () => {
    const token = getActiveBearerToken('local_mode');
    // Deve retornar null se só houver local_mode
    assert.strictEqual(token, null);
  });
});
