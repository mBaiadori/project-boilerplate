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
  const rawTempDir = path.join(os.tmpdir(), `context-os-script-${tempId}`);
  fs.mkdirSync(rawTempDir, { recursive: true, mode: 0o700 });
  const tempDir = fs.realpathSync(rawTempDir);
  const resolvedRepoDir = fs.existsSync(safeRepoDir) ? fs.realpathSync(safeRepoDir) : safeRepoDir;

  const payloadPath = path.join(tempDir, 'payload.json');
  const runnerScriptPath = path.join(tempDir, 'runner.mjs');

  const payload = {
    code,
    args,
    context,
    safeRepoDir: resolvedRepoDir,
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
  const rel = path.relative(safeRepoDir, full).replaceAll('\\\\', '/');
  const parts = rel.split('/').filter(Boolean);
  if (parts.some((p) => p === '.git' || p === '.tools' || p === '.context-os')) {
    throw new Error('Acesso negado: manipulação de pastas internas de infraestrutura (.git / .tools) é estritamente proibida.');
  }
  let curr = full;
  while (curr && curr !== safeRepoDir && curr !== path.dirname(curr)) {
    if (fs.existsSync(curr)) {
      const real = fs.realpathSync(curr);
      if (!isPathInside(safeRepoDir, real) && real !== safeRepoDir) {
        throw new Error('Acesso negado: symlink para fora do diretório do projeto.');
      }
    }
    curr = path.dirname(curr);
  }
}

// Bloqueia acesso à rede global dentro do realm
delete globalThis.fetch;

// Esteriliza funções utilitárias contra escape de realm via construtor
function secureFn(fn) {
  Object.setPrototypeOf(fn, null);
  Object.defineProperty(fn, 'constructor', {
    value: undefined,
    writable: false,
    configurable: false,
  });
  return fn;
}

// Cria sandbox isolada sem protótipos do realm pai (host)
const sandbox = Object.create(null);
sandbox.args = args;
sandbox.context = context;

const scriptContext = vm.createContext(sandbox, {
  codeGeneration: { strings: false, wasm: false },
});

// Extrai instâncias intrínsecas ao próprio contexto para evitar vazamento do realm do host
const intrinsic = vm.runInContext('({ JSON, Math, Date })', scriptContext);

function sanitizeRel(p) {
  let s = String(p || '');
  while (s.startsWith('/') || s.startsWith('\\\\')) s = s.slice(1);
  return s;
}

const safeUtils = Object.freeze({
  JSON: intrinsic.JSON,
  Math: intrinsic.Math,
  Date: intrinsic.Date,
  toBase64: secureFn((str) => Buffer.from(String(str || ''), 'utf-8').toString('base64')),
  fromBase64: secureFn((b64) => Buffer.from(String(b64 || ''), 'base64').toString('utf-8')),
  readProjectFile: secureFn((relPath) => {
    const full = path.resolve(safeRepoDir, sanitizeRel(relPath));
    assertSafeRepoPath(full);
    if (!fs.existsSync(full)) return null;
    return fs.readFileSync(full, 'utf-8');
  }),
  writeProjectFile: secureFn((relPath, content) => {
    const full = path.resolve(safeRepoDir, sanitizeRel(relPath));
    assertSafeRepoPath(full);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, String(content ?? ''), 'utf-8');
    return true;
  }),
  listProjectFiles: secureFn((relDir = '') => {
    const full = path.resolve(safeRepoDir, sanitizeRel(relDir));
    assertSafeRepoPath(full);
    if (!fs.existsSync(full)) return [];
    return fs.readdirSync(full);
  }),
});

sandbox.utils = safeUtils;
sandbox.console = Object.freeze({
  log: secureFn((...a) => {}),
  warn: secureFn((...a) => {}),
  error: secureFn((...a) => {}),
});

Object.setPrototypeOf(sandbox, null);

const wrappedSource = \`(async () => {
  \${code}
})()\`;

try {
  const script = new vm.Script(wrappedSource, {
    filename: 'custom-tool.js',
    timeout: ${timeoutMs},
  });
  const result = await script.runInContext(scriptContext);
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
      [
        '--disallow-code-generation-from-strings',
        '--permission',
        `--allow-fs-read=${tempDir}`,
        `--allow-fs-read=${rawTempDir}`,
        `--allow-fs-read=${resolvedRepoDir}`,
        `--allow-fs-read=${safeRepoDir}`,
        `--allow-fs-write=${resolvedRepoDir}`,
        `--allow-fs-write=${safeRepoDir}`,
        '--max-old-space-size=128',
        '--no-addons',
        runnerScriptPath,
      ],
      {
        shell: false,
        timeout: timeoutMs + 2000,
        maxBuffer: 1024 * 1024,
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
