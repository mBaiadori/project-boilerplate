import { test, describe } from 'node:test';
import assert from 'node:assert';
import { assertCommitish, assertRemoteName, assertBranchName, assertGitPath } from './git-validate.js';

describe('git-validate: Testes dos Validadores de Entradas Git', () => {
  test('assertCommitish: aceita hashes hex válidos e refs simples', () => {
    assert.strictEqual(assertCommitish('a1b2c3d'), 'a1b2c3d');
    assert.strictEqual(assertCommitish('0123456789abcdef0123456789abcdef01234567'), '0123456789abcdef0123456789abcdef01234567');
    assert.strictEqual(assertCommitish('HEAD'), 'HEAD');
    assert.strictEqual(assertCommitish('HEAD~2'), 'HEAD~2');
  });

  test('assertCommitish: bloqueia injeções e flags', () => {
    assert.throws(() => assertCommitish('--upload-pack=evil'), /não pode iniciar com "-"/);
    assert.throws(() => assertCommitish('HEAD; touch PWNED'), /contém caracteres inválidos/);
    assert.throws(() => assertCommitish('`touch PWNED`'), /contém caracteres inválidos/);
    assert.throws(() => assertCommitish('$(touch PWNED)'), /contém caracteres inválidos/);
  });

  test('assertRemoteName: aceita nomes válidos e bloqueia injeções', () => {
    assert.strictEqual(assertRemoteName('origin'), 'origin');
    assert.strictEqual(assertRemoteName('upstream-1'), 'upstream-1');
    assert.throws(() => assertRemoteName('--upload-pack=evil'), /não pode iniciar com "-"/);
    assert.throws(() => assertRemoteName('origin; rm -rf /'), /contém caracteres inválidos/);
  });

  test('assertBranchName: valida branches normais e bloqueia caracteres hostis', () => {
    assert.strictEqual(assertBranchName('main'), 'main');
    assert.strictEqual(assertBranchName('feat/nova-funcionalidade'), 'feat/nova-funcionalidade');
    assert.strictEqual(assertBranchName('gov/update-123'), 'gov/update-123');
    assert.throws(() => assertBranchName('main; touch PWNED'), /contém caracteres inválidos/);
    assert.throws(() => assertBranchName('a`touch PWNED`'), /contém caracteres inválidos/);
    assert.throws(() => assertBranchName('-b'), /não pode iniciar com "-"/);
  });

  test('assertGitPath: rejeita flags iniciais e caracteres nulos', () => {
    assert.strictEqual(assertGitPath('docs/readme.md'), 'docs/readme.md');
    assert.throws(() => assertGitPath('--output=evil'), /não pode iniciar com "-"/);
    assert.throws(() => assertGitPath('docs/\x00evil'), /contém caractere nulo/);
  });
});
