/**
 * PARTE 9 — Motor de paginación v1 (preview editorial).
 *
 * Entrada: snapshot libro + secciones + bloques.
 * Salida: secuencia de `RenderedPage` con colocaciones y metadatos.
 *
 * Alturas en **unidades internas** (~px a escala fija); la UI escala proporcionalmente.
 * Sin DOM ni medición real: heurísticas estables para v1.
 */

import type { DocumentBlock } from '$lib/core/domain/block';
import type { DocumentSection, SectionType } from '$lib/core/domain/section';
import { parseImageBlockContent } from './image-block-content';
import type { BookLayoutSnapshot, PaginatedBookResult, PlacedBlock, RenderedPage } from './page-layout-model';
import { pageSpreadSide } from './page-layout-model';
import { buildEditorialFrames } from './editorial-page-numbering';
import {
  blockContainsTocMarker,
  buildTocEntries,
  resolveTocConfig,
} from './toc-generation';
import type { TocConfig, TocEntry } from './toc-model';

/** Altura útil del cuerpo de página (unidades internas). */
export const PAGE_BODY_HEIGHT_UNITS = 920;
export const PAGE_BODY_WIDTH_UNITS  = 560;

const GAP_AFTER_BLOCK = 12;
const CHARS_PER_LINE  = 54;
const TOC_ENTRY_UNITS = 26;
const TOC_TITLE_UNITS = 52;
const TOC_EMPTY_UNITS = 28;

function estimateLines(text: string): number {
  const t = text.replace(/\r\n/g, '\n');
  if (!t.trim()) return 1;
  const parts = t.split('\n');
  let lines = 0;
  for (const p of parts) {
    const chunk = p.length === 0 ? 1 : Math.ceil(p.length / CHARS_PER_LINE);
    lines += chunk;
  }
  return Math.max(1, lines);
}

function estimateParagraphUnits(text: string): number {
  const lines = estimateLines(text);
  return 16 + lines * 22;
}

function estimateBlockHeight(block: DocumentBlock): number {
  switch (block.blockType) {
    case 'HEADING_1':
      return 48 + estimateLines(block.contentText) * 26;
    case 'HEADING_2':
      return 40 + estimateLines(block.contentText) * 22;
    case 'PARAGRAPH':
      return estimateParagraphUnits(block.contentText);
    case 'QUOTE':
      return 20 + estimateLines(block.contentText) * 21;
    case 'CENTERED_PHRASE':
      return 28 + estimateLines(block.contentText) * 22;
    case 'IMAGE': {
      const img = parseImageBlockContent(block.contentJson);
      return img.assetId ? 280 : 120;
    }
    case 'SEPARATOR':
      return 40;
    case 'PAGE_BREAK':
      return 0;
    case 'CHAPTER_OPENING':
      return Math.floor(PAGE_BODY_HEIGHT_UNITS * 0.96);
    default:
      return estimateParagraphUnits(block.contentText);
  }
}

function estimateTocUnits(entryCount: number, includeTitle: boolean): number {
  const titleUnits = includeTitle ? TOC_TITLE_UNITS : 0;
  const bodyUnits = entryCount > 0 ? entryCount * TOC_ENTRY_UNITS : TOC_EMPTY_UNITS;
  return titleUnits + bodyUnits;
}

/** Reservado para reglas por tipo (COVER, TOC…); v1: toda sección tras la primera abre en página nueva. */
function sectionStartsOnFreshPage(_sectionType: SectionType, isFirstSection: boolean): boolean {
  if (isFirstSection) return false;
  return true;
}

class Paginator {
  readonly bookId: string;
  readonly pages: RenderedPage[] = [];
  private currentIdx = 0;
  private used = 0;
  private forceNext = false;

  constructor(bookId: string) {
    this.bookId = bookId;
    this.appendContentPage();
  }

  private makePage(kind: RenderedPage['kind']): RenderedPage {
    const ix = this.pages.length;
    return {
      internalIndex:      ix,
      visualPageNumber:   ix + 1,
      physicalPageNumber: ix + 1,
      editorialPageNumber: null,
      editorialPageLabel: null,
      side:               pageSpreadSide(ix),
      kind,
      primarySectionId:   null,
      primarySectionType: null,
      primarySectionTitle: null,
      placements:         [],
      debugNotes:         [],
      layoutMeta: {
        bodyHeightUnits: PAGE_BODY_HEIGHT_UNITS,
        usedContentUnits: 0,
      },
      editorial: {
        physicalPageNumber: ix + 1,
        numberingScope: null,
        editorialOrdinal: null,
        editorialLabel: null,
        showPageNumber: false,
        headerText: null,
        footerText: null,
      },
    };
  }

