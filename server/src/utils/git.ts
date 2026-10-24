/**
 * Context OS - Git Utilities Facade
 *
 * Re-exporta de forma transparente os módulos especializados:
 * - git-core.ts: Execução de comandos, parsing de progresso e variáveis de ambiente
 * - git-queries.ts: Consultas, logs, diffs, blame e status de repositório
 * - git-ops.ts: Operações mutantes (clone, pull, commit, branch, sync, rollback)
 * - git-validate.ts: Validadores estritos de segurança de argumentos
 */

export * from "./git-validate.js";
export * from "./git-core.js";
export * from "./git-queries.js";
export * from "./git-ops.js";
