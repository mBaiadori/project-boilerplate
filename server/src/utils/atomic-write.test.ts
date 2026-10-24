import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { writeJsonAtomic, writeTextAtomic } from './atomic-write.js';

describe('Atomic File Writing (utils/atomic-write.ts)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atomic-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  it('writeJsonAtomic should write valid formatted JSON file atomically', () => {
    const target = path.join(tmpDir, 'data.json');
    const payload = { test: true, count: 42, name: 'ContextOS' };

    writeJsonAtomic(target, payload);

    assert.ok(fs.existsSync(target));
    const content = JSON.parse(fs.readFileSync(target, 'utf-8'));
    assert.deepStrictEqual(content, payload);
  });

  it('writeTextAtomic should write text content without leaving temporary files', () => {
    const target = path.join(tmpDir, 'test.txt');
    const content = 'Hello atomic world!';

    writeTextAtomic(target, content);

    assert.strictEqual(fs.readFileSync(target, 'utf-8'), content);
    const files = fs.readdirSync(tmpDir);
    assert.deepStrictEqual(files, ['test.txt']);
  });

  it('writeJsonAtomic should keep original file intact if serialization fails', () => {
    const target = path.join(tmpDir, 'intact.json');
    writeJsonAtomic(target, { original: true });

    // Circular object that causes JSON.stringify to throw
    const circular: any = {};
    circular.self = circular;

    assert.throws(() => {
      writeJsonAtomic(target, circular);
    });

    // Original file must remain untouched
    const content = JSON.parse(fs.readFileSync(target, 'utf-8'));
    assert.deepStrictEqual(content, { original: true });
  });
});
