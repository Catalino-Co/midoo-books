/**
 * electron/ipc/handlers/exports.handlers.ts
 *
 * IPC handlers para el módulo de exportación de MIDOO Books.
 *
 * Canales:
 *   exports:create       — Crea un registro ExportJob (status: pending)
 *   exports:update       — Actualiza status/outputPath/errorMsg de un job
 *   exports:listByBook   — Lista los últimos N jobs de un libro
 *   exports:renderPdf    — Abre ventana oculta, espera Paged.js, captura PDF
 *   exports:saveFile     — Guarda un Buffer en disco con dialog nativo
 */

import { ipcMain, dialog, BrowserWindow } from 'electron';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { ExportRepo } from '../../database/repositories/index';
import type { CreateExportJobInput, UpdateExportJobInput } from '../../../src/lib/core/domain/export';

// ─── Tipo de opciones de render PDF ──────────────────────────────────────────

interface PdfRenderOptions {
  format: 'screen' | 'print';
  /** URL base del devServer o app. Ej: http://localhost:5173 */
  baseUrl: string;
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

  // PDF via printToPDF ──────────────────────────────────────────────────────────

  ipcMain.handle('exports:renderPdf', async (_e, bookId: string, opts: PdfRenderOptions) =>
    safeAsync(async () => {
      const url = `${opts.baseUrl}/export-render/${encodeURIComponent(bookId)}?format=${opts.format}`;

      // Ruta al preload compilado — mismo directorio que main.cjs (dist-electron/).
      // Los BrowserWindow hijos NO heredan el preload automáticamente: hay que
      // especificarlo explícitamente en cada nueva ventana.
      const preloadPath = join(__dirname, 'preload.cjs');

      const win = new BrowserWindow({
        // show:false desactiva el compositor GPU en algunas versiones de Electron/Chromium,
        // lo que provoca que printToPDF capture páginas en blanco.
        // Solución: crear la ventana oculta pero mostrarla (fuera de pantalla) justo antes
        // de printToPDF para garantizar que el pipeline de render esté activo.
        show:   false,
        x:      -10000,   // posición fuera de pantalla visible
        y:      -10000,
        width:  1280,
        height: 900,
        webPreferences: {
          preload:          preloadPath,
          nodeIntegration:  false,
          contextIsolation: true,
          // sandbox: false es necesario para que ipcRenderer funcione en el preload
          sandbox:          false,
        },
      });

      // loadURL resuelve cuando 'did-finish-load' se dispara
      await win.loadURL(url);

      // Esperar a que el renderer señalice que el contenido está listo.
      // La ruta export-render expone window.__exportReady (Promise) y dispara
      // el evento 'export-ready' cuando termina el render + requestAnimationFrame.
      // Timeout de seguridad de 15 s para libros grandes.
      await win.webContents.executeJavaScript(`
        new Promise((resolve) => {
          const TIMEOUT_MS = 15000;
          const timer = setTimeout(resolve, TIMEOUT_MS);
          function done() { clearTimeout(timer); resolve(undefined); }

          if (window.__exportReady) {
            window.__exportReady.then(done).catch(done);
          } else {
            // Fallback: el script aún no corrió — esperar al evento custom
            document.addEventListener('export-ready', done, { once: true });
          }
        })
      `);

      // Leer dimensiones físicas de página (mm) expuestas por el renderer
      const pageDims = await win.webContents.executeJavaScript(
        'window.__exportPageDims || null'
      ) as { width: number; height: number; unit: string } | null;

      console.log('[PDF] pageDims recibidas:', pageDims);

      // ── Diagnóstico del DOM antes de imprimir ────────────────────────────
      const domSnap = await win.webContents.executeJavaScript(`
        (function() {
          const root = document.querySelector('.export-root');
          if (!root) return 'NO .export-root';
          const pages = root.querySelectorAll('.export-page');
          const bodies = root.querySelectorAll('.export-body');
          const first = bodies[0];
          return JSON.stringify({
            pageCount: pages.length,
            bodyCount: bodies.length,
            firstBodyHtml: first ? first.innerHTML.slice(0, 300) : null,
            firstBodyVisible: first
              ? { w: first.offsetWidth, h: first.offsetHeight, overflow: getComputedStyle(first).overflow }
              : null,
          });
        })()
      `).catch(() => 'executeJavaScript error');
      console.log('[PDF] DOM snapshot:', domSnap);

      // Activar el compositor GPU mostrando la ventana (está fuera de pantalla).
      // Sin esto, show:false puede dejar el pipeline de render inactivo → páginas en blanco.
      win.show();
      // Breve pausa para que el frame pintado sea capturado por printToPDF
      await new Promise<void>(res => setTimeout(res, 200));

      // ── Opciones de printToPDF ───────────────────────────────────────────────
      // IMPORTANTE: NO pasar pageSize como objeto { width, height } en micrones.
      // Cuando se pasa así, Electron/Chromium genera un PDF con MediaBox en unidades
      // internas (1/72000 mm ≈ 15 millones de unidades para una página A4), lo que
      // hace que Adobe Acrobat y otros lectores muestren "dimensions out of range"
      // y rendericen páginas en blanco.
      //
      // Solución: omitir pageSize aquí y dejar que la regla CSS
      //   @page { size: Xmm Ymm; margin: 0 }
      // (inyectada en <svelte:head> por /export-render) controle las dimensiones.
      // Chromium respeta @page { size } y genera un MediaBox estándar en puntos PDF.
      if (pageDims) {
        console.log(`[PDF] dimensiones usadas por @page CSS: ${pageDims.width}×${pageDims.height}mm`);
      } else {
        console.warn('[PDF] pageDims no disponibles — se usará el tamaño definido en @page CSS o Letter por defecto');
      }
      const printOptions: Electron.PrintToPDFOptions = {
        margins:         { marginType: 'none' },
        printBackground: true,
        // pageSize omitido intencionalmente — controlado por CSS @page { size }
      };

      const pdfBuffer = await win.webContents.printToPDF(printOptions);
      win.destroy();

      return pdfBuffer;
    }),
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
