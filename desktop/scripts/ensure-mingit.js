import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_DIR = path.resolve(__dirname, '../resources/git-win');
const GIT_EXE = path.join(TARGET_DIR, 'cmd', 'git.exe');
const MINGIT_URL = 'https://github.com/git-for-windows/git/releases/download/v2.56.0.windows.4/MinGit-2.56.0.4-64-bit.zip';
const ZIP_TEMP = path.resolve(__dirname, '../resources/mingit-temp.zip');

async function downloadFile(url, dest) {
  console.log(`[ensure-mingit] Baixando MinGit de ${url}...`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Falha no download do MinGit: ${res.status} ${res.statusText}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  fs.writeFileSync(dest, Buffer.from(arrayBuffer));
  console.log(`[ensure-mingit] Download concluído (${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)} MB).`);
}

async function main() {
  if (fs.existsSync(GIT_EXE)) {
    console.log('[ensure-mingit] MinGit já está presente em:', GIT_EXE);
    return;
  }

  const resourcesDir = path.resolve(__dirname, '../resources');
  fs.mkdirSync(resourcesDir, { recursive: true });
  fs.mkdirSync(TARGET_DIR, { recursive: true });

  try {
    await downloadFile(MINGIT_URL, ZIP_TEMP);
    console.log('[ensure-mingit] Extraindo MinGit para:', TARGET_DIR);

    if (process.platform === 'win32') {
      execSync(`tar -xf "${ZIP_TEMP}" -C "${TARGET_DIR}"`, { stdio: 'inherit' });
    } else {
      execSync(`unzip -q -o "${ZIP_TEMP}" -d "${TARGET_DIR}"`, { stdio: 'inherit' });
    }

    if (fs.existsSync(GIT_EXE)) {
      console.log('✅ [ensure-mingit] MinGit extraído e verificado com sucesso!');
    } else {
      throw new Error(`Arquivo ${GIT_EXE} não encontrado após a descompactação.`);
    }
  } catch (err) {
    console.error('❌ [ensure-mingit] Erro ao obter MinGit:', err.message);
    process.exit(1);
  } finally {
    if (fs.existsSync(ZIP_TEMP)) {
      try {
        fs.unlinkSync(ZIP_TEMP);
      } catch {}
    }
  }
}

main();
