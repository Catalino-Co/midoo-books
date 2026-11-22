<script lang="ts">
  /**
   * PARTE 9 — Vista previa paginada: miniaturas + barra + UNA página.
   * La página la dibuja BookPage.svelte, el mismo componente que imprime el PDF.
   */
  import type { PaginatedBookResult, RenderedPage } from '$lib/core/editorial/page-layout-model';
  import type { Asset } from '$lib/core/domain/asset';
  import { pageDimensionsMm } from '$lib/core/editorial/document-page-geometry';
  import { CSS_PX_PER_MM } from '$lib/core/editorial/document-layout-metrics';
  import BookPage from '$lib/components/book/BookPage.svelte';

  let {
    bookId,
    layout,
    initialPhysicalPage = 1,
    assets = [],
    showLayoutDebug = false,
  }: {
    bookId: string;
    layout: PaginatedBookResult;
    initialPhysicalPage?: number;
    assets?: Asset[];
    showLayoutDebug?: boolean;
  } = $props();

  let activeIndex = $state(0);
  /** Guías de caja de texto y zona segura (no salen en el PDF). */
  let showGuides = $state(false);

  $effect(() => {
    const nextIndex = layout.pages.findIndex(page => page.physicalPageNumber === initialPhysicalPage);
    activeIndex = nextIndex >= 0 ? nextIndex : 0;
  });

  let activePage = $derived(layout.pages[Math.min(activeIndex, Math.max(0, layout.pages.length - 1))] ?? null);

  let layoutSettings = $derived(layout.layoutSettings);

  // ── Zoom ───────────────────────────────────────────────────────────────────
  const ZOOM_STEPS  = [0.40, 0.50, 0.65, 0.75, 0.85, 1.00, 1.25, 1.50];
  const ZOOM_MIN    = 0.40;
  const ZOOM_MAX    = 1.50;
  const ZOOM_DEFAULT = 0.85;

  let zoom = $state(ZOOM_DEFAULT);

  function zoomIn() {
    const next = ZOOM_STEPS.find(z => z > zoom + 0.001);
    zoom = next !== undefined ? next : Math.min(ZOOM_MAX, Math.round((zoom + 0.05) * 100) / 100);
  }
  function zoomOut() {
    const prev = [...ZOOM_STEPS].reverse().find(z => z < zoom - 0.001);
    zoom = prev !== undefined ? prev : Math.max(ZOOM_MIN, Math.round((zoom - 0.05) * 100) / 100);
  }
  function resetZoom() { zoom = ZOOM_DEFAULT; }

  // ── Dimensiones físicas a 96 dpi (sin redondear: misma hoja que el PDF) ─────
  let physWidthPx  = $derived(pageDimensionsMm(layoutSettings).widthMm * CSS_PX_PER_MM);
  let physHeightPx = $derived(pageDimensionsMm(layoutSettings).heightMm * CSS_PX_PER_MM);

  let pagedRootCss = $derived.by(() => {
    const bleedMm = Math.max(0, layoutSettings.bleedMm ?? 0);
    return [
      `--page-phys-w:${physWidthPx}px`,
      `--page-phys-h:${physHeightPx}px`,
      `--zoom:${zoom}`,
      `--page-w:${Math.round(physWidthPx * zoom)}px`,
      `--page-h:${Math.round(physHeightPx * zoom)}px`,
      `--bleed-outline:${showGuides && bleedMm > 0 ? `${bleedMm}mm` : '0'}`,
    ].join(';');
  });

  function firstEditableBlockId(page: RenderedPage): string | null {
    return page.placements.find(pl => pl.block?.id)?.block?.id ?? null;
  }

  function contentHrefForPage(page: RenderedPage): string | null {
    if (!page.primarySectionId) return null;
    const url = new URL(`/books/${bookId}/content`, 'https://midoo.local');
    url.searchParams.set('sectionId', page.primarySectionId);
    url.searchParams.set('page', String(page.physicalPageNumber));
    const blockId = firstEditableBlockId(page);
    if (blockId) url.searchParams.set('blockId', blockId);
    return `${url.pathname}${url.search}`;
  }
</script>

