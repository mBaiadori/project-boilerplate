import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { getSessionToken } from '../security/session.js';
import { validateRepoName } from './repo-ref.js';

describe('Fase 05: Repo Guard e Validação Centralizada de Repositório (M9, B6)', () => {
  describe('5.1 Validação de Unidade: validateRepoName', () => {
    it('deve aceitar nomes de repositório legítimos', () => {
      assert.strictEqual(validateRepoName('meu-repo'), 'meu-repo');
      assert.strictEqual(validateRepoName('enursy-gov'), 'enursy-gov');
      assert.strictEqual(validateRepoName('org_projeto-1'), 'org_projeto-1');
      assert.strictEqual(validateRepoName('owner/meu-repo'), 'owner/meu-repo');
    });

    it('deve rejeitar path traversal com .. ou .', () => {
      assert.throws(() => validateRepoName('../../etc'), /inválido|path traversal/i);
      assert.throws(() => validateRepoName('../malicious'), /inválido|path traversal/i);
      assert.throws(() => validateRepoName('..'), /inválido/i);
      assert.throws(() => validateRepoName('.'), /inválido/i);
      assert.throws(() => validateRepoName('owner/../malicious'), /inválido|path traversal/i);
    });

    it('deve rejeitar caracteres nulos ou de controle', () => {
      assert.throws(() => validateRepoName('repo\0evil'), /nulo|null byte|inválido/i);
      assert.throws(() => validateRepoName('repo;rm -rf'), /inválidos/i);
      assert.throws(() => validateRepoName('repo$bad'), /inválidos/i);
    });

    it('deve rejeitar entradas vazias ou não-strings', () => {
      assert.throws(() => validateRepoName(''), /não informado|vazio/i);
      assert.throws(() => validateRepoName('   '), /não informado|vazio/i);
      assert.throws(() => validateRepoName(null as unknown as string), /não informado/i);
    });
  });

  describe('5.2 Hook Global Fastify preValidation para Parâmetro repo', () => {
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

    it('deve rejeitar requisição com ?repo=../../etc com HTTP 400', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/git/status?repo=../../etc',
        headers: {
          host: '127.0.0.1:4100',
          'x-contextos-token': token,
        },
      });

      assert.strictEqual(res.statusCode, 400);
      const json = JSON.parse(res.body);
      assert.strictEqual(json.code, 'INVALID_REPO_NAME');
      assert.match(json.error, /Parâmetro de repositório inválido/i);
    });

    it('deve rejeitar requisição com body { "repo": "../malicious" } com HTTP 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/git/stage',
        headers: {
          host: '127.0.0.1:4100',
          'x-contextos-token': token,
          'content-type': 'application/json',
        },
        payload: {
          repo: '../malicious',
          files: ['file.txt'],
        },
      });

      assert.strictEqual(res.statusCode, 400);
      const json = JSON.parse(res.body);
      assert.strictEqual(json.code, 'INVALID_REPO_NAME');
      assert.match(json.error, /Parâmetro de repositório inválido/i);
    });

    it('deve permitir requisições com nome de repositório válido na query string', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/git/status?repo=projeto-legitimo',
        headers: {
          host: '127.0.0.1:4100',
          'x-contextos-token': token,
        },
      });

      // Não deve ser 400 INVALID_REPO_NAME (pode ser 200, ou 404/500 se o repo não existir no disco de teste, mas passou pelo hook)
      assert.notStrictEqual(res.statusCode, 400);
      if (res.statusCode !== 200) {
        const json = JSON.parse(res.body);
        assert.notStrictEqual(json.code, 'INVALID_REPO_NAME');
      }
    });
  });
});
