import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const baselinePath = path.join(ROOT_DIR, 'scripts', 'guards.baseline.json');
if (!fs.existsSync(baselinePath)) {
  console.error('❌ Arquivo de baseline não encontrado:', baselinePath);
  process.exit(1);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));

function walk(dir, extFilter) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of list) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(walk(full, extFilter));
    } else if (extFilter.some(ext => entry.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

const serverFiles = walk(path.join(ROOT_DIR, 'server', 'src'), ['.ts']).filter(f => !f.includes('.test.ts'));
const frontendFiles = walk(path.join(ROOT_DIR, 'frontend', 'src'), ['.ts', '.tsx']);

let executeGitCommandCount = 0;
let newFunctionCount = 0;
let execAsyncCount = 0;
let dangerouslySetInnerHTMLUnsanitized = 0;

for (const f of serverFiles) {
  const content = fs.readFileSync(f, 'utf-8');
  const egc = (content.match(/executeGitCommand\s*\(/g) || []).length;
  executeGitCommandCount += egc;
  const nf = (content.match(/new\s+Function\s*\(/g) || []).length;
  newFunctionCount += nf;
  const ea = (content.match(/\b(execAsync|execFileAsync)\s*\(/g) || []).length;
  execAsyncCount += ea;
}

for (const f of frontendFiles) {
  const content = fs.readFileSync(f, 'utf-8');
  const matches = content.match(/dangerouslySetInnerHTML\s*=\s*\{\s*\{[\s\S]*?\}\s*\}/g) || [];
  for (const m of matches) {
    if (!m.includes('sanitizeHtml')) {
      dangerouslySetInnerHTMLUnsanitized++;
    }
  }
}

let innerHTMLUnsanitizedFrontend = 0;
for (const f of frontendFiles) {
  if (f.includes('.test.')) continue;
  const content = fs.readFileSync(f, 'utf-8');
  const lines = content.split('\n');
  for (const line of lines) {
    if (/\.innerHTML\s*\+?=\s*/.test(line)) {
      // Ignora literais vazios/limpeza, quebras de linha estáticas e usos que chamam sanitizeHtml/sanitizeSvg/setSafeHtml
      const isStaticOrSafe =
        line.includes("= ''") ||
        line.includes('=""') ||
        line.includes("= '<br>'") ||
        line.includes("= '<p><br></p>'") ||
        line.includes('sanitizeHtml(') ||
        line.includes('sanitizeSvg(');
      if (!isStaticOrSafe) {
        innerHTMLUnsanitizedFrontend++;
      }
    }
  }
}

let frontendAnyCount = 0;
for (const f of frontendFiles) {
  const content = fs.readFileSync(f, 'utf-8');
  const anyMatches = (content.match(/(:\s*any\b|\bas\s+any\b)/g) || []).length;
  frontendAnyCount += anyMatches;
}

let serverAnyCount = 0;
for (const f of serverFiles) {
  const content = fs.readFileSync(f, 'utf-8');
  const anyMatches = (content.match(/(:\s*any\b|\bas\s+any\b)/g) || []).length;
  serverAnyCount += anyMatches;
}

const current = {
  executeGitCommand_server_src: executeGitCommandCount,
  newFunction_server_src: newFunctionCount,
  execAsync_server_src: execAsyncCount,
  dangerouslySetInnerHTML_unsanitized_frontend: dangerouslySetInnerHTMLUnsanitized,
  innerHTML_unsanitized_frontend: innerHTMLUnsanitizedFrontend,
  any_frontend_src: frontendAnyCount,
  any_server_src: serverAnyCount,
};

console.log('🛡️  Verificação de Guardas Estáticos:');
let hasError = false;

for (const [key, limit] of Object.entries(baseline)) {
  const val = current[key] ?? 0;
  if (val > limit) {
    console.error(`❌ REGRESSÃO: ${key} = ${val} (limite máximo permitido: ${limit}) [+${val - limit}]`);
    hasError = true;
  } else if (val < limit) {
    console.log(`✨ MELHORIA: ${key} = ${val} (abaixo do baseline: ${limit}) [${val - limit}]. Atualize o baseline!`);
  } else {
    console.log(`✅ OK: ${key} = ${val} (baseline: ${limit})`);
  }
}

if (hasError) {
  console.error('\n🚨 Falha nos guardas de segurança/qualidade! Corrija as regressões acima.');
  process.exit(1);
} else {
  console.log('\n🎉 Todos os guardas estáticos foram respeitados.');
}
