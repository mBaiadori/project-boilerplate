import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';
import { getSessionToken } from '../../security/session.js';
import { eventsService } from '../events/events.service.js';

describe('Fase 7: Server Hardening & Security Gates', () => {
  let app: FastifyInstance;
  let token: string;

  before(async () => {
    app = await buildApp();
    await app.ready();
    token = getSessionToken();
  });

  after(async () => {
    await app.close();
  });

  describe('7.1 Chaves fora da query string', () => {
    it('GET /api/ai/models com api_key na query string deve retornar 410 Gone', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/ai/models?api_key=AIzaSySecretKey&provider=gemini',
        headers: {
          'x-contextos-token': token,
        },
      });

      assert.strictEqual(res.statusCode, 410);
      const body = JSON.parse(res.body);
      assert.ok(body.error.includes('POST'));
    });

    it('POST /api/ai/models com corpo JSON deve ser aceito', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/ai/models',
        headers: {
          'x-contextos-token': token,
          'content-type': 'application/json',
        },
        payload: {
          provider: 'gemini',
          api_key: 'AIzaSySecretKey',
        },
      });

      // Aceito (200) com lista de modelos (fallback ou dinâmico)
      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.provider, 'gemini');
      assert.ok(Array.isArray(body.models));
    });
  });

  describe('7.2 Validação de custom_endpoint contra SSRF', () => {
    it('deve rejeitar endpoints de metadata de nuvem (169.254.169.254)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/ai/models',
        headers: {
          'x-contextos-token': token,
          'content-type': 'application/json',
        },
        payload: {
          provider: 'ollama',
          custom_endpoint: 'http://169.254.169.254/latest/meta-data',
        },
      });

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.ok(body.error.toLowerCase().includes('restrito') || body.error.toLowerCase().includes('inválid'));
    });

    it('deve rejeitar endereços IP de redes privadas (10.0.0.1)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/ai/models',
        headers: {
          'x-contextos-token': token,
          'content-type': 'application/json',
        },
        payload: {
          provider: 'ollama',
          custom_endpoint: 'http://10.0.0.1:8080/v1',
        },
      });

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.ok(body.error.toLowerCase().includes('restrito') || body.error.toLowerCase().includes('inválid'));
    });

    it('deve rejeitar esquemas não HTTP (file://)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/ai/models',
        headers: {
          'x-contextos-token': token,
          'content-type': 'application/json',
        },
        payload: {
          provider: 'ollama',
          custom_endpoint: 'file:///etc/passwd',
        },
      });

      assert.strictEqual(res.statusCode, 400);
      const body = JSON.parse(res.body);
      assert.ok(body.error.toLowerCase().includes('protocolo'));
    });

    it('deve aceitar localhost para o provedor ollama', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/ai/models',
        headers: {
          'x-contextos-token': token,
          'content-type': 'application/json',
        },
        payload: {
          provider: 'ollama',
          custom_endpoint: 'http://localhost:11434/v1',
        },
      });

      assert.strictEqual(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.strictEqual(body.provider, 'ollama');
    });
  });

  describe('7.3 Erros sem vazamento de caminhos do sistema', () => {
    it('errorHandler global não deve expor /Users/ ou caminhos internos em erros 500', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/test-leak-error',
        headers: {
          'x-contextos-token': token,
        },
      });

      assert.strictEqual(res.statusCode, 500);
      const body = JSON.parse(res.body);
      assert.ok(!body.error.includes('/Users/MarcosBaiadori'));
      assert.ok(body.requestId);
    });
  });

  describe('7.5 Limite de clientes SSE', () => {
    it('deve impor limite defensivo no número máximo de conexões simultâneas', async () => {
      const maxClients = eventsService.getMaxClients();
      assert.ok(maxClients > 0 && maxClients <= 50);
      assert.strictEqual(eventsService.getClientCount() >= 0, true);
    });
  });
});
