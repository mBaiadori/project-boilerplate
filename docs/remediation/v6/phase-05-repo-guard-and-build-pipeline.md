# Fase 05 — Hook Centralizado de Repositório e Pipeline de Build Limpo (M9, B6)

**Objetivo:** Eliminar o risco de path traversal em novas rotas através de um hook centralizado de validação do parâmetro `repo` e garantir a higienização do ciclo de compilação/empacotamento com etapas explícitas de limpeza (`clean`) para prevenir a distribuição de artefatos desatualizados.  
**Resolve:** Achados **M9** (Severidade Média) e **B6** (Severidade Baixa / Prevenção Estrutural).  
**Prioridade:** P2.  
**Esforço:** Médio.  
**Arquivos Principais:**
- `server/src/app.ts`
- `server/src/utils/repo-ref.ts`
- `server/src/utils/repo-guard.test.ts` (Novo)
- `server/package.json`
- `package.json`
- `desktop/package.json`
- `scripts/verify.sh`

---

## 1. Contexto e Diagnóstico

### 1.1 Fragmentação da Validação de `repo` (B6)
Atualmente, dezenas de rotas aceitam o parâmetro `repo` via query string ou corpo da requisição (ex: `query.repo || body.repo`).  
Embora o utilitário `validateRepoName` e o helper `resolveSafeRepoPath` existam em `repo-ref.ts`, a chamada a essas funções depende da disciplina individual de cada desenvolvedor ao criar uma nova rota em `modules/*/routes.ts`. Se um novo endpoint omitir a validação, vetores de escape como `../../` ou nomes contendo caracteres de controle podem ser aceitos silenciosamente.

### 1.2 Risco de Empacotamento de Artefatos Órfãos/Desatualizados (M9)
Durante a auditoria técnica, constatou-se que o arquivo de bundle compilado `server/dist/server.prod.cjs` e outros binários gerados em `desktop/release` não passavam por uma limpeza determinística antes das etapas de compilação.  
Se um arquivo for renomeado, removido ou modificado sem a limpeza prévia do diretório `dist`, o bundle de produção do Desktop pode embutir versões defasadas do backend que não contêm as correções de segurança mais recentes.

---

## 2. Passos de Execução

### 2.1 RED — Testes Unitários do Hook Centralizado (`repo-guard.test.ts`)
Criar `server/src/utils/repo-guard.test.ts`:
- **Teste 1:** Qualquer requisição para endpoint sob `/api/` contendo `?repo=../../etc` deve ser rejeitada com HTTP 400 antes de chegar ao handler.
- **Teste 2:** Qualquer requisição POST/PUT com payload JSON contendo `{ "repo": "../malicious" }` deve ser rejeitada com HTTP 400.
- **Teste 3:** Requisições com nomes válidos de repositório (ex: `meu-repo`, `enursy-gov`, `org_projeto-1`) devem passar normalmente.
- **Teste 4:** Nomes com caracteres nulos (`\0`) ou caracteres de controle do sistema devem ser bloqueados sumariamente.

**Comando RED:**
```bash
cd server && npx tsx --test src/utils/repo-guard.test.ts
```

---

### 2.2 Implementação do Hook `preValidation` em `app.ts`
Adicionar um hook global do Fastify no ciclo de vida da requisição para todos os endpoints sob `/api/`:

```typescript
app.addHook("preValidation", async (request, reply) => {
  const url = request.raw.url || "";
  if (!url.startsWith("/api/")) return;

  // 1. Extração do parâmetro repo de query string
  const query = request.query as Record<string, any> | undefined;
  if (query && typeof query.repo === 'string' && query.repo.trim()) {
    try {
      validateRepoName(query.repo.trim());
    } catch (err: any) {
      return reply.status(400).send({
        error: `Parâmetro de repositório inválido: ${err.message}`,
        code: 'INVALID_REPO_NAME',
      });
    }
  }

  // 2. Extração do parâmetro repo do corpo JSON
  const body = request.body as Record<string, any> | undefined;
  if (body && typeof body.repo === 'string' && body.repo.trim()) {
    try {
      validateRepoName(body.repo.trim());
    } catch (err: any) {
      return reply.status(400).send({
        error: `Parâmetro de repositório inválido no corpo da requisição: ${err.message}`,
        code: 'INVALID_REPO_NAME',
      });
    }
  }
});
```

---

### 2.3 Padronização de Scripts de Limpeza (`clean`)

1. **Em `server/package.json`:**
   Adicionar script `clean`:
   ```json
   "clean": "node -e \"fs.rmSync('dist', { recursive: true, force: true })\"",
   "build": "npm run clean && tsc && node ../scripts/copy-schemas.mjs"
   ```

2. **Em `desktop/package.json`:**
   Adicionar script `clean`:
   ```json
   "clean": "node -e \"fs.rmSync('dist', { recursive: true, force: true }); fs.rmSync('release', { recursive: true, force: true })\"",
   "build": "npm run clean && npm run build:ts"
   ```

3. **No root `package.json`:**
   Garantir que os comandos de empacotamento invoquem as etapas de compilação limpa em ordem estrita:
   ```json
   "clean": "npm --prefix server run clean && npm --prefix frontend run clean && npm --prefix desktop run clean",
   "desktop:package:mac": "npm run build && npm --prefix desktop run clean && npm --prefix desktop run build:ts && npm --prefix desktop run compile:bytecode && npm --prefix desktop run package:mac"
   ```

---

## 3. Gate de Saída

- [ ] `repo-guard.test.ts` passando com 100% de sucesso.
- [ ] Bloqueio centralizado de injeções de diretório em `repo` sem quebrar endpoints legítimos.
- [ ] Scripts `npm run clean` e `npm run build` executando sem falhas em todos os submódulos.
- [ ] `npm run verify` executando com sucesso.
