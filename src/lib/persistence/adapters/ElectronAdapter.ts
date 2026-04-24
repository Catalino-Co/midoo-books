/**
 * src/lib/persistence/adapters/ElectronAdapter.ts
 *
 * Implementación de IPlatformAdapter para Electron.
 * Todas las llamadas son proxies a window.electronAPI (preload/contextBridge).
 *
 * Manejo de errores IPC:
 * Los handlers del proceso principal pueden devolver { error: string }.
 * unwrap() verifica la respuesta y lanza un Error de JavaScript si hay error,
 * convirtiendo el error serializado en una excepción nativa del renderer.
 */

import type { IPlatformAdapter } from './IPlatformAdapter';
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
} from '$lib/core/domain/index';

/** Lanza una excepción si la respuesta IPC contiene un campo 'error'. */
function unwrap<T>(response: T | { error: string }): T {
  if (response && typeof response === 'object' && 'error' in response) {
    throw new Error((response as { error: string }).error);
  }
  return response as T;
}

export class ElectronAdapter implements IPlatformAdapter {
  private api: NonNullable<Window['electronAPI']>;

  constructor() {
    if (typeof window === 'undefined' || !window.electronAPI) {
      throw new Error('ElectronAdapter: window.electronAPI no disponible. ¿Está cargado el preload?');
    }
    this.api = window.electronAPI;
  }

  // ── App info ──────────────────────────────────────────────────────────────
  getAppVersion() { return this.api.app.getVersion(); }
  getPlatform()   { return this.api.app.getPlatform(); }

  // ── Filesystem ────────────────────────────────────────────────────────────
  readFile(path: string)              { return this.api.fs.readFile(path); }
  listFiles(dir: string, ext: string) { return this.api.fs.listFiles(dir, ext); }
  openFilePicker()                    { return this.api.fs.openFilePicker(); }

  // ── Settings & diagnóstico ────────────────────────────────────────────────
  dbPing()                              { return this.api.db.ping(); }
  getSetting(key: string)               { return this.api.db.getSetting(key); }
  setSetting(key: string, value: string){ return this.api.db.setSetting(key, value); }
  getAllSettings()                       { return this.api.db.getAllSettings(); }

  // ── BookProject ───────────────────────────────────────────────────────────

  async createBook(input: CreateBookProjectInput): Promise<BookProject> {
    return unwrap(await this.api.books.create(input));
  }

  async listBooks(): Promise<BookProject[]> {
    return unwrap(await this.api.books.list());
  }

  async getBookById(id: string): Promise<BookProject | null> {
    const res = await this.api.books.getById(id);
    if (res && 'error' in res) throw new Error((res as { error: string }).error);
    return res as BookProject | null;
  }

  async updateBook(id: string, input: UpdateBookProjectInput): Promise<BookProject | null> {
    const res = await this.api.books.update(id, input);
    if (res && 'error' in res) throw new Error((res as { error: string }).error);
    return res as BookProject | null;
  }

  async deleteBook(id: string): Promise<boolean> {
    const res = unwrap(await this.api.books.delete(id));
    return (res as { deleted: boolean }).deleted;
  }

  async getLayoutSettingsByBookId(bookId: string): Promise<LayoutSettings> {
    return unwrap(await this.api.layout.getByBookId(bookId));
  }

  async updateLayoutSettingsByBookId(
    bookId: string,
    input: UpdateLayoutSettingsInput,
  ): Promise<LayoutSettings | null> {
    const res = await this.api.layout.updateByBookId(bookId, input);
    if (res && 'error' in res) throw new Error((res as { error: string }).error);
    return res as LayoutSettings | null;
  }

  // ── DocumentSection ───────────────────────────────────────────────────────

  async createSection(input: CreateSectionInput): Promise<DocumentSection> {
    return unwrap(await this.api.sections.create(input));
  }

  async listSectionsByBook(bookId: string): Promise<DocumentSection[]> {
    return unwrap(await this.api.sections.listByBook(bookId));
  }

  async updateSection(id: string, input: UpdateSectionInput): Promise<DocumentSection | null> {
    const res = await this.api.sections.update(id, input);
    if (res && 'error' in res) throw new Error((res as { error: string }).error);
    return res as DocumentSection | null;
  }

  async deleteSection(id: string): Promise<boolean> {
    const res = unwrap(await this.api.sections.delete(id));
    return (res as { deleted: boolean }).deleted;
  }

  async reorderSections(bookId: string, ids: string[]): Promise<void> {
    unwrap(await this.api.sections.reorder(bookId, ids));
  }

  // ── DocumentBlock ─────────────────────────────────────────────────────────

  async createBlock(input: CreateBlockInput): Promise<DocumentBlock> {
    return unwrap(await this.api.blocks.create(input));
  }

  async listBlocksBySection(sectionId: string): Promise<DocumentBlock[]> {
    return unwrap(await this.api.blocks.listBySection(sectionId));
  }

  async updateBlock(id: string, input: UpdateBlockInput): Promise<DocumentBlock | null> {
    const res = await this.api.blocks.update(id, input);
    if (res && 'error' in res) throw new Error((res as { error: string }).error);
    return res as DocumentBlock | null;
  }

  async deleteBlock(id: string): Promise<boolean> {
    const res = unwrap(await this.api.blocks.delete(id));
    return (res as { deleted: boolean }).deleted;
  }

  async reorderBlocks(sectionId: string, ids: string[]): Promise<void> {
    unwrap(await this.api.blocks.reorder(sectionId, ids));
  }

  // ── Assets ───────────────────────────────────────────────────────────────

  async listAssetsByBook(bookId: string): Promise<Asset[]> {
    return unwrap(await this.api.assets.listByBook(bookId));
  }

  async getAssetById(id: string): Promise<Asset | null> {
    const res = await this.api.assets.getById(id);
    if (res && 'error' in res) throw new Error((res as { error: string }).error);
    return res as Asset | null;
  }

  async updateAsset(id: string, input: UpdateAssetInput): Promise<Asset | null> {
    const res = await this.api.assets.update(id, input);
    if (res && 'error' in res) throw new Error((res as { error: string }).error);
    return res as Asset | null;
  }

  async deleteAsset(id: string): Promise<boolean> {
    const res = unwrap(await this.api.assets.delete(id));
    return (res as { deleted: boolean }).deleted;
  }

  async pickAndImportAssets(bookId: string): Promise<Asset[]> {
    const res = await this.api.assets.pickAndImport(bookId);
    if (res && 'error' in res) throw new Error((res as { error: string }).error);
    return (res as { imported: Asset[] }).imported;
  }

  async importAssetFiles(bookId: string, paths: string[]): Promise<Asset[]> {
    const res = await this.api.assets.importPaths(bookId, paths);
    if (res && 'error' in res) throw new Error((res as { error: string }).error);
    return (res as { imported: Asset[] }).imported;
  }
}
