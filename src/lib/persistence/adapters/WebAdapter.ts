/**
 * src/lib/persistence/adapters/WebAdapter.ts
 *
 * Implementación de IPlatformAdapter para entorno web (fallback sin Electron).
 *
 * Estado en Fase 2:
 *   - Settings → localStorage
 *   - Books → localStorage (datos serializados como JSON)
 *   - Filesystem → no implementado
 *
 * En Fase 3 (modo web) reemplazar con:
 *   - IndexedDB (books, sections, blocks)
 *   - File System Access API (filesystem)
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
import {
  asBookProjectId,
  DEFAULT_BOOK_STATUS,
  DEFAULT_LANGUAGE_CODE,
  DEFAULT_LAYOUT_SETTINGS,
} from '$lib/core/domain/index';
import { asSectionId } from '$lib/core/domain/section';
import { asBlockId } from '$lib/core/domain/block';
import { detectPageSizePreset } from '$lib/core/editorial/page-size-presets';

const PREFIX = 'midoo:';
const BOOKS_KEY = `${PREFIX}books`;
const LAYOUT_KEY = `${PREFIX}layouts`;

// ─── Helpers localStorage ─────────────────────────────────────────────────────

function readBooks(): BookProject[] {
  try {
    const raw = localStorage.getItem(BOOKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function writeBooks(books: BookProject[]): void {
  localStorage.setItem(BOOKS_KEY, JSON.stringify(books));
}

function readLayouts(): LayoutSettings[] {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function writeLayouts(layouts: LayoutSettings[]): void {
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(layouts));
}

function normalizeWebLayoutSettings(layout: LayoutSettings): LayoutSettings {
  return {
    ...DEFAULT_LAYOUT_SETTINGS,
    ...layout,
    pageSizePreset:
      layout.pageSizePreset
      ?? detectPageSizePreset(layout.pageWidth, layout.pageHeight, layout.pageUnit),
    bleedMm: layout.bleedMm ?? 0,
    safeAreaInsetMm: layout.safeAreaInsetMm ?? 0,
    stylesJson: layout.stylesJson ?? null,
  };
}

function newId(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

export class WebAdapter implements IPlatformAdapter {

  // ── App info ──────────────────────────────────────────────────────────────
  getAppVersion() { return Promise.resolve('0.2.0-web'); }
  getPlatform()   { return Promise.resolve('web'); }

  // ── Filesystem ────────────────────────────────────────────────────────────
  readFile(_path: string)              { return Promise.reject(new Error('WebAdapter: readFile no implementado.')); }
  listFiles(_dir: string, _ext: string){ return Promise.resolve<string[]>([]); }
  openFilePicker()                     { return Promise.resolve<string | null>(null); }

  // ── Settings ──────────────────────────────────────────────────────────────
  dbPing() {
    return Promise.resolve({ ok: false, message: 'WebAdapter: sin SQLite en modo web.' });
  }
  getSetting(key: string) {
    return Promise.resolve(localStorage.getItem(`${PREFIX}${key}`));
  }
  setSetting(key: string, value: string) {
    localStorage.setItem(`${PREFIX}${key}`, value);
    return Promise.resolve();
  }
  getAllSettings() {
    const settings: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX) && k !== BOOKS_KEY) {
        settings[k.slice(PREFIX.length)] = localStorage.getItem(k) ?? '';
      }
    }
    return Promise.resolve(settings);
  }

  // ── BookProject (localStorage) ────────────────────────────────────────────

  createBook(input: CreateBookProjectInput): Promise<BookProject> {
    const books = readBooks();
    const ts = now();
    const book: BookProject = {
      id:           asBookProjectId(newId()),
      title:        input.title,
      subtitle:     input.subtitle     ?? '',
      authorName:   input.authorName   ?? '',
      description:  input.description  ?? '',
      languageCode: input.languageCode ?? DEFAULT_LANGUAGE_CODE,
      status:       input.status       ?? DEFAULT_BOOK_STATUS,
      coverAssetId: input.coverAssetId ?? null,
      createdAt:    ts,
      updatedAt:    ts,
    };
    books.push(book);
    writeBooks(books);
    const layouts = readLayouts();
    layouts.push({
      id:                    newId() as LayoutSettings['id'],
      bookId:                book.id,
      ...DEFAULT_LAYOUT_SETTINGS,
      createdAt:             ts,
      updatedAt:             ts,
    });
    writeLayouts(layouts);
    return Promise.resolve(book);
  }

  listBooks(): Promise<BookProject[]> {
    return Promise.resolve([...readBooks()].sort(
      (a, b) => b.updatedAt.localeCompare(a.updatedAt)
    ));
  }

  getBookById(id: string): Promise<BookProject | null> {
    const found = readBooks().find(b => b.id === id) ?? null;
    return Promise.resolve(found);
  }

  async updateBook(id: string, input: UpdateBookProjectInput): Promise<BookProject | null> {
    const books = readBooks();
    const idx = books.findIndex(b => b.id === id);
    if (idx === -1) return null;
    const updated: BookProject = {
      ...books[idx],
      ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)),
      updatedAt: now(),
    };
    books[idx] = updated;
    writeBooks(books);
    return updated;
  }

  deleteBook(id: string): Promise<boolean> {
    const books = readBooks();
    const filtered = books.filter(b => b.id !== id);
    if (filtered.length === books.length) return Promise.resolve(false);
    writeBooks(filtered);
    writeLayouts(readLayouts().filter(layout => layout.bookId !== id));
    return Promise.resolve(true);
  }

  getLayoutSettingsByBookId(bookId: string): Promise<LayoutSettings> {
    const existing = readLayouts().find(layout => layout.bookId === bookId);
    if (existing) return Promise.resolve(normalizeWebLayoutSettings(existing));
    const ts = now();
    const created: LayoutSettings = normalizeWebLayoutSettings({
      id:        newId() as LayoutSettings['id'],
      bookId,
      ...DEFAULT_LAYOUT_SETTINGS,
      createdAt: ts,
      updatedAt: ts,
    });
    writeLayouts([...readLayouts(), created]);
    return Promise.resolve(created);
  }

  async updateLayoutSettingsByBookId(
    bookId: string,
    input: UpdateLayoutSettingsInput,
  ): Promise<LayoutSettings | null> {
    const layouts = readLayouts();
    const existing = await this.getLayoutSettingsByBookId(bookId);
    const idx = layouts.findIndex(layout => layout.bookId === bookId);
    const updated: LayoutSettings = normalizeWebLayoutSettings({
      ...existing,
      ...Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)),
      updatedAt: now(),
    });
    if (idx === -1) layouts.push(updated);
    else layouts[idx] = updated;
    writeLayouts(layouts);
    return updated;
  }

  // ── Secciones y bloques — stubs (TODO Fase 3: IndexedDB) ─────────────────

  createSection(_input: CreateSectionInput): Promise<DocumentSection> {
    return Promise.reject(new Error('WebAdapter: sections no implementado en modo web (Fase 2).'));
  }
  listSectionsByBook(_bookId: string): Promise<DocumentSection[]> {
    return Promise.resolve([]);
  }
  updateSection(_id: string, _input: UpdateSectionInput): Promise<DocumentSection | null> {
    return Promise.resolve(null);
  }
  deleteSection(_id: string): Promise<boolean> {
    return Promise.resolve(false);
  }
  reorderSections(_bookId: string, _ids: string[]): Promise<void> {
    return Promise.resolve();
  }

  createBlock(_input: CreateBlockInput): Promise<DocumentBlock> {
    return Promise.reject(new Error('WebAdapter: blocks no implementado en modo web (Fase 2).'));
  }
  listBlocksBySection(_sectionId: string): Promise<DocumentBlock[]> {
    return Promise.resolve([]);
  }
  updateBlock(_id: string, _input: UpdateBlockInput): Promise<DocumentBlock | null> {
    return Promise.resolve(null);
  }
  deleteBlock(_id: string): Promise<boolean> {
    return Promise.resolve(false);
  }
  reorderBlocks(_sectionId: string, _ids: string[]): Promise<void> {
    return Promise.resolve();
  }

  listAssetsByBook(_bookId: string): Promise<Asset[]> {
    return Promise.resolve([]);
  }
  getAssetById(_id: string): Promise<Asset | null> {
    return Promise.resolve(null);
  }
  updateAsset(_id: string, _input: UpdateAssetInput): Promise<Asset | null> {
    return Promise.resolve(null);
  }
  deleteAsset(_id: string): Promise<boolean> {
    return Promise.resolve(false);
  }
  pickAndImportAssets(_bookId: string): Promise<Asset[]> {
    return Promise.reject(new Error('WebAdapter: assets solo en Electron (PARTE 8).'));
  }
  importAssetFiles(_bookId: string, _paths: string[]): Promise<Asset[]> {
    return Promise.reject(new Error('WebAdapter: assets solo en Electron (PARTE 8).'));
  }
}