<div class="paged-root" style={pagedRootCss}>
  {#if layout.pages.length === 0}
    <p class="paged-empty">No hay páginas que mostrar.</p>
  {:else}
    <aside class="thumb-col" aria-label="Miniaturas de páginas">
      {#each layout.pages as p, i (p.internalIndex)}
        <button
          type="button"
          class="thumb"
          class:thumb--active={i === activeIndex}
          class:thumb--blank={p.kind === 'editorial_blank'}
          onclick={() => { activeIndex = i; }}
        >
          <span class="thumb-side">{p.side === 'right' ? 'R' : 'L'}</span>
          <span class="thumb-num">{p.visualPageNumber}</span>
        </button>
      {/each}
    </aside>

    <div class="main-col">
      {#if activePage}
        <div class="page-toolbar">
          <span class="toolbar-meta">
            Página física <strong>{activePage.physicalPageNumber}</strong> · {activePage.side === 'right' ? 'Recto' : 'Verso'}
            {#if activePage.kind === 'editorial_blank'}
              · <em>Blanco editorial</em>
            {/if}
            {#if activePage.editorial.editorialLabel}
              · Folio visible <strong>{activePage.editorial.editorialLabel}</strong>
            {/if}
          </span>
          <div class="toolbar-nav">
            {#if contentHrefForPage(activePage)}
              <a class="btn-mini btn-mini--jump" href={contentHrefForPage(activePage) ?? '#'}>Contenido</a>
            {/if}

            <button
              type="button"
              class="btn-mini btn-mini--toggle"
              aria-pressed={showGuides}
              title="Mostrar caja de texto, zona segura y sangrado (no se imprimen)"
              onclick={() => { showGuides = !showGuides; }}
            >Guías</button>

            <!-- Controles de zoom -->
            <div class="zoom-controls" title="Zoom de visualización (no afecta la paginación)">
              <button type="button" class="btn-mini btn-mini--zoom" disabled={zoom <= ZOOM_MIN} onclick={zoomOut} title="Reducir zoom">−</button>
              <button type="button" class="zoom-label" onclick={resetZoom} title="Restablecer zoom al 85%">{Math.round(zoom * 100)}%</button>
              <button type="button" class="btn-mini btn-mini--zoom" disabled={zoom >= ZOOM_MAX} onclick={zoomIn} title="Aumentar zoom">+</button>
            </div>

            <button
              type="button"
              class="btn-mini"
              disabled={activeIndex <= 0}
              onclick={() => { activeIndex = Math.max(0, activeIndex - 1); }}
            >←</button>
            <button
              type="button"
              class="btn-mini"
              disabled={activeIndex >= layout.pages.length - 1}
              onclick={() => { activeIndex = Math.min(layout.pages.length - 1, activeIndex + 1); }}
            >→</button>
          </div>
        </div>

        <!-- Wrapper que ocupa el espacio DOM escalado -->
        <div class="page-sheet-wrap">
          <div class="page-sheet" class:page-sheet--bleed={showGuides}>
            <BookPage {bookId} {layout} page={activePage} {assets} mode="preview" {showGuides} />
          </div>
        </div>

        {#if showLayoutDebug && activePage.debugNotes.length > 0}
          <details class="page-debug">
            <summary>Notas de maquetación</summary>
            <ul>
              {#each activePage.debugNotes as n}
                <li>{n}</li>
              {/each}
            </ul>
          </details>
        {/if}
      {/if}
    </div>
  {/if}
</div>

<style>
  .paged-root {
    --preview-toolbar-h: 30px;
    --preview-toolbar-gap: 10px;
    display: flex;
    gap: 0;
    align-items: stretch;
    width: 100%;
    max-width: 1100px;
    margin: 0 auto;
    /* Llenar el alto disponible en el panel */
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  .paged-empty {
    color: rgba(255, 255, 255, 0.4);
    font-size: 14px;
  }

  .thumb-col {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 92px;
    /* Ocupa todo el alto disponible y hace scroll internamente */
    height: 100%;
    max-height: 100%;
    overflow-y: auto;
    flex-shrink: 0;
    padding: 8px 6px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 12px 0 0 12px;
    /* Separador visual con el área principal */
    border-right: 1px solid rgba(255, 255, 255, 0.07);
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.1) transparent;
  }
  .thumb {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    width: 100%;
    min-height: 40px;
    padding: 8px 12px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(30, 30, 46, 0.9);
    color: rgba(255, 255, 255, 0.65);
    font-size: 12px;
    cursor: pointer;
    font-family: inherit;
    text-align: left;
  }
  .thumb:hover {
    border-color: rgba(122, 184, 232, 0.35);
  }
  .thumb--active {
    border-color: rgba(122, 184, 232, 0.75);
    background: rgba(122, 184, 232, 0.12);
    color: #e8f4ff;
  }
  .thumb--blank {
    border-style: dashed;
    opacity: 0.85;
  }
  .thumb-side {
    font-size: 10px;
    font-weight: 800;
    opacity: 0.45;
    min-width: 16px;
  }
  .thumb-num {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    margin-left: auto;
  }

  .main-col {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    /* Scroll vertical independiente para la página */
    overflow-y: auto;
    overflow-x: auto;
    padding: 12px 20px 40px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.12) transparent;
  }

  .page-toolbar {
    min-height: var(--preview-toolbar-h);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }
  .toolbar-meta {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.55);
  }
  .toolbar-nav {
    display: flex;
    gap: 6px;
  }
  .btn-mini {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 30px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.06);
    color: #fff;
    cursor: pointer;
    font-size: 14px;
    text-decoration: none;
    font-family: inherit;
  }
  .btn-mini--jump {
    width: auto;
    min-width: 78px;
    padding: 0 10px;
    font-size: 12px;
    color: #c8e6ff;
    border-color: rgba(122, 184, 232, 0.32);
    background: rgba(122, 184, 232, 0.12);
  }
  .btn-mini:disabled {
    opacity: 0.35;
    cursor: default;
  }

  /* ── Controles de zoom ─────────────────────────────────────────────────── */
  .zoom-controls {
    display: flex;
    align-items: center;
    gap: 2px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 7px;
    padding: 2px;
  }

  .btn-mini--zoom {
    width: 26px;
    height: 26px;
    font-size: 16px;
    font-weight: 400;
    border: none;
    background: transparent;
    border-radius: 5px;
  }
  .btn-mini--zoom:hover:not(:disabled) {
    background: rgba(255,255,255,0.1);
    border-color: transparent;
  }

  .zoom-label {
    min-width: 40px;
    height: 26px;
    padding: 0 4px;
    font-size: 11px;
    font-weight: 600;
    font-family: inherit;
    font-variant-numeric: tabular-nums;
    color: rgba(255,255,255,0.7);
    background: transparent;
    border: none;
    cursor: pointer;
    border-radius: 4px;
    text-align: center;
  }
  .zoom-label:hover {
    background: rgba(255,255,255,0.08);
    color: #fff;
  }

  /* Wrapper que reserva el espacio DOM exacto de la hoja escalada */
  .page-sheet-wrap {
    width: var(--page-w);
    height: var(--page-h);
    flex-shrink: 0;
    margin: 0 auto;
  }
  .page-sheet {
    width: var(--page-phys-w);
    height: var(--page-phys-h);
    transform: scale(var(--zoom));
    transform-origin: top left;
    box-shadow:
      0 2px 4px rgba(0, 0, 0, 0.12),
      0 12px 28px rgba(0, 0, 0, 0.22);
    border-radius: 2px;
  }
  .page-sheet--bleed {
    outline: var(--bleed-outline, 0) solid rgba(255, 130, 70, 0.35);
  }

  .btn-mini--toggle {
    width: auto;
    padding: 0 10px;
    font-size: 12px;
  }
  .btn-mini--toggle[aria-pressed='true'] {
    border-color: rgba(122, 184, 232, 0.6);
    background: rgba(122, 184, 232, 0.18);
    color: #e8f4ff;
  }

  .page-debug {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
    max-width: var(--page-w);
    margin: 0 auto;
  }
  .page-debug summary { cursor: pointer; user-select: none; }
  .page-debug ul { margin: 6px 0 0; padding-left: 1.1em; }
</style>
