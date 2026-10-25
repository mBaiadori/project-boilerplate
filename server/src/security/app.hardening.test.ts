import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { getSessionToken } from './session.js';
import { writeJsonAtomic } from '../utils/atomic-write.js';
import { mergePlaintext3Way } from '../utils/crypto.js';

describe('Fase 4 (S6, C13): Endurecimento do Servidor e Persistência Segura', () => {
  let app: FastifyInstance;

  before(async () => {
    app = await buildApp();
    // Injetar rota deliberada para teste de mascaramento de erro 500 sem expor no app de produção
    app.get('/api/test-leak-error', async () => {
      throw new Error('Erro ao ler /Users/marcos/secret.txt');
    });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  it('4.1.1: Respostas devem incluir headers do Helmet (CSP, nosniff, no-referrer, X-Frame-Options: DENY)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { host: '127.0.0.1:4100' },
    });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['x-content-type-options'], 'nosniff');
    assert.strictEqual(res.headers['referrer-policy'], 'no-referrer');
    assert.strictEqual(res.headers['x-frame-options'], 'DENY');
    assert.ok(res.headers['content-security-policy'], 'Content-Security-Policy deve estar configurado');
    assert.match(res.headers['content-security-policy'] as string, /default-src 'self'/);
  });

  it('4.1.2: Erros 500 com paths de sistema devem mascarar caminhos absolutos e incluir requestId', async () => {
    const token = getSessionToken();
    const res = await app.inject({
      method: 'GET',
      url: '/api/test-leak-error',
      headers: {
        host: '127.0.0.1:4100',
        'x-contextos-token': token,
      },
    });

    assert.strictEqual(res.statusCode, 500);
    const json = JSON.parse(res.body);
    assert.ok(json.requestId, 'Deve retornar requestId');
    assert.ok(!json.error.includes('/Users/'), 'Não deve vazar /Users/ na mensagem de erro');
    assert.ok(!json.error.includes('/home/'), 'Não deve vazar /home/ na mensagem de erro');
  });

  it('4.1.3: mergePlaintext3Way deve ser assíncrono e executar sem execFileSync', async () => {
    const base = 'Linha 1\nLinha Meio\nLinha 3\n';
    const ours = 'Linha 1 alterada\nLinha Meio\nLinha 3\n';
    const theirs = 'Linha 1\nLinha Meio\nLinha 3 alterada\n';

    // Testa se o retorno é uma Promise (função assíncrona)
    const mergePromise = mergePlaintext3Way(base, ours, theirs);
    assert.ok(mergePromise instanceof Promise, 'mergePlaintext3Way deve retornar uma Promise');

    const result = await mergePromise;
    assert.strictEqual(result.hasConflicts, false);
    assert.strictEqual(result.conflictCount, 0);
    assert.ok(result.mergedContent.includes('Linha 1 alterada'));
    assert.ok(result.mergedContent.includes('Linha 3 alterada'));
  });

  it('4.1.4: 20 escritas atômicas paralelas devem deixar arquivo JSON íntegro e legível', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atomic-concurrent-'));
    const targetFile = path.join(tmpDir, 'state.json');

    try {
      const writes = Array.from({ length: 20 }, (_, i) =>
        writeJsonAtomic(targetFile, { iteration: i, timestamp: Date.now(), items: [1, 2, 3] })
      );

      await Promise.all(writes);

      assert.ok(fs.existsSync(targetFile), 'Arquivo deve existir');
      const raw = fs.readFileSync(targetFile, 'utf-8');
      const parsed = JSON.parse(raw);
      assert.ok(typeof parsed.iteration === 'number', 'JSON final deve ser válido e parseável');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