  private appendContentPage(): void {
    this.pages.push(this.makePage('content'));
    this.currentIdx = this.pages.length - 1;
    this.used = 0;
  }

  private appendBlankPage(note: string): void {
    const p = this.makePage('editorial_blank');
    p.debugNotes.push(note);
    this.pages.push(p);
    this.currentIdx = this.pages.length - 1;
    this.used = 0;
  }

  private touchPrimarySection(section: DocumentSection): void {
    const p = this.pages[this.currentIdx];
    if (!p.primarySectionId) {
      p.primarySectionId    = section.id;
      p.primarySectionType  = section.sectionType;
      p.primarySectionTitle = section.title;
    }
  }

  private bumpUsed(delta: number): void {
    this.used += delta;
    const p = this.pages[this.currentIdx];
    p.layoutMeta.usedContentUnits = this.used;
  }

  remaining(): number {
    return Math.max(0, PAGE_BODY_HEIGHT_UNITS - this.used);
  }

  private startNewContentPage(note?: string): void {
    this.appendContentPage();
    if (note) this.pages[this.currentIdx].debugNotes.push(note);
  }

  /**
   * Fuerza inicio en recto (impar físico en convención v1: índice 0 = derecha).
   * Si la primera página de la sección caería en verso vacío, se reutiliza como blanco editorial
   * y se abre una nueva página de contenido en recto.
   */
  ensureStartOnRightPage(section: DocumentSection): void {
    if (!section.startOnRightPage) return;
    if (pageSpreadSide(this.currentIdx) === 'right' && this.used === 0) return;
    if (pageSpreadSide(this.currentIdx) === 'right' && this.used > 0) {
      this.startNewContentPage('Nueva página antes de sección en recto');
    }
    if (pageSpreadSide(this.currentIdx) === 'left') {
      const p = this.pages[this.currentIdx];
      if (this.used === 0 && p.placements.length === 0 && p.kind === 'content') {
        p.kind = 'editorial_blank';
        p.primarySectionId    = null;
        p.primarySectionType  = null;
        p.primarySectionTitle = null;
        p.debugNotes.push('Página en blanco editorial (forzar inicio en recto)');
        this.appendContentPage();
      } else {
        this.appendBlankPage('Página en blanco editorial (forzar inicio en recto)');
        this.appendContentPage();
      }
    }
  }

  beginSection(section: DocumentSection, isFirst: boolean): void {
    if (sectionStartsOnFreshPage(section.sectionType, isFirst)) {
      if (this.used > 0) {
        this.startNewContentPage(`Inicio de sección: ${section.sectionType}`);
      } else if (!isFirst) {
        // Nueva sección siempre en página nueva aunque la anterior acabara justo al filo
        this.startNewContentPage(`Nueva sección: ${section.sectionType}`);
      }
    }
    this.ensureStartOnRightPage(section);
    this.touchPrimarySection(section);
  }

  private finishPageBreakBlock(): void {
    this.startNewContentPage('Bloque PAGE_BREAK');
    this.forceNext = false;
  }

  private placePlacement(
    section: DocumentSection,
    placed: PlacedBlock,
    height: number,
  ): void {
    this.touchPrimarySection(section);
    const p = this.pages[this.currentIdx];
    p.placements.push(placed);
    this.bumpUsed(height + GAP_AFTER_BLOCK);
  }

  private splitParagraph(
    text: string,
    maxUnits: number,
  ): { first: string; rest: string } | null {
    const t = text.trim();
    if (!t || maxUnits < 80) return null;
    const target = Math.floor(t.length * Math.min(0.85, maxUnits / estimateParagraphUnits(t)));
    let cut = Math.max(20, Math.min(target, t.length - 1));
    const space = t.lastIndexOf(' ', cut);
    if (space > 20) cut = space;
    const first = t.slice(0, cut).trimEnd();
    const rest  = t.slice(cut).trimStart();
    if (!rest) return null;
    return { first, rest };
  }

