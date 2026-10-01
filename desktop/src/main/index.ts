import { app, BrowserWindow, shell, ipcMain, safeStorage } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import net from 'node:net';
import { fileURLToPath, pathToFileURL } from 'node:url';
import bytenode from 'bytenode';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let activeServerPort = 4100;

/**
 * Encontra uma porta TCP livre a partir de startPort
 */
async function findAvailablePort(startPort: number = 4100, maxAttempts: number = 50): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    const isFree = await new Promise<boolean>((resolve) => {
      const server = net.createServer();
      server.unref();
      server.on('error', () => resolve(false));
      server.listen({ port, host: '0.0.0.0' }, () => {
        server.close(() => resolve(true));
      });
    });
    if (isFree) return port;
  }
  return startPort;
}

/**
 * Inicializa o processo do servidor Fastify/Express embutido com suporte a Bytenode
 */
async function startEmbeddedServer(): Promise<number> {
  const isDev = !app.isPackaged;
  const userDataDir = app.getPath('userData');
  const resourcesDir = process.resourcesPath || path.resolve(__dirname, '../../..');

  // Garante diretório do usuário criado
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  // Detecta porta livre dinamicamente (resiliência contra conflito com dev server)
  const port = await findAvailablePort(4100);
  activeServerPort = port;

  process.env.CONTEXT_OS_USER_DATA = userDataDir;
  process.env.CONTEXT_OS_RESOURCES = resourcesDir;
  process.env.PORT = String(port);
  process.env.NODE_ENV = isDev ? 'development' : 'production';

  const serverJsc = isDev
    ? path.resolve(__dirname, '../../../server/dist/server.jsc')
    : path.join(process.resourcesPath, 'server/server.jsc');

  const serverProdCjs = isDev
    ? path.resolve(__dirname, '../../../server/dist/server.prod.cjs')
    : path.join(process.resourcesPath, 'server/server.prod.cjs');

  console.log(`[Desktop Main] Inicializando backend protegido na porta ${port}... (caminho: ${serverProdCjs})`);

  let started = false;

  // Carrega o bundle de produção compilado e protegido
  if (fs.existsSync(serverProdCjs)) {
    try {
      console.log(`[Desktop Main] Carregando bundle protegido: ${serverProdCjs}`);
      const { createRequire } = await import('node:module');
      const require = createRequire(import.meta.url);
      require(serverProdCjs);
      started = true;
    } catch (err: any) {
      console.error('[Desktop Main] Erro ao carregar bundle de produção:', err);
    }
  } else if (fs.existsSync(serverJsc)) {
    try {
      bytenode.runBytecodeFile(serverJsc);
      started = true;
    } catch (err: any) {
      console.warn('[Desktop Main] Erro no bytecode:', err.message);
    }
  }

  // Tentativa 3: Fallback dev JS
  if (!started) {
    const fallbackJs = path.resolve(__dirname, '../../../server/dist/server.js');
    if (fs.existsSync(fallbackJs)) {
      await import(pathToFileURL(fallbackJs).href);
    }
  }

  // Polling de verificação de prontidão do servidor Fastify (até 15 segundos)
  console.log(`[Desktop Main] Aguardando inicialização do servidor HTTP na porta ${port}...`);
  for (let attempt = 1; attempt <= 30; attempt++) {
    try {
      const res = await fetch(`http://localhost:${port}/api/status`);
      if (res.ok) {
        console.log(`[Desktop Main] Servidor Fastify pronto e respondendo na porta ${port}!`);
        return port;
      }
    } catch {
      // Servidor ainda subindo
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  console.warn('[Desktop Main] Timeout no polling do servidor, prosseguindo com carregamento da janela...');
  return port;
}

/**
 * Criação da janela principal do Context OS
 */
function createMainWindow(port: number) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Context OS',
    backgroundColor: '#0f172a',
    titleBarStyle: 'default',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  const isDev = !app.isPackaged;
  const appUrl = isDev ? `http://localhost:5173` : `http://localhost:${port}`;

  console.log(`[Desktop Main] Carregando URL na janela: ${appUrl}`);
  mainWindow.loadURL(appUrl);

  // Redireciona links externos para o navegador padrão do sistema operacional
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Criptografia e Armazenamento Seguro via Keychain/DPAPI (safeStorage)
ipcMain.handle('secure-store:encrypt', async (_event, plainText: string) => {
  if (safeStorage.isEncryptionAvailable()) {
    const buffer = safeStorage.encryptString(plainText);
    return buffer.toString('base64');
  }
  return Buffer.from(plainText, 'utf-8').toString('base64');
});

ipcMain.handle('secure-store:decrypt', async (_event, encryptedBase64: string) => {
  if (safeStorage.isEncryptionAvailable()) {
    const buffer = Buffer.from(encryptedBase64, 'base64');
    return safeStorage.decryptString(buffer);
  }
  return Buffer.from(encryptedBase64, 'base64').toString('utf-8');
});

// Inicialização do ciclo de vida do Electron
app.whenReady().then(async () => {
  const port = await startEmbeddedServer();
  createMainWindow(port);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow(activeServerPort);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
