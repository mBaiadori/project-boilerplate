#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverDir = path.resolve(__dirname, '..', 'server');

// Cria diretório temporário para isolar completamente o ambiente de dados do usuário e HOME
const tmpUserEnv = fs.mkdtempSync(path.join(os.tmpdir(), 'context-os-test-env-'));

// Cria subpastas essenciais para o servidor e cofre/sessão
fs.mkdirSync(path.join(tmpUserEnv, 'projects'), { recursive: true });
fs.mkdirSync(path.join(tmpUserEnv, '.context-os'), { recursive: true, mode: 0o700 });

// No macOS, o Keyring nativo requer acesso ao keychain de login do usuário em Library/Keychains
if (process.platform === 'darwin') {
  const realHome = process.env.HOME || os.homedir();
  const keychainsDir = path.join(realHome, 'Library', 'Keychains');
  if (fs.existsSync(keychainsDir)) {
    fs.mkdirSync(path.join(tmpUserEnv, 'Library'), { recursive: true });
    try {
      fs.symlinkSync(keychainsDir, path.join(tmpUserEnv, 'Library', 'Keychains'));
    } catch {}
  }
}

// Configura variáveis de ambiente isoladas
const testEnv = {
  ...process.env,
  CONTEXT_OS_USER_DATA: tmpUserEnv,
  HOME: tmpUserEnv,
  NODE_ENV: 'test',
};

// Argumentos passados para o test runner
const userArgs = process.argv.slice(2);
const testTargets = userArgs.length > 0 ? userArgs : ['src/**/*.test.ts'];
const tsxArgs = ['--test', '--test-timeout=60000', ...testTargets];

const child = spawn('npx', ['tsx', ...tsxArgs], {
  cwd: serverDir,
  env: testEnv,
  stdio: 'inherit',
});

function cleanup() {
  try {
    if (fs.existsSync(tmpUserEnv)) {
      fs.rmSync(tmpUserEnv, { recursive: true, force: true });
    }
  } catch {}
}

child.on('close', (code) => {
  cleanup();
  process.exit(code ?? 0);
});

child.on('error', (err) => {
  console.error('[run-tests] Erro ao iniciar subprocesso de testes:', err);
  cleanup();
  process.exit(1);
});

process.on('SIGINT', () => {
  cleanup();
  process.exit(130);
});

process.on('SIGTERM', () => {
  cleanup();
  process.exit(143);
});
