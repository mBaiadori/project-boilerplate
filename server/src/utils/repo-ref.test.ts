import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  parseRepoRef,
  repoKey,
  repoFullName,
  resolveRepoDirPath,
  sanitizeRepoSegment,
} from './repo-ref.js';
import { PROJECTS_DIR } from '../config/constants.js';

describe('RepoRef & Canonical Path Resolution', () => {
  test('sanitizeRepoSegment sanitiza nomes e remove .git', () => {
    assert.equal(sanitizeRepoSegment('my-repo.git'), 'my-repo');
    assert.equal(sanitizeRepoSegment('my-repo'), 'my-repo');
    assert.equal(sanitizeRepoSegment(' Org_Name '), 'Org_Name');
    assert.throws(() => sanitizeRepoSegment('..'));
    assert.throws(() => sanitizeRepoSegment('../traversal'));
    assert.throws(() => sanitizeRepoSegment('a/b'));
  });

  test('parseRepoRef lida com strings owner/repo e objetos', () => {
    const r1 = parseRepoRef('orgA/repoB');
    assert.deepEqual(r1, { owner: 'orgA', repo: 'repoB' });

    const r2 = parseRepoRef({ owner: 'orgA', name: 'repoB' });
    assert.deepEqual(r2, { owner: 'orgA', repo: 'repoB' });

    const r3 = parseRepoRef({ owner: { login: 'orgA' }, repo: 'repoB' });
    assert.deepEqual(r3, { owner: 'orgA', repo: 'repoB' });

    const r4 = parseRepoRef('repoB', 'orgA');
    assert.deepEqual(r4, { owner: 'orgA', repo: 'repoB' });

    const r5 = parseRepoRef({ full_name: 'orgA/repoB.git' });
    assert.deepEqual(r5, { owner: 'orgA', repo: 'repoB' });
  });

  test('repoKey normaliza para lowercase e repoFullName preserva casing original', () => {
    const ref = { owner: 'MyOrg', repo: 'MyRepo' };
    assert.equal(repoKey(ref), 'myorg/myrepo');
    assert.equal(repoFullName(ref), 'MyOrg/MyRepo');
  });

  test('resolveRepoDirPath gera estritamente projects/<owner>/<repo> de forma determinística', () => {
    const p1 = resolveRepoDirPath('orgA/repoB');
    assert.equal(p1, path.resolve(PROJECTS_DIR, 'orgA', 'repoB'));

    const p2 = resolveRepoDirPath({ owner: 'company', repo: 'backend' });
    assert.equal(p2, path.resolve(PROJECTS_DIR, 'company', 'backend'));

    assert.throws(() => resolveRepoDirPath('../../../etc/passwd', 'hack'));
  });
});
