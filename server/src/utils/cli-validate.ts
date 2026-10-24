import fs from "node:fs";
import path from "node:path";

export interface CliValidationResult {
  valid: boolean;
  error?: string;
  realPath?: string;
}

const FORBIDDEN_SHELL_CHARS = /[;&|`$\r\n\0]/;

/**
 * Validação estrita de binários de CLIs externos (Claude, Antigravity) para execução local segura
 */
export function validateCliExecutable(
  cliPath: string,
  allowedBinaryNames: string[],
): CliValidationResult {
  if (!cliPath || typeof cliPath !== "string") {
    return { valid: false, error: "Caminho do binário inválido ou não fornecido." };
  }

  const trimmed = cliPath.trim();
  if (FORBIDDEN_SHELL_CHARS.test(trimmed)) {
    return {
      valid: false,
      error: `Caminho do binário contém caracteres inválidos ou perigosos de shell: ${trimmed}`,
    };
  }

  if (!fs.existsSync(trimmed)) {
    return { valid: false, error: `Arquivo de binário não encontrado no disco: ${trimmed}` };
  }

  let realPath: string;
  try {
    realPath = fs.realpathSync(trimmed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `Falha ao resolver caminho canônico: ${msg}` };
  }

  // Verifica se o arquivo é executável pelo usuário atual
  try {
    fs.accessSync(realPath, fs.constants.X_OK);
  } catch {
    return { valid: false, error: `Arquivo existe mas não possui permissão de executável: ${realPath}` };
  }

  const stat = fs.statSync(realPath);
  if (stat.isDirectory()) {
    return { valid: false, error: `Caminho aponta para um diretório, não um executável: ${realPath}` };
  }

  // Permissões seguras: rejeita binários graváveis por todos os usuários (world-writable)
  if ((stat.mode & 0o002) !== 0) {
    return {
      valid: false,
      error: `Binário com permissões inseguras (world-writable): ${realPath}`,
    };
  }

  // Validação contra allowlist de nomes de binários conhecidos
  const baseName = path.basename(realPath).toLowerCase();
  const isAllowed = allowedBinaryNames.some(
    (allowed) => baseName === allowed.toLowerCase() || baseName === `${allowed.toLowerCase()}.exe`
  );

  if (!isAllowed) {
    return {
      valid: false,
      error: `Nome do binário ('${baseName}') não consta na allowlist de executáveis autorizados (${allowedBinaryNames.join(", ")}).`,
    };
  }

  return {
    valid: true,
    realPath,
  };
}
