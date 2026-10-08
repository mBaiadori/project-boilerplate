import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { prsService } from './prs.service.js';
import { resolveRepoDir } from '../../config/constants.js';

describe('PRsService - Isolamento de PRs por Repositório', () => {
  const TEST_REPO_A = 'test-repo-alpha';
  const TEST_REPO_B = 'test-repo-beta';

  const repoADir = resolveRepoDir(TEST_REPO_A);
  const repoBDir = resolveRepoDir(TEST_REPO_B);

  after(() => {
    try {
      if (fs.existsSync(repoADir)) fs.rmSync(repoADir, { recursive: true, force: true });
      if (fs.existsSync(repoBDir)) fs.rmSync(repoBDir, { recursive: true, force: true });
    } catch {}
  });

  it('Deve salvar e carregar PRs isoladamente na pasta de cada projeto (.spec-memory/prs.json)', () => {
    const prA = [{ id: 1, title: 'PR Alpha', repo_name: TEST_REPO_A, status: 'OPEN' }];
    const prB = [{ id: 10, title: 'PR Beta', repo_name: TEST_REPO_B, status: 'OPEN' }];

    prsService.saveRepoPRs(TEST_REPO_A, prA);
    prsService.saveRepoPRs(TEST_REPO_B, prB);

    // 1. Carrega Repo A
    const loadedA = prsService.loadRepoPRs(TEST_REPO_A);
    assert.strictEqual(loadedA.length, 1);
    assert.strictEqual(loadedA[0].title, 'PR Alpha');

    // 2. Carrega Repo B
    const loadedB = prsService.loadRepoPRs(TEST_REPO_B);
    assert.strictEqual(loadedB.length, 1);
    assert.strictEqual(loadedB[0].title, 'PR Beta');

    // 3. Verifica se os arquivos físicos foram criados nos caminhos corretos
    const fileAPath = path.join(repoADir, '.spec-memory', 'prs.json');
    const fileBPath = path.join(repoBDir, '.spec-memory', 'prs.json');

    assert.strictEqual(fs.existsSync(fileAPath), true);
    assert.strictEqual(fs.existsSync(fileBPath), true);
  });
});
