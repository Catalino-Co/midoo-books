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
   *   - Composiciones «a sangre» (portada, imagen a página completa con sangre, apertura
   *     de capítulo con sangre) se dibujan sobre la hoja, no en la caja de texto. Con
   *     `bleedMm` > 0 (PDF de imprenta) se extienden también por el sangrado exterior,
   *     superior e inferior; el lado del lomo nunca lleva sangrado.
   *   - El fondo de página (papel, cuadrícula o textura) va debajo de todo, a sangre.
   *   - La caja de texto es una columna flex: los bloques «anclados al pie» llevan
   *     margin-top:auto y quedan pegados al final de la caja. Los bloques no encogen
   *     (flex-shrink:0), así que las alturas son las mismas que midió el motor.
   *   - Etiqueta y Cita bíblica se pintan con el HTML de composite-blocks.ts, el mismo
   *     que mide el motor.
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
    textBlockCss,
    textBlockTag,
  } from '$lib/core/editorial/block-render-css';
  import { assetDisplayUrl } from '$lib/services/assets.service';
  import {
    furnitureTextAlign,
    parseFooterConfig,
    parseHeaderConfig,
  } from '$lib/core/editorial/page-furniture';
  import {
    parseSeparatorContent,
    separatorHeightPx,
    separatorOrnamentSvg,
  } from '$lib/core/editorial/separator-content';
  import { compositeBlockHtml, isCompositeBlockType } from '$lib/core/editorial/composite-blocks';
  import {
    gridBackgroundSvg,
    parsePageBackground,
    parseSectionDecoration,
  } from '$lib/core/editorial/page-decoration';
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
    bleedMm = 0,
  }: {
    bookId: string;
    layout: PaginatedBookResult;
    page: RenderedPage;
    assets?: Asset[];
    mode?: 'preview' | 'print';
    showGuides?: boolean;
    /** Sangrado de imprenta (solo PDF de impresión). 0 = recorte exacto. */
    bleedMm?: number;
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

  /** Imagen de portada / contraportada: fondo de la hoja entera, a sangre. */
  function isCoverImage(pl: PlacedBlock): boolean {
    if (pl.coverBackdrop) return true;
    return pl.block?.blockType === 'IMAGE'
      && (page.primarySectionType === 'COVER' || page.primarySectionType === 'BACK_COVER');
  }

  /** HTML de Etiqueta / Cita bíblica con el estilo efectivo (igual que el motor). */
  function compositeHtml(pl: PlacedBlock): string {
    if (!pl.block) return '';
    const style = resolveEffectiveBookStyleForBlock(
      settings,
      page.primarySectionType ? { sectionType: page.primarySectionType } : null,
      pl.block,
    ) ?? (pl.block.blockType === 'BADGE' ? bookStyles.BADGE : bookStyles.VERSE_TEXT);
    return compositeBlockHtml(pl.block, style, bookStyles) ?? '';
  }

  /** Colocación que se dibuja a sangre, sobre la hoja completa. */
  function isBleedPlacement(pl: PlacedBlock): boolean {
    if (!pl.block) return false;
    if (isCoverImage(pl)) return true;
    if (pl.block.blockType === 'IMAGE') {
      const im = parseImageBlockContent(pl.block.contentJson);
      return im.fillPage && im.bleed;
    }
    if (pl.block.blockType === 'CHAPTER_OPENING') {
      return parseChapterOpeningContent(pl.block.contentJson).bleed;
    }
    return false;
  }

  /** Motivo legible de una página en blanco editorial (solo vista previa). */
  let blankReason = $derived(
    page.debugNotes.some(n => n.includes('página par'))
      ? 'para que la apertura quede en página par'
      : page.debugNotes.some(n => n.includes('página impar'))
        ? 'para que la apertura quede en página impar'
        : 'para que la sección empiece en página impar',
  );

  let bleedPlacements = $derived(page.placements.filter(isBleedPlacement));
  let flowPlacements  = $derived(page.placements.filter(pl => !isBleedPlacement(pl)));
  /** Índice (en flowPlacements) del primer bloque anclado al pie: lleva margin-top:auto. */
  let firstAnchoredIdx = $derived(flowPlacements.findIndex(pl => pl.anchorBottom));

  /** Sangrado real solo al imprimir. */
  let bleed = $derived(mode === 'print' ? Math.max(0, bleedMm) : 0);

  function isFillPageImage(pl: PlacedBlock): boolean {
    if (pl.block?.blockType !== 'IMAGE') return false;
    return parseImageBlockContent(pl.block.contentJson).fillPage;
  }

  /** La página es una composición a página completa (sin cabecera ni folio). */
  let fullPage = $derived(
    page.placements.some(pl =>
      pl.fullPageComposition || isCoverImage(pl) || isFillPageImage(pl)),
  );

  // ── Fondo de página y tono de la sección ──
  let pageBg     = $derived(parsePageBackground(settings.pageBackgroundJson));
  let sectionDec = $derived(parseSectionDecoration({ settingsJson: page.primarySectionSettingsJson ?? null }));
  let showPageBg = $derived(
    pageBg.kind !== 'none'
    && sectionDec.background !== 'none'
    && !(pageBg.skipFullPage && fullPage)
    && (pageBg.kind !== 'image' || !!assetUrlFor(pageBg.assetId)),
  );
  let lightText = $derived(sectionDec.textTone === 'light');

  let pageStyle = $derived([
    `width:${frame.pageWidthMm}mm`,
    `height:${frame.pageHeightMm}mm`,
    `font-family:${baseFont}`,
    lightText ? 'color:#fbf8f2' : '',
  ].filter(Boolean).join(';'));

  let boxStyle = $derived([
    `top:${frame.box.topMm}mm`,
    `left:${frame.box.leftMm}mm`,
    `width:${frame.box.widthMm}mm`,
    `height:${frame.box.heightMm}mm`,
  ].join(';'));

  /**
   * Capa a sangre relativa a la hoja: la hoja entera más el sangrado por arriba,
   * abajo y el corte exterior (izquierda en verso, derecha en recto).
   */
  let bleedStyle = $derived([
    `top:-${bleed}mm`,
    `left:${page.side === 'left' ? -bleed : 0}mm`,
    `width:${frame.pageWidthMm + bleed}mm`,
    `height:${frame.pageHeightMm + bleed * 2}mm`,
  ].join(';'));

  /** Marco de la hoja (sin sangrado) dentro de la capa a sangre. */
  let trimInBleedStyle = $derived([
    `top:${bleed}mm`,
    `left:${page.side === 'left' ? bleed : 0}mm`,
    `width:${frame.pageWidthMm}mm`,
    `height:${frame.pageHeightMm}mm`,
  ].join(';'));

  /** El texto sobre una apertura a sangre se mantiene dentro de la caja de texto. */
  let bleedTextInsetStyle = $derived([
    `top:${frame.box.topMm}mm`,
    `left:${frame.box.leftMm}mm`,
    `width:${frame.box.widthMm}mm`,
    `height:${frame.box.heightMm}mm`,
  ].join(';'));

  let headerCfg = $derived(parseHeaderConfig(settings.headerConfigJson));
  let footerCfg = $derived(parseFooterConfig(settings.footerConfigJson));

  // Cabecera y folio se alinean con la caja de texto (mismo ancho que la columna).
  let headerStyle = $derived([
    `top:${frame.headerCenterFromTopMm}mm`,
    `left:${frame.marginLeftMm}mm`,
    `right:${frame.marginRightMm}mm`,
    `text-align:${furnitureTextAlign(headerCfg.position, page.side)}`,
    headerCfg.uppercase ? 'text-transform:uppercase;letter-spacing:0.12em;font-size:7pt' : '',
  ].filter(Boolean).join(';'));

  let footerOrnament = $derived(fullPage ? null : (page.editorial.footerOrnament ?? null));

  let footerStyle = $derived([
    `bottom:${frame.footerCenterFromBottomMm}mm`,
    `left:${frame.marginLeftMm}mm`,
    `right:${frame.marginRightMm}mm`,
    `text-align:${furnitureTextAlign(footerCfg.position, page.side)}`,
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
  class:bp-page--bleed={bleed > 0}
  style={pageStyle}
  data-page={page.physicalPageNumber}
>
  {#if showPageBg}
    <div class="bp-pagebg" style="{bleedStyle};{pageBg.kind !== 'image' ? `background:${pageBg.color}` : ''}" aria-hidden="true">
      {#if pageBg.kind === 'grid'}
        {@html gridBackgroundSvg(frame.pageWidthMm + bleed, frame.pageHeightMm + bleed * 2, pageBg.opacity)}
      {:else if pageBg.kind === 'image'}
        <img class="bp-pagebg__img" src={assetUrlFor(pageBg.assetId)} alt="" style="opacity:{pageBg.opacity}" />
      {/if}
    </div>
  {/if}
  {#if page.kind === 'editorial_blank'}
    {#if mode === 'preview'}
      <p class="bp-blank-hint">Página en blanco<br /><span>({blankReason})</span></p>
    {/if}
  {:else}
    {#each bleedPlacements as pl, bi (`bleed-${pl.block?.id ?? bi}`)}
      <div class="bp-bleed" style={bleedStyle}>
        {#if pl.block?.blockType === 'CHAPTER_OPENING'}
          {@const co = parseChapterOpeningContent(pl.block.contentJson)}
          {@const url = assetUrlFor(co.assetId)}
          <div class="co co--bleed {chapterOpeningPreviewRootClassNames(co)}" class:co--no-img={!url}>
            {#if url}
              <img class="co__img" src={url} alt="" />
            {:else if mode === 'preview'}
              <div class="co__ph">{co.assetId ? 'Imagen no disponible' : 'Sin imagen'}</div>
            {/if}
            <div class="bp-trim" style={trimInBleedStyle}>
              <div class="co__safe" style={bleedTextInsetStyle}>
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
          </div>
        {:else if pl.block?.blockType === 'IMAGE'}
          {@const im = parseImageBlockContent(pl.block.contentJson)}
          {@const url = assetUrlFor(im.assetId)}
          {#if url}
            <img class="bp-fill-img" src={url} alt={im.altText || ''} />
          {:else if mode === 'preview'}
            <div class="img-ph img-ph--full" class:img-ph--dark={lightText}>Sin imagen</div>
          {/if}
        {/if}
      </div>
    {/each}

    {#if page.editorial.headerText && !fullPage}
      <div class="bp-running-head" style={headerStyle}>{page.editorial.headerText}</div>
    {/if}

    <div class="bp-box" class:bp-box--light={lightText} style={boxStyle}>
      {#each flowPlacements as pl, pi (`${pl.block?.id ?? pl.syntheticType ?? 'syn'}-${pi}-${pl.textOverride ?? ''}`)}
        {#if pi === firstAnchoredIdx}
          <!-- Empuja los bloques anclados al pie de la caja de texto -->
          <div class="bp-anchor-spacer" aria-hidden="true"></div>
        {/if}
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
          {#if im.fillPage}
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
          {@const sep = parseSeparatorContent(pl.block.contentJson)}
          <div
            class="bp-block sep sep--{sep.ornament}"
            style="height:{separatorHeightPx(sep.ornament)}px"
            aria-hidden="true"
          >{@html separatorOrnamentSvg(sep.ornament)}</div>

        {:else if pl.block?.blockType === 'PAGE_BREAK'}
          <!-- salto de página explícito: ya es página separada -->

        {:else if pl.block && isCompositeBlockType(pl.block.blockType)}
          <div class="bp-block">{@html compositeHtml(pl)}</div>

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

    {#if footerOrnament}
      <div
        class="bp-foot-orn"
        style="bottom:{frame.footerCenterFromBottomMm}mm;left:{frame.marginLeftMm}mm;right:{frame.marginRightMm}mm"
        aria-hidden="true"
      >{@html separatorOrnamentSvg(footerOrnament)}</div>
    {/if}
    {#if page.editorial.footerText && !fullPage}
      <!-- Con ornamento en el pie, el folio baja bajo el ornamento -->
      <div
        class="bp-folio"
        style="{footerStyle}{footerOrnament ? `;bottom:${Math.max(2, frame.footerCenterFromBottomMm - 4.4)}mm` : ''}"
      >{page.editorial.footerText}</div>
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
  /* En el PDF de imprenta la capa a sangre sobresale de la hoja; recorta el contenedor. */
  .bp-page--bleed { overflow: visible; }
  .bp-page--preview.bp-page--blank {
    background: #fbfbf9;
  }

  .bp-box {
    position: absolute;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
  }
  .bp-box--light {
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
  }
  .bp-anchor-spacer {
    margin-top: auto;
    flex: 0 0 0;
  }

  /* Envoltorio de cada bloque: BFC para que los márgenes no colapsen (ver cabecera). */
  .bp-block {
    display: flow-root;
    flex-shrink: 0;
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

  /* Ornamento del pie (laurel, floritura…), centrado en el margen inferior */
  .bp-foot-orn {
    position: absolute;
    display: flex;
    justify-content: center;
    transform: translateY(50%);
    color: #3b2f22;
    pointer-events: none;
  }
  .bp-foot-orn :global(svg) {
    display: block;
    height: 5.2mm;
    width: auto;
  }

  /* Fondo de página: debajo de todo, a sangre */
  .bp-pagebg {
    position: absolute;
    overflow: hidden;
    z-index: 0;
    pointer-events: none;
  }
  .bp-pagebg__img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

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
  .img-ph--dark { background: #34343e; color: rgba(255, 255, 255, 0.4); }
  .bp-fill-img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .bp-bleed {
    position: absolute;
    overflow: hidden;
    z-index: 0;
  }
  .bp-trim {
    position: absolute;
    pointer-events: none;
  }
  /* Apertura a sangre: el texto vive en la caja de texto de la hoja. */
  .co--bleed { height: 100%; }
  .co__safe {
    position: absolute;
    z-index: 1;
  }
  .co__safe .co__text { padding: 0; max-width: 100%; }

  /* ── Separador ── */
  .sep {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #2a2a2a;
  }
  .sep :global(svg) {
    display: block;
    height: 4.6mm;
    width: auto;
    max-width: 100%;
  }
  .sep--line :global(svg) { height: 3mm; opacity: 0.6; }
  .sep--dots :global(svg) { height: 3.2mm; }

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
