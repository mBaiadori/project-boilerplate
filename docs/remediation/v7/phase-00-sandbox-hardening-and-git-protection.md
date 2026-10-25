# Fase 00 — Blindagem de Sandbox e Proteção contra Manipulação de `.git`

**Resolve:** Achado **S1** (Severidade Crítica).  
**Prioridade:** P0.  
**Esforço:** Médio.  
**Arquivos Principais:**
- `server/src/modules/skills/script-runner.ts`
- `server/src/modules/skills/custom-tools.escape.test.ts`

---

## 1. Contexto e Diagnóstico

### 1.1 Escape de Realm via Funções do Host (S1.1)
No arquivo `server/src/modules/skills/script-runner.ts`, o script do subprocesso runner monta o objeto `safeUtils` diretamente no escopo do runner:
```javascript
const safeUtils = Object.freeze({
  JSON: intrinsic.JSON,
  Math: intrinsic.Math,
  Date: intrinsic.Date,
  toBase64: (str) => Buffer.from(String(str || ''), 'utf-8').toString('base64'),
  fromBase64: (b64) => Buffer.from(String(b64 || ''), 'base64').toString('utf-8'),
  readProjectFile: (relPath) => { ... },
  writeProjectFile: (relPath, content) => { ... },
  listProjectFiles: (relDir = '') => { ... },
});
sandbox.utils = safeUtils;
```
Como essas funções anônimas foram criadas no Realm do processo runner (host do VM), qualquer código executado dentro da sandbox pode acessar o construtor da função e escapar do VM:
```javascript
const P = utils.toBase64.constructor('return process')();
const http = P.getBuiltinModule('node:http'); // Bypass de rede! Acesso a sockets internos
```

### 1.2 Gravação Arbitrária em Pastas Sensíveis `.git/` e `.tools/` (S1.2)
A função `assertSafeRepoPath` valida apenas se o caminho canônico do arquivo está dentro de `safeRepoDir`. Ela **não restringe a escrita em subdiretórios sensíveis do repositório**, permitindo que scripts criem ou sobrescrevam:
- `.git/config` (ex: definindo `core.fsmonitor` ou `diff.external` maliciosos);
- `.git/hooks/*` (ex: `pre-commit`, `post-checkout`, `post-merge`);
- `.tools/tools.manifest.json` (tentativas de autoaprovação de manifestos).

---

## 2. Passos de Execução

### 2.1 Desacoplamento de Protótipos e Bloqueio de Construtor
1. No script runner injetado em `script-runner.ts`:
   - Todas as funções expostas para a sandbox devem ter seu protótipo explicitamente anulado (`Object.setPrototypeOf(fn, null)`).
   - O construtor dessas funções deve ser sobrescrito ou redefinido para lançar erro fatal caso invocado.
   - Alternativamente e de forma hermética, instanciar as funções de ponte dentro do próprio `scriptContext` usando `vm.runInContext`.

### 2.2 Bloqueio Rigoroso de Pastas Internas em `assertSafeRepoPath`
1. Proibir explicitamente que qualquer operação de leitura, listagem ou escrita acerte arquivos cujo caminho relativo comece com `.git` ou `.tools`:
   ```javascript
   function assertSafeRepoPath(full) {
     const rel = path.relative(safeRepoDir, full).replace(/\\/g, '/');
     if (!isPathInside(safeRepoDir, full) && full !== safeRepoDir) {
       throw new Error('Acesso negado: fora do diretório do projeto.');
     }
     const segments = rel.split('/');
     if (segments.includes('.git') || segments.includes('.tools')) {
       throw new Error('Acesso negado: manipulação de pastas de infraestrutura interna (.git / .tools) é estritamente proibida.');
     }
     // Validação de symlinks ancestrais
     ...
   }
   ```

### 2.3 Hardening do Subprocesso Runner
1. Adicionar argumento `--disallow-code-generation-from-strings` na chamada do `execFileAsync` para o subprocesso do Node, impossibilitando construções `Function(...)` no processo runner.

---

## 3. Critérios de Aceite e Verificação

1. **Teste TDD RED:** Criar suíte de testes em `custom-tools.escape.test.ts` comprovando que:
   - Tentativas de recuperar `process` via construtores de `utils` falham com erro.
   - Tentativas de escrever em `.git/config` ou `.git/hooks/pre-commit` via `writeProjectFile` são rejeitadas com erro de acesso negado.
2. **Teste TDD GREEN:** Todos os testes passam sem exceção.
3. `npm test` no servidor passa 100%.
