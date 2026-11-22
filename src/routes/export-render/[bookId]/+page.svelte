<script lang="ts">
  /**
   * /export-render/[bookId]/+page.svelte
   *
   * Ruta sin interfaz que el proceso main abre en una ventana oculta y imprime a PDF
   * (exports:renderPdf). Dibuja TODAS las páginas con BookPage.svelte, el mismo
   * componente de la vista previa, así que el PDF es la vista previa.
   *
   * Contrato con el proceso main:
   *   - @page { size: <ancho>mm <alto>mm; margin: 0 } → tamaño real de la hoja
   *     (printToPDF con preferCSSPageSize: true).
   *   - window.__exportReady → Promise que resuelve con
   *       { ok: true, pages, widthMm, heightMm }  cuando el layout está pintado,
   *       las fuentes cargadas y TODAS las imágenes decodificadas;
   *       { ok: false, error }                    si algo falla.
   *   - Además se emite el evento 'export-ready' con el mismo detalle.
   */
  import { page } from '$app/stores';
  import { tick } from 'svelte';
  import { loadBookLayoutSnapshot, computePaginatedPreviewForBrowser } from '$lib/services/preview-layout.service';
  import { listAssets } from '$lib/services/assets.service';
  import { ensureBookFontsLoaded } from '$lib/services/book-fonts.service';
  import { pageDimensionsMm } from '$lib/core/editorial/document-page-geometry';
  import type { PaginatedBookResult } from '$lib/core/editorial/page-layout-model';
  import type { Asset } from '$lib/core/domain/asset';
  import BookPage from '$lib/components/book/BookPage.svelte';

  type ReadyDetail =
    | { ok: true; pages: number; widthMm: number; heightMm: number }
    | { ok: false; error: string };

  let bookId = $derived($page.params.bookId);

  let layout    = $state<PaginatedBookResult | null>(null);
  let assets    = $state<Asset[]>([]);
  let loadError = $state<string | null>(null);

  // Señal para el proceso main: se crea de forma síncrona para que exista cuando
  // executeJavaScript('window.__exportReady') se evalúe tras loadURL().
  let resolveReady: ((d: ReadyDetail) => void) | null = null;
  if (typeof window !== 'undefined') {
    (window as any).__exportReady = new Promise<ReadyDetail>(res => { resolveReady = res; });
  }

  function signal(detail: ReadyDetail) {
    if (!resolveReady) return;
    resolveReady(detail);
    resolveReady = null;
    document.dispatchEvent(new CustomEvent('export-ready', { detail }));
  }

  /** Espera a que todas las <img> de la página estén cargadas y decodificadas. */
  async function waitForImages(): Promise<string[]> {
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('.export-root img'));
    const failed: string[] = [];
    await Promise.all(imgs.map(async img => {
      try {
        if (!img.complete) {
          await new Promise<void>((res, rej) => {
            img.addEventListener('load', () => res(), { once: true });
            img.addEventListener('error', () => rej(new Error('error')), { once: true });
          });
        }
        if (img.naturalWidth === 0) throw new Error('vacía');
        await img.decode().catch(() => undefined);
      } catch {
        failed.push(img.currentSrc || img.src);
      }
    }));
    return failed;
  }

  async function load(id: string) {
    try {
      assets = await listAssets(id);
      await ensureBookFontsLoaded(id, assets);
      const snap = await loadBookLayoutSnapshot(id);
      layout = await computePaginatedPreviewForBrowser(snap);

      await tick();
      const failed = await waitForImages();
      if (failed.length) console.warn('[export-render] Imágenes que no cargaron:', failed);
      await document.fonts.ready;
      // Dos frames para asegurar que el último layout está pintado.
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      const { widthMm, heightMm } = pageDimensionsMm(layout.layoutSettings);
      signal({ ok: true, pages: layout.pages.length, widthMm, heightMm });
    } catch (e) {
      loadError = e instanceof Error ? e.message : String(e);
      signal({ ok: false, error: loadError });
    }
  }

  $effect(() => { if (bookId) void load(bookId); });
</script>

<svelte:head>
  <title>Export render</title>
  {#if layout}
    {@const dims = pageDimensionsMm(layout.layoutSettings)}
    {@html `<style>@page{size:${dims.widthMm}mm ${dims.heightMm}mm;margin:0}</style>`}
  {/if}
</svelte:head>

{#if loadError}
  <div class="msg msg--error">Error: {loadError}</div>
{:else if !layout}
  <div class="msg">Cargando…</div>
{:else}
  <div class="export-root">
    {#each layout.pages as pg (pg.internalIndex)}
      <div class="export-page">
        <BookPage {bookId} {layout} page={pg} {assets} mode="print" />
      </div>
    {/each}
  </div>
{/if}

<style>
  :global(html),
  :global(body) {
    margin: 0 !important;
    padding: 0 !important;
    background: #ffffff !important;
    color: #111111 !important;
  }

  .export-root {
    background: #ffffff;
  }

  /* Una hoja por página impresa. BookPage ya mide exactamente el tamaño de la hoja. */
  .export-page {
    break-after: page;
    page-break-after: always;
    break-inside: avoid;
  }
  .export-page:last-child {
    break-after: auto;
    page-break-after: auto;
  }

  .msg {
    padding: 20px;
    color: #555;
    font-family: sans-serif;
  }
  .msg--error { color: #900; }
</style>