  placeToc(
    section: DocumentSection,
    tocEntries: TocEntry[],
    tocConfig: TocConfig,
  ): void {
    let index = 0;
    let showTitleInChunk = tocConfig.showTitle;
    const maxEntriesPerFreshPage = Math.max(
      1,
      Math.floor((PAGE_BODY_HEIGHT_UNITS - (showTitleInChunk ? TOC_TITLE_UNITS : 0)) / TOC_ENTRY_UNITS),
    );

    if (tocEntries.length === 0) {
      const height = estimateTocUnits(0, showTitleInChunk);
      if (height > this.remaining() && this.used > 0) {
        this.startNewContentPage('Continuación de TOC');
      }
      this.placePlacement(section, {
        block: null,
        estimatedUnits: height,
        tocEntries: [],
        tocConfig: { ...tocConfig, showTitle: showTitleInChunk },
        syntheticType: 'TOC',
      }, height);
      return;
    }

    while (index < tocEntries.length) {
      if (this.remaining() < TOC_ENTRY_UNITS * 2 && this.used > 0) {
        this.startNewContentPage('Continuación de TOC');
      }

      const availableUnits = this.remaining() - (showTitleInChunk ? TOC_TITLE_UNITS : 0);
      const fitCount = Math.max(
        1,
        Math.min(
          tocEntries.length - index,
          Math.floor(Math.max(availableUnits, TOC_ENTRY_UNITS) / TOC_ENTRY_UNITS),
        ),
      );
      const chunkCount = Math.min(fitCount, maxEntriesPerFreshPage);
      const chunk = tocEntries.slice(index, index + chunkCount);
      const height = estimateTocUnits(chunk.length, showTitleInChunk);

      if (height > this.remaining() && this.used > 0) {
        this.startNewContentPage('Continuación de TOC');
        continue;
      }

      this.placePlacement(section, {
        block: null,
        estimatedUnits: height,
        tocEntries: chunk,
        tocConfig: { ...tocConfig, showTitle: showTitleInChunk },
        syntheticType: 'TOC',
      }, height);

      index += chunk.length;
      showTitleInChunk = false;
    }
  }

  placeBlock(block: DocumentBlock, section: DocumentSection, next: DocumentBlock | undefined): void {
    if (this.forceNext) {
      this.startNewContentPage('Salto pendiente (pageBreakAfter anterior)');
      this.forceNext = false;
    }

    if (block.pageBreakBefore && this.used > 0) {
      this.startNewContentPage('pageBreakBefore en bloque');
    }

    if (block.blockType === 'PAGE_BREAK') {
      if (this.used > 0) this.startNewContentPage('PAGE_BREAK');
      else this.pages[this.currentIdx].debugNotes.push('PAGE_BREAK en cabecera de página');
      return;
    }

    if (block.blockType === 'CHAPTER_OPENING') {
      if (this.used > 0) this.startNewContentPage('CHAPTER_OPENING en página dedicada');
      const h = Math.min(PAGE_BODY_HEIGHT_UNITS, estimateBlockHeight(block));
      const placed: PlacedBlock = {
        block,
        estimatedUnits: h,
        fullPageComposition: true,
      };
      this.placePlacement(section, placed, h);
      this.startNewContentPage('Tras CHAPTER_OPENING');
      return;
    }

    let h = estimateBlockHeight(block);

    if (block.keepTogether && next) {
      const combined = h + GAP_AFTER_BLOCK + estimateBlockHeight(next);
      if (combined > this.remaining()) {
        this.startNewContentPage('keepTogether con el bloque siguiente');
      }
    }

    if (
      block.blockType === 'PARAGRAPH'
      && !block.keepTogether
      && h > this.remaining()
      && h <= PAGE_BODY_HEIGHT_UNITS * 0.92
      && this.remaining() > 60
    ) {
      const split = this.splitParagraph(block.contentText, this.remaining());
      if (split) {
        const h1 = estimateParagraphUnits(split.first);
        if (h1 <= this.remaining()) {
          this.placePlacement(section, {
            block,
            textOverride: split.first,
            estimatedUnits: h1,
          }, h1);
          // Continuar resto en página siguiente como colocación virtual encadenada:
          const h2 = estimateParagraphUnits(split.rest);
          this.startNewContentPage('Continuación de párrafo fragmentado');
          this.placePlacement(section, {
            block,
            textOverride: split.rest,
            estimatedUnits: h2,
          }, h2);
          if (block.pageBreakAfter) this.forceNext = true;
          return;
        }
      }
    }

    if (h > this.remaining()) {
      if (this.used > 0) {
        this.startNewContentPage(
          h > PAGE_BODY_HEIGHT_UNITS ? 'Bloque más alto que una página' : 'Desborde vertical',
        );
      }
      h = estimateBlockHeight(block);
    }

    const placed: PlacedBlock = { block, estimatedUnits: h };
    this.placePlacement(section, placed, h);

    if (block.pageBreakAfter) {
      this.forceNext = true;
    }
  }

