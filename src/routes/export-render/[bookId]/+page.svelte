<script lang="ts">
  /**
   * /export-render/[bookId]/+page.svelte
   *
   * Ruta sin chrome usada por exports:renderPdf (BrowserWindow oculto).
   * printToPDF necesita:
   *   1. Cada .export-page con dimensiones físicas exactas en mm
   *   2. Márgenes aplicados como padding en mm (NO posicionamiento absoluto)
   *   3. page-break-after:always entre páginas
   *   4. window.__exportReady  → Promise que resuelve cuando el DOM está pintado
   *   5. window.__exportPageDims → { width, height, unit: 'mm' }
   */
  import { page } from '$app/stores';
  import { loadBookLayoutSnapshot, computePaginatedPreviewForBrowser } from '$lib/services/preview-layout.service';
  import { listAssets } from '$lib/services/assets.service';
  import { pageDimensionsMm, getPageContentBoxMm } from '$lib/core/editorial/document-page-geometry';
  import {
    resolveBookStyles,
    resolveEffectiveBookStyleForBlock,
    buildBookStyleCss,
    type BookStyleDefinition,
  } from '$lib/core/editorial/book-styles';
  import { assetDisplayUrl } from '$lib/services/assets.service';
  import {
    parseImageBlockContent,
    parseChapterOpeningContent,
    chapterOpeningPreviewRootClassNames,
  } from '$lib/services/content.service';
  import type { PaginatedBookResult, PlacedBlock, RenderedPage } from '$lib/core/editorial/page-layout-model';
  import type { Asset } from '$lib/core/domain/asset';

  let bookId = $derived($page.params.bookId);
  let format = $derived(($page.url.searchParams.get('format') ?? 'screen') as 'screen' | 'print');

  let layout    = $state<PaginatedBookResult | null>(null);
  let assets    = $state<Asset[]>([]);
  let loadError = $state<string | null>(null);

  // ── Señales para el proceso principal ────────────────────────────────────────
  // Se inicializan sincrónicamente para que estén disponibles cuando
  // executeJavaScript('window.__exportReady') se evalúe tras loadURL().
  let _exportResolve: (() => void) | null = null;
  if (typeof window !== 'undefined') {
    (window as any).__exportReady    = new Promise<void>((res) => { _exportResolve = res; });
    (window as any).__exportPageDims = null;
  }

  // ── Carga de datos ────────────────────────────────────────────────────────────

  async function load() {
    try {
      const snap = await loadBookLayoutSnapshot(bookId);
      assets = await listAssets(bookId);
      layout = await computePaginatedPreviewForBrowser(snap);

      const { widthMm, heightMm } = pageDimensionsMm(snap.layoutSettings);
      if (typeof window !== 'undefined') {
        (window as any).__exportPageDims = { width: widthMm, height: heightMm, unit: 'mm' };
      }
    } catch (e) {
      loadError = e instanceof Error ? e.message : String(e);
      // Resolver incluso en error para que printToPDF no espere 15 s
      signalReady();
    }
  }

  $effect(() => { if (bookId) void load(); });

  function signalReady() {
    if (typeof window === 'undefined' || !_exportResolve) return;
    // setTimeout en lugar de requestAnimationFrame: en ventanas ocultas (show:false)
    // los callbacks de rAF pueden no dispararse. setTimeout siempre se ejecuta.
    // 150 ms es suficiente para que Svelte termine de renderizar el DOM.
    setTimeout(() => {
      _exportResolve?.();
      _exportResolve = null;
      document.dispatchEvent(new CustomEvent('export-ready'));
    }, 150);
  }

  // Señalizar cuando layout esté disponible y el DOM renderizado
  $effect(() => {
    if (layout) signalReady();
  });

  // ── Helpers de render ──────────────────────────────────────────────────────────

  function assetUrlFor(assetId: string | null | undefined): string | null {
    if (!assetId) return null;
    const a = assets.find(x => x.id === (assetId as any));
    return a ? assetDisplayUrl(bookId, a.storagePath) : null;
  }

  function bodyText(pl: PlacedBlock): string {
    return pl.textOverride ?? pl.block?.contentText ?? '';
  }

  function textStyle(pg: RenderedPage, pl: PlacedBlock): string {
    if (!pl.block || !layout) return '';
    const resolved = resolveEffectiveBookStyleForBlock(
      layout.layoutSettings,
      pg.primarySectionType ? { sectionType: pg.primarySectionType } : null,
      pl.block,
    );
    return resolved ? buildBookStyleCss(resolved) : '';
  }

  function isFullPageImage(pg: RenderedPage, pl: PlacedBlock): boolean {
    if (pl.block?.blockType !== 'IMAGE') return false;
    const img = parseImageBlockContent(pl.block.contentJson);
    return pg.primarySectionType === 'COVER' || img.fillPage;
  }

  function coTextStyle(style: BookStyleDefinition, align: 'left' | 'center' | 'right'): string {
    return buildBookStyleCss({ ...style, textAlign: align }, { includeMargins: false });
  }

  /** Padding en mm para el body de cada página según sus márgenes configurados. */
  function pagePaddingStyle(pg: RenderedPage): string {
    if (!layout) return '';
    const box = getPageContentBoxMm(layout.layoutSettings, pg.side);
    // Altura explícita del body = altura página − margen top − margen bottom
    // Evita que height:100% colapse en el pipeline de print de Chromium
    const { heightMm } = pageDimensionsMm(layout.layoutSettings);
    const bodyHeightMm = heightMm - box.marginTopMm - box.marginBottomMm;
    return [
      `padding-top:${box.marginTopMm}mm`,
      `padding-right:${box.marginRightMm}mm`,
      `padding-bottom:${box.marginBottomMm}mm`,
      `padding-left:${box.marginLeftMm}mm`,
      `min-height:${bodyHeightMm}mm`,
    ].join(';');
  }

  /** Estilo de página con dimensiones físicas exactas. */
  function pageStyle(pg: RenderedPage): string {
    if (!layout) return '';
    const { widthMm, heightMm } = pageDimensionsMm(layout.layoutSettings);
    return `width:${widthMm}mm;min-height:${heightMm}mm;max-height:${heightMm}mm`;
  }

  let bookStyles = $derived(layout ? resolveBookStyles(layout.layoutSettings) : null);
