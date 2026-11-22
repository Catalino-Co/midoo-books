/**
 * electron/main/ui-origin.ts
 *
 * Única fuente de verdad sobre DÓNDE vive la UI (renderer):
 *   - Desarrollo (sin empaquetar): servidor de Vite en DEV_URL.
 *   - Producción (empaquetada) o MIDOO_LOAD_BUILD=1: build estático vía app://midoo/.
 *
 * El proceso main usa este módulo tanto para cargar la ventana principal como para
 * construir la URL de la ruta headless de exportación a PDF. Así el main nunca confía
 * en una URL enviada desde el renderer.
 */

import { app } from 'electron';
import { APP_ORIGIN } from './app-protocol';

/** URL del servidor de desarrollo de Vite (ver vite.config.js). */
export const DEV_URL = 'http://localhost:5178';

/** true si la UI se sirve desde el build estático (app://midoo/). */
export function loadsUiFromBuild(): boolean {
  return app.isPackaged || process.env.MIDOO_LOAD_BUILD === '1';
}

/** Origen de la UI sin barra final: `http://localhost:5178` o `app://midoo`. */
export function getUiOrigin(): string {
  return loadsUiFromBuild() ? APP_ORIGIN : DEV_URL;
}

/** URL absoluta a una ruta de la UI. `path` debe empezar por `/`. */
export function uiUrl(path: string): string {
  return `${getUiOrigin()}${path}`;
}
