# Fase 0 — Contenção Estrita de Path Traversal e Sanitização Canônica (SEC-01, C15)

**Objetivo:** Impedir expressamente leitura, gravação, renomeação ou exclusão arbitrária de arquivos fora dos diretórios permitidos de repositório, wiki, traduções e worktrees.  
**Resolve:** SEC-01 (Path Traversal), C15 (Alocação indevida de worktrees).  
**Prioridade:** P0.  
**Esforço:** Médio.  
**Arquivos Principais:**
- `server/src/utils/repo-ref.ts`
- `server/src/modules/workspace/workspace.service.ts`
- `server/src/modules/wiki/wiki.service.ts`
- `server/src/modules/translations/translations.service.ts`
- `server/src/modules/prs/pr-worktree.service.ts`
- `server/src/utils/path-traversal.security.test.ts` (Novo)

---

## Contexto e Vulnerabilidade

Na revisão v5 foi comprovado que diversos serviços essenciais apenas executavam `filePath.trim().replace(/^\/+/, '')` e faziam `path.join(repoDir, cleanPath)` sem validar `isPathInside(repoDir, fullPath)`:
1. `WorkspaceService.getFile` e `getRawFile`: Leitura arbitrária com `path=../../../../etc/passwd`.
2. `WorkspaceService.saveFile`: Escrita arbitrária fora do repositório.
3. `WorkspaceService.deleteFile`: Exclusão arbitrária de arquivos e exclusão recursiva (`fs.rmSync(fullPath, { recursive: true })`) de diretórios arbitrários do sistema operacional.
4. `WikiService.saveWikiPage`, `getWikiPage`, `deleteWikiPage`: O parâmetro `category` era concatenado diretamente via `path.join(rootDir, category)` sem validação de `..`, permitindo ler, gravar e apagar notas fora de `.spec-memory/wiki/`.
5. `TranslationsService.saveTranslation` e `deleteTranslation`: Não validavam se `relPath` ou `lang` continham `..`.
6. `PRWorktreeService`: Alocava worktrees dentro de `.git/context-pr-worktrees` (contra recomendação oficial do Git) e não validava `writePlainAtWorktree`.

---

## Passos de Execução

### 0.1 RED — Testes Unitários de Segurança (`path-traversal.security.test.ts`)
Criar uma suíte dedicada em `server/src/utils/path-traversal.security.test.ts` que simula requisições com vetores de Path Traversal e confirma que todas falham com erro antes da correção:
- Leitura em `workspaceService.getFile('../../../../etc/passwd')` deve lançar `AppError` 403 (ou erro com mensagem de caminho fora dos limites).
- Leitura em `workspaceService.getRawFile('../../../../etc/passwd')` deve lançar erro de caminho restrito.
- Escrita em `workspaceService.saveFile('../evil.txt', 'conteudo')` deve ser bloqueada.
- Exclusão em `workspaceService.deleteFile('../evil.txt')` deve ser bloqueada e não alterar o arquivo externo.
- Salvar nota no wiki com `wikiService.saveWikiPage('../../root-note', 'slug', 'titulo', 'conteudo')` deve ser bloqueado.
- Deletar nota no wiki com categoria maliciosa `wikiService.deleteWikiPage('../../root-note', 'slug')` deve ser bloqueado.
- Salvar tradução com `translationsService.saveTranslation(repo, 'pt-BR', '../../evil.md', 'corpo')` deve ser bloqueado.
- Escrita em worktree com `prWorktreeService.writePlainAtWorktree(wtDir, '../../evil.txt', 'pwned')` deve ser bloqueada.

**Comando de validação RED:**
```bash
cd server && npx tsx --test src/utils/path-traversal.security.test.ts
```

---

### 0.2 Implementação do Helper Canônico em `repo-ref.ts`
Em `server/src/utils/repo-ref.ts`, adicionar e exportar a função canônica:
```typescript
/**
 * Resolve e valida rigorosamente que o caminho resultante está contido dentro do diretório raiz autorizado,
 * prevenindo escapes por '..', caminhos absolutos forçados e symlinks maliciosos.
 */
export function resolveSafeRepoPath(baseDir: string, userPath: string): string {
  if (!userPath || typeof userPath !== 'string') {
    throw new Error('Caminho inválido ou não informado.');
  }

  // Remove caracteres nulos e normaliza separadores
  const sanitized = userPath.replace(/\0/g, '').trim().replace(/^\/+/, '');
  const resolved = path.resolve(baseDir, sanitized);

  if (!isPathInside(baseDir, resolved) && resolved !== baseDir) {
    throw new Error(`Acesso negado: o caminho '${sanitized}' está fora do diretório permitido.`);
  }

  return resolved;
}
```

---

### 0.3 Proteção dos Métodos em `workspace.service.ts`
Atualizar os métodos para resolver caminhos estritamente através de `resolveSafeRepoPath`:
- `getFile(filePath, targetRepoName)`:
  ```typescript
  const repoDir = this.getRepoDir(repoName);
  const fullPath = resolveSafeRepoPath(repoDir, filePath);
  ```
- `getRawFile(filePath, targetRepoName)`:
  ```typescript
  const repoDir = this.getRepoDir(repoName);
  const fullPath = resolveSafeRepoPath(repoDir, filePath);
  ```
- `saveFile(filePath, content, meta, targetRepoName)`:
  ```typescript
  const repoDir = this.getRepoDir(repoName);
  const fullPath = resolveSafeRepoPath(repoDir, filePath);
  ```
- `deleteFile(filePath, targetRepoName)`:
  ```typescript
  const repoDir = this.getRepoDir(repoName);
  const fullPath = resolveSafeRepoPath(repoDir, filePath);
  ```
- `duplicateFile` e `renameFile`: validar tanto a origem quanto o destino.

---

### 0.4 Proteção de `wiki.service.ts`
1. Sanitizar expressamente a categoria para aceitar apenas identificadores alfanuméricos, hífen e sublinhado:
   ```typescript
   const cleanCategory = (category || 'decisions').toLowerCase().trim().replace(/[^a-z0-9_-]/g, '') || 'decisions';
   ```
2. Validar o caminho completo da categoria e do slug com `resolveSafeRepoPath(this.getWikiRootDir(repoName), ...)`.

---

### 0.5 Proteção de `translations.service.ts` e `pr-worktree.service.ts`
1. Em `translations.service.ts`, validar `mainFileFullPath` e `fullPath` através de `resolveSafeRepoPath(repoDir, ...)`.
2. Sanitizar a sigla de idioma (`lang`) com regex `/^[a-zA-Z]{2}(-[a-zA-Z0-9]+)?$/` para rejeitar qualquer injeção de caracteres de diretório.
3. Em `pr-worktree.service.ts`:
   - Validar `writePlainAtWorktree` com `resolveSafeRepoPath(wtDir, relPlainPath)`.
   - Mover a localização padrão de worktrees de `.git/context-pr-worktrees` para uma pasta de suporte segura fora de `.git` (ex: `path.join(repoDir, '.worktrees', String(prId))`).

---

## Gate de Saída

- [ ] Todos os testes em `src/utils/path-traversal.security.test.ts` passam com sucesso (GREEN).
- [ ] Nenhuma quebra de testes pré-existentes do servidor (`npm test`).
- [ ] `npm run verify` passa nos 6 estágios sem regressões.
