/**
 * src/lib/persistence/adapters/IPlatformAdapter.ts
 *
 * Contrato de la capa de plataforma.
 *
 * El App Shell (SvelteKit) solo depende de esta interfaz.
 * Las implementaciones concretas (Electron, Web) son intercambiables.
 */

import type {
  BookProject,
  CreateBookProjectInput,
  UpdateBookProjectInput,
  DocumentSection,
  CreateSectionInput,
  UpdateSectionInput,
  DocumentBlock,
  CreateBlockInput,
  UpdateBlockInput,
} from '$lib/core/domain/index';

/** Respuesta genérica de un error IPC serializado. */
export interface IpcError { error: string; }

export interface IPlatformAdapter {

  // ── App info ──────────────────────────────────────────────────────────────
  getAppVersion(): Promise<string>;
  getPlatform():   Promise<string>;

  // ── Filesystem ────────────────────────────────────────────────────────────
  readFile(path: string):              Promise<string>;
  listFiles(dir: string, ext: string): Promise<string[]>;
  openFilePicker():                    Promise<string | null>;

  // ── Settings & diagnóstico ────────────────────────────────────────────────
  dbPing():                            Promise<{ ok: boolean; message: string }>;
  getSetting(key: string):             Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
  getAllSettings():                     Promise<Record<string, string>>;

  // ── BookProject ───────────────────────────────────────────────────────────
  createBook(input: CreateBookProjectInput):              Promise<BookProject>;
  listBooks():                                            Promise<BookProject[]>;
  getBookById(id: string):                                Promise<BookProject | null>;
  updateBook(id: string, input: UpdateBookProjectInput):  Promise<BookProject | null>;
  deleteBook(id: string):                                 Promise<boolean>;

  // ── DocumentSection ───────────────────────────────────────────────────────
  createSection(input: CreateSectionInput):               Promise<DocumentSection>;
  listSectionsByBook(bookId: string):                     Promise<DocumentSection[]>;
  updateSection(id: string, input: UpdateSectionInput):   Promise<DocumentSection | null>;
  deleteSection(id: string):                              Promise<boolean>;
  reorderSections(bookId: string, ids: string[]):         Promise<void>;

  // ── DocumentBlock ─────────────────────────────────────────────────────────
  createBlock(input: CreateBlockInput):                   Promise<DocumentBlock>;
  listBlocksBySection(sectionId: string):                 Promise<DocumentBlock[]>;
  updateBlock(id: string, input: UpdateBlockInput):       Promise<DocumentBlock | null>;
  deleteBlock(id: string):                                Promise<boolean>;
  reorderBlocks(sectionId: string, ids: string[]):        Promise<void>;
}
