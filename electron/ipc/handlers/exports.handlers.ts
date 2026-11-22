/**
 * electron/ipc/handlers/exports.handlers.ts
 *
 * IPC handlers para el módulo de exportación de MIDOO Books.
 *
 * Canales:
 *   exports:create        — Crea un registro ExportJob (status: pending)
 *   exports:update        — Actualiza status/outputPath/errorMsg de un job
 *   exports:listByBook    — Lista los últimos N jobs de un libro
 *   exports:clearHistory  — Borra todos los jobs de un libro
 *   exports:renderPdf     — Abre la ruta /export-render en una ventana oculta y la imprime a PDF
 *   exports:saveFile      — Guarda un Buffer en disco con dialog nativo
 */

import { ipcMain, dialog, BrowserWindow } from 'electron';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { ExportRepo } from '../../database/repositories/index';
import { uiUrl } from '../../main/ui-origin';
import type { CreateExportJobInput, UpdateExportJobInput } from '../../../src/lib/core/domain/export';

// ─── Tipo de opciones de render PDF ──────────────────────────────────────────

interface PdfRenderOptions {
  format: 'screen' | 'print';
  /**
   * @deprecated Se ignora. El proceso main construye la URL con ui-origin.ts para no
   * abrir con el preload completo una URL enviada por el renderer. Se mantiene en la
   * firma por compatibilidad con ElectronAdapter.
   */
  baseUrl?: string;
}

/** Tiempo máximo para que /export-render pagine, cargue fuentes e imágenes. */
const EXPORT_READY_TIMEOUT_MS = 60_000;

/**
 * Renderiza el libro a PDF con la MISMA ruta y el MISMO componente de página que la
 * vista previa (/export-render usa BookPage.svelte).
 */
async function renderBookPdf(bookId: string, format: 'screen' | 'print'): Promise<Buffer> {
  const safeFormat = format === 'print' ? 'print' : 'screen';
  const url = uiUrl(`/export-render/${encodeURIComponent(bookId)}?format=${safeFormat}`);

  const win = new BrowserWindow({
    // show:false puede dejar el compositor inactivo (páginas en blanco en printToPDF):
    // se crea oculta y fuera de pantalla, y se muestra justo antes de imprimir.
    show:   false,
    x:      -10000,
    y:      -10000,
    width:  1280,
    height: 900,
    webPreferences: {
      // Los BrowserWindow hijos no heredan el preload: la ruta necesita electronAPI
      // para leer el libro de la BD.
      preload:          join(__dirname, 'preload.cjs'),
      nodeIntegration:  false,
      contextIsolation: true,
      sandbox:          false,
    },
  });

  try {
    await win.loadURL(url);

    // /export-render expone window.__exportReady: resuelve con { ok, pages, ... } cuando
    // el layout está pintado, las fuentes cargadas y todas las imágenes decodificadas.
    const ready = await win.webContents.executeJavaScript(`
      new Promise((resolve) => {
        const timer = setTimeout(() => resolve({ ok: false, error: 'timeout' }), ${EXPORT_READY_TIMEOUT_MS});
        const done = (v) => { clearTimeout(timer); resolve(v ?? { ok: true }); };
        const fail = (e) => { clearTimeout(timer); resolve({ ok: false, error: String(e && e.message || e) }); };
        if (window.__exportReady) window.__exportReady.then(done, fail);
        else document.addEventListener('export-ready', (ev) => done(ev.detail), { once: true });
      })
    `) as { ok: boolean; error?: string; pages?: number; widthMm?: number; heightMm?: number };

    if (!ready?.ok) {
      throw new Error(
        ready?.error === 'timeout'
          ? `La vista de exportación no terminó en ${EXPORT_READY_TIMEOUT_MS / 1000} s.`
          : `No se pudo preparar el PDF: ${ready?.error ?? 'error desconocido'}`,
      );
    }
    console.log(`[PDF] ${ready.pages ?? '?'} páginas · ${ready.widthMm}×${ready.heightMm} mm`);

    win.show();
    await new Promise<void>(res => setTimeout(res, 200));

    return await win.webContents.printToPDF({
      // El tamaño lo dicta @page { size: <ancho>mm <alto>mm } de /export-render.
      // Sin preferCSSPageSize, Chromium ignora @page y usa Carta (612×792 pt).
      preferCSSPageSize: true,
      // Márgenes en pulgadas (Electron ≥ 21); los márgenes del libro van en el HTML.
      margins:           { top: 0, bottom: 0, left: 0, right: 0 },
      printBackground:   true,
    });
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

interface SaveFileFilter {
  name: string;
  extensions: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safe<T>(fn: () => T): T | { error: string } {
  try {
    return fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[IPC exports]', msg);
    return { error: msg };
  }
}

function safeAsync<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
  return fn().catch(err => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[IPC exports]', msg);
    return { error: msg };
  });
}

// ─── Registro ─────────────────────────────────────────────────────────────────

export function registerExportHandlers(): void {

  // CRUD de jobs ───────────────────────────────────────────────────────────────

  ipcMain.handle('exports:create', (_e, input: CreateExportJobInput) =>
    safe(() => ExportRepo.createExportJob(input)),
  );

  ipcMain.handle('exports:update', (_e, id: string, updates: UpdateExportJobInput) =>
    safe(() => ExportRepo.updateExportJob(id, updates)),
  );

  ipcMain.handle('exports:listByBook', (_e, bookId: string, limit?: number) =>
    safe(() => ExportRepo.listExportJobsByBook(bookId, limit ?? 10)),
  );

  ipcMain.handle('exports:clearHistory', (_e, bookId: string) =>
    safe(() => ExportRepo.clearExportJobsByBook(bookId)),
  );

  // PDF via printToPDF ──────────────────────────────────────────────────────────

  ipcMain.handle('exports:renderPdf', async (_e, bookId: string, opts: PdfRenderOptions) =>
    safeAsync(() => renderBookPdf(bookId, opts.format)),
  );

  // Guardar archivo con diálogo nativo ─────────────────────────────────────────

  ipcMain.handle(
    'exports:saveFile',
    async (
      _e,
      buffer: Buffer,
      defaultName: string,
      filters: SaveFileFilter[],
    ) =>
      safeAsync(async () => {
        const result = await dialog.showSaveDialog({
          title:       'Guardar archivo exportado',
          defaultPath: defaultName,
          filters,
          properties:  ['createDirectory'],
        });

        if (result.canceled || !result.filePath) {
          return { success: false, canceled: true };
        }

        writeFileSync(result.filePath, Buffer.from(buffer));
        return { success: true, path: result.filePath };
      }),
  );

  console.log('[IPC] Export handlers registrados.');
}
