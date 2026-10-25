# Fase 1 — Inicialização do Desktop, Polling Rápido e Alinhamento de Sessão (SEC-02, SEC-03, SEC-05)

**Objetivo:** Eliminar o atraso de 9 segundos na inicialização do Electron, corrigir a rota de verificação de prontidão do servidor e estruturar o repasse seguro de tokens de sessão e variáveis de ambiente em modo desktop e agentes.  
**Resolve:** SEC-02 (Timeout de polling no boot do Electron), SEC-03 (Bloqueio de bootstrap no Desktop), SEC-05 (Privilégios e vazamento de env em adaptadores de IA).  
**Prioridade:** P0.  
**Esforço:** Pequeno.  
**Arquivos Principais:**
- `desktop/src/main/index.ts`
- `desktop/src/preload/index.ts`
- `server/src/app.ts`
- `frontend/src/services/api/client.ts`
- `server/src/modules/ai/providers/AntigravityAdapter.ts`
- `desktop/test/desktop-boot.test.ts` (ou teste de integração)

---

## Contexto e Diagnóstico

1. **Atraso de 9s no Electron (SEC-02):** Em `desktop/src/main/index.ts` L99, o loop de prontidão aguardava resposta positiva de `fetch('http://localhost:${port}/api/status')`. Porém, a rota `/api/status` é protegida e exige autenticação de sessão. Sem token, o Fastify respondia `401 Unauthorized`, fazendo `res.ok` ser sempre `false`. O Electron realizava 30 iterações com delay de 300ms, totalizando 9 segundos de congelamento desnecessário antes de abrir a janela principal. A rota correta, pública e canônica de health check é `/api/health`.
2. **Inconsistência da Flag Desktop (SEC-03):** Em `server/src/app.ts` L231, se `process.env.CONTEXT_OS_DESKTOP === "1"`, a rota `/api/session/bootstrap` responde `403`. Porém, o `desktopBridge` no preload do Electron não possuía nenhum método IPC para entregar o token de sessão local para a SPA, deixando o frontend sem autenticação caso a flag fosse utilizada.
3. **Vazamento de Variáveis de Ambiente (SEC-05):** `AntigravityAdapter.ts` executava `spawn` com `{ env: { ...process.env } }`, repassando todas as chaves privadas e tokens de ambiente do sistema para a ferramenta CLI do agente.

---

## Passos de Execução

### 1.1 RED — Teste de Rota Pública e Handshake
Validar que a rota consultada pelo Electron no boot responde com status 200 sem necessidade de credenciais:
- Criar teste em `server/src/security/desktop-integration.test.ts` verificando que:
  - `GET /api/health` retorna `200 OK` com `{ status: "ok" }` sem cabeçalhos de autenticação.
  - `GET /api/status` retorna `401 Unauthorized` na ausência de token (comprovando que não deve ser usado como health check anônimo).

---

### 1.2 Correção do Polling no Electron (`desktop/src/main/index.ts`)
Substituir a chamada de polling de `/api/status` para `/api/health`:
```typescript
// desktop/src/main/index.ts
console.log(`[Desktop Main] Aguardando inicialização do servidor HTTP na porta ${port}...`);
for (let attempt = 1; attempt <= 30; attempt++) {
  try {
    const res = await fetch(`http://localhost:${port}/api/health`);
    if (res.ok) {
      console.log(`[Desktop Main] Servidor Fastify pronto e respondendo na porta ${port}!`);
      return port;
    }
  } catch {
    // Servidor ainda iniciando
  }
  await new Promise((r) => setTimeout(r, 200));
}
```

---

### 1.3 Alinhamento de Token no Preload do Electron
1. Em `desktop/src/main/index.ts`, adicionar handler IPC seguro para fornecer o token de sessão gerado localmente em disco:
   ```typescript
   ipcMain.handle('desktop:get-session-token', async () => {
     try {
       const tokenPath = path.join(userDataDir, '.context-os', 'session-token');
       if (fs.existsSync(tokenPath)) {
         return fs.readFileSync(tokenPath, 'utf-8').trim();
       }
     } catch {}
     return null;
   });
   ```
2. Em `desktop/src/preload/index.ts`, expor o método no `desktopBridge`:
   ```typescript
   contextBridge.exposeInMainWorld('desktopBridge', {
     isDesktop: true,
     platform: process.platform,
     getSessionToken: () => ipcRenderer.invoke('desktop:get-session-token'),
     encrypt: (plainText: string) => ipcRenderer.invoke('secure-store:encrypt', plainText),
     decrypt: (encryptedBase64: string) => ipcRenderer.invoke('secure-store:decrypt', encryptedBase64),
   });
   ```
3. Em `frontend/src/services/api/client.ts`, caso esteja em ambiente Desktop (`window.desktopBridge?.isDesktop`), tentar obter o token diretamente via `desktopBridge.getSessionToken()` antes de recorrer ao fallback de rede.

---

### 1.4 Sanitização de Ambiente no `AntigravityAdapter.ts`
Em `server/src/modules/ai/providers/AntigravityAdapter.ts`, restringir as variáveis de ambiente repassadas para o subprocesso CLI do agente:
```typescript
const safeEnv: NodeJS.ProcessEnv = {
  PATH: process.env.PATH || '',
  HOME: process.env.HOME || '',
  USER: process.env.USER || '',
  LANG: process.env.LANG || 'en_US.UTF-8',
  PAGER: 'cat',
  FORCE_COLOR: '0',
  CONTEXT_OS_PROJECT_ROOT: targetCwd,
};

// Não repassa tokens globais (GITHUB_TOKEN, GEMINI_API_KEY) no ambiente se o agente não precisar
const child = spawn(cli.command, spawnArgs, {
  cwd: targetCwd,
  env: safeEnv,
});
```

---

## Gate de Saída

- [ ] Polling do Desktop responde em menos de 1 segundo em ambiente local (`/api/health` retorna `status: "ok"`).
- [ ] Build do Desktop (`npm --prefix desktop run build:ts`) compila sem erros de tipagem.
- [ ] `AntigravityAdapter` não vaza variáveis de ambiente não-operacionais para processos filhos.
- [ ] Pipeline geral `npm run verify` verde.
