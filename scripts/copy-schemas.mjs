import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, '..', 'server', 'src', 'schemas');
const distDir = path.resolve(__dirname, '..', 'server', 'dist', 'schemas');

if (fs.existsSync(srcDir)) {
  fs.mkdirSync(distDir, { recursive: true });
  fs.cpSync(srcDir, distDir, { recursive: true, force: true });
  console.log('✅ Schemas copiados com sucesso para dist/schemas (cross-platform)');
}
