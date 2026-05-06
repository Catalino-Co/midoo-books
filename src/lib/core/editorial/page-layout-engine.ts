/**
 * PARTE 9 — Motor de paginación v1 (preview editorial).
 * PARTE 13 — Unidades de cuerpo derivadas de geometría física (márgenes + tamaño de hoja).
 *
 * Entrada: snapshot libro + secciones + bloques.
 * Salida: secuencia de `RenderedPage` con colocaciones y metadatos.
 *
 * Alturas en **unidades internas** escaladas desde el trim size; la UI refleja mm vía preview.
 * Sin DOM ni medición real: heurísticas estables para v1.
 */

import type { DocumentBlock } from '$lib/core/domain/block';
import type { DocumentSection, SectionType } from '$lib/core/domain/section';
import { DEFAULT_LAYOUT_SETTINGS } from '$lib/core/domain/layout';
import { parseImageBlockContent } from './image-block-content';
import type { BookLayoutSnapshot, PaginatedBookResult, PlacedBlock, RenderedPage } from './page-layout-model';
import { pageSpreadSide } from './page-layout-model';
import { buildEditorialFrames } from './editorial-page-numbering';
import {
  resolveBookStyles,
  resolveBookStyleRoleForBlock,
  resolveEffectiveBookStyleForBlock,
  type BookStyleDefinition,
  type BookStyleMap,
} from './book-styles';
import {
  blockContainsTocMarker,
  buildTocEntries,
  resolveTocConfig,
} from './toc-generation';
import type { TocConfig, TocEntry } from './toc-model';
import { computeLayoutEngineMetrics } from './document-layout-metrics';
import type { LayoutEngineMetrics } from './page-layout-model';

/** Referencia histórica del motor v1 (A5 por defecto); el render real usa `engineMetrics`. */
export const PAGE_BODY_HEIGHT_UNITS = 540;
export const PAGE_BODY_WIDTH_UNITS  = 396;

const GAP_AFTER_BLOCK = 10;
const PARAGRAPH_LINE_UNITS = 20;
const QUOTE_LINE_UNITS = 20;
const PARAGRAPH_TOP_UNITS = 16;
const PARAGRAPH_CONTINUATION_TOP_UNITS = 8;
const QUOTE_TOP_UNITS = 20;
const MIN_PARAGRAPH_LINES_PER_FRAGMENT = 2;
const MIN_PARAGRAPH_LINES_AT_PAGE_BOTTOM = 1;
const MIN_PARAGRAPH_LINES_AT_PAGE_TOP = 2;
const KEEP_TOGETHER_MAX_PARAGRAPH_LINES = 4;
const HEADING_KEEP_WITH_NEXT_LINES = 3;
const SHORT_SPECIAL_BLOCK_MAX_UNITS = 220;
const SPECIAL_BLOCK_MIN_BOTTOM_BREATHING_ROOM = 44;
/** Solo holgura por redondeo medición/unidades; no inflar el presupuesto vertical (evita texto sobre el pie). */
const PARAGRAPH_FIT_TOLERANCE_UNITS = 3;
const TOC_ENTRY_UNITS = 26;
const TOC_TITLE_UNITS = 52;
const TOC_EMPTY_UNITS = 28;
const TEXT_LINE_UNITS_PER_PT =
  PARAGRAPH_LINE_UNITS / (DEFAULT_LAYOUT_SETTINGS.bodyFontSize * DEFAULT_LAYOUT_SETTINGS.bodyLineHeight);
const SPACING_UNITS_PER_PT = GAP_AFTER_BLOCK / Math.max(1, DEFAULT_LAYOUT_SETTINGS.paragraphSpacing);

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export interface MeasuredTextBlock {
  totalUnits: number;
  lineCount: number;
}

export interface MeasuredParagraphSplit {
  first: string;
  rest: string;
  measuredUnits: number;
  fragmentLineCount: number;
  widowOrphanAdjusted: boolean;
}

export interface LayoutTextMeasurementAdapter {
  measureTextBlock(input: {
    blockType: DocumentBlock['blockType'];
    text: string;
    style: BookStyleDefinition;
    continuedFromPreviousPage?: boolean;
    continuesOnNextPage?: boolean;
  }): MeasuredTextBlock;
  splitParagraph(input: {
    text: string;
    style: BookStyleDefinition;
    availableUnits: number;
    continuedFromPreviousPage: boolean;
    minLinesAtPageBottom: number;
    minLinesAtPageTop: number;
  }): MeasuredParagraphSplit | null;
}

