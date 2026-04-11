/**
 * electron/database/connection.ts
 *
 * Gestión de la conexión a la base de datos SQLite mediante sql.js.
 *
 * ¿Por qué sql.js y no better-sqlite3?
 * sql.js es una compilación de SQLite a WebAssembly (WASM), sin dependencias
 * nativas. Funciona en cualquier plataforma sin necesidad de compilar extensiones
 * de Node.js (node-gyp). Esto simplifica el setup en equipos sin Visual Studio SDK.
 *
 * Diferencia clave vs better-sqlite3:
 * sql.js mantiene la BD en memoria. Para persistir, llama a `persist()` después
 * de cada escritura. La BD se guarda como un archivo binario en el directorio
 * de datos del usuario (AppData en Windows, ~/.config en Linux, ~/Library en Mac).
 *
 * Upgrade path (Fase 2+):
 * Reemplazar initSqlJs + export/import por better-sqlite3 cuando se estabilicen
 * los prebuilds para la versión de Node.js de Electron en uso.
 */

import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { app } from 'electron';
import { runMigrations } from './migrations';

let db: Database | null = null;
let dbFilePath: string | null = null;

/**
 * Retorna la ruta al archivo WASM de sql.js.
 * En desarrollo: carga desde node_modules.
 * En producción (packaged): desde extraResources definido en electron-builder.
 */
function getWasmDir(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'sql.js', 'dist');
  }
  return join(app.getAppPath(), 'node_modules', 'sql.js', 'dist');
}

/**
 * Abre (o crea) la base de datos y aplica migraciones pendientes.
 * Debe llamarse una sola vez al arrancar la aplicación, antes de registrar
 * los handlers IPC.
 */
export async function openDatabase(): Promise<Database> {
  if (db) return db;

  // Inicializar sql.js apuntando al WASM
  const SQL = await initSqlJs({
    locateFile: (file: string) => join(getWasmDir(), file),
  });

  // Directorio de datos del usuario (varía por SO)
  const userDataPath = app.getPath('userData');
  mkdirSync(userDataPath, { recursive: true });
  dbFilePath = join(userDataPath, 'midoo-books.db');

  if (existsSync(dbFilePath)) {
    const buffer = readFileSync(dbFilePath);
    db = new SQL.Database(buffer);
    console.log(`[DB] Base de datos cargada desde: ${dbFilePath}`);
  } else {
    db = new SQL.Database();
    console.log(`[DB] Nueva base de datos creada en: ${dbFilePath}`);
  }

  // Aplicar migraciones pendientes
  runMigrations(db);

  // Guardar estado inicial
  persist();

  return db;
}

/**
 * Guarda el estado actual de la BD en memoria al archivo de disco.
 * Llama a esta función después de cada operación de escritura (INSERT/UPDATE/DELETE).
 */
export function persist(): void {
  if (!db || !dbFilePath) return;
  const data = db.export();
  writeFileSync(dbFilePath, Buffer.from(data));
}

/**
 * Retorna la instancia activa de la base de datos.
 * Lanza error si openDatabase() no fue llamado antes.
 */
export function getDatabase(): Database {
  if (!db) {
    throw new Error(
      '[DB] Base de datos no inicializada. Llama a openDatabase() en app.whenReady().'
    );
  }
  return db;
}

/**
 * Cierra la base de datos y persiste los datos pendientes.
 * Llama antes de que la aplicación se cierre (app.on("before-quit")).
 */
export function closeDatabase(): void {
  if (db) {
    persist();
    db.close();
    db = null;
    console.log('[DB] Base de datos cerrada.');
  }
}
