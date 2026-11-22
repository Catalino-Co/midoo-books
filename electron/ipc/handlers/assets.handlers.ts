/**
 * IPC — metadatos e importación de assets (PARTE 8).
 */

import { ipcMain, dialog } from 'electron';
import { existsSync, unlinkSync, rmSync } from 'fs';
import { join } from 'path';
import * as AssetRepo from '../../database/repositories/AssetRepository';
import { importAssetFromPath } from '../../services/asset-import';
import { resolveBookStoragePath, getBooksRootDir } from '../../lib/book-media-paths';
import type { UpdateAssetInput } from '../../../src/lib/core/domain/asset';

function safe<T>(fn: () => T): T | { error: string } {
  try {
    return fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[IPC assets]', msg);
    return { error: msg };
  }
}

export function registerAssetHandlers(): void {
  ipcMain.handle('assets:listByBook', (_e, bookId: string) =>
    safe(() => AssetRepo.listAssetsByBook(bookId)),
  );

  ipcMain.handle('assets:getById', (_e, id: string) =>
    safe(() => AssetRepo.getAssetById(id)),
  );

  ipcMain.handle('assets:update', (_e, id: string, input: UpdateAssetInput) =>
    safe(() => AssetRepo.updateAsset(id, input)),
  );

  ipcMain.handle('assets:delete', (_e, id: string) =>
    safe(() => {
      const a = AssetRepo.getAssetById(id);
      if (!a) return { deleted: false };
      const abs = resolveBookStoragePath(a.bookId, a.storagePath);
      AssetRepo.deleteAsset(id);
      try {
        if (existsSync(abs)) unlinkSync(abs);
      } catch {
        /* archivo ya ausente */
      }
      return { deleted: true };
    }),
  );

  ipcMain.handle('assets:pickAndImport', async (_e, bookId: string, kind: 'image' | 'font' = 'image') => {
    try {
      const isFont = kind === 'font';
      const r = await dialog.showOpenDialog({
        title:      isFont ? 'Añadir fuentes al libro' : 'Añadir imágenes al libro',
        buttonLabel: 'Importar',
        filters:    isFont
          ? [{ name: 'Fuentes (TTF, OTF, WOFF, WOFF2)', extensions: ['ttf', 'otf', 'woff', 'woff2'] }]
          : [
            { name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] },
            { name: 'Todos', extensions: ['*'] },
          ],
        properties: ['openFile', 'multiSelections'],
      });
      if (r.canceled || r.filePaths.length === 0) {
        return { imported: [] as ReturnType<typeof AssetRepo.listAssetsByBook> };
      }
      const imported = [];
      for (const p of r.filePaths) {
        try {
          imported.push(importAssetFromPath({ bookId, sourcePath: p, assetType: isFont ? 'font' : 'image' }));
        } catch (err) {
          console.warn('[assets:pickAndImport]', p, err);
        }
      }
      return { imported };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { error: msg };
    }
  });

  ipcMain.handle('assets:importPaths', (_e, bookId: string, paths: string[]) =>
    safe(() => {
      const imported = [];
      for (const p of paths) {
        imported.push(importAssetFromPath({ bookId, sourcePath: p, assetType: 'image' }));
      }
      return { imported };
    }),
  );

  console.log('[IPC] Handlers de assets registrados.');
}

/**
 * Elimina la carpeta local del libro (medio) tras borrar el proyecto en BD.
 */
export function removeBookMediaFolder(bookId: string): void {
  try {
    const dir = join(getBooksRootDir(), bookId);
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  } catch (e) {
    console.warn('[IPC] removeBookMediaFolder', bookId, e);
  }
}
