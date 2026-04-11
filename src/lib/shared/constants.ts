/**
 * src/lib/shared/constants.ts
 *
 * Constantes compartidas entre todas las capas de la aplicación.
 * Sin dependencias de runtime.
 */

export const APP_NAME    = 'MIDOO Books';
export const APP_VERSION = '0.1.0';

export const DEFAULT_PAGE_SIZE = 'A5'      as const;
export const DEFAULT_VARIANT   = 'light'   as const;
export const DEFAULT_LAYOUT    = 'Standard' as const;
export const DEFAULT_LANGUAGE  = 'es'      as const;

/** Directorio de contenido Markdown (relativo a la raíz del proyecto) */
export const CONTENT_DIR = 'content';

/** Extensión de archivos de libro */
export const BOOK_EXT = '.md';
