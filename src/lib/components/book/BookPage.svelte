<script lang="ts">
  /**
   * BookPage.svelte — render de UNA página física del libro.
   *
   * Es el único componente que dibuja páginas: lo usan la vista previa
   * (BookPagedPreview, escalado con transform) y la ruta /export-render que se
   * imprime a PDF. Por eso lo que se ve en la vista previa es lo que sale en el PDF.
   *
   * Reglas:
   *   - Todo se posiciona en mm sobre la hoja real (Chromium usa 96 dpi en pantalla y
   *     al imprimir, así que la misma hoja mide lo mismo en ambos).
   *   - El texto se dibuja en la caja de contenido (hoja − márgenes), la misma caja en
   *     la que el motor midió y cortó los párrafos.
   *   - Cabecera y folio viven dentro de los márgenes, no restan alto a la caja.
   *   - Cada bloque va en un envoltorio `display: flow-root` para que sus márgenes no
   *     colapsen con los vecinos: así la suma de alturas medidas coincide con el render.
   *   - El CSS de los bloques de texto sale de block-render-css.ts (el mismo que usa
   *     el medidor). No añadir aquí reglas que cambien la altura del texto.
   *   - mode = 'preview' puede mostrar guías; mode = 'print' nunca dibuja nada que no
   *     sea parte del libro.
   */
  import type { PaginatedBookResult, PlacedBlock, RenderedPage } from '$lib/core/editorial/page-layout-model';
  import type { Asset } from '$lib/core/domain/asset';
  import type { BookStyleDefinition } from '$lib/core/editorial/book-styles';
  import {
    resolveBookStyles,
    resolveEffectiveBookStyleForBlock,
    buildBookStyleCss,
  } from '$lib/core/editorial/book-styles';
  import { pageFrameMm } from '$lib/core/editorial/preview-page-style';
  import {
    bookBaseFontFamily,
    imageCaptionCss,
    IMAGE_BLOCK_MARGIN_PT,
    SEPARATOR_BLOCK_HEIGHT_PX,
    textBlockCss,
    textBlockTag,
  } from '$lib/core/editorial/block-render-css';
  import { assetDisplayUrl } from '$lib/services/assets.service';
  import {
    parseImageBlockContent,
    parseChapterOpeningContent,
    chapterOpeningPreviewRootClassNames,
    parseTitlePageContent,
  } from '$lib/services/content.service';

  let {
    bookId,
    layout,
    page,
    assets = [],
    mode = 'preview',
    showGuides = false,
  }: {
    bookId: string;
    layout: PaginatedBookResult;
    page: RenderedPage;
    assets?: Asset[];
    mode?: 'preview' | 'print';
    showGuides?: boolean;
  } = $props();

  let settings   = $derived(layout.layoutSettings);
  let bookStyles = $derived(resolveBookStyles(settings));
  let frame      = $derived(pageFrameMm(settings, page.side));
  let baseFont   = $derived(bookBaseFontFamily(settings));

  function assetUrlFor(assetId: string | null | undefined): string | null {
    if (!assetId) return null;
    const a = assets.find(x => x.id === assetId);
    return a ? assetDisplayUrl(bookId, a.storagePath) : null;
  }

  function bodyText(pl: PlacedBlock): string {
    return pl.textOverride ?? pl.block?.contentText ?? '';
  }

  function isTextBlock(pl: PlacedBlock): boolean {
    switch (pl.block?.blockType) {
      case 'HEADING_1': case 'HEADING_2': case 'HEADING_3': case 'HEADING_4':
      case 'PARAGRAPH': case 'QUOTE': case 'CENTERED_PHRASE':
        return true;
      default:
        return false;
    }
  }

  function textCss(pl: PlacedBlock): string {
    if (!pl.block) return '';
    const style = resolveEffectiveBookStyleForBlock(
      settings,
      page.primarySectionType ? { sectionType: page.primarySectionType } : null,
      pl.block,
    );
    if (!style) return '';
    return textBlockCss(pl.block.blockType, style, {
      continuedFromPreviousPage: pl.debugMeta?.continuedFromPreviousPage ?? false,
      continuesOnNextPage:       pl.debugMeta?.continuesOnNextPage ?? false,
    });
  }

  function overlayTextCss(style: BookStyleDefinition, textAlign: 'left' | 'center' | 'right'): string {
    return buildBookStyleCss({ ...style, textAlign }, { includeMargins: false });
  }

  /** Imagen de portada (sección COVER): ocupa la hoja entera, a sangre. */
  function isCoverImage(pl: PlacedBlock): boolean {
    return pl.block?.blockType === 'IMAGE' && page.primarySectionType === 'COVER';
  }

  function isFillPageImage(pl: PlacedBlock): boolean {
    if (pl.block?.blockType !== 'IMAGE') return false;
    return parseImageBlockContent(pl.block.contentJson).fillPage;
  }

  /** La página es una composición a página completa (sin cabecera ni folio). */
  let fullPage = $derived(
    page.placements.some(pl =>
      pl.fullPageComposition || isCoverImage(pl) || isFillPageImage(pl)),
  );

  let pageStyle = $derived([
    `width:${frame.pageWidthMm}mm`,
    `height:${frame.pageHeightMm}mm`,
    `font-family:${baseFont}`,
  ].join(';'));

  let boxStyle = $derived([
    `top:${frame.box.topMm}mm`,
    `left:${frame.box.leftMm}mm`,
    `width:${frame.box.widthMm}mm`,
    `height:${frame.box.heightMm}mm`,
  ].join(';'));

  /** Caja a sangre relativa a la caja de contenido (para portadas). */
  let bleedStyle = $derived([
    `top:-${frame.box.topMm}mm`,
    `left:-${frame.box.leftMm}mm`,
    `width:${frame.pageWidthMm}mm`,
    `height:${frame.pageHeightMm}mm`,
  ].join(';'));

  let headerStyle = $derived([
    `top:${frame.headerCenterFromTopMm}mm`,
    `left:${frame.marginLeftMm}mm`,
    `right:${frame.marginRightMm}mm`,
  ].join(';'));

  let footerStyle = $derived([
    `bottom:${frame.footerCenterFromBottomMm}mm`,
    `left:${frame.marginLeftMm}mm`,
    `right:${frame.marginRightMm}mm`,
  ].join(';'));

  let safeGuideStyle = $derived(
    frame.safeInsetMm > 0
      ? `inset:${frame.safeInsetMm}mm`
      : 'display:none',
  );

  const imageMarginCss = `margin:${IMAGE_BLOCK_MARGIN_PT}pt 0`;
