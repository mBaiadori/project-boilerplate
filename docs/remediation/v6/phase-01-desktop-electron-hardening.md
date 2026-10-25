# Fase 01 — Endurecimento do Desktop Electron e Atualização de Dependências (A2, M1, M3)

**Objetivo:** Eliminar vulnerabilidades conhecidas em dependências do Electron, integrar a auditoria do desktop no CI, garantir que o armazenamento seguro falhe fechado (sem degradação para Base64 não criptografado), validar os remetentes de chamadas IPC e restringir a navegação in-window da aplicação.  
**Resolve:** Achados **A2** (Severidade Alta), **M1** (Severidade Média) e **M3** (Severidade Média).  
**Prioridade:** P0 / P1.  
**Esforço:** Médio.  
**Arquivos Principais:**
- `desktop/package.json`
- `desktop/src/main/index.ts`
- `.github/workflows/ci.yml`
- `desktop/src/main/desktop-security.test.ts` (Novo)

---

## 1. Contexto e Diagnóstico

### 1.1 Dependências Vulneráveis e Furo no CI (A2)
A execução de `npm audit` no diretório `desktop` acusa vulnerabilidades de severidade **High**:
- `electron`: Múltiplas vulnerabilidades de execução de código e isolamento herdadas de versões antigas do Chromium.
- `builder-util-runtime` e `electron-updater`: Vazamento de credenciais (`PRIVATE-TOKEN` e cabeçalhos de autorização) em redirecionamentos cross-origin.
- `app-builder-lib`: Pesquisa descontrolada de caminhos em empacotamentos `AppImage`.
Além disso, o arquivo `.github/workflows/ci.yml` possui um job `audit` que verifica apenas `server` e `frontend`, permitindo que vulnerabilidades no desktop passem despercebidas na integração contínua.

### 1.2 Degradação Silenciosa para Base64 (M1)
No arquivo `desktop/src/main/index.ts`:
```typescript
ipcMain.handle('secure-store:encrypt', async (_event, plainText: string) => {
  if (safeStorage.isEncryptionAvailable()) {
    const buffer = safeStorage.encryptString(plainText);
    return buffer.toString('base64');
  }
  return Buffer.from(plainText, 'utf-8').toString('base64'); // FALHA SILENCIOSA!
});
```
Se a chave do sistema operacional (Keychain no macOS, DPAPI no Windows, SecretService no Linux) estiver indisponível ou bloqueada, a aplicação finge criptografar usando Base64 simples (que é apenas codificação pública de texto), gerando uma falsa sensação de segurança.

### 1.3 Ausência de Proteção contra Navegação In-Window (M3)
Atualmente, apenas `setWindowOpenHandler` está configurado para links que abrem novas abas/janelas (`target="_blank"`). Caso uma tag `<a>` interna ou resposta de markdown acione uma navegação direta na própria janela, o Electron pode navegar para sites de terceiros dentro do mesmo contexto de janela.

---

## 2. Passos de Execução

### 2.1 Atualização de Dependências em `desktop/package.json`
1. Atualizar o `electron` para versão patched estável compatível (>= 34.x / versão LTS recomendada).
2. Atualizar `electron-builder` e suas bibliotecas de runtime (`builder-util-runtime`, `app-builder-lib`) para as versões que corrigem os advisories de segurança.
3. Executar `cd desktop && npm install && npm audit --omit=dev` e confirmar que retorna **0 vulnerabilidades**.

---

### 2.2 Inclusão do Desktop no CI (`.github/workflows/ci.yml`)
Expandir o job de auditoria do CI para cobrir os três pacotes do repositório:

```yaml
  audit:
    name: Dependency Audit (Blocking)
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Audit Server
        run: cd server && npm audit --audit-level=high --omit=dev
      - name: Audit Frontend
        run: cd frontend && npm audit --audit-level=high --omit=dev
      - name: Audit Desktop
        run: cd desktop && npm audit --audit-level=high --omit=dev
```

---

### 2.3 Endurecimento de IPC e `safeStorage` em `desktop/src/main/index.ts`

1. **Validação de Remetente (IPC Sender Frame):**
   Garantir que chamadas de IPC aceitem apenas requisições originadas do frame principal do aplicativo, prevenindo requisições de subframes ou janelas não autorizadas:
   ```typescript
   function validateIpcSender(event: Electron.IpcMainInvokeEvent): void {
     const senderUrl = event.senderFrame?.url || '';
     const allowedOrigins = [
       `http://localhost:${activeServerPort}`,
       'http://localhost:5173',
       'app://',
     ];
     const isAllowed = allowedOrigins.some((origin) => senderUrl.startsWith(origin));
     if (!isAllowed) {
       throw new Error(`Acesso IPC não autorizado originado de: '${senderUrl}'`);
     }
   }
   ```

2. **Criptografia Fail-Closed:**
   Eliminar o fallback para Base64. Se o armazenamento seguro nativo não estiver disponível, lançar um erro explícito para que a interface informe o usuário em vez de salvar segredos descriptografados:
   ```typescript
   ipcMain.handle('secure-store:encrypt', async (event, plainText: string) => {
     validateIpcSender(event);
     if (!safeStorage.isEncryptionAvailable()) {
       throw new Error('Armazenamento seguro não disponível no sistema operacional (safeStorage indisponível).');
     }
     const buffer = safeStorage.encryptString(plainText);
     return buffer.toString('base64');
   });

   ipcMain.handle('secure-store:decrypt', async (event, encryptedBase64: string) => {
     validateIpcSender(event);
     if (!safeStorage.isEncryptionAvailable()) {
       throw new Error('Armazenamento seguro não disponível no sistema operacional (safeStorage indisponível).');
     }
     const buffer = Buffer.from(encryptedBase64, 'base64');
     return safeStorage.decryptString(buffer);
   });
   ```

3. **Restrição Estrita de Navegação In-Window:**
   Em `createMainWindow`:
   ```typescript
   mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
     const parsed = new URL(navigationUrl);
     const isLocal =
       (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') &&
       (parsed.port === String(activeServerPort) || parsed.port === '5173');

     if (!isLocal) {
       event.preventDefault();
       shell.openExternal(navigationUrl);
     }
   });

   mainWindow.webContents.on('will-redirect', (event, navigationUrl) => {
     const parsed = new URL(navigationUrl);
     const isLocal =
       (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') &&
       (parsed.port === String(activeServerPort) || parsed.port === '5173');

     if (!isLocal) {
       event.preventDefault();
       shell.openExternal(navigationUrl);
     }
   });
   ```

---

## 3. Gate de Saída

- [ ] `cd desktop && npm audit --omit=dev` com 0 vulnerabilidades.
- [ ] Job de auditoria do CI atualizado cobrindo `desktop`.
- [ ] Criptografia nativa em `desktop/src/main/index.ts` falha fechada com exceção quando o `safeStorage` não está disponível.
- [ ] Navegações in-window para URLs remotas são interceptadas e transferidas ao navegador do sistema via `shell.openExternal`.
- [ ] `npm run verify` executando com sucesso.