  finalize(): void {
    for (let i = 0; i < this.pages.length; i++) {
      const p = this.pages[i];
      p.internalIndex      = i;
      p.visualPageNumber   = i + 1;
      p.physicalPageNumber = i + 1;
      p.side               = pageSpreadSide(i);
      p.layoutMeta.bodyHeightUnits = PAGE_BODY_HEIGHT_UNITS;
      const n = p.placements.length;
      const sumU = p.placements.reduce((s, x) => s + x.estimatedUnits, 0);
      p.layoutMeta.usedContentUnits = sumU + (n > 0 ? (n - 1) * GAP_AFTER_BLOCK : 0);
    }
  }
}

function applyEditorialMetadata(
  pages: RenderedPage[],
  snapshot: BookLayoutSnapshot,
  sections: DocumentSection[],
): void {
  const editorialFrames = buildEditorialFrames({
    pages,
    sections,
    bookTitle: snapshot.bookTitle,
    settings: snapshot.layoutSettings,
  });
  pages.forEach((page, index) => {
    const frame = editorialFrames[index];
    page.editorial = frame;
    page.editorialPageNumber = frame.editorialOrdinal;
    page.editorialPageLabel = frame.editorialLabel;
  });
}

function paginateBookPass(
  snapshot: BookLayoutSnapshot,
  sections: DocumentSection[],
  tocEntries: TocEntry[],
  tocConfig: TocConfig,
): RenderedPage[] {
  const pag = new Paginator(snapshot.bookId);

  let first = true;
  for (const section of sections) {
    const blocks = [...(snapshot.blocksBySectionId[section.id] ?? [])].sort(
      (a, b) => a.orderIndex - b.orderIndex,
    );
    pag.beginSection(section, first);
    first = false;

    const autoInsertTocAtSectionStart =
      section.sectionType === 'TOC' && !blocks.some(block => blockContainsTocMarker(block.contentText));

    if (autoInsertTocAtSectionStart) {
      pag.placeToc(section, tocEntries, tocConfig);
    }

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const next  = blocks[i + 1];
      if (section.sectionType === 'TOC' && blockContainsTocMarker(block.contentText)) {
        pag.placeToc(section, tocEntries, tocConfig);
        continue;
      }
      pag.placeBlock(block, section, next);
    }
  }

  pag.finalize();
  applyEditorialMetadata(pag.pages, snapshot, sections);
  return pag.pages;
}

function tocEntriesSignature(entries: TocEntry[]): string {
  return entries.map(entry => `${entry.targetSectionId}:${entry.pageNumberVisible ?? ''}:${entry.label}`).join('|');
}

/**
 * Construye el layout paginado completo del libro.
 */
export function buildPaginatedLayout(snapshot: BookLayoutSnapshot): PaginatedBookResult {
  const sections = [...snapshot.sections].sort((a, b) => a.orderIndex - b.orderIndex);
  const tocConfig = resolveTocConfig(snapshot.layoutSettings.tocConfigJson);

  let tocEntries: TocEntry[] = [];
  let pages: RenderedPage[] = [];
  let lastSignature = '';

  for (let pass = 0; pass < 4; pass++) {
    pages = paginateBookPass(snapshot, sections, tocEntries, tocConfig);
    const nextEntries = buildTocEntries({ sections, pages });
    const signature = tocEntriesSignature(nextEntries);
    if (signature === lastSignature) {
      tocEntries = nextEntries;
      break;
    }
    tocEntries = nextEntries;
    lastSignature = signature;
  }

  pages = paginateBookPass(snapshot, sections, tocEntries, tocConfig);

  return {
    bookId: snapshot.bookId,
    pages,
    tocEntries,
    pageBodyHeightUnits: PAGE_BODY_HEIGHT_UNITS,
    pageBodyWidthUnits:  PAGE_BODY_WIDTH_UNITS,
  };
}
