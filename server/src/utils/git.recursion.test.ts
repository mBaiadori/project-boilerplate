import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  executeGit,
  getGitBranches,
  getDefaultBranch,
  getGitStatus,
  setGitExecutionHook,
} from './git.js';
import { CONFIG_PATH } from '../config/constants.js';

describe('Fase 0 (B1 & R1): Git Recursion Prevention, Dependency Strictness & Config Isolation', () => {
  let tmpRepoDir: string;

  beforeEach(async () => {
    tmpRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-recursion-test-'));
  });

  afterEach(() => {
    setGitExecutionHook(null);
    try {
      fs.rmSync(tmpRepoDir, { recursive: true, force: true });
    } catch {}
  });

  test('0.1.1: getGitBranches não deve realizar mais que 3 chamadas git no caminho de execução', async () => {
    await executeGit(['init', '-b', 'main'], tmpRepoDir);
    await executeGit(['config', 'user.name', 'Tester'], tmpRepoDir);
    await executeGit(['config', 'user.email', 'test@example.com'], tmpRepoDir);
    fs.writeFileSync(path.join(tmpRepoDir, 'file.txt'), 'hello');
    await executeGit(['add', 'file.txt'], tmpRepoDir);
    await executeGit(['commit', '-m', 'initial'], tmpRepoDir);

    let gitCalls = 0;
    setGitExecutionHook((args) => {
      gitCalls++;
    });

    const result = await getGitBranches(tmpRepoDir);
    assert.strictEqual(result.current, 'main');
    assert.ok(gitCalls <= 3, `getGitBranches executou ${gitCalls} chamadas git (máximo permitido: 3)`);
  });

  test('0.1.2: getDefaultBranch só pode chamar executeGit diretamente, NUNCA getGitBranches', async () => {
    await executeGit(['init', '-b', 'main'], tmpRepoDir);
    await executeGit(['config', 'user.name', 'Tester'], tmpRepoDir);
    await executeGit(['config', 'user.email', 'test@example.com'], tmpRepoDir);
    fs.writeFileSync(path.join(tmpRepoDir, 'file.txt'), 'hello');
    await executeGit(['add', 'file.txt'], tmpRepoDir);
    await executeGit(['commit', '-m', 'initial'], tmpRepoDir);

    const executedCommands: string[][] = [];
    setGitExecutionHook((args) => {
      executedCommands.push(args);
    });

    const defaultBranch = await getDefaultBranch(tmpRepoDir);
    assert.strictEqual(defaultBranch, 'main');

    // Regra da Fase 0 (0.2): "getDefaultBranch só pode chamar executeGit, nunca getGitBranches nem getGitStatus.
    // Troque o passo 2 por executeGit(['for-each-ref','--format=%(refname:short)','refs/heads'])"
    // Não pode executar `git branch --list` (que é característico de getGitBranches)
    const branchListCalls = executedCommands.filter(
      (cmd) => cmd[0] === 'branch' && cmd.includes('--list')
    );
    assert.strictEqual(
      branchListCalls.length,
      0,
      'VIOLAÇÃO B1: getDefaultBranch chamou getGitBranches (invocou git branch --list) em vez de consultar refs diretamente.'
    );
  });

  test('0.1.3: Repo com branch master e sem origin deve retornar master tanto em getDefaultBranch quanto em getGitBranches', async () => {
    await executeGit(['init', '-b', 'master'], tmpRepoDir);
    await executeGit(['config', 'user.name', 'Tester'], tmpRepoDir);
    await executeGit(['config', 'user.email', 'test@example.com'], tmpRepoDir);
    fs.writeFileSync(path.join(tmpRepoDir, 'file.txt'), 'hello on master');
    await executeGit(['add', 'file.txt'], tmpRepoDir);
    await executeGit(['commit', '-m', 'commit on master'], tmpRepoDir);

    const defBranch = await getDefaultBranch(tmpRepoDir);
    assert.strictEqual(defBranch, 'master');

    const branchesInfo = await getGitBranches(tmpRepoDir);
    assert.strictEqual(branchesInfo.current, 'master');
    assert.ok(branchesInfo.branches.includes('master'));
  });

  test('0.1.4: Repo vazio (sem commits) não deve lançar exceção nem travar em loop em getGitBranches e getDefaultBranch', async () => {
    await executeGit(['init', '-b', 'main'], tmpRepoDir);

    let defBranch = '';
    assert.doesNotThrow(async () => {
      defBranch = await getDefaultBranch(tmpRepoDir);
    });

    let branchesInfo: any = null;
    assert.doesNotThrow(async () => {
      branchesInfo = await getGitBranches(tmpRepoDir);
    });

    const status = await getGitStatus(tmpRepoDir);
    assert.ok(status);
    assert.strictEqual(status.isClean, true);
  });

  test('0.1.5 (R1 RED): CONFIG_PATH deve residir estritamente dentro de os.tmpdir() durante a execução de testes', () => {
    const tmpPrefix = os.tmpdir();
    const isUnderTmp = CONFIG_PATH.startsWith(tmpPrefix);
    assert.strictEqual(
      isUnderTmp,
      true,
      `VIOLAÇÃO R1: CONFIG_PATH ("${CONFIG_PATH}") está fora de os.tmpdir() ("${tmpPrefix}"). Os testes correm risco de sobrescrever o config.json real!`
    );
  });
});
