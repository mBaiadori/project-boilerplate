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

  describe('3.3 Hardening do Bootstrap e Proteção de Sessão (Fase 1 - S1, S5)', () => {
    it('deve rejeitar Host header ausente na função isValidHostHeader', () => {
      assert.strictEqual(isValidHostHeader(undefined), false);
      assert.strictEqual(isValidHostHeader(''), false);
    });

    it('deve recusar bootstrap com 403 se Origin for de porta local diferente não autorizada (ex: 3000 ou 9999)', async () => {
      const res3000 = await app.inject({
        method: 'GET',
        url: '/api/session/bootstrap',
        headers: {
          host: '127.0.0.1:4100',
          origin: 'http://localhost:3000',
        },
      });
      assert.strictEqual(res3000.statusCode, 403);

      const res9999 = await app.inject({
        method: 'GET',
        url: '/api/session/bootstrap',
        headers: {
          host: '127.0.0.1:4100',
          origin: 'http://127.0.0.1:9999',
        },
      });
      assert.strictEqual(res9999.statusCode, 403);
    });

    it('deve permitir bootstrap com 200 se Origin for da mesma origem ou Vite dev (5173)', async () => {
      const resSameOrigin = await app.inject({
        method: 'GET',
        url: '/api/session/bootstrap',
        headers: {
          host: '127.0.0.1:4100',
          origin: 'http://127.0.0.1:4100',
        },
      });
      assert.strictEqual(resSameOrigin.statusCode, 200);

      const resVite = await app.inject({
        method: 'GET',
        url: '/api/session/bootstrap',
        headers: {
          host: '127.0.0.1:4100',
          origin: 'http://localhost:5173',
        },
      });
      assert.strictEqual(resVite.statusCode, 200);
    });

    it('não deve registrar ou expor /api/test-leak-error quando em produção (S5)', async () => {
      const prevEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        const prodApp = await buildApp();
        await prodApp.ready();
        const res = await prodApp.inject({
          method: 'GET',
          url: '/api/test-leak-error',
          headers: {
            host: '127.0.0.1:4100',
            'x-contextos-token': getSessionToken(),
          },
        });
        assert.strictEqual(res.statusCode, 404);
        await prodApp.close();
      } finally {
        process.env.NODE_ENV = prevEnv;
      }
    });
  });
});

