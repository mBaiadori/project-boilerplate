import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { isPathInside, assertPathInside } from './repo-ref.js';

describe('RepoRef & Path Security: Proteção contra Symlink Escape (Fase 4 - N4)', () => {
  const testRoot = path.join(os.tmpdir(), `symlink-test-${Date.now()}`);
  const repoDir = path.join(testRoot, 'projects', 'my-repo');
  const outsideSecretFile = path.join(testRoot, 'secret.txt');
  const outsideFolder = path.join(testRoot, 'outside-folder');

  beforeEach(() => {
    fs.mkdirSync(repoDir, { recursive: true });
    fs.mkdirSync(outsideFolder, { recursive: true });
    fs.writeFileSync(outsideSecretFile, 'SUPER_SECRET_EXTERNAL_CONTENT', 'utf-8');
  });

  afterEach(() => {
    try {
      fs.rmSync(testRoot, { recursive: true, force: true });
    } catch {}
  });

  it('deve rejeitar symlink de arquivo que aponta para fora do repositório', () => {
    const symlinkFile = path.join(repoDir, 'leak.md');
    fs.symlinkSync(outsideSecretFile, symlinkFile);

    const isInside = isPathInside(repoDir, symlinkFile);
    assert.strictEqual(isInside, false, 'Symlink apontando para fora do repo deve retornar false!');
  });

  it('deve rejeitar symlink de diretório que aponta para pasta externa', () => {
    const symlinkDir = path.join(repoDir, 'docs-symlink');
    fs.symlinkSync(outsideFolder, symlinkDir);

    const isInside = isPathInside(repoDir, symlinkDir);
    assert.strictEqual(isInside, false, 'Symlink de diretório externo deve retornar false!');

    // Tentativa de acessar arquivo dentro do symlink de diretório externo
    const targetFileInsideSymlink = path.join(symlinkDir, 'subfile.txt');
    assert.strictEqual(
      isPathInside(repoDir, targetFileInsideSymlink),
      false,
      'Arquivo dentro de symlink externo deve retornar false!'
    );
  });

  it('deve rejeitar escrita de novo arquivo através de symlink que aponta para fora', () => {
    const symlinkDir = path.join(repoDir, 'docs-symlink');
    fs.symlinkSync(outsideFolder, symlinkDir);

    const newFileTarget = path.join(symlinkDir, 'novo-arquivo.md');
    assert.throws(
      () => assertPathInside(repoDir, newFileTarget),
      /fora do diretório/i
    );
  });

  it('deve permitir arquivos e pastas legítimos normais dentro do repositório', () => {
    const normalFile = path.join(repoDir, 'README.md');
    fs.writeFileSync(normalFile, '# Readme', 'utf-8');

    assert.strictEqual(isPathInside(repoDir, normalFile), true);
    assert.doesNotThrow(() => assertPathInside(repoDir, normalFile));
  });

  it('deve permitir novo arquivo ainda inexistente dentro de pasta normal existente', () => {
    const nonExistentFile = path.join(repoDir, 'subfolder', 'new-doc.md');
    // Pasta subfolder não existe ainda ou existe
    fs.mkdirSync(path.join(repoDir, 'subfolder'), { recursive: true });

    assert.strictEqual(isPathInside(repoDir, nonExistentFile), true);
  });

  it('deve rejeitar repo irmão com prefixo similar (ex: my-repo-evil vs my-repo)', () => {
    const siblingRepo = path.join(testRoot, 'projects', 'my-repo-evil');
    fs.mkdirSync(siblingRepo, { recursive: true });

    const siblingFile = path.join(siblingRepo, 'file.md');
    assert.strictEqual(isPathInside(repoDir, siblingFile), false);
  });
});
