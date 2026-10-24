import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import crypto from 'node:crypto';
import { isPathInside } from '../../utils/repo-ref.js';
import { validateUrlForSSRF } from '../../utils/ssrf-guard.js';

const execFileAsync = promisify(execFile);

export interface ScriptExecutionOptions {
  code: string;
  args: Record<string, unknown>;
  context: { repoName: string; filePath?: string };
  safeRepoDir: string;
  timeoutMs?: number;
}

/**
 * Executa código JavaScript de ferramenta customizada dentro de um subprocesso isolado
 * do Node.js, com sandbox estrita, sem herdar variáveis de ambiente sensíveis e com timeout real.
 */
export async function runIsolatedScript(options: ScriptExecutionOptions): Promise<unknown> {
  const { code, args, context, safeRepoDir, timeoutMs = 15000 } = options;

  const tempId = crypto.randomBytes(16).toString('hex');
  const tempDir = path.join(os.tmpdir(), `context-os-script-${tempId}`);
  fs.mkdirSync(tempDir, { recursive: true, mode: 0o700 });

  const payloadPath = path.join(tempDir, 'payload.json');
  const runnerScriptPath = path.join(tempDir, 'runner.mjs');

  const payload = {
    code,
    args,
    context,
    safeRepoDir,
  };

  fs.writeFileSync(payloadPath, JSON.stringify(payload), { encoding: 'utf-8', mode: 0o600 });

  // Script do subprocesso runner
  const runnerCode = `
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const payload = JSON.parse(fs.readFileSync(${JSON.stringify(payloadPath)}, 'utf-8'));
const { code, args, context, safeRepoDir } = payload;

function isPathInside(parent, child) {
  const rel = path.relative(parent, child);
  return Boolean(rel && !rel.startsWith('..') && !path.isAbsolute(rel));
}

function assertSafeRepoPath(full) {
  if (!isPathInside(safeRepoDir, full) && full !== safeRepoDir) {
    throw new Error('Acesso negado: fora do diretório do projeto.');
  }
  if (fs.existsSync(full)) {
    const real = fs.realpathSync(full);
    if (!isPathInside(safeRepoDir, real) && real !== safeRepoDir) {
      throw new Error('Acesso negado: symlink para fora do diretório do projeto.');
    }
  }
}

const safeUtils = Object.freeze({
  JSON,
  Math,
  Date,
  Buffer,
  readProjectFile: (relPath) => {
    const full = path.resolve(safeRepoDir, String(relPath || '').replace(/^\\/+/, ''));
    assertSafeRepoPath(full);
    if (!fs.existsSync(full)) return null;
    return fs.readFileSync(full, 'utf-8');
  },
  writeProjectFile: (relPath, content) => {
    const full = path.resolve(safeRepoDir, String(relPath || '').replace(/^\\/+/, ''));
    assertSafeRepoPath(full);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, String(content ?? ''), 'utf-8');
    return true;
  },
  listProjectFiles: (relDir = '') => {
    const full = path.resolve(safeRepoDir, String(relDir || '').replace(/^\\/+/, ''));
    assertSafeRepoPath(full);
    if (!fs.existsSync(full)) return [];
    return fs.readdirSync(full);
  },
});

const sandbox = {
  args,
  context,
  utils: safeUtils,
  console: {
    log: (...a) => {},
    warn: (...a) => {},
    error: (...a) => {},
  },
  setTimeout,
  clearTimeout,
  Promise,
};

const scriptContext = vm.createContext(sandbox);

const wrappedSource = \`(async () => {
  \${code}
})()\`;

try {
  const script = new vm.Script(wrappedSource, {
    filename: 'custom-tool.js',
    timeout: ${timeoutMs},
  });
  const resultPromise = script.runInContext(scriptContext);
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Timeout de execução excedido')), ${timeoutMs});
  });
  const result = await Promise.race([resultPromise, timeoutPromise]);
  if (timer) clearTimeout(timer);
  process.stdout.write(JSON.stringify({ success: true, result }));
  process.exit(0);
} catch (err) {
  process.stdout.write(JSON.stringify({ success: false, error: err.message || String(err) }));
  process.exit(0);
}
`;

  fs.writeFileSync(runnerScriptPath, runnerCode, { encoding: 'utf-8', mode: 0o600 });

  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      ['--max-old-space-size=128', '--no-addons', runnerScriptPath],
      {
        shell: false,
        timeout: timeoutMs + 2000,
        maxBuffer: 2 * 1024 * 1024,
        env: {
          NODE_ENV: 'production',
          PATH: process.env.PATH || '',
        },
      }
    );

    if (!stdout.trim()) {
      throw new Error(stderr || 'Execução do script falhou sem saída.');
    }

    const parsed = JSON.parse(stdout);
    if (!parsed.success) {
      throw new Error(parsed.error);
    }

    return parsed.result;
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}
