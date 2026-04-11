/**
 * src/lib/persistence/index.ts
 *
 * Punto de entrada de la capa de persistencia.
 *
 * Exporta:
 *   - IPlatformAdapter (interfaz)
 *   - ElectronAdapter  (implementación desktop)
 *   - WebAdapter       (implementación web/fallback)
 *   - getPlatformAdapter() (factory — detecta el entorno automáticamente)
 */

export type { IPlatformAdapter } from './adapters/IPlatformAdapter';
export { ElectronAdapter } from './adapters/ElectronAdapter';
export { WebAdapter } from './adapters/WebAdapter';

import type { IPlatformAdapter } from './adapters/IPlatformAdapter';
import { ElectronAdapter } from './adapters/ElectronAdapter';
import { WebAdapter } from './adapters/WebAdapter';

/**
 * Factory que devuelve el adaptador correcto según el entorno.
 *
 * Uso:
 *   import { getPlatformAdapter } from '$lib/persistence';
 *   const platform = getPlatformAdapter();
 *   const status = await platform.dbPing();
 */
export function getPlatformAdapter(): IPlatformAdapter {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return new ElectronAdapter();
  }
  return new WebAdapter();
}
