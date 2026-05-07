/**
 * src/lib/persistence/adapters/electron.d.ts
 *
 * Declaración de tipos globales para window.electronAPI.
 * TypeScript reconoce este objeto en todos los .svelte y .ts del App Shell
 * sin imports explícitos — está en scope global gracias a declare global.
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

declare global {
  interface Window {
    electronAPI?: {

      // ── App info ──────────────────────────────────────────────────────────
      app: {
        getVersion():      Promise<string>;
        getPlatform():     Promise<string>;
        getUserDataPath(): Promise<string>;
      };

      // ── Settings & diagnóstico ────────────────────────────────────────────
      db: {
        ping():                                  Promise<{ ok: boolean; message: string }>;
        getSetting(key: string):                 Promise<string | null>;
        setSetting(key: string, value: string):  Promise<void>;
        getAllSettings():                         Promise<Record<string, string>>;
      };

      // ── Filesystem ────────────────────────────────────────────────────────
      fs: {
        readFile(path: string):                  Promise<string>;
        listFiles(dir: string, ext: string):     Promise<string[]>;
        openFilePicker():                         Promise<string | null>;
      };

      // ── BookProject CRUD ──────────────────────────────────────────────────
      books: {
        create(input: CreateBookProjectInput):                  Promise<BookProject | { error: string }>;
        list():                                                  Promise<BookProject[] | { error: string }>;
        getById(id: string):                                     Promise<BookProject | null | { error: string }>;
        update(id: string, input: UpdateBookProjectInput):      Promise<BookProject | null | { error: string }>;
        delete(id: string):                                      Promise<{ deleted: boolean } | { error: string }>;
        count():                                                 Promise<{ count: number } | { error: string }>;
      };

      layout: {
        getByBookId(bookId: string):                             Promise<LayoutSettings | { error: string }>;
        updateByBookId(
          bookId: string,
          input: UpdateLayoutSettingsInput,
        ): Promise<LayoutSettings | null | { error: string }>;
      };

      // ── DocumentSection CRUD ──────────────────────────────────────────────
      sections: {
        create(input: CreateSectionInput):                        Promise<DocumentSection | { error: string }>;
        listByBook(bookId: string):                               Promise<DocumentSection[] | { error: string }>;
        getById(id: string):                                      Promise<DocumentSection | null | { error: string }>;
        update(id: string, input: UpdateSectionInput):            Promise<DocumentSection | null | { error: string }>;
        delete(id: string):                                       Promise<{ deleted: boolean } | { error: string }>;
        reorder(bookId: string, orderedIds: string[]):            Promise<{ ok: boolean } | { error: string }>;
      };

      // ── DocumentBlock CRUD ────────────────────────────────────────────────
      blocks: {
        create(input: CreateBlockInput):                          Promise<DocumentBlock | { error: string }>;
        listBySection(sectionId: string):                         Promise<DocumentBlock[] | { error: string }>;
        getById(id: string):                                      Promise<DocumentBlock | null | { error: string }>;
        update(id: string, input: UpdateBlockInput):              Promise<DocumentBlock | null | { error: string }>;
        delete(id: string):                                       Promise<{ deleted: boolean } | { error: string }>;
        reorder(sectionId: string, orderedIds: string[]):         Promise<{ ok: boolean } | { error: string }>;
      };

      assets: {
        listByBook(bookId: string):                               Promise<Asset[] | { error: string }>;
        getById(id: string):                                      Promise<Asset | null | { error: string }>;
        update(id: string, input: UpdateAssetInput):              Promise<Asset | null | { error: string }>;
        delete(id: string):                                       Promise<{ deleted: boolean } | { error: string }>;
        pickAndImport(bookId: string):                            Promise<{ imported: Asset[] } | { error: string }>;
        importPaths(bookId: string, paths: string[]):            Promise<{ imported: Asset[] } | { error: string }>;
      };

      exports: {
        create(input: CreateExportJobInput):                                                           Promise<ExportJob | { error: string }>;
        update(id: string, updates: UpdateExportJobInput):                                             Promise<ExportJob | null | { error: string }>;
        listByBook(bookId: string, limit?: number):                                                    Promise<ExportJob[] | { error: string }>;
        renderPdf(bookId: string, opts: { format: 'screen' | 'print'; baseUrl: string }):             Promise<Buffer | { error: string }>;
        saveFile(buffer: Buffer, name: string, filters: { name: string; extensions: string[] }[]):    Promise<{ success: boolean; path?: string; canceled?: boolean } | { error: string }>;
      };
    };
  }
}

export {};