export interface BuildPaginatedLayoutOptions {
  engineMetrics?: LayoutEngineMetrics;
  textMeasurement?: LayoutTextMeasurementAdapter | null;
}

function wrapTextToLines(text: string, charsPerLine: number): string[] {
  const normalized = text.replace(/\r\n/g, '\n');
  if (!normalized.trim()) return [''];

  const rawLines = normalized.split('\n');
  const out: string[] = [];

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      out.push('');
      continue;
    }

    const words = trimmed.split(/\s+/);
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= charsPerLine || current === '') {
        current = candidate;
      } else {
        out.push(current);
        current = word;
      }
    }
    out.push(current);
  }

  return out.length > 0 ? out : [''];
}

function estimateLines(text: string, charsPerLine: number): number {
  return wrapTextToLines(text, charsPerLine).length;
}

function charsPerLineForStyle(
  baseCharsPerLine: number,
  style: BookStyleDefinition,
  paragraphStyle: BookStyleDefinition,
): number {
  const scaled = Math.round(baseCharsPerLine * (paragraphStyle.fontSize / Math.max(8, style.fontSize)));
  return clamp(scaled, 12, 120);
}

function lineUnitsForStyle(style: BookStyleDefinition): number {
  return Math.max(14, Math.round(style.fontSize * style.lineHeight * TEXT_LINE_UNITS_PER_PT));
}

function spacingUnits(pt: number): number {
  return Math.max(0, Math.round(pt * SPACING_UNITS_PER_PT));
}

function topUnitsForStyle(style: BookStyleDefinition, continuationUnits: number, continued: boolean): number {
  if (continued) return continuationUnits;
  return Math.max(continuationUnits, spacingUnits(style.marginTop));
}

function totalLinesForText(text: string, charsPerLine: number): number {
  return wrapTextToLines(text, charsPerLine).length;
}

function estimateTextBlockUnits(
  text: string,
  style: BookStyleDefinition,
  charsPerLine: number,
): number {
  const lines = totalLinesForText(text, charsPerLine);
  return spacingUnits(style.marginTop)
    + (lines * lineUnitsForStyle(style))
    + spacingUnits(style.marginBottom);
}

function estimateParagraphFragmentUnits(
  lineCount: number,
  continuedFromPreviousPage: boolean,
  style?: BookStyleDefinition,
  continuesOnNextPage = false,
): number {
  if (!style) {
    return (continuedFromPreviousPage ? PARAGRAPH_CONTINUATION_TOP_UNITS : PARAGRAPH_TOP_UNITS)
      + (lineCount * PARAGRAPH_LINE_UNITS);
  }
  return topUnitsForStyle(style, PARAGRAPH_CONTINUATION_TOP_UNITS, continuedFromPreviousPage)
    + (lineCount * lineUnitsForStyle(style))
    + (continuesOnNextPage ? 0 : spacingUnits(style.marginBottom));
}

function estimateQuoteFragmentUnits(
  lineCount: number,
  style?: BookStyleDefinition,
  continuedFromPreviousPage = false,
  continuesOnNextPage = false,
): number {
  if (!style) {
    return QUOTE_TOP_UNITS + (lineCount * QUOTE_LINE_UNITS);
  }
  return topUnitsForStyle(style, QUOTE_TOP_UNITS, continuedFromPreviousPage)
    + (lineCount * lineUnitsForStyle(style))
    + (continuesOnNextPage ? 0 : spacingUnits(style.marginBottom));
}

function maxParagraphLinesForUnits(
  maxUnits: number,
  continuedFromPreviousPage: boolean,
  style?: BookStyleDefinition,
): number {
  if (!style) {
    const topUnits = continuedFromPreviousPage ? PARAGRAPH_CONTINUATION_TOP_UNITS : PARAGRAPH_TOP_UNITS;
    return Math.max(0, Math.floor((maxUnits - topUnits) / PARAGRAPH_LINE_UNITS));
  }
  const topUnits = topUnitsForStyle(style, PARAGRAPH_CONTINUATION_TOP_UNITS, continuedFromPreviousPage);
  return Math.max(0, Math.floor((maxUnits - topUnits) / Math.max(1, lineUnitsForStyle(style))));
}

