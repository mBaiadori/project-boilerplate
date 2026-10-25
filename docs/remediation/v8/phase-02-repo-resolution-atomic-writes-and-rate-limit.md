# Fase 02 — Resolução Canônica de Repositórios com Owner, Escritas Atômicas e Resiliência em Rate Limiting

**Resolve:** Achados **BUG-02** (Falha de resolução de arquivos de organizações em ferramentas nativas de IA), **SEC-04** (Risco de corrupção de estado por escrita não-atômica) e **SEC-03** (Rate limiting suscetível a colisões e ausência de `trustProxy`).  
**Prioridade:** P1.  
**Esforço:** Médio.  
**Arquivos Principais:**
- `server/src/modules/ai/tools/native-tools.ts`
- `server/src/modules/governance/governance.service.ts`
- `server/src/modules/prs/prs.service.ts`
- `server/src/modules/workspace/docs-metadata.service.ts`
- `server/src/security/rate-limit.ts`
- `server/src/app.ts`

---

## 1. Contexto e Diagnóstico

### 1.1 Resolução Quebrada em `native-tools.ts` para Repositórios Organizacionais (BUG-02)
Em `server/src/modules/ai/tools/native-tools.ts`:
```typescript
function getSafeRepoPath(
  repoName: string,
  relativeFilePath: string,
): string | null {
  const safeRepo = repoName.replace(/[^a-zA-Z0-9_-]/g, "") || "local";
  const repoDir = path.resolve(PROJECTS_DIR, safeRepo);
  const targetPath = path.resolve(
    repoDir,
    relativeFilePath.replace(/^\/+/, ""),
  );
  if (!isPathInside(repoDir, targetPath)) {
    return null;
  }
  return targetPath;
}
```
**Problema:** O padrão canônico do Context OS armazena repositórios clonados de organizações em `projects/<owner>/<repo>`. Ao substituir todas as barras por string vazia via regex (`[^a-zA-Z0-9_-]`), um `repoName` como `"minha-org/meu-repo"` vira `"projects/minha-orgmeu-repo"`. Como essa pasta não existe, todas as ferramentas nativas de IA (`docs_propose_diff`, `fs_read_file`, `docs_get_graph`, etc.) falham com erro de arquivo não encontrado ou acesso negado.

### 1.2 Gravação Direta Sem Proteção Atômica (SEC-04)
Em `governance.service.ts` (linha 69), `prs.service.ts` (linha 153) e `docs-metadata.service.ts` (linha 500), arquivos centrais como `.project.config.json` e `.spec-memory/prs.json` são salvos através de `fs.writeFileSync(p, JSON.stringify(...))`.
**Problema:** O método `fs.writeFileSync` trunca o arquivo antes de gravar os novos bytes. Se ocorrer uma falha súbita de processo (SIGKILL, reinicialização ou crash por falta de memória), o arquivo fica permanentemente truncado para 0 bytes, corrompendo a governança do repositório.

### 1.3 Limitação de Taxa Baseada em IP Único e Falta de `trustProxy` (SEC-03)
Em `server/src/app.ts`, a taxa de requisições sensíveis (IA, autenticação, Git) é avaliada usando apenas `request.ip || '127.0.0.1'`.
**Problema:** Em ambientes locais com múltiplas abas abertas ou ao rodar atrás de proxies reversos/Docker (onde `trustProxy` não está habilitado no Fastify), todos os clientes colidem na mesma cota, resultando em respostas 429 indevidas.

---

## 2. Passos de Execução

### 2.1 Uso de `resolveRepoDir` Canônico em `native-tools.ts`
1. Em `native-tools.ts`, refatorar `getSafeRepoPath` para reutilizar o utilitário canônico [resolveRepoDir](file:///Users/MarcosBaiadori/Desktop/project-boilerplate/server/src/config/constants.ts#L95) e [resolveSafeRepoPath](file:///Users/MarcosBaiadori/Desktop/project-boilerplate/server/src/utils/repo-ref.ts#L276):
   ```typescript
   import { resolveRepoDir } from "../../../config/constants.js";
   import { resolveSafeRepoPath } from "../../../utils/repo-ref.js";

   function getSafeRepoPath(
     repoName: string,
     relativeFilePath: string,
   ): string | null {
     try {
       const repoDir = resolveRepoDir(repoName);
       return resolveSafeRepoPath(repoDir, relativeFilePath);
     } catch {
       return null;
     }
   }
   ```

### 2.2 Substituição de `fs.writeFileSync` por `writeJsonAtomic`
1. Em `governance.service.ts`, `prs.service.ts` e `docs-metadata.service.ts`, importar `writeJsonAtomic` de `server/src/utils/atomic-write.js`.
2. Substituir todas as chamadas de salvamento de arquivos de configuração e estado estruturado por `writeJsonAtomic(p, data, 2)`.

### 2.3 Resiliência de Rate Limiting e Configuração de `trustProxy`
1. Em `server/src/app.ts`, habilitar `trustProxy` se `process.env.BEHIND_PROXY === "true"` ou `process.env.NODE_ENV === "production"`.
2. Para rotas de streaming e IA (`/api/chat/stream` e `/api/chat`), usar chave composta baseada no IP e no Session ID do usuário quando disponível:
   ```typescript
   const sessionKey = (request.headers['x-session-id'] as string) || (request.query as any)?.session_id;
   const rateLimitKey = sessionKey ? `${clientIp}:${sessionKey}` : clientIp;
   ```

---

## 3. Critérios de Aceite e Verificação

1. **Testes TDD RED:**
   - Criar teste automatizado em `server/src/modules/ai/tools/native-tools.test.ts` verificando que `getSafeRepoPath` resolve com sucesso caminhos para repositórios com owner (`"org-test/repo-test"`).
   - Validar que simulações de interrupção não deixam arquivos vazios em `.project.config.json`.
2. **Validação:** `npm test` no servidor passando com 100% de sucesso.
