import { app, BrowserWindow, ipcMain } from 'electron';
import electronUpdater from 'electron-updater';

const { autoUpdater } = electronUpdater;

/**
 * Configura o serviço de Auto-Update para o Electron Desktop
 * Monitora releases no GitHub e envia notificações de progresso ao frontend
 */
export function setupAutoUpdater(
  getMainWindow: () => BrowserWindow | null,
  validateIpcSender: (event: Electron.IpcMainInvokeEvent) => void
) {
  if (!app.isPackaged) {
    console.log('[AutoUpdater] Modo desenvolvimento ativo: auto-updater em standby.');
    return;
  }

  // Configurações do autoUpdater
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Verificando atualizações no GitHub Releases...');
    getMainWindow()?.webContents.send('updater:status', { status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    console.log(`[AutoUpdater] Nova versão encontrada: ${info.version}`);
    getMainWindow()?.webContents.send('updater:status', {
      status: 'available',
      version: info.version,
      releaseDate: info.releaseDate,
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log(`[AutoUpdater] O aplicativo já está na versão mais recente: ${info.version}`);
    getMainWindow()?.webContents.send('updater:status', {
      status: 'up-to-date',
      version: info.version,
    });
  });

  autoUpdater.on('error', (err) => {
    console.warn('[AutoUpdater] Erro durante verificação de atualizações:', err?.message || err);
    getMainWindow()?.webContents.send('updater:status', {
      status: 'error',
      error: err?.message || 'Erro ao checar atualizações',
    });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    getMainWindow()?.webContents.send('updater:progress', {
      percent: Math.round(progressObj.percent),
      bytesPerSecond: progressObj.bytesPerSecond,
      transferred: progressObj.transferred,
      total: progressObj.total,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log(`[AutoUpdater] Versão ${info.version} baixada e pronta para instalação.`);
    getMainWindow()?.webContents.send('updater:status', {
      status: 'downloaded',
      version: info.version,
    });
  });

  // Handlers IPC para controle pelo frontend
  ipcMain.handle('updater:check', async (event) => {
    validateIpcSender(event);
    if (!app.isPackaged) {
      return { status: 'dev-mode', message: 'Auto-updater inativo em modo dev.' };
    }
    try {
      const result = await autoUpdater.checkForUpdates();
      return { status: 'checked', updateInfo: result?.updateInfo };
    } catch (err: any) {
      return { status: 'error', error: err?.message || String(err) };
    }
  });

  ipcMain.handle('updater:quit-and-install', async (event) => {
    validateIpcSender(event);
    if (app.isPackaged) {
      console.log('[AutoUpdater] Reiniciando aplicativo para aplicar atualização...');
      autoUpdater.quitAndInstall();
    }
  });

  // Executa uma checagem automática 10 segundos após o boot da janela
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      console.warn('[AutoUpdater] Falha no checkForUpdatesAndNotify inicial:', err?.message || err);
    });
  }, 10000);
}
