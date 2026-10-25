import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { buildApp } from '../app.js';
import { FastifyInstance } from 'fastify';

describe('Fase 1 (SEC-02, SEC-03): Desktop Boot, Health Check e Handshake de Sessão', () => {
  let app: FastifyInstance;

  before(async () => {
    app = await buildApp();
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  it('1.1.1: GET /api/health deve responder 200 OK sem necessidade de autenticação', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.status, 'ok');
  });

  it('1.1.2: GET /api/status deve retornar 401 Unauthorized na ausência de token de sessão', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/status',
    });

    assert.strictEqual(res.statusCode, 401);
  });
});
