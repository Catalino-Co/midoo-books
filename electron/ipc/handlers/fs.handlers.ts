/**
 * electron/ipc/handlers/fs.handlers.ts
 *
 * Handlers IPC para operaciones de sistema de archivos.
 *
 * En Fase 1 estos son de solo lectura (los archivos .md del proyecto).
 * En Fase 2 se añadirá escritura y apertura de archivos arbitrarios.
 *
 * Nota de seguridad: en producción, validar y sanitizar las rutas antes
 * de exponerlas al renderer. No exponer rutas arbitrarias del sistema.
 */

import { ipcMain, dialog, app } from 'electron';
import { readFile, readdir } from 'fs/promises';
import { join, extname, resolve, isAbsolute } from 'path';

export function registerFsHandlers(): void {
  /**
   * readFile → lee un archivo y devuelve su contenido como string UTF-8.
   * Solo permite rutas dentro del directorio de la aplicación (por seguridad).
   */
  ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
    const safePath = sanitizePath(filePath);
    return readFile(safePath, 'utf-8');
  });

  /**
   * listFiles → lista archivos en un directorio filtrados por extensión.
   * Retorna solo los nombres de archivo (no rutas completas).
   */
  ipcMain.handle('fs:listFiles', async (_event, dir: string, ext: string) => {
    const safeDir = sanitizePath(dir);
    const entries = await readdir(safeDir, { withFileTypes: true });
    return entries
      .filter(e => e.isFile() && extname(e.name) === ext)
      .map(e => e.name);
  });

  /**
   * openFilePicker → abre el diálogo nativo para seleccionar un archivo .md.
   * Retorna la ruta seleccionada o null si el usuario cancela.
   */
  ipcMain.handle('fs:openFilePicker', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Abrir libro Markdown',
      filters: [
        { name: 'Archivos Markdown', extensions: ['md'] },
        { name: 'Todos los archivos', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });
    return result.canceled ? null : result.filePaths[0];
  });
}

/**
 * Resuelve una ruta y evita path traversal básico.
 * En producción, añadir validación más estricta.
 */
function sanitizePath(inputPath: string): string {
  if (isAbsolute(inputPath)) return inputPath;
  // Rutas relativas se resuelven desde el directorio de la app
  return resolve(app.getAppPath(), inputPath);
}
