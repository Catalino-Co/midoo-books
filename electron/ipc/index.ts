/**
 * electron/ipc/index.ts
 *
 * Registro central de todos los handlers IPC.
 *
 * Convención de canales por dominio:
 *   app:*      → información de la aplicación
 *   db:*       → operaciones genéricas de base de datos (settings, ping)
 *   fs:*       → operaciones de sistema de archivos
 *   books:*    → CRUD de BookProject
 *   sections:* → CRUD de DocumentSection
 *   blocks:*   → CRUD de DocumentBlock
 *
 * Para añadir un nuevo dominio:
 *   1. Crear electron/ipc/handlers/miDominio.handlers.ts
 *   2. Exportar registerMiDominioHandlers()
 *   3. Importar y llamar aquí
 */

import { registerAppHandlers }    from './handlers/app.handlers';
import { registerDbHandlers }     from './handlers/db.handlers';
import { registerFsHandlers }     from './handlers/fs.handlers';
import { registerBooksHandlers }  from './handlers/books.handlers';
import { registerAssetHandlers }  from './handlers/assets.handlers';
import { registerLayoutHandlers } from './handlers/layout.handlers';
import { registerExportHandlers } from './handlers/exports.handlers';

export function registerAllHandlers(): void {
  registerAppHandlers();
  registerDbHandlers();
  registerFsHandlers();
  registerBooksHandlers();
  registerAssetHandlers();
  registerLayoutHandlers();
  registerExportHandlers();

  console.log('[IPC] Todos los handlers registrados.');
}
