import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { buildApp } from '../app.js';
import { getSessionToken, isValidHostHeader, isValidSessionToken } from './session.js';
import { FastifyInstance } from 'fastify';

describe('Segurança de API e Autenticação de Sessão (Fase 3 - N3)', () => {
  let app: FastifyInstance;

  before(async () => {
    app = await buildApp();
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  describe('3.1 Proteção de Host Header (Anti-DNS Rebinding)', () => {
    it('deve validar hosts locais legítimos', () => {
      assert.strictEqual(isValidHostHeader('localhost'), true);
      assert.strictEqual(isValidHostHeader('localhost:4100'), true);
      assert.strictEqual(isValidHostHeader('127.0.0.1:4100'), true);
      assert.strictEqual(isValidHostHeader('[::1]:4100'), true);
    });

    it('deve rejeitar hosts externos ou de rebinding', () => {
      assert.strictEqual(isValidHostHeader('evil.example.com'), false);
      assert.strictEqual(isValidHostHeader('attacker.local'), false);
      assert.strictEqual(isValidHostHeader('192.168.1.100:4100'), false);
    });

    it('deve retornar 403 se Host header for hostil (DNS rebinding)', async () => {
      const token = getSessionToken();
      const res = await app.inject({
        method: 'GET',
        url: '/api/repos',
        headers: {
          host: 'evil.example.com',
          'x-contextos-token': token,
        },
      });

      assert.strictEqual(res.statusCode, 403);
      assert.match(res.body, /Host não autorizado/i);
    });
  });

  describe('3.2 Autenticação Obrigatória para Rotas /api/*', () => {
    it('deve permitir acesso sem token apenas na rota de bootstrap', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/session/bootstrap',
        headers: {
          host: '127.0.0.1:4100',
        },
      });

      assert.strictEqual(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.ok(json.token, 'Deve retornar o token de sessão');
      const setCookie = res.headers['set-cookie'];
      assert.ok(setCookie, 'Deve emitir Set-Cookie com ctxos_session');
    });

    it('deve recusar com 401 chamadas a /api/* sem token de sessão', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/repos',
        headers: {
          host: '127.0.0.1:4100',
        },
      });

      assert.strictEqual(res.statusCode, 401);
      assert.match(res.body, /Não autorizado|Sessão inválida/i);
    });

    it('deve recusar com 401 chamadas com token de sessão falso', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/repos',
        headers: {
          host: '127.0.0.1:4100',
          'x-contextos-token': 'token-falso-invalido-1234567890',
        },
      });

      assert.strictEqual(res.statusCode, 401);
      assert.match(res.body, /Não autorizado|Sessão inválida/i);
    });

    it('deve autorizar acesso via header X-ContextOS-Token válido', async () => {
      const token = getSessionToken();
      const res = await app.inject({
        method: 'GET',
        url: '/api/repos',
        headers: {
          host: '127.0.0.1:4100',
          'x-contextos-token': token,
        },
      });

      assert.strictEqual(res.statusCode, 200);
    });

    it('deve autorizar acesso via cookie ctxos_session válido (usado por EventSource/SSE)', async () => {
      const token = getSessionToken();
      const res = await app.inject({
        method: 'GET',
        url: '/api/repos',
        headers: {
          host: '127.0.0.1:4100',
          cookie: `ctxos_session=${token}; other_cookie=123`,
        },
      });

      assert.strictEqual(res.statusCode, 200);
    });
  });
});
