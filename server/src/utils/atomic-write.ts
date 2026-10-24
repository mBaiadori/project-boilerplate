import fs from 'node:fs';
import path from 'node:path';

/**
 * Escreve um arquivo de texto de forma atômica utilizando o padrão:
 * 1. Escreve em arquivo temporário no mesmo diretório
 * 2. Garante flush no disco via fsync
 * 3. Renomeia atomicamente sobre o destino (rename)
 * Evita que quedas de energia, panes ou shutdowns corrompam arquivos de configuração com 0 bytes.
 */
export function writeTextAtomic(filePath: string, text: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tmpPath = path.join(
    dir,
    `.${path.basename(filePath)}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`
  );

  let fd: number | null = null;
  try {
    fd = fs.openSync(tmpPath, 'w');
    fs.writeSync(fd, text, 0, 'utf-8');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;

    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {}
    }
    if (fs.existsSync(tmpPath)) {
      try {
        fs.unlinkSync(tmpPath);
      } catch {}
    }
    throw err;
  }
}

/**
 * Serializa e escreve um objeto JSON de forma estritamente atômica.
 */
export function writeJsonAtomic(filePath: string, data: unknown, space = 2): void {
  // Serialização antes de tocar no disco para não criar arquivo temporário em caso de erro no stringify
  const serialized = JSON.stringify(data, null, space);
  writeTextAtomic(filePath, serialized);
}
