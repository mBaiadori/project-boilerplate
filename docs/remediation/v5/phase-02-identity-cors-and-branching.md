# Fase 2 — Identidade Dinâmica, CORS para Dev1 e Branch Padrão (C14, B5, B6)

**Objetivo:** Eliminar dados de usuário hardcoded em PRs, liberar o bootstrap de sessão para instâncias concorrentes de desenvolvimento (`npm run dev1`) e corrigir a detecção de branch padrão do Git para evitar corrupção por ordenação alfabética.  
**Resolve:** C14 (Identidade `'marcosbaiadori'` hardcoded), B5 (CORS 403 no `dev1`), B6 (Seleção alfabética indevida de branch em `getDefaultBranch`).  
**Prioridade:** P1.  
**Esforço:** Pequeno.  
**Arquivos Principais:**
- `server/src/app.ts`
- `server/src/modules/prs/prs.service.ts`
- `server/src/modules/prs/pr-conflicts.service.ts`
- `server/src/modules/prs/pr-security.service.ts`
- `server/src/modules/prs/prs.routes.ts`
- `server/src/utils/git-queries.ts`
- `server/src/modules/repos/default-branch.test.ts`
- `server/src/security/app.security.test.ts`

---

## Contexto e Diagnóstico

1. **Usuário Hardcoded (C14):** Em 10 pontos do módulo de Propostas de Alteração (`prs`), o código utilizava `const login = userLogin || cfg.user?.login || 'marcosbaiadori';`. Isso viola a diretriz de "Zero Hardcoded Data & Configuração Dinâmica", herdando permissões e autoria indevida para qualquer novo usuário local.
2. **Rejeição de CORS no Dev1 (B5):** O script `npm run dev1` roda o frontend na porta 5174. Em `app.ts` L247, a condição `isViteDev` aceitava apenas portas `5173` ou `4100`. Qualquer requisição feita por `localhost:5174` era rejeitada com 403 no bootstrap de sessão.
3. **Branch Padrão Alfabética (B6):** Em `git-queries.ts` L62, ao consultar `for-each-ref refs/heads`, se `main` e `master` não fossem encontrados, a função retornava `branches[0]`. Como o Git ordena alfabeticamente, branches como `feat/`, `fix/` ou `gov/` vinham antes e eram gravadas no `config.json` como o `default_branch` do projeto (como registrado com `"gov/update-2675"`).

---

## Passos de Execução

### 2.1 RED — Testes Unitários de CORS e Identidade
1. Em `server/src/security/app.security.test.ts`, adicionar teste simulando requisição com `Origin: http://localhost:5174` para `/api/session/bootstrap`: deve responder `200 OK` (antes respondia `403`).
2. Em `server/src/modules/repos/default-branch.test.ts`, criar cenário de teste onde um repositório Git local possui branches `gov/update-1` e `develop` (sem `main` nem `master` criadas ainda): o sistema não deve eleger cegamente a branch de menor ordem alfabética se houver um HEAD apontando para outra referência.
3. Testar `resolveDocClearance` sem usuário logado: deve lançar erro ou avaliar como usuário anônimo neutro (`'local_user'`), sem conceder clearance de `'marcosbaiadori'`.

---

### 2.2 Suporte a Portas Dinâmicas de Desenvolvimento (`server/src/app.ts`)
Atualizar a verificação `isViteDev` na rota `/api/session/bootstrap` para autorizar a faixa comum de servidores locais de desenvolvimento (5173 a 5180 e 4100 a 4110):
```typescript
// server/src/app.ts
const portNum = parseInt(parsed.port || '80', 10);
const isLocalhostHost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
const isViteDev = isLocalhostHost && ((portNum >= 5173 && portNum <= 5185) || (portNum >= 4100 && portNum <= 4110));
```

---

### 2.3 Eliminação dos 10 Fallbacks Hardcoded de Usuário
Substituir todas as ocorrências de `'marcosbaiadori'` no módulo `prs`:
- [pr-conflicts.service.ts](file:///Users/MarcosBaiadori/Desktop/project-boilerplate/server/src/modules/prs/pr-conflicts.service.ts#L101,L148,L177)
- [pr-security.service.ts](file:///Users/MarcosBaiadori/Desktop/project-boilerplate/server/src/modules/prs/pr-security.service.ts#L42)
- [prs.service.ts](file:///Users/MarcosBaiadori/Desktop/project-boilerplate/server/src/modules/prs/prs.service.ts#L148,L464,L518,L1310)
- [prs.routes.ts](file:///Users/MarcosBaiadori/Desktop/project-boilerplate/server/src/modules/prs/prs.routes.ts#L104,L131)

Substituição padronizada:
```typescript
const login = userLogin || cfg.user?.login || 'local_user';
```
Se a operação exigir permissão real de aprovação ou escrita remota no GitHub, lançar exceção explícita se o usuário for `'local_user'` e não estiver autenticado.

---

### 2.4 Resolução Determinística de `getDefaultBranch`
Em `server/src/utils/git-queries.ts`:
1. Verificar `symbolic-ref refs/remotes/origin/HEAD`.
2. Verificar se existe `main` ou `master` em `refs/heads` ou `refs/remotes/origin/`.
3. Consultar `git symbolic-ref --short HEAD` no repositório local.
4. Se nenhuma das opções acima identificar um branch principal claro, retornar `"main"` canônico como convenção neutra, nunca o primeiro item de ordenação alfabética arbitrária.

---

## Gate de Saída

- [ ] Requisição com `Origin: http://localhost:5174` aprovada com 200 no bootstrap de sessão.
- [ ] Nenhuma ocorrência de `'marcosbaiadori'` restante no código fonte de `server/src/` (exceto em testes de fixture explicitamente documentados).
- [ ] Repositório sem branch `main` não corrompe `default_branch` com prefixos `fix/` ou `gov/`.
- [ ] `npm test` do servidor verde em < 5 segundos.