</script>

<svelte:head>
  <title>Export render</title>
  {#if layout}
    {@const dims = pageDimensionsMm(layout.layoutSettings)}
    {@html `<style>@page{size:${dims.widthMm}mm ${dims.heightMm}mm;margin:0}</style>`}
  {/if}
</svelte:head>

{#if loadError}
  <div style="color:#900;padding:20px;font-family:sans-serif">Error: {loadError}</div>
{:else if !layout}
  <div style="padding:20px;color:#555;font-family:sans-serif">Cargando…</div>
{:else}
  <div class="export-root">
    {#each layout.pages as pg (pg.internalIndex)}
      <div class="export-page" style={pageStyle(pg)}>
        {#if pg.kind === 'editorial_blank'}
          <!-- página en blanco editorial -->
        {:else}
          <div class="export-body" style={pagePaddingStyle(pg)}>
            {#each pg.placements as pl, pi (`${pl.block?.id ?? pl.syntheticType ?? 'syn'}-${pi}`)}
              {#if pl.block?.blockType === 'IMAGE'}
                {@const img = parseImageBlockContent(pl.block.contentJson)}
                {@const url = assetUrlFor(img.assetId)}
                {#if url}
                  <figure class="blk-img" class:blk-img--fill={isFullPageImage(pg, pl)}>
                    <img src={url} alt={img.altText ?? ''} />
                    {#if img.caption?.trim() && !isFullPageImage(pg, pl)}
                      <figcaption>{img.caption}</figcaption>
                    {/if}
                  </figure>
                {/if}
              {:else if pl.block?.blockType === 'CHAPTER_OPENING'}
                {@const co = parseChapterOpeningContent(pl.block.contentJson)}
                {@const cls = chapterOpeningPreviewRootClassNames(co)}
                {#if bookStyles}
                  <div class="blk-co {cls}">
                    {#if co.chapterLabel.trim()}
                      <div class="co-label" style={coTextStyle(bookStyles.CHAPTER_OPENING_LABEL, co.textAlign)}>{co.chapterLabel}</div>
                    {/if}
                    {#if co.title.trim()}
                      <div class="co-title" style={coTextStyle(bookStyles.CHAPTER_OPENING_TITLE, co.textAlign)}>{co.title}</div>
                    {/if}
                  </div>
                {/if}
              {:else if pl.block?.blockType === 'HEADING_1'}
                <h1 style={textStyle(pg, pl)}>{bodyText(pl)}</h1>
              {:else if pl.block?.blockType === 'HEADING_2'}
                <h2 style={textStyle(pg, pl)}>{bodyText(pl)}</h2>
              {:else if pl.block?.blockType === 'HEADING_3'}
                <h3 style={textStyle(pg, pl)}>{bodyText(pl)}</h3>
              {:else if pl.block?.blockType === 'HEADING_4'}
                <h4 style={textStyle(pg, pl)}>{bodyText(pl)}</h4>
              {:else if pl.block?.blockType === 'SEPARATOR'}
                <hr class="blk-sep" />
              {:else if pl.block?.blockType === 'QUOTE'}
                <blockquote class="blk-quote" style={textStyle(pg, pl)}>{bodyText(pl)}</blockquote>
              {:else if pl.block?.blockType === 'CENTERED_PHRASE'}
                <p class="blk-center" style={textStyle(pg, pl)}>{bodyText(pl)}</p>
              {:else if pl.block?.blockType === 'PAGE_BREAK'}
                <!-- salto de página explícito — ya es página separada -->
              {:else if pl.block}
                <p class="blk-p" style={textStyle(pg, pl)}>{bodyText(pl)}</p>
              {/if}
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  /* ── Reset de la UI del editor para la ventana de render ── */
  :global(html) {
    background: white !important;
    color: #111 !important;
  }
  :global(body) {
    margin: 0 !important;
    padding: 0 !important;
    background: white !important;
    color: #111 !important;
    font-family: 'Georgia', 'Times New Roman', serif !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ── Contenedor raíz ── */
  .export-root {
    background: white;
  }

  /* ── Página física ── */
  .export-page {
    /* dimensiones seteadas inline con pageStyle() */
    box-sizing: border-box;
    position: relative;
    background: white;
    overflow: hidden;
    page-break-after: always;
    break-after: page;
  }

  /* ── Cuerpo de la página (padding = márgenes físicos del libro) ── */
  .export-body {
    /* padding seteado inline con pagePaddingStyle() usando unidades mm */
    box-sizing: border-box;
    width: 100%;
    /* NO height:100% — en modo print Chromium no resuelve % correctamente
       y puede colapsar la altura a 0, ocultando todo el contenido.
       Tampoco overflow:hidden — usamos la altura física de la página para clip. */
    overflow: visible;
  }

  /* ── Elementos de bloque ── */
  h1, h2, h3, h4,
  .blk-p, .blk-quote, .blk-center {
    /* Los estilos tipográficos vienen de textStyle() / inline */
    margin: 0;
    /* Heredar font-family del body (Georgia) para consistencia con el medidor */
    font-family: inherit;
    color: inherit;
  }

  .blk-sep {
    border: none;
    border-top: 1px solid currentColor;
    opacity: 0.4;
    margin: 0.5em 0;
  }

  .blk-quote {
    border-left: 3px solid currentColor;
    padding-left: 0.75em;
    opacity: 0.85;
  }

  .blk-img {
    margin: 0;
    display: block;
  }

  .blk-img img {
    display: block;
    max-width: 100%;
    height: auto;
  }

  .blk-img--fill {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }

  .blk-img--fill img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .blk-img figcaption {
    font-size: 0.8em;
    color: #666;
    text-align: center;
    margin-top: 4px;
  }

  .blk-co {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3em;
    text-align: center;
  }

  @media print {
    .export-page {
      page-break-after: always;
      break-after: page;
      /* En modo print no queremos overflow:hidden — dejar que la página dicte el clip */
      overflow: visible;
    }
    .export-body {
      overflow: visible;
    }
    /* Evitar que el sistema de impresión escale el contenido */
    .export-root {
      zoom: 1;
    }
  }
</style>
