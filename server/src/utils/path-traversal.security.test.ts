import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { workspaceService } from '../modules/workspace/workspace.service.js';
import { wikiService } from '../modules/wiki/wiki.service.js';
import { translationsService } from '../modules/translations/translations.service.js';
import { prWorktreeService } from '../modules/prs/pr-worktree.service.js';
import { resolveRepoDir } from '../config/constants.js';

describe('Fase 0 (SEC-01, C15): Path Traversal Containment & Safe Path Resolution', () => {
  let tmpRepoDir: string;
  const repoName = 'test-path-traversal-repo';

  beforeEach(() => {
    tmpRepoDir = resolveRepoDir(repoName);
    fs.mkdirSync(tmpRepoDir, { recursive: true });
    // Cria um arquivo legítimo dentro do repositório
    fs.writeFileSync(path.join(tmpRepoDir, 'documento.md'), '# Documento Legítimo', 'utf-8');
  });

  afterEach(() => {
    try {
      if (fs.existsSync(tmpRepoDir)) {
        fs.rmSync(tmpRepoDir, { recursive: true, force: true });
      }
    } catch {}
  });

  test('0.1.1: getFile deve rejeitar caminhos com directory traversal (..)', () => {
    assert.throws(
      () => {
        workspaceService.getFile('../../../../etc/passwd', repoName);
      },
      /fora do diretório|Acesso negado|inválido/i,
      'getFile permitiu path traversal para fora do repositório'
    );
  });

  test('0.1.2: getRawFile deve rejeitar caminhos com directory traversal (..)', () => {
    assert.throws(
      () => {
        workspaceService.getRawFile('../../config.json', repoName);
      },
      /fora do diretório|Acesso negado|inválido/i,
      'getRawFile permitiu path traversal para fora do repositório'
    );
  });

  test('0.1.3: saveFile deve rejeitar gravação fora do repositório (..)', async () => {
    await assert.rejects(
      async () => {
        await workspaceService.saveFile('../escaped.txt', 'malicioso', {}, repoName);
      },
      /fora do diretório|Acesso negado|inválido/i,
      'saveFile permitiu gravação fora do repositório'
    );
  });

  test('0.1.4: deleteFile deve rejeitar exclusão fora do repositório (..)', async () => {
    await assert.rejects(
      async () => {
        await workspaceService.deleteFile('../escaped.txt', repoName);
      },
      /fora do diretório|Acesso negado|inválido/i,
      'deleteFile permitiu exclusão fora do repositório'
    );
  });

  test('0.1.5: renameFile deve rejeitar caminhos fora do repositório na origem ou no destino', async () => {
    await assert.rejects(
      async () => {
        await workspaceService.renameFile('documento.md', '../escaped.md', repoName);
      },
      /fora do diretório|Acesso negado|inválido/i,
      'renameFile permitiu destino fora do repositório'
    );

    await assert.rejects(
      async () => {
        await workspaceService.renameFile('../escaped.md', 'legitimo.md', repoName);
      },
      /fora do diretório|Acesso negado|inválido/i,
      'renameFile permitiu origem fora do repositório'
    );
  });

  test('0.1.6: wikiService deve rejeitar categorias maliciosas com directory traversal', () => {
    assert.throws(
      () => {
        wikiService.saveWikiPage('../../root-notes', 'slug', 'Título', 'Conteúdo', repoName);
      },
      /fora do diretório|Acesso negado|inválido/i,
      'saveWikiPage permitiu categoria com traversal'
    );

    assert.throws(
      () => {
        wikiService.deleteWikiPage('../../root-notes', 'slug', repoName);
      },
      /fora do diretório|Acesso negado|inválido/i,
      'deleteWikiPage permitiu categoria com traversal'
    );
  });

  test('0.1.7: translationsService deve rejeitar caminhos com directory traversal', () => {
    assert.throws(
      () => {
        translationsService.saveTranslation(repoName, 'pt-BR', '../../evil.md', 'Conteúdo');
      },
      /fora do diretório|Acesso negado|inválido/i,
      'saveTranslation permitiu path traversal'
    );

    assert.throws(
      () => {
        translationsService.deleteTranslation(repoName, 'en', '../../evil.md');
      },
      /fora do diretório|Acesso negado|inválido/i,
      'deleteTranslation permitiu path traversal'
    );
  });

  test('0.1.8: writePlainAtWorktree deve rejeitar caminhos com directory traversal fora da worktree', async () => {
    const tmpWtDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-test-'));
    try {
      await assert.rejects(
        async () => {
          await prWorktreeService.writePlainAtWorktree(tmpWtDir, '../../evil.txt', 'pwned');
        },
        /fora do diretório|Acesso negado|inválido/i,
        'writePlainAtWorktree permitiu escrita fora da worktree'
      );
    } finally {
      try {
        fs.rmSync(tmpWtDir, { recursive: true, force: true });
      } catch {}
    }
  });

  test('0.1.9: Arquivos legítimos devem continuar sendo lidos e gravados normalmente', async () => {
    const saved = await workspaceService.saveFile('docs/manual.md', '# Manual de Teste', {}, repoName);
    assert.strictEqual(saved.success, true);

    const loaded = workspaceService.getFile('docs/manual.md', repoName);
    assert.strictEqual(loaded.content, '# Manual de Teste');
  });
});