function estimateBlockHeight(
  block: DocumentBlock,
  section: DocumentSection,
  bodyH: number,
  charsPerLine: number,
  bookStyles: BookStyleMap,
): number {
  const paragraphStyle = bookStyles.PARAGRAPH;
  const role = resolveBookStyleRoleForBlock(section.sectionType, block);
  const roleStyle = role ? bookStyles[role] : null;
  const roleCharsPerLine = roleStyle
    ? charsPerLineForStyle(charsPerLine, roleStyle, paragraphStyle)
    : charsPerLine;

  switch (block.blockType) {
    case 'HEADING_1':
    case 'HEADING_2':
    case 'PARAGRAPH':
    case 'CENTERED_PHRASE':
      if (roleStyle) {
        return estimateTextBlockUnits(block.contentText, roleStyle, roleCharsPerLine);
      }
      break;
    case 'QUOTE':
      if (roleStyle) {
        return estimateQuoteFragmentUnits(
          totalLinesForText(block.contentText, roleCharsPerLine),
          roleStyle,
          false,
          false,
        );
      }
      break;
    case 'IMAGE': {
      const img = parseImageBlockContent(block.contentJson);
      if (img.fillPage) return Math.floor(bodyH * 0.96);
      return img.assetId ? 280 : 120;
    }
    case 'SEPARATOR':
      return 40;
    case 'PAGE_BREAK':
      return 0;
    case 'CHAPTER_OPENING':
      return Math.floor(bodyH * 0.96);
  }
  return estimateTextBlockUnits(block.contentText, paragraphStyle, charsPerLine);
}

