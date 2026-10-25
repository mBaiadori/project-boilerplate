import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { recordAuditEvent, verifyAuditChain } from './audit-chain.service.js';
import { CONFIG_PATH } from '../../config/constants.js';

describe('Fase 4 (REL-01): Concorrência na Trilha de Auditoria Encadeada SHA-256', () => {
  let tmpRepo: string;

  beforeEach(() => {
    tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-concurrency-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpRepo, { recursive: true, force: true });
    } catch {}
  });

  it('4.1.1: 20 gravações concorrentes via Promise.all devem ser serializadas sem quebrar a cadeia', async () => {
    const promises = Array.from({ length: 20 }, (_, i) =>
      recordAuditEvent(tmpRepo, {
        eventType: 'CONCURRENT_TEST',
        user: `user_${i}`,
        payload: { item: i, rand: Math.random() },
      })
    );

    const records = await Promise.all(promises);
    assert.strictEqual(records.length, 20);

    const result = verifyAuditChain(tmpRepo);
    assert.strictEqual(result.valid, true, `Cadeia corrompida: ${result.error}`);
    assert.strictEqual(result.totalEntries, 20);
    assert.strictEqual(result.brokenIndex, undefined);
  });
});
