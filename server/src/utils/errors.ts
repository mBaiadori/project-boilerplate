/**
 * Erro de aplicação com mensagem segura para resposta ao cliente.
 */
export class AppError extends Error {
  public statusCode: number;
  public code?: string;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 400, code?: string) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Mascara caminhos absolutos do sistema de arquivos e tokens para evitar vazamento em mensagens de erro.
 */
export function redactPaths(text: string): string {
  if (!text) return '';
  return text
    .replace(/(?:\/Users\/[a-zA-Z0-9._-]+|\/home\/[a-zA-Z0-9._-]+|[a-zA-Z]:\\[a-zA-Z0-9._-]+)/g, '[REDACTED_PATH]')
    .replace(/\/(?:private\/)?var\/folders\/[^\s:'"]+/g, '[REDACTED_TMP_PATH]')
    .replace(/node_modules\/[^\s:'"]+/g, '[REDACTED_NODE_MODULES]');
}