function estimateTocUnits(entryCount: number, includeTitle: boolean, bookStyles?: BookStyleMap): number {
  const titleUnits = includeTitle
    ? bookStyles
      ? estimateTextBlockUnits('Índice', bookStyles.HEADING_1, charsPerLineForStyle(36, bookStyles.HEADING_1, bookStyles.PARAGRAPH))
      : TOC_TITLE_UNITS
    : 0;
  const perEntryUnits = bookStyles
    ? Math.max(18, estimateTextBlockUnits('Entrada de índice', bookStyles.TOC_ENTRY, charsPerLineForStyle(50, bookStyles.TOC_ENTRY, bookStyles.PARAGRAPH)))
    : TOC_ENTRY_UNITS;
  const bodyUnits = entryCount > 0 ? entryCount * perEntryUnits : TOC_EMPTY_UNITS;
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
  private readonly metrics: LayoutEngineMetrics;
  private readonly layoutSettings: BookLayoutSnapshot['layoutSettings'];
  private readonly bookStyles: BookStyleMap;
  private readonly textMeasurement: LayoutTextMeasurementAdapter | null;
  private currentIdx = 0;
  private used = 0;
  private forceNext = false;

  constructor(
    bookId: string,
    metrics: LayoutEngineMetrics,
    layoutSettings: BookLayoutSnapshot['layoutSettings'],
    bookStyles: BookStyleMap,
    textMeasurement: LayoutTextMeasurementAdapter | null,
  ) {
    this.bookId = bookId;
    this.metrics = metrics;
    this.layoutSettings = layoutSettings;
    this.bookStyles = bookStyles;
    this.textMeasurement = textMeasurement;
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
        bodyHeightUnits: this.metrics.pageBodyHeightUnits,
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
    return Math.max(0, this.metrics.pageBodyHeightUnits - this.used);
  }

  private placementGapBefore(): number {
    return this.pages[this.currentIdx].placements.length > 0 ? GAP_AFTER_BLOCK : 0;
  }

  private availableForPlacement(): number {
    return Math.max(0, this.remaining() - this.placementGapBefore());
  }

  private effectiveStyle(section: DocumentSection, block: DocumentBlock): BookStyleDefinition | null {
    return resolveEffectiveBookStyleForBlock(
      this.layoutSettings,
      { sectionType: section.sectionType },
      block,
    );
  }

  private measureTextBlockUnits(
    block: DocumentBlock,
    section: DocumentSection,
    text: string,
    options: {
      continuedFromPreviousPage?: boolean;
      continuesOnNextPage?: boolean;
    } = {},
  ): MeasuredTextBlock | null {
    if (!this.textMeasurement) return null;
    const style = this.effectiveStyle(section, block);
    if (!style) return null;
    if (
      block.blockType !== 'HEADING_1'
      && block.blockType !== 'HEADING_2'
      && block.blockType !== 'PARAGRAPH'
      && block.blockType !== 'QUOTE'
      && block.blockType !== 'CENTERED_PHRASE'
    ) {
      return null;
    }
    return this.textMeasurement.measureTextBlock({
      blockType: block.blockType,
      text,
      style,
      continuedFromPreviousPage: options.continuedFromPreviousPage ?? false,
      continuesOnNextPage: options.continuesOnNextPage ?? false,
    });
  }

  private estimateBlockHeightForPlacement(block: DocumentBlock, section: DocumentSection): number {
    const measured = this.measureTextBlockUnits(block, section, block.contentText, {
      continuedFromPreviousPage: false,
      continuesOnNextPage: false,
    });
    if (measured) return measured.totalUnits;

    const effectiveStyle = this.effectiveStyle(section, block);
    const paragraphStyle = this.bookStyles.PARAGRAPH;
    const roleStyle = effectiveStyle
      ?? (resolveBookStyleRoleForBlock(section.sectionType, block)
        ? this.bookStyles[resolveBookStyleRoleForBlock(section.sectionType, block)!]
        : null);
    const roleCharsPerLine = roleStyle
      ? charsPerLineForStyle(this.metrics.charsPerLine, roleStyle, paragraphStyle)
      : this.metrics.charsPerLine;

    switch (block.blockType) {
      case 'HEADING_1':
      case 'HEADING_2':
      case 'PARAGRAPH':
      case 'CENTERED_PHRASE':
        if (roleStyle) {
          return estimateTextBlockUnits(block.contentText, roleStyle, roleCharsPerLine);
        }
        break;
      case 'QUOTE':
        if (roleStyle) {
          return estimateQuoteFragmentUnits(
            totalLinesForText(block.contentText, roleCharsPerLine),
            roleStyle,
            false,
            false,
          );
        }
        break;
      case 'IMAGE': {
        const img = parseImageBlockContent(block.contentJson);
        if (img.fillPage) return Math.floor(this.metrics.pageBodyHeightUnits * 0.96);
        return img.assetId ? 280 : 120;
      }
      case 'SEPARATOR':
        return 40;
      case 'PAGE_BREAK':
        return 0;
      case 'CHAPTER_OPENING':
        return Math.floor(this.metrics.pageBodyHeightUnits * 0.96);
    }

    return estimateTextBlockUnits(block.contentText, paragraphStyle, this.metrics.charsPerLine);
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
    const gapBefore = this.placementGapBefore();
    p.placements.push(placed);
    this.bumpUsed(gapBefore + height);
  }

  private splitParagraph(
    text: string,
    maxUnits: number,
    continuedFromPreviousPage: boolean,
    paragraphStyle: BookStyleDefinition,
    minLinesAtPageBottom: number,
    minLinesAtPageTop: number,
  ): { first: string; rest: string; lineCount: number; startLine: number; widowOrphanAdjusted: boolean } | null {
    const lines = wrapTextToLines(
      text,
      charsPerLineForStyle(this.metrics.charsPerLine, paragraphStyle, this.bookStyles.PARAGRAPH),
    );
    if (lines.length <= 1) return null;
    if (lines.length <= minLinesAtPageBottom + minLinesAtPageTop) {
      return null;
    }

    let fitLines = maxParagraphLinesForUnits(maxUnits, continuedFromPreviousPage, paragraphStyle);
    if (fitLines <= 0) return null;

    if (fitLines >= lines.length) return null;

    const minFirstLines = Math.min(
      lines.length - minLinesAtPageTop,
      Math.max(minLinesAtPageBottom, 1),
    );
    if (fitLines < minFirstLines) return null;

    let widowOrphanAdjusted = false;
    const remainingLines = lines.length - fitLines;
    if (remainingLines > 0 && remainingLines < minLinesAtPageTop) {
      fitLines = lines.length - minLinesAtPageTop;
      widowOrphanAdjusted = true;
    }

    if (fitLines <= 0 || fitLines >= lines.length) return null;

    return {
      first: lines.slice(0, fitLines).join('\n'),
      rest: lines.slice(fitLines).join('\n'),
      lineCount: fitLines,
      startLine: 0,
      widowOrphanAdjusted,
    };
  }

  private minimumNextBlockUnits(next: DocumentBlock, section: DocumentSection): number {
    const paragraphStyle = this.bookStyles.PARAGRAPH;
    const roleStyle = this.effectiveStyle(section, next)
      ?? (resolveBookStyleRoleForBlock(section.sectionType, next)
        ? this.bookStyles[resolveBookStyleRoleForBlock(section.sectionType, next)!]
        : paragraphStyle);
    const roleChars = charsPerLineForStyle(this.metrics.charsPerLine, roleStyle, paragraphStyle);

    if (next.blockType === 'PARAGRAPH') {
      return estimateParagraphFragmentUnits(HEADING_KEEP_WITH_NEXT_LINES, false, this.bookStyles.PARAGRAPH, false);
    }
    if (next.blockType === 'QUOTE') {
      return estimateQuoteFragmentUnits(
        Math.min(3, totalLinesForText(next.contentText, roleChars)),
        roleStyle,
      );
    }
    if (next.blockType === 'CENTERED_PHRASE') {
      return Math.min(
        estimateTextBlockUnits(next.contentText, roleStyle, roleChars),
        SHORT_SPECIAL_BLOCK_MAX_UNITS,
      );
    }
    return Math.min(
      this.estimateBlockHeightForPlacement(next, section),
      180,
    );
  }

  private shouldMoveHeadingWithNext(
    block: DocumentBlock,
    section: DocumentSection,
    next: DocumentBlock | undefined,
  ): boolean {
    if ((block.blockType !== 'HEADING_1' && block.blockType !== 'HEADING_2') || !next) return false;
    if (this.used === 0) return false;

    const resolvedHeadingUnits = this.estimateBlockHeightForPlacement(block, section);
    const nextUnits = this.minimumNextBlockUnits(next, section);
    const requiredUnits = resolvedHeadingUnits + GAP_AFTER_BLOCK + nextUnits;

    return requiredUnits > this.availableForPlacement();
  }

  private shouldPreferFreshPageForSpecialBlock(
    block: DocumentBlock,
    blockHeight: number,
  ): boolean {
    if (this.used === 0) return false;
    if (
      block.blockType !== 'QUOTE'
      && block.blockType !== 'CENTERED_PHRASE'
      && block.blockType !== 'SEPARATOR'
    ) {
      return false;
    }

    const crampedFit = this.availableForPlacement() - blockHeight < SPECIAL_BLOCK_MIN_BOTTOM_BREATHING_ROOM;
    return blockHeight <= SHORT_SPECIAL_BLOCK_MAX_UNITS && crampedFit;
  }

  private placeParagraphFlow(
    block: DocumentBlock,
    section: DocumentSection,
  ): void {
    const paragraphStyle = this.effectiveStyle(section, block) ?? this.bookStyles.PARAGRAPH;
    const paragraphChars = charsPerLineForStyle(this.metrics.charsPerLine, paragraphStyle, paragraphStyle);
    const totalLines = wrapTextToLines(block.contentText, paragraphChars);
    const measuredWhole = this.measureTextBlockUnits(block, section, block.contentText, {
      continuedFromPreviousPage: false,
      continuesOnNextPage: false,
    });
    const totalUnits = measuredWhole?.totalUnits ?? estimateTextBlockUnits(block.contentText, paragraphStyle, paragraphChars);
    const totalLineCount = measuredWhole?.lineCount ?? totalLines.length;
    const shouldKeepWhole = block.keepTogether
      && totalLineCount <= KEEP_TOGETHER_MAX_PARAGRAPH_LINES
      && totalUnits <= this.metrics.pageBodyHeightUnits;

    if (shouldKeepWhole && totalUnits > this.availableForPlacement() && this.used > 0) {
      this.startNewContentPage('keepTogether en párrafo');
    }

    if (
      !this.textMeasurement
      &&
      !shouldKeepWhole
      && totalUnits <= this.metrics.pageBodyHeightUnits
      && this.used > 0
      && maxParagraphLinesForUnits(this.availableForPlacement(), false, paragraphStyle) < Math.min(totalLines.length, MIN_PARAGRAPH_LINES_PER_FRAGMENT)
    ) {
      this.startNewContentPage('Evitar huérfana al final de página');
    }

    if (shouldKeepWhole || totalUnits <= this.availableForPlacement()) {
      this.placePlacement(section, {
        block,
        estimatedUnits: totalUnits,
        debugMeta: {
          fragmented: false,
          keepTogetherApplied: shouldKeepWhole,
        },
      }, totalUnits);
      if (block.pageBreakAfter) this.forceNext = true;
      return;
    }

    let remainingText = block.contentText;
    let lineOffset = 0;
    let fragmentIndex = 0;
    let continued = false;

    while (remainingText.trim().length > 0) {
      if (
        !this.textMeasurement
        && this.availableForPlacement() < estimateParagraphFragmentUnits(MIN_PARAGRAPH_LINES_PER_FRAGMENT, continued, paragraphStyle, true)
      ) {
        if (this.used > 0) {
          this.startNewContentPage('Continuación de párrafo');
          continued = true;
          continue;
        }
      }

      const availableUnits = this.availableForPlacement();
      const fitBudgetUnits = availableUnits + PARAGRAPH_FIT_TOLERANCE_UNITS;
      const measuringContinuation = continued || lineOffset > 0;
      const tailLines = wrapTextToLines(remainingText, paragraphChars);
      const minLinesAtPageTopForSplit = tailLines.length <= 4 ? 1 : MIN_PARAGRAPH_LINES_AT_PAGE_TOP;
      const minLinesAtPageBottomForSplit =
        availableUnits < estimateParagraphFragmentUnits(2, measuringContinuation, paragraphStyle, true)
          ? 1
          : MIN_PARAGRAPH_LINES_AT_PAGE_BOTTOM;
      const measuredTail = this.measureTextBlockUnits(block, section, remainingText, {
        continuedFromPreviousPage: measuringContinuation,
        continuesOnNextPage: false,
      });
      const tailUnits = measuredTail?.totalUnits
        ?? estimateParagraphFragmentUnits(tailLines.length, continued, paragraphStyle, false);

      if (
        tailUnits <= fitBudgetUnits
        || this.used === 0 && tailUnits <= this.metrics.pageBodyHeightUnits + PARAGRAPH_FIT_TOLERANCE_UNITS
      ) {
        this.placePlacement(section, {
          block,
          textOverride: remainingText,
          estimatedUnits: tailUnits,
          debugMeta: {
            fragmented: continued || lineOffset > 0,
            continuedFromPreviousPage: continued || lineOffset > 0,
            continuesOnNextPage: false,
            fragmentLineStart: lineOffset,
            fragmentLineCount: measuredTail?.lineCount ?? tailLines.length,
            fragmentIndex,
            wasSplit: continued || lineOffset > 0,
            keepTogetherApplied: shouldKeepWhole,
            nonFragmentable: false,
          },
        }, tailUnits);
        break;
      }

      const split = this.splitParagraph(
        remainingText,
        fitBudgetUnits,
        measuringContinuation,
        paragraphStyle,
        minLinesAtPageBottomForSplit,
        minLinesAtPageTopForSplit,
      );
      const estimatedMaxLines = maxParagraphLinesForUnits(
        fitBudgetUnits,
        continued || lineOffset > 0,
        paragraphStyle,
      );
      const measuredHeuristicSplit = this.textMeasurement && split
        ? (() => {
          const measured = this.textMeasurement!.measureTextBlock({
            blockType: 'PARAGRAPH',
            text: split.first,
            style: paragraphStyle,
            continuedFromPreviousPage: continued || lineOffset > 0,
            continuesOnNextPage: true,
          });
          if (measured.totalUnits > fitBudgetUnits) return null;
          return {
            first: split.first,
            rest: split.rest,
            lineCount: measured.lineCount,
            widowOrphanAdjusted: split.widowOrphanAdjusted,
            measuredUnits: measured.totalUnits,
          };
        })()
        : null;
      const measuredSplit = this.textMeasurement
        ? this.textMeasurement.splitParagraph({
          text: remainingText,
          style: paragraphStyle,
          availableUnits: fitBudgetUnits,
          continuedFromPreviousPage: measuringContinuation,
          minLinesAtPageBottom: minLinesAtPageBottomForSplit,
          minLinesAtPageTop: minLinesAtPageTopForSplit,
        })
        : null;
      const estimatedSplit = this.textMeasurement ? null : split;
      if (!estimatedSplit && !measuredSplit && !measuredHeuristicSplit) {
        if (tailUnits > this.availableForPlacement() && this.used > 0) {
          this.startNewContentPage('Continuación de párrafo');
          continued = true;
          continue;
        }
        this.placePlacement(section, {
          block,
          textOverride: remainingText,
          estimatedUnits: tailUnits,
          debugMeta: {
            fragmented: continued || lineOffset > 0,
            continuedFromPreviousPage: continued || lineOffset > 0,
            continuesOnNextPage: false,
            fragmentLineStart: lineOffset,
            fragmentLineCount: measuredTail?.lineCount ?? tailLines.length,
            fragmentIndex,
            wasSplit: continued || lineOffset > 0,
            keepTogetherApplied: shouldKeepWhole,
            nonFragmentable: false,
          },
        }, tailUnits);
        break;
      }

      const effectiveSplit = measuredSplit
        ? {
          first: measuredSplit.first,
          rest: measuredSplit.rest,
          lineCount: measuredSplit.fragmentLineCount,
          widowOrphanAdjusted: measuredSplit.widowOrphanAdjusted,
          measuredUnits: measuredSplit.measuredUnits,
        }
        : measuredHeuristicSplit
          ? measuredHeuristicSplit
          : {
          first: split!.first,
          rest: split!.rest,
          lineCount: split!.lineCount,
          widowOrphanAdjusted: split!.widowOrphanAdjusted,
          measuredUnits: estimateParagraphFragmentUnits(
            split!.lineCount,
            continued || lineOffset > 0,
            paragraphStyle,
            true,
          ),
        };
      const h = effectiveSplit.measuredUnits;
      this.placePlacement(section, {
        block,
        textOverride: effectiveSplit.first,
        estimatedUnits: h,
        debugMeta: {
          fragmented: true,
          continuedFromPreviousPage: continued || lineOffset > 0,
          continuesOnNextPage: true,
          fragmentLineStart: lineOffset,
          fragmentLineCount: effectiveSplit.lineCount,
          fragmentIndex,
          wasSplit: true,
          remainingTextPreview: effectiveSplit.rest.slice(0, 120),
          keepTogetherApplied: shouldKeepWhole,
          widowOrphanAdjusted: effectiveSplit.widowOrphanAdjusted,
          nonFragmentable: false,
        },
      }, h);

      remainingText = effectiveSplit.rest;
      lineOffset += effectiveSplit.lineCount;
      fragmentIndex += 1;
      this.startNewContentPage('Continuación de párrafo fragmentado');
      continued = true;
    }

    if (block.pageBreakAfter) this.forceNext = true;
  }

  placeToc(
    section: DocumentSection,
    tocEntries: TocEntry[],
    tocConfig: TocConfig,
  ): void {
    let index = 0;
    let showTitleInChunk = tocConfig.showTitle;
    const tocEntryUnits = Math.max(
      18,
      estimateTextBlockUnits(
        'Entrada de índice',
        this.bookStyles.TOC_ENTRY,
        charsPerLineForStyle(50, this.bookStyles.TOC_ENTRY, this.bookStyles.PARAGRAPH),
      ),
    );
    const tocTitleUnits = estimateTextBlockUnits(
      tocConfig.titleText || 'Índice',
      this.bookStyles.HEADING_1,
      charsPerLineForStyle(36, this.bookStyles.HEADING_1, this.bookStyles.PARAGRAPH),
    );
    const maxEntriesPerFreshPage = Math.max(
      1,
      Math.floor(
        (this.metrics.pageBodyHeightUnits - (showTitleInChunk ? tocTitleUnits : 0)) / tocEntryUnits,
      ),
    );

    if (tocEntries.length === 0) {
      const height = estimateTocUnits(0, showTitleInChunk, this.bookStyles);
      if (height > this.availableForPlacement() && this.used > 0) {
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
      if (this.availableForPlacement() < tocEntryUnits * 2 && this.used > 0) {
        this.startNewContentPage('Continuación de TOC');
      }

      const availableUnits = this.availableForPlacement() - (showTitleInChunk ? tocTitleUnits : 0);
      const fitCount = Math.max(
        1,
        Math.min(
          tocEntries.length - index,
          Math.floor(Math.max(availableUnits, tocEntryUnits) / tocEntryUnits),
        ),
      );
      const chunkCount = Math.min(fitCount, maxEntriesPerFreshPage);
      const chunk = tocEntries.slice(index, index + chunkCount);
      const height = estimateTocUnits(chunk.length, showTitleInChunk, this.bookStyles);

      if (height > this.availableForPlacement() && this.used > 0) {
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

    if (this.shouldMoveHeadingWithNext(block, section, next)) {
      this.startNewContentPage('Heading keep-with-next');
    }

    if (block.blockType === 'PAGE_BREAK') {
      if (this.used > 0) this.startNewContentPage('PAGE_BREAK');
      else this.pages[this.currentIdx].debugNotes.push('PAGE_BREAK en cabecera de página');
      return;
    }

    if (block.blockType === 'CHAPTER_OPENING') {
      if (this.used > 0) this.startNewContentPage('CHAPTER_OPENING en página dedicada');
      const h = Math.min(
        this.metrics.pageBodyHeightUnits,
        this.estimateBlockHeightForPlacement(block, section),
      );
      const placed: PlacedBlock = {
        block,
        estimatedUnits: h,
        fullPageComposition: true,
      };
      this.placePlacement(section, placed, h);
      this.startNewContentPage('Tras CHAPTER_OPENING');
      return;
    }

    if (block.blockType === 'IMAGE') {
      const img = parseImageBlockContent(block.contentJson);
      if (img.fillPage) {
        if (this.used > 0) this.startNewContentPage('IMAGE a página completa');
        const h = Math.min(
          this.metrics.pageBodyHeightUnits,
          this.estimateBlockHeightForPlacement(block, section),
        );
        this.placePlacement(section, {
          block,
          estimatedUnits: h,
          fullPageComposition: true,
        }, h);
        this.startNewContentPage('Tras IMAGE a página completa');
        return;
      }
    }

    if (block.blockType === 'PARAGRAPH') {
      this.placeParagraphFlow(block, section);
      return;
    }

    let h = this.estimateBlockHeightForPlacement(block, section);

    if (block.keepTogether && next) {
      const combined = h + GAP_AFTER_BLOCK + this.estimateBlockHeightForPlacement(next, section);
      if (combined > this.availableForPlacement()) {
        this.startNewContentPage('keepTogether con el bloque siguiente');
      }
    }

    if (this.shouldPreferFreshPageForSpecialBlock(block, h)) {
      this.startNewContentPage(`Mejor acomodo visual de ${block.blockType}`);
    }

    if (h > this.availableForPlacement()) {
      if (this.used > 0) {
        this.startNewContentPage(
          h > this.metrics.pageBodyHeightUnits ? 'Bloque más alto que una página' : 'Desborde vertical',
        );
      }
      h = this.estimateBlockHeightForPlacement(block, section);
    }

    const placed: PlacedBlock = {
      block,
      estimatedUnits: h,
      debugMeta: {
        fragmented: false,
        keepTogetherApplied: block.keepTogether,
        keepWithNextApplied: block.blockType === 'HEADING_1' || block.blockType === 'HEADING_2'
          ? this.pages[this.currentIdx].debugNotes.includes('Heading keep-with-next')
          : false,
        movedToNextPage: this.pages[this.currentIdx].debugNotes.some(note =>
          note.includes('keepTogether') || note.includes('Heading keep-with-next') || note.includes(`Mejor acomodo visual de ${block.blockType}`),
        ),
        nonFragmentable: true,
      },
    };
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
      p.layoutMeta.bodyHeightUnits = this.metrics.pageBodyHeightUnits;
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
  engineMetrics: LayoutEngineMetrics,
  textMeasurement: LayoutTextMeasurementAdapter | null,
): RenderedPage[] {
  const pag = new Paginator(
    snapshot.bookId,
    engineMetrics,
    snapshot.layoutSettings,
    resolveBookStyles(snapshot.layoutSettings),
    textMeasurement,
  );

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
export function buildPaginatedLayout(
  snapshot: BookLayoutSnapshot,
  options: BuildPaginatedLayoutOptions = {},
): PaginatedBookResult {
  const sections = [...snapshot.sections].sort((a, b) => a.orderIndex - b.orderIndex);
  const tocConfig = resolveTocConfig(snapshot.layoutSettings.tocConfigJson);
  const engineMetrics = options.engineMetrics ?? computeLayoutEngineMetrics(snapshot.layoutSettings);

  let tocEntries: TocEntry[] = [];
  let pages: RenderedPage[] = [];
  let lastSignature = '';

  for (let pass = 0; pass < 4; pass++) {
    pages = paginateBookPass(snapshot, sections, tocEntries, tocConfig, engineMetrics, options.textMeasurement ?? null);
    const nextEntries = buildTocEntries({ sections, pages });
    const signature = tocEntriesSignature(nextEntries);
    if (signature === lastSignature) {
      tocEntries = nextEntries;
      break;
    }
    tocEntries = nextEntries;
    lastSignature = signature;
  }

  pages = paginateBookPass(snapshot, sections, tocEntries, tocConfig, engineMetrics, options.textMeasurement ?? null);

  return {
    bookId: snapshot.bookId,
    pages,
    tocEntries,
    pageBodyHeightUnits: engineMetrics.pageBodyHeightUnits,
    pageBodyWidthUnits:  engineMetrics.pageBodyWidthUnits,
    layoutSettings:      snapshot.layoutSettings,
    engineMetrics,
  };
}
