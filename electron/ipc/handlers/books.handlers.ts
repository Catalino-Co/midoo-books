/**
 * electron/ipc/handlers/books.handlers.ts
 *
 * Handlers IPC para operaciones de BookProject (CRUD completo).
 *
 * Canales expuestos:
 *   books:create   → CreateBookProjectInput → BookProject
 *   books:list     → void → BookProject[]
 *   books:getById  → id: string → BookProject | null
 *   books:update   → { id, input } → BookProject | null
 *   books:delete   → id: string → { deleted: boolean }
 *
 * Secciones (básico):
 *   sections:create     → CreateSectionInput → DocumentSection
 *   sections:listByBook → bookId: string → DocumentSection[]
 *   sections:update     → { id, input } → DocumentSection | null
 *   sections:delete     → id: string → { deleted: boolean }
 *   sections:reorder    → { bookId, orderedIds } → void
 *
 * Bloques (básico):
 *   blocks:create          → CreateBlockInput → DocumentBlock
 *   blocks:listBySection   → sectionId: string → DocumentBlock[]
 *   blocks:update          → { id, input } → DocumentBlock | null
 *   blocks:delete          → id: string → { deleted: boolean }
 *
 * Convención de errores:
 *   Los handlers atrapan excepciones y devuelven { error: string } en su lugar.
 *   El renderer comprueba si la respuesta tiene la propiedad 'error'.
 */

import { ipcMain } from 'electron';
import { BookRepo, SectionRepo, BlockRepo } from '../../database/repositories/index';
import type { CreateBookProjectInput, UpdateBookProjectInput } from '../../../src/lib/core/domain/book';
import type { CreateSectionInput, UpdateSectionInput } from '../../../src/lib/core/domain/section';
import type { CreateBlockInput, UpdateBlockInput } from '../../../src/lib/core/domain/block';

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Envuelve un handler en try/catch para devolver errores serializables. */
function safe<T>(fn: () => T): T | { error: string } {
  try {
    return fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[IPC] Error:', msg);
    return { error: msg };
  }
}

// ─── Registro de handlers ─────────────────────────────────────────────────────

export function registerBooksHandlers(): void {

  // ── BookProject CRUD ──────────────────────────────────────────────────────

  ipcMain.handle('books:create', (_event, input: CreateBookProjectInput) =>
    safe(() => BookRepo.createBook(input))
  );

  ipcMain.handle('books:list', () =>
    safe(() => BookRepo.listBooks())
  );

  ipcMain.handle('books:getById', (_event, id: string) =>
    safe(() => BookRepo.getBookById(id))
  );

  ipcMain.handle('books:update', (_event, id: string, input: UpdateBookProjectInput) =>
    safe(() => BookRepo.updateBook(id, input))
  );

  ipcMain.handle('books:delete', (_event, id: string) =>
    safe(() => ({ deleted: BookRepo.deleteBook(id) }))
  );

  ipcMain.handle('books:count', () =>
    safe(() => ({ count: BookRepo.countBooks() }))
  );

  // ── DocumentSection CRUD ──────────────────────────────────────────────────

  ipcMain.handle('sections:create', (_event, input: CreateSectionInput) =>
    safe(() => SectionRepo.createSection(input))
  );

  ipcMain.handle('sections:listByBook', (_event, bookId: string) =>
    safe(() => SectionRepo.listSectionsByBook(bookId))
  );

  ipcMain.handle('sections:getById', (_event, id: string) =>
    safe(() => SectionRepo.getSectionById(id))
  );

  ipcMain.handle('sections:update', (_event, id: string, input: UpdateSectionInput) =>
    safe(() => SectionRepo.updateSection(id, input))
  );

  ipcMain.handle('sections:delete', (_event, id: string) =>
    safe(() => ({ deleted: SectionRepo.deleteSection(id) }))
  );

  ipcMain.handle('sections:reorder', (_event, bookId: string, orderedIds: string[]) =>
    safe(() => { SectionRepo.reorderSections(bookId, orderedIds); return { ok: true }; })
  );

  // ── DocumentBlock CRUD ────────────────────────────────────────────────────

  ipcMain.handle('blocks:create', (_event, input: CreateBlockInput) =>
    safe(() => BlockRepo.createBlock(input))
  );

  ipcMain.handle('blocks:listBySection', (_event, sectionId: string) =>
    safe(() => BlockRepo.listBlocksBySection(sectionId))
  );

  ipcMain.handle('blocks:getById', (_event, id: string) =>
    safe(() => BlockRepo.getBlockById(id))
  );

  ipcMain.handle('blocks:update', (_event, id: string, input: UpdateBlockInput) =>
    safe(() => BlockRepo.updateBlock(id, input))
  );

  ipcMain.handle('blocks:delete', (_event, id: string) =>
    safe(() => ({ deleted: BlockRepo.deleteBlock(id) }))
  );

  ipcMain.handle('blocks:reorder', (_event, sectionId: string, orderedIds: string[]) =>
    safe(() => { BlockRepo.reorderBlocks(sectionId, orderedIds); return { ok: true }; })
  );

  console.log('[IPC] Handlers de libros, secciones y bloques registrados.');
}
