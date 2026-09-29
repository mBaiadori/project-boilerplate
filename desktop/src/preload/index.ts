import { contextBridge, ipcRenderer } from 'electron';

// Exposição segura de utilitários nativos para o frontend sem habilitar nodeIntegration
contextBridge.exposeInMainWorld('desktopBridge', {
  isDesktop: true,
  platform: process.platform,
  encrypt: (plainText: string) => ipcRenderer.invoke('secure-store:encrypt', plainText),
  decrypt: (encryptedBase64: string) => ipcRenderer.invoke('secure-store:decrypt', encryptedBase64),
});
