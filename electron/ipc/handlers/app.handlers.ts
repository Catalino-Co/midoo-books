/**
 * electron/ipc/handlers/app.handlers.ts
 *
 * Handlers IPC relacionados con la aplicación en general:
 * versión, plataforma, rutas del sistema.
 */

import { ipcMain, app } from 'electron';

export function registerAppHandlers(): void {
  // Versión de la aplicación (desde package.json)
  ipcMain.handle('app:getVersion', () => {
    return app.getVersion();
  });

  // Plataforma del SO ('win32' | 'darwin' | 'linux')
  ipcMain.handle('app:getPlatform', () => {
    return process.platform;
  });

  // Ruta de datos del usuario (AppData/Roaming en Windows)
  ipcMain.handle('app:getUserDataPath', () => {
    return app.getPath('userData');
  });
}
