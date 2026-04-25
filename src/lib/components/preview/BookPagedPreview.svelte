<script lang="ts">
  /**
   * PARTE 9 — Render visual del resultado paginado (sin lógica de paginación).
   */
  import type { PaginatedBookResult, PlacedBlock, RenderedPage } from '$lib/core/editorial/page-layout-model';
  import type { Asset } from '$lib/core/domain/asset';
  import { assetDisplayUrl } from '$lib/services/assets.service';
  import {
    parseImageBlockContent,
    parseChapterOpeningContent,
    chapterOpeningPreviewRootClassNames,
    resolveBlockLayout,
  } from '$lib/services/content.service';
  import { sectionTypeLabel } from '$lib/services/content.service';

  let {
    bookId,
    layout,
    assets = [],
  }: {
    bookId: string;
    layout: PaginatedBookResult;
    assets?: Asset[];
  } = $props();

  let activeIndex = $state(0);

  let activePage = $derived(layout.pages[Math.min(activeIndex, Math.max(0, layout.pages.length - 1))] ?? null);

  function assetUrlFor(assetId: string | null | undefined): string | null {
    if (!assetId) return null;
    const a = assets.find(x => x.id === assetId);
    return a ? assetDisplayUrl(bookId, a.storagePath) : null;
  }

  function bodyText(pl: PlacedBlock): string {
    return pl.textOverride ?? pl.block?.contentText ?? '';
  }
</script>