</script>

<article
  class="bp-page"
  class:bp-page--preview={mode === 'preview'}
  class:bp-page--blank={page.kind === 'editorial_blank'}
  style={pageStyle}
  data-page={page.physicalPageNumber}
>
  {#if page.kind === 'editorial_blank'}
    {#if mode === 'preview'}
      <p class="bp-blank-hint">Página en blanco<br /><span>(para que la sección empiece en página impar)</span></p>
    {/if}
  {:else}
    {#if page.editorial.headerText && !fullPage}
      <div class="bp-running-head" style={headerStyle}>{page.editorial.headerText}</div>
    {/if}

    <div class="bp-box" style={boxStyle}>
      {#each page.placements as pl, pi (`${pl.block?.id ?? pl.syntheticType ?? 'syn'}-${pi}-${pl.textOverride ?? ''}`)}
        {#if pl.syntheticType === 'TOC'}
          <div class="bp-block">
            <section class="toc">
              {#if pl.tocConfig?.showTitle}
                <h2 class="toc__title" style={buildBookStyleCss(bookStyles.HEADING_1)}>{pl.tocConfig.titleText}</h2>
              {/if}
              {#if pl.tocEntries && pl.tocEntries.length > 0}
                <div class="toc__list">
                  {#each pl.tocEntries as entry (`${entry.targetSectionId}-${entry.orderIndex}`)}
                    <div class="toc__row" style={buildBookStyleCss(bookStyles.TOC_ENTRY, { includeMargins: false, includeMaxWidth: false })}>
                      <span class="toc__label">{entry.label}</span>
                      {#if pl.tocConfig?.showDotLeaders}
                        <span class="toc__dots" aria-hidden="true"></span>
                      {:else}
                        <span class="toc__gap" aria-hidden="true"></span>
                      {/if}
                      <span class="toc__page">{entry.pageNumberVisible ?? ''}</span>
                    </div>
                  {/each}
                </div>
              {:else if mode === 'preview'}
                <p class="toc__empty">Todavía no hay entradas para mostrar.</p>
              {/if}
            </section>
          </div>

        {:else if pl.block?.blockType === 'CHAPTER_OPENING'}
          {@const co = parseChapterOpeningContent(pl.block.contentJson)}
          {@const url = assetUrlFor(co.assetId)}
          <div class="bp-block bp-block--full">
            <div class="co {chapterOpeningPreviewRootClassNames(co)}" class:co--no-img={!url}>
              {#if url}
                <img class="co__img" src={url} alt="" />
              {:else if mode === 'preview'}
                <div class="co__ph">{co.assetId ? 'Imagen no disponible' : 'Sin imagen'}</div>
              {/if}
              <div class="co__text">
                {#if co.chapterLabel.trim()}
                  <span class="co__label" style={overlayTextCss(bookStyles.CHAPTER_OPENING_LABEL, co.textAlign)}>{co.chapterLabel}</span>
                {/if}
                {#if co.title.trim()}
                  <span class="co__title" style={overlayTextCss(bookStyles.CHAPTER_OPENING_TITLE, co.textAlign)}>{co.title}</span>
                {/if}
              </div>
            </div>
          </div>

        {:else if pl.block?.blockType === 'TITLE_PAGE'}
          {@const tp = parseTitlePageContent(pl.block.contentJson)}
          <div class="bp-block bp-block--full">
            <div class="tp" style="text-align:{tp.textAlign}">
              {#if tp.seriesLabel.trim()}
                <div class="tp__series" style={buildBookStyleCss(bookStyles.HEADING_4, { includeMargins: false })}>{tp.seriesLabel}</div>
              {/if}
              <div class="tp__title-area">
                {#if tp.title.trim()}
                  <div class="tp__title" style={buildBookStyleCss(bookStyles.TITLE, { includeMargins: false })}>{tp.title}</div>
                {/if}
                {#if tp.subtitle.trim()}
                  <div class="tp__subtitle" style={buildBookStyleCss(bookStyles.HEADING_2, { includeMargins: false })}>{tp.subtitle}</div>
                {/if}
              </div>
              {#if tp.authorLine.trim()}
                <div class="tp__author" style={buildBookStyleCss(bookStyles.CENTERED_PHRASE, { includeMargins: false, includeMaxWidth: false })}>{tp.authorLine}</div>
              {/if}
              {#if tp.publisherInfo.trim()}
                <div class="tp__publisher" style={buildBookStyleCss(bookStyles.PARAGRAPH, { includeMargins: false })}>{tp.publisherInfo}</div>
              {/if}
            </div>
          </div>

        {:else if pl.block?.blockType === 'IMAGE'}
          {@const im = parseImageBlockContent(pl.block.contentJson)}
          {@const url = assetUrlFor(im.assetId)}
          {#if isCoverImage(pl)}
            <div class="bp-bleed" style={bleedStyle}>
              {#if url}<img class="bp-fill-img" src={url} alt={im.altText || ''} />{/if}
            </div>
          {:else if im.fillPage}
            <div class="bp-block bp-block--full">
              {#if url}
                <img class="bp-fill-img" src={url} alt={im.altText || ''} />
              {:else if mode === 'preview'}
                <div class="img-ph img-ph--full">Sin imagen</div>
              {/if}
            </div>
          {:else}
            <div class="bp-block">
              <figure class="img" style={imageMarginCss}>
                {#if url}
                  <img
                    src={url}
                    alt={im.altText || ''}
                    style={pl.imageBox ? `width:${pl.imageBox.widthMm}mm;height:${pl.imageBox.heightMm}mm` : 'max-width:100%'}
                  />
                {:else}
                  <div
                    class="img-ph"
                    class:img-ph--print={mode === 'print'}
                    style={pl.imageBox ? `width:${pl.imageBox.widthMm}mm;height:${pl.imageBox.heightMm}mm;min-height:0;margin:0 auto` : ''}
                  >{mode === 'preview' ? 'Sin imagen' : ''}</div>
                {/if}
                {#if im.caption.trim()}
                  <figcaption style={imageCaptionCss()}>{im.caption}</figcaption>
                {/if}
              </figure>
            </div>
          {/if}

        {:else if pl.block?.blockType === 'SEPARATOR'}
          <div class="bp-block sep" style="height:{SEPARATOR_BLOCK_HEIGHT_PX}px" aria-hidden="true"><hr /></div>

        {:else if pl.block?.blockType === 'PAGE_BREAK'}
          <!-- salto de página explícito: ya es página separada -->

        {:else if pl.block && isTextBlock(pl)}
          <div class="bp-block">
            <svelte:element this={textBlockTag(pl.block.blockType)} style={textCss(pl)}>{bodyText(pl)}</svelte:element>
          </div>

        {:else if pl.block}
          <!-- Tipo no textual desconocido: se dibuja como párrafo para no perder contenido -->
          <div class="bp-block">
            <p style={textCss(pl)}>{bodyText(pl)}</p>
          </div>
        {/if}
      {/each}
    </div>

    {#if page.editorial.footerText && !fullPage}
      <div class="bp-folio" style={footerStyle}>{page.editorial.footerText}</div>
    {/if}

    {#if mode === 'preview' && showGuides}
      <div class="guide guide--box" style={boxStyle} aria-hidden="true">
        <div class="guide guide--safe" style={safeGuideStyle}></div>
      </div>
    {/if}
  {/if}
</article>

<style>
  .bp-page {
    position: relative;
    box-sizing: border-box;
    overflow: hidden;
    background: #ffffff;
    color: #111111;
    /* font-family base del libro: inline (bookBaseFontFamily). */
    font-size: 11pt;
    line-height: 1.4;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .bp-page--preview.bp-page--blank {
    background: #fbfbf9;
  }

  .bp-box {
    position: absolute;
    box-sizing: border-box;
  }

  /* Envoltorio de cada bloque: BFC para que los márgenes no colapsen (ver cabecera). */
  .bp-block {
    display: flow-root;
  }
  .bp-block--full {
    height: 100%;
  }

  /* ── Cabecera y folio (dentro de los márgenes) ── */
  .bp-running-head,
  .bp-folio {
    position: absolute;
    text-align: center;
    font-size: 8pt;
    line-height: 1;
    letter-spacing: 0.04em;
    color: #555555;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .bp-running-head { transform: translateY(-50%); }
  .bp-folio        { transform: translateY(50%); }

  /* ── Imágenes ── */
  /* La figura ocupa todo el ancho de la columna (igual que al medir el pie);
     la imagen se centra dentro con el tamaño que calculó el motor. */
  .img {
    display: block;
    width: 100%;
  }
  .img img {
    display: block;
    margin: 0 auto;
    object-fit: contain;
  }
  .img-ph {
    min-height: 20mm;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.05);
    color: rgba(0, 0, 0, 0.4);
    font-size: 9pt;
  }
  .img-ph--print { background: transparent; }
  .img-ph--full { height: 100%; }
  .bp-fill-img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .bp-bleed {
    position: absolute;
    overflow: hidden;
  }

  /* ── Separador ── */
  .sep {
    display: flex;
    align-items: center;
  }
  .sep hr {
    flex: 1;
    margin: 0 25%;
    border: none;
    border-top: 0.6pt solid rgba(0, 0, 0, 0.35);
  }

  /* ── Índice ── */
  .toc {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .toc__title { margin: 0 0 0.3em; text-align: center; }
  .toc__list  { display: flex; flex-direction: column; gap: 7px; }
  .toc__row   { display: flex; align-items: baseline; gap: 8px; }
  .toc__label { min-width: 0; }
  .toc__dots  { flex: 1; border-bottom: 1px dotted rgba(0, 0, 0, 0.45); transform: translateY(-2px); }
  .toc__gap   { flex: 1; }
  .toc__page  { min-width: 1.8em; text-align: right; font-variant-numeric: tabular-nums; }
  .toc__empty { margin: 0; font-size: 9pt; color: rgba(0, 0, 0, 0.42); font-style: italic; }

  /* ── Portadilla (TITLE_PAGE) ── */
  .tp {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
  }
  .tp__series     { padding-top: 18%; opacity: 0.7; }
  .tp__title-area { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 4% 0; gap: 0.4em; }
  .tp__title      { line-height: 1.15; }
  .tp__subtitle   { opacity: 0.8; }
  .tp__author     { padding-bottom: 6%; }
  .tp__publisher  { margin-top: auto; padding-bottom: 8%; opacity: 0.55; }

  /* ── Apertura de capítulo: ocupa toda la caja de contenido ── */
  .co {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #222;
    color: #fff;
  }
  .co.co--no-img { background: #2a2a32; }
  .co__img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .co__ph {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.35);
    font-size: 9pt;
  }
  .co__text {
    position: absolute;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 0.35em;
    padding: 6mm;
    max-width: 88%;
    box-sizing: border-box;
  }
  .co.co-preview--pos-top-left .co__text     { top: 0; left: 0; }
  .co.co-preview--pos-top-right .co__text    { top: 0; right: 0; align-items: flex-end; }
  .co.co-preview--pos-bottom-left .co__text  { bottom: 0; left: 0; }
  .co.co-preview--pos-bottom-right .co__text { bottom: 0; right: 0; align-items: flex-end; }
  .co.co-preview--pos-center .co__text {
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    align-items: center;
    text-align: center;
  }
  .co.co-preview--ta-left .co__text   { text-align: left; }
  .co.co-preview--ta-center .co__text { text-align: center; }
  .co.co-preview--ta-right .co__text  { text-align: right; }
  .co.co-preview--overlay::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.55), transparent 50%);
  }
  .co.co-preview--tone-light .co__label,
  .co.co-preview--tone-light .co__title,
  .co.co-preview--tone-auto .co__label,
  .co.co-preview--tone-auto .co__title {
    color: rgba(255, 255, 255, 0.96);
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.55);
  }
  .co.co-preview--tone-dark .co__label,
  .co.co-preview--tone-dark .co__title {
    color: rgba(20, 20, 28, 0.95);
    text-shadow: 0 0 6px rgba(255, 255, 255, 0.35);
  }

  /* ── Solo vista previa ── */
  .bp-blank-hint {
    position: absolute;
    inset: 40% 10% auto;
    margin: 0;
    text-align: center;
    font-family: system-ui, sans-serif;
    font-size: 9pt;
    color: rgba(0, 0, 0, 0.32);
  }
  .bp-blank-hint span { font-size: 7.5pt; }
  .guide {
    position: absolute;
    pointer-events: none;
    box-sizing: border-box;
  }
  .guide--box  { border: 1px dashed rgba(80, 140, 220, 0.5); }
  .guide--safe { border: 1px dashed rgba(230, 120, 60, 0.55); }
</style>
