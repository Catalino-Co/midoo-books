/**
 * electron/database/repositories/index.ts
 *
 * Punto de entrada de los repositorios.
 * Los handlers IPC importan desde aquí — no desde los archivos individuales.
 */

export * as BookRepo    from './BookRepository';
export * as SectionRepo from './SectionRepository';
export * as BlockRepo   from './BlockRepository';
