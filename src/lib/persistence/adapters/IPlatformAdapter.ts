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
  LayoutSettings,
  UpdateLayoutSettingsInput,
  DocumentSection,
  CreateSectionInput,
  UpdateSectionInput,
  DocumentBlock,
  CreateBlockInput,
  UpdateBlockInput,
  Asset,
  UpdateAssetInput,
  ExportJob,
  CreateExportJobInput,
  UpdateExportJobInput,
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

  // ── LayoutSettings ────────────────────────────────────────────────────────
  getLayoutSettingsByBookId(bookId: string):              Promise<LayoutSettings>;
  updateLayoutSettingsByBookId(
    bookId: string,
    input: UpdateLayoutSettingsInput,
  ): Promise<LayoutSettings | null>;

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

  // ── Assets (imágenes por libro) — PARTE 8 ─────────────────────────────────
  listAssetsByBook(bookId: string):                       Promise<Asset[]>;
  getAssetById(id: string):                               Promise<Asset | null>;
  updateAsset(id: string, input: UpdateAssetInput):       Promise<Asset | null>;
  deleteAsset(id: string):                              Promise<boolean>;
  /** Diálogo nativo: importa una o varias imágenes al libro. */
  pickAndImportAssets(bookId: string):                    Promise<Asset[]>;
  importAssetFiles(bookId: string, paths: string[]):     Promise<Asset[]>;

  // ── Exportación ───────────────────────────────────────────────────────────
  createExportJob(input: CreateExportJobInput):                                                          Promise<ExportJob>;
  updateExportJob(id: string, updates: UpdateExportJobInput):                                            Promise<ExportJob | null>;
  listExportJobsByBook(bookId: string, limit?: number):                                                  Promise<ExportJob[]>;
  renderBookPdf(bookId: string, opts: { format: 'screen' | 'print'; baseUrl: string }):                 Promise<Buffer>;
  saveExportFile(buffer: Buffer, name: string, filters: { name: string; extensions: string[] }[]):      Promise<{ success: boolean; path?: string; canceled?: boolean }>;
}
