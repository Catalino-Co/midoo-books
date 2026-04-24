import { ipcMain } from 'electron';
import { LayoutRepo } from '../../database/repositories/index';
import type { UpdateLayoutSettingsInput } from '../../../src/lib/core/domain/layout';

function safe<T>(fn: () => T): T | { error: string } {
  try {
    return fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[IPC layout]', msg);
    return { error: msg };
  }
}

export function registerLayoutHandlers(): void {
  ipcMain.handle('layout:getByBookId', (_event, bookId: string) =>
    safe(() => LayoutRepo.ensureLayoutSettingsForBook(bookId)),
  );

  ipcMain.handle('layout:updateByBookId', (_event, bookId: string, input: UpdateLayoutSettingsInput) =>
    safe(() => LayoutRepo.updateLayoutSettings(bookId, input)),
  );

  console.log('[IPC] Handlers de layout registrados.');
}
