/**
 * electron/ipc/handlers/db.handlers.ts
 *
 * Handlers IPC para operaciones de base de datos.
 *
 * Capa de acceso mínima para Fase 1:
 *   db:ping            → verificación de salud de la BD
 *   db:getSetting      → leer una preferencia de app_settings
 *   db:setSetting      → escribir una preferencia de app_settings
 *   db:getAllSettings   → leer todas las preferencias
 *
 * En Fase 2 se añadirán handlers para CRUD completo de libros.
 */

import { ipcMain } from 'electron';
import { getDatabase, persist } from '../../database/connection';

export function registerDbHandlers(): void {
  /**
   * Ping → verifica que la BD responde correctamente.
   * El renderer puede llamarlo para confirmar que SQLite está activo.
   */
  ipcMain.handle('db:ping', () => {
    try {
      const db = getDatabase();
      const result = db.exec('SELECT sqlite_version() AS version');
      const version = result[0]?.values[0]?.[0] ?? 'desconocida';
      return {
        ok: true,
        message: `SQLite ${version} — conexión activa.`,
      };
    } catch (err) {
      return {
        ok: false,
        message: `Error: ${String(err)}`,
      };
    }
  });

  /**
   * getSetting → lee el valor de una clave en app_settings.
   * Retorna null si la clave no existe.
   */
  ipcMain.handle('db:getSetting', (_event, key: string) => {
    const db = getDatabase();
    const result = db.exec(
      'SELECT value FROM app_settings WHERE key = ?',
      [key]
    );
    if (result.length === 0 || result[0].values.length === 0) return null;
    return result[0].values[0][0] as string;
  });

  /**
   * setSetting → inserta o actualiza una clave en app_settings.
   * Persiste automáticamente al disco después de escribir.
   */
  ipcMain.handle('db:setSetting', (_event, key: string, value: string) => {
    const db = getDatabase();
    db.run(
      `INSERT OR REPLACE INTO app_settings (key, value, updated_at)
       VALUES (?, ?, datetime('now'))`,
      [key, value]
    );
    persist();
  });

  /**
   * getAllSettings → devuelve todas las preferencias como objeto clave-valor.
   */
  ipcMain.handle('db:getAllSettings', () => {
    const db = getDatabase();
    const result = db.exec('SELECT key, value FROM app_settings ORDER BY key');
    if (result.length === 0) return {};
    const settings: Record<string, string> = {};
    for (const [key, value] of result[0].values) {
      settings[key as string] = value as string;
    }
    return settings;
  });
}