<div class="paged-root">
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

        <article
          class="page-sheet"
          class:page-sheet--left={activePage.side === 'left'}
          class:page-sheet--right={activePage.side === 'right'}
          class:page-sheet--blank={activePage.kind === 'editorial_blank'}
        >
          {#if activePage.editorial.headerText}
            <div class="page-header">
              <span>{activePage.editorial.headerText}</span>
            </div>
          {/if}

          <header class="page-rail">
            {#if activePage.primarySectionType}
              <span class="rail-type">{sectionTypeLabel(activePage.primarySectionType)}</span>
              {#if activePage.primarySectionTitle}
                <span class="rail-title">{activePage.primarySectionTitle}</span>
              {/if}
            {:else if activePage.kind === 'editorial_blank'}
              <span class="rail-type rail-type--muted">Blanco editorial</span>
            {/if}
          </header>

          <div class="page-body">
            {#if activePage.kind === 'editorial_blank'}
              <div class="blank-mark" aria-hidden="true"></div>
              <p class="blank-label">Página en blanco editorial</p>
              <p class="blank-hint">Forzada por reglas de inicio en recto u otras reglas v1.</p>
            {:else}
              {#each activePage.placements as pl, pi (`${pl.block?.id ?? pl.syntheticType ?? 'synthetic'}-${pi}-${pl.textOverride ?? ''}`)}
                {@const L = pl.block ? resolveBlockLayout(pl.block) : null}
                <div class="flow-block flow-block--{pl.block?.blockType ?? pl.syntheticType ?? 'SYNTHETIC'}">
                  {#if pl.syntheticType === 'TOC'}
                    <section class="toc-render">
                      {#if pl.tocConfig?.showTitle}
                        <h2 class="toc-render__title">{pl.tocConfig.titleText}</h2>
                      {/if}
                      {#if pl.tocEntries && pl.tocEntries.length > 0}
                        <div class="toc-render__list">
                          {#each pl.tocEntries as entry (`${entry.targetSectionId}-${entry.orderIndex}`)}
                            <div class="toc-render__row">
                              <span class="toc-render__label">{entry.label}</span>
                              {#if pl.tocConfig?.showDotLeaders}
                                <span class="toc-render__dots" aria-hidden="true"></span>
                              {/if}
                              <span class="toc-render__page">{entry.pageNumberVisible ?? '—'}</span>
                            </div>
                          {/each}
                        </div>
                      {:else}
                        <p class="toc-render__empty">Todavía no hay entradas para mostrar.</p>
                      {/if}
                    </section>
                  {:else if pl.block?.blockType === 'CHAPTER_OPENING'}
                    {@const co = parseChapterOpeningContent(pl.block.contentJson)}
                    <div class="co-render {chapterOpeningPreviewRootClassNames(co)}">
                      {#if co.assetId}
                        {@const u = assetUrlFor(co.assetId)}
                        {#if u}
                          <img class="co-render__img" src={u} alt="" />
                        {:else}
                          <div class="co-render__ph">Imagen no disponible</div>
                        {/if}
                      {:else}
                        <div class="co-render__ph">Sin imagen</div>
                      {/if}
                      <div class="co-render__text">
                        {#if co.chapterLabel.trim()}
                          <span class="co-render__lab">{co.chapterLabel}</span>
                        {/if}
                        {#if co.title.trim()}
                          <span class="co-render__tit">{co.title}</span>
                        {/if}
                      </div>
                    </div>
                  {:else if pl.block?.blockType === 'IMAGE'}
                    {@const im = parseImageBlockContent(pl.block.contentJson)}
                    {@const u = assetUrlFor(im.assetId)}
                    <figure class="img-render">
                      {#if u}
                        <img src={u} alt={im.altText || ''} />
                      {:else}
                        <div class="img-ph">Sin recurso</div>
                      {/if}
                      {#if im.caption.trim()}
                        <figcaption>{im.caption}</figcaption>
                      {/if}
                    </figure>
                  {:else if pl.block?.blockType === 'HEADING_1'}
                    <h1 class="flow-h1" style:text-align={L?.textAlign}>{bodyText(pl)}</h1>
                  {:else if pl.block?.blockType === 'HEADING_2'}
                    <h2 class="flow-h2" style:text-align={L?.textAlign}>{bodyText(pl)}</h2>
                  {:else if pl.block?.blockType === 'QUOTE'}
                    <blockquote class="flow-quote" style:text-align={L?.textAlign}>{bodyText(pl)}</blockquote>
                  {:else if pl.block?.blockType === 'SEPARATOR'}
                    <hr class="flow-sep" />
                  {:else if pl.block?.blockType === 'CENTERED_PHRASE'}
                    <p class="flow-center" style:text-align={L?.textAlign}>{bodyText(pl)}</p>
                  {:else}
                    <p class="flow-p" style:text-align={L?.textAlign}>{bodyText(pl)}</p>
                  {/if}
                </div>
              {/each}
            {/if}
          </div>

          <footer class="page-footer">
            <span class="folio">Folio físico {activePage.physicalPageNumber}</span>
            {#if activePage.editorial.footerText}
              <span class="folio-ed">{activePage.editorial.footerText}</span>
            {:else if activePage.editorial.numberingScope}
              <span class="folio-ed folio-ed--muted">Número oculto en esta página</span>
            {:else}
              <span class="folio-ed folio-ed--muted">Numeración editorial: pendiente</span>
            {/if}
          </footer>

          {#if activePage.debugNotes.length > 0}
            <details class="page-debug">
              <summary>Notas de maquetación v1</summary>
              <ul>
                {#each activePage.debugNotes as n}
                  <li>{n}</li>
                {/each}
              </ul>
            </details>
          {/if}
        </article>
      {/if}
    </div>
  {/if}
</div>

<style>
  .paged-root {
    display: flex;
    gap: 16px;
    align-items: flex-start;
    width: 100%;
    max-width: 1100px;
    margin: 0 auto;
    padding: 12px 0 32px;
  }
  .paged-empty {
    color: rgba(255, 255, 255, 0.4);
    font-size: 14px;
  }

  .thumb-col {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: min(72vh, 560px);
    overflow-y: auto;
    flex-shrink: 0;
    padding: 4px;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.2);
  }
  .thumb {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(30, 30, 46, 0.9);
    color: rgba(255, 255, 255, 0.65);
    font-size: 11px;
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
    font-size: 9px;
    font-weight: 800;
    opacity: 0.45;
    width: 14px;
  }
  .thumb-num {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .main-col {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .page-toolbar {
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
    width: 34px;
    height: 30px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.06);
    color: #fff;
    cursor: pointer;
    font-size: 14px;
  }
  .btn-mini:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .page-sheet {
    --page-w: min(440px, 94vw);
    width: var(--page-w);
    min-height: calc(var(--page-w) * 1.414);
    margin: 0 auto;
    background: #fafaf8;
    color: #1a1a22;
    border-radius: 3px;
    box-shadow:
      0 2px 4px rgba(0, 0, 0, 0.12),
      0 12px 28px rgba(0, 0, 0, 0.18);
    display: flex;
    flex-direction: column;
    position: relative;
  }
  .page-sheet--right {
    box-shadow:
      2px 2px 4px rgba(0, 0, 0, 0.1),
      10px 12px 28px rgba(0, 0, 0, 0.16);
  }
  .page-sheet--left {
    box-shadow:
      -2px 2px 4px rgba(0, 0, 0, 0.1),
      -10px 12px 28px rgba(0, 0, 0, 0.16);
  }
  .page-sheet--blank {
    background: linear-gradient(145deg, #f2f2f0 0%, #e8e8e4 100%);
  }

  .page-rail {
    padding: 10px 14px 6px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .page-header {
    padding: 10px 22px 0;
    text-align: center;
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(0, 0, 0, 0.44);
  }
  .rail-type {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(0, 0, 0, 0.38);
  }
  .rail-type--muted {
    color: rgba(0, 0, 0, 0.28);
  }
  .rail-title {
    font-size: 11px;
    color: rgba(0, 0, 0, 0.45);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .page-body {
    flex: 1;
    padding: 14px 22px 18px;
    font-family: 'Georgia', 'Times New Roman', serif;
    font-size: 13px;
    line-height: 1.55;
  }

  .blank-mark {
    position: absolute;
    inset: 36% 30%;
    border: 1px dashed rgba(0, 0, 0, 0.12);
    border-radius: 4px;
    pointer-events: none;
  }
  .blank-label {
    text-align: center;
    font-size: 13px;
    font-weight: 600;
    color: rgba(0, 0, 0, 0.35);
    margin: 28% 0 0;
  }
  .blank-hint {
    text-align: center;
    font-size: 11px;
    color: rgba(0, 0, 0, 0.28);
    margin: 8px 0 0;
  }

  .flow-block {
    margin-bottom: 0.85em;
  }
  .flow-block--CHAPTER_OPENING {
    margin: -14px -22px 12px;
  }

  .flow-h1 {
    font-size: 1.45rem;
    font-weight: 700;
    margin: 0 0 0.5em;
    line-height: 1.2;
  }
  .flow-h2 {
    font-size: 1.15rem;
    font-weight: 700;
    margin: 0.6em 0 0.35em;
    line-height: 1.25;
  }
  .flow-p {
    margin: 0 0 0.75em;
  }
  .flow-quote {
    margin: 0.6em 0;
    padding: 0.5em 0 0.5em 0.9em;
    border-left: 3px solid rgba(0, 0, 0, 0.15);
    color: rgba(0, 0, 0, 0.72);
  }
  .flow-center {
    text-align: center;
    font-style: italic;
    margin: 0.8em 0;
  }
  .flow-sep {
    border: none;
    border-top: 1px solid rgba(0, 0, 0, 0.12);
    margin: 1em 0;
  }

  .toc-render {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 0.4em 0 0.8em;
  }
  .toc-render__title {
    margin: 0 0 0.3em;
    font-size: 1.2rem;
    font-weight: 700;
    text-align: center;
  }
  .toc-render__list {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .toc-render__row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 13px;
    line-height: 1.35;
  }
  .toc-render__label {
    min-width: 0;
  }
  .toc-render__dots {
    flex: 1;
    border-bottom: 1px dotted rgba(0, 0, 0, 0.35);
    transform: translateY(-2px);
  }
  .toc-render__page {
    min-width: 1.8rem;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .toc-render__empty {
    margin: 0;
    font-size: 12px;
    color: rgba(0, 0, 0, 0.42);
    font-style: italic;
  }

  .img-render {
    margin: 0.5em 0;
  }
  .img-render img {
    display: block;
    max-width: 100%;
    max-height: 220px;
    object-fit: contain;
    margin: 0 auto;
  }
  .img-ph {
    min-height: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.05);
    color: rgba(0, 0, 0, 0.35);
    font-size: 12px;
  }
  .img-render figcaption {
    font-size: 11px;
    color: rgba(0, 0, 0, 0.5);
    margin-top: 6px;
    text-align: center;
  }

  .co-render {
    position: relative;
    min-height: 200px;
    background: #222;
    color: #fff;
  }
  .co-render__img {
    display: block;
    width: 100%;
    max-height: 280px;
    object-fit: cover;
  }
  .co-render__ph {
    min-height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #2a2a32;
    color: rgba(255, 255, 255, 0.35);
    font-size: 12px;
  }
  .co-render__text {
    position: absolute;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 14px 16px;
    max-width: 88%;
  }
  .co-render.co-preview--pos-top-left .co-render__text { top: 8px; left: 8px; }
  .co-render.co-preview--pos-top-right .co-render__text { top: 8px; right: 8px; align-items: flex-end; }
  .co-render.co-preview--pos-bottom-left .co-render__text { bottom: 8px; left: 8px; }
  .co-render.co-preview--pos-bottom-right .co-render__text { bottom: 8px; right: 8px; align-items: flex-end; }
  .co-render.co-preview--pos-center .co-render__text {
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    align-items: center;
    text-align: center;
  }
  .co-render.co-preview--ta-left .co-render__text { text-align: left; }
  .co-render.co-preview--ta-center .co-render__text { text-align: center; }
  .co-render.co-preview--ta-right .co-render__text { text-align: right; }
  .co-render.co-preview--overlay::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.55), transparent 50%);
  }
  .co-render.co-preview--tone-light .co-render__lab,
  .co-render.co-preview--tone-light .co-render__tit,
  .co-render.co-preview--tone-auto .co-render__lab,
  .co-render.co-preview--tone-auto .co-render__tit {
    color: rgba(255, 255, 255, 0.95);
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.55);
  }
  .co-render.co-preview--tone-dark .co-render__lab,
  .co-render.co-preview--tone-dark .co-render__tit {
    color: rgba(20, 20, 28, 0.95);
    text-shadow: 0 0 6px rgba(255, 255, 255, 0.35);
  }
  .co-render__lab {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .co-render__tit {
    font-size: 1.35rem;
    font-weight: 700;
    line-height: 1.15;
  }

  .page-footer {
    margin-top: auto;
    padding: 10px 16px 12px;
    border-top: 1px solid rgba(0, 0, 0, 0.07);
    display: flex;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
    font-size: 10px;
    color: rgba(0, 0, 0, 0.38);
  }
  .folio {
    font-variant-numeric: tabular-nums;
  }
  .folio-ed--muted {
    opacity: 0.75;
  }

  .page-debug {
    font-size: 10px;
    color: rgba(0, 0, 0, 0.45);
    padding: 0 14px 10px;
  }
  .page-debug summary {
    cursor: pointer;
    user-select: none;
  }
  .page-debug ul {
    margin: 6px 0 0;
    padding-left: 1.1em;
  }
</style>
