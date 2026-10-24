/**
 * Validadores estritos para comandos Git para prevenir injeção de argumentos e caracteres maliciosos.
 */

/**
 * Valida se uma string é um commit hash ou ref válido (SHA-1/SHA-256 ou ref simples como HEAD, HEAD~1, etc).
 */
export function assertCommitish(ref: string, label = "Commit/Ref"): string {
  if (!ref || typeof ref !== "string") {
    throw new Error(`${label} inválido: valor vazio.`);
  }
  const trimmed = ref.trim();
  // Não pode começar com "-" (evita injeção de flags como --upload-pack)
  if (trimmed.startsWith("-")) {
    throw new Error(`${label} inválido: não pode iniciar com "-": ${trimmed}`);
  }
  // Permite hex (4 a 64 chars), HEAD, HEAD~N, HEAD^N, ou refs alfanuméricas com barras/hífens
  const validPattern = /^(?:[0-9a-fA-F]{4,64}|HEAD(?:[~^]\d*)*|[a-zA-Z0-9_\-./]+)$/;
  if (!validPattern.test(trimmed) || trimmed.includes("..") || trimmed.includes(";") || trimmed.includes("`") || trimmed.includes("$")) {
    throw new Error(`${label} contém caracteres inválidos: ${trimmed}`);
  }
  return trimmed;
}

/**
 * Valida o nome de um remote Git (ex: "origin", "upstream").
 */
export function assertRemoteName(remote: string, label = "Nome do Remote"): string {
  if (!remote || typeof remote !== "string") {
    throw new Error(`${label} inválido: valor vazio.`);
  }
  const trimmed = remote.trim();
  if (trimmed.startsWith("-")) {
    throw new Error(`${label} inválido: não pode iniciar com "-": ${trimmed}`);
  }
  // Remote names típicos ou URLs git seguras
  const validRemote = /^[a-zA-Z0-9._-]+$/;
  if (!validRemote.test(trimmed)) {
    throw new Error(`${label} contém caracteres inválidos: ${trimmed}`);
  }
  return trimmed;
}

/**
 * Valida o nome de uma branch Git.
 */
export function assertBranchName(branch: string, label = "Nome da Branch"): string {
  if (!branch || typeof branch !== "string") {
    throw new Error(`${label} inválido: valor vazio.`);
  }
  const trimmed = branch.trim();
  if (trimmed.startsWith("-")) {
    throw new Error(`${label} inválido: não pode iniciar com "-": ${trimmed}`);
  }
  // Não pode conter caracteres de controle, espaços, aspas, ponto e vírgula, crases, interpolação
  const invalidChars = /[ ~^:?*\[\\;`$'"\s\x00-\x1f\x7f]/;
  if (invalidChars.test(trimmed) || trimmed.includes("..") || trimmed.includes("@{") || trimmed.endsWith("/") || trimmed.endsWith(".")) {
    throw new Error(`${label} contém caracteres inválidos: ${trimmed}`);
  }
  return trimmed;
}

/**
 * Sanitiza caminho relativo para uso com git (garante que não começa com "-").
 */
export function assertGitPath(filePath: string, label = "Caminho do arquivo"): string {
  if (!filePath || typeof filePath !== "string") {
    throw new Error(`${label} inválido: valor vazio.`);
  }
  const trimmed = filePath.trim();
  if (trimmed.startsWith("-")) {
    throw new Error(`${label} inválido: não pode iniciar com "-": ${trimmed}`);
  }
  if (trimmed.includes("\x00")) {
    throw new Error(`${label} contém caractere nulo.`);
  }
  return trimmed;
}
