import type { DocumentBlock } from '$lib/core/domain/block';
import type { BookStyleDefinition } from './book-styles';
import type {
  LayoutEngineMetrics,
} from './page-layout-model';
import type {
  LayoutTextMeasurementAdapter,
  MeasuredParagraphSplit,
  MeasuredTextBlock,
} from './page-layout-engine';

const PT_TO_PX = 96 / 72;
const SPLIT_FIT_TOLERANCE_PX = 2;
/** Umbral para agrupar rectángulos en la misma línea visual (subpíxeles / zoom). */
const LINE_TOP_EPSILON_PX = 1;

function marginTopPx(style: BookStyleDefinition, continuedFromPreviousPage: boolean): number {
  return continuedFromPreviousPage ? 0 : style.marginTop * PT_TO_PX;
}

function marginBottomPx(style: BookStyleDefinition, continuesOnNextPage: boolean): number {
  return continuesOnNextPage ? 0 : style.marginBottom * PT_TO_PX;
}

function lineHeightPx(style: BookStyleDefinition): number {
  return Math.max(1, style.fontSize * PT_TO_PX * style.lineHeight);
}

export class BrowserPreviewTextMeasurer implements LayoutTextMeasurementAdapter {
  private readonly host: HTMLDivElement;
  private readonly bodyWidthPx: number;

  constructor(metrics: LayoutEngineMetrics) {
    this.bodyWidthPx = Math.max(180, metrics.pageBodyWidthUnits);
    this.host = document.createElement('div');
    this.host.setAttribute('aria-hidden', 'true');
    this.host.style.position = 'fixed';
    this.host.style.left = '-10000px';
    this.host.style.top = '0';
    this.host.style.width = `${this.bodyWidthPx}px`;
    this.host.style.visibility = 'hidden';
    this.host.style.pointerEvents = 'none';
    this.host.style.contain = 'layout style paint';
    this.host.style.zIndex = '-1';
    document.body.appendChild(this.host);
  }

  dispose(): void {
    this.host.remove();
  }

  measureTextBlock(input: {
    blockType: DocumentBlock['blockType'];
    text: string;
    style: BookStyleDefinition;
    continuedFromPreviousPage?: boolean;
    continuesOnNextPage?: boolean;
  }): MeasuredTextBlock {
    const measured = this.measureElement(
      input.blockType,
      input.text,
      input.style,
      input.continuedFromPreviousPage ?? false,
      input.continuesOnNextPage ?? false,
    );
    return {
      totalUnits: Math.ceil(measured.totalHeightPx),
      lineCount: measured.lineCount,
    };
  }

  splitParagraph(input: {
    text: string;
    style: BookStyleDefinition;
    availableUnits: number;
    continuedFromPreviousPage: boolean;
    minLinesAtPageBottom: number;
    minLinesAtPageTop: number;
  }): MeasuredParagraphSplit | null {
    const normalized = input.text.replace(/\r\n/g, '\n').trim();
    if (!normalized) return null;

    const byLines = this.splitParagraphByDomLines({
      text: normalized,
      style: input.style,
      availableUnits: input.availableUnits,
      continuedFromPreviousPage: input.continuedFromPreviousPage,
      minLinesAtPageBottom: input.minLinesAtPageBottom,
      minLinesAtPageTop: input.minLinesAtPageTop,
    });
    if (byLines) return byLines;

    return this.splitParagraphByWords({
      ...input,
      text: normalized,
    });
  }

  /**
   * Salto de página tipo procesador de texto: primero se parte en líneas visuales reales
   * (misma caja y estilos que el preview), luego se elige cuántas líneas caben en la altura disponible.
   */
  private splitParagraphByDomLines(input: {
    text: string;
    style: BookStyleDefinition;
    availableUnits: number;
    continuedFromPreviousPage: boolean;
    minLinesAtPageBottom: number;
    minLinesAtPageTop: number;
  }): MeasuredParagraphSplit | null {
    const text = input.text;
    if (text.length < 2) return null;

    const element = this.appendParagraphMeasureElement(
      text,
      input.style,
      input.continuedFromPreviousPage,
      true,
    );
    const lineStarts = this.getVisualLineStartIndices(element, text);
    const lineCount = lineStarts.length;
    if (lineCount <= 1) return null;
    if (lineCount <= input.minLinesAtPageBottom + input.minLinesAtPageTop) return null;

    const maxKByOrphan = lineCount - input.minLinesAtPageTop;
    if (maxKByOrphan < 1) return null;

    let lo = input.minLinesAtPageBottom;
    let hi = Math.min(maxKByOrphan, lineCount - 1);
    if (lo > hi) return null;

    let bestK = 0;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const cut = mid < lineCount ? lineStarts[mid]! : text.length;
      const firstText = text.slice(0, cut);
      const firstMeasure = this.measureElement(
        'PARAGRAPH',
        firstText,
        input.style,
        input.continuedFromPreviousPage,
        true,
      );
      if (firstMeasure.totalHeightPx <= input.availableUnits + SPLIT_FIT_TOLERANCE_PX) {
        bestK = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    if (bestK < input.minLinesAtPageBottom) return null;

    let k = bestK;
    let cut = k < lineCount ? lineStarts[k]! : text.length;
    let widowOrphanAdjusted = false;
    const restLines = lineCount - k;
    if (restLines > 0 && restLines < input.minLinesAtPageTop) {
      k = lineCount - input.minLinesAtPageTop;
      if (k < input.minLinesAtPageBottom) return null;
      cut = k < lineCount ? lineStarts[k]! : text.length;
      widowOrphanAdjusted = true;
    }

    const firstText = text.slice(0, cut).replace(/\s+$/u, '');
    const restText = text.slice(cut).replace(/^\s+/u, '');
    if (!restText) return null;

    const firstMeasure = this.measureElement(
      'PARAGRAPH',
      firstText,
      input.style,
      input.continuedFromPreviousPage,
      true,
    );
    if (firstMeasure.totalHeightPx > input.availableUnits + SPLIT_FIT_TOLERANCE_PX) return null;
    if (firstMeasure.lineCount < input.minLinesAtPageBottom) return null;

    const restMeasure = this.measureElement(
      'PARAGRAPH',
      restText,
      input.style,
      true,
      false,
    );
    if (restMeasure.lineCount < input.minLinesAtPageTop) return null;

    return {
      first: firstText,
      rest: restText,
      measuredUnits: Math.ceil(firstMeasure.totalHeightPx),
      fragmentLineCount: firstMeasure.lineCount,
      widowOrphanAdjusted,
    };
  }

  /** Respaldo estable (palabras) si el DOM no expone líneas de forma fiable. */
  private splitParagraphByWords(input: {
    text: string;
    style: BookStyleDefinition;
    availableUnits: number;
    continuedFromPreviousPage: boolean;
    minLinesAtPageBottom: number;
    minLinesAtPageTop: number;
  }): MeasuredParagraphSplit | null {
    const normalized = input.text;
    const words = normalized.split(/\s+/).filter(Boolean);
    if (words.length < 2) return null;

    let lo = 1;
    let hi = words.length - 1;
    let bestFitWords = 0;

    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const fragmentText = words.slice(0, mid).join(' ');
      const fragmentMeasure = this.measureElement(
        'PARAGRAPH',
        fragmentText,
        input.style,
        input.continuedFromPreviousPage,
        true,
      );
      if (fragmentMeasure.totalHeightPx <= input.availableUnits + SPLIT_FIT_TOLERANCE_PX) {
        bestFitWords = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    if (bestFitWords <= 0 || bestFitWords >= words.length) return null;
    for (let candidateWords = bestFitWords; candidateWords >= 1; candidateWords--) {
      if (candidateWords >= words.length) continue;
      const firstText = words.slice(0, candidateWords).join(' ');
      const restText = words.slice(candidateWords).join(' ');
      if (!restText) continue;

      const firstMeasure = this.measureElement(
        'PARAGRAPH',
        firstText,
        input.style,
        input.continuedFromPreviousPage,
        true,
      );
      if (firstMeasure.totalHeightPx > input.availableUnits + SPLIT_FIT_TOLERANCE_PX) continue;
      if (firstMeasure.lineCount < input.minLinesAtPageBottom) continue;

      const restMeasure = this.measureElement(
        'PARAGRAPH',
        restText,
        input.style,
        true,
        false,
      );
      if (restMeasure.lineCount < input.minLinesAtPageTop) continue;

      return {
        first: firstText,
        rest: restText,
        measuredUnits: Math.ceil(firstMeasure.totalHeightPx),
        fragmentLineCount: firstMeasure.lineCount,
        widowOrphanAdjusted: candidateWords !== bestFitWords,
      };
    }

    return null;
  }

  /**
   * Índices UTF-16 de inicio de cada línea visual (alineado con el ajuste del navegador en esta caja).
   */
  private getVisualLineStartIndices(element: HTMLElement, text: string): number[] {
    const textNode = element.firstChild;
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return [0];
    const data = (textNode as Text).data;
    if (data.length === 0) return [0];
    if (data !== text) {
      return [0];
    }

    const range = document.createRange();
    const starts: number[] = [0];
    let lineBaselineTop = Number.POSITIVE_INFINITY;

    for (let i = 0; i < text.length; i++) {
      range.setStart(textNode, i);
      range.setEnd(textNode, i + 1);
      const rects = range.getClientRects();
      if (!rects.length) continue;
      const top = rects[0]!.top;
      if (i === 0) {
        lineBaselineTop = top;
        continue;
      }
      if (top > lineBaselineTop + LINE_TOP_EPSILON_PX) {
        starts.push(i);
        lineBaselineTop = top;
      }
    }

    return starts;
  }

  private appendParagraphMeasureElement(
    text: string,
    style: BookStyleDefinition,
    continuedFromPreviousPage: boolean,
    continuesOnNextPage: boolean,
  ): HTMLElement {
    this.host.innerHTML = '';
    const element = document.createElement('p');
    element.textContent = text;
    element.style.margin = '0';
    element.style.padding = '0';
    element.style.border = 'none';
    element.style.boxSizing = 'border-box';
    element.style.width = '100%';
    element.style.whiteSpace = 'pre-wrap';
    element.style.overflowWrap = 'normal';
    element.style.wordBreak = 'normal';
    element.style.hyphens = 'none';
    element.style.fontFamily = "'Georgia', 'Times New Roman', serif";
    element.style.fontSize = `${style.fontSize}pt`;
    element.style.lineHeight = String(style.lineHeight);
    element.style.textAlign = style.textAlign;
    element.style.fontWeight = String(style.fontWeight);
    element.style.letterSpacing = `${style.letterSpacing}em`;
    if (style.color) element.style.color = style.color;
    if (style.maxWidth != null) {
      element.style.maxWidth = `${style.maxWidth}%`;
      if (style.textAlign === 'right') {
        element.style.marginInline = 'auto 0';
      } else if (style.textAlign === 'left') {
        element.style.marginInline = '0 auto';
      } else {
        element.style.marginInline = 'auto';
      }
    }

    this.host.appendChild(element);
    void element.offsetHeight;
    return element;
  }

  private measureElement(
    blockType: DocumentBlock['blockType'],
    text: string,
    style: BookStyleDefinition,
    continuedFromPreviousPage: boolean,
    continuesOnNextPage: boolean,
  ): {
    totalHeightPx: number;
    lineCount: number;
  } {
    this.host.innerHTML = '';

    const element = document.createElement(this.tagNameForBlock(blockType));
    element.textContent = text;
    element.style.margin = '0';
    element.style.padding = '0';
    element.style.border = 'none';
    element.style.boxSizing = 'border-box';
    element.style.width = '100%';
    element.style.whiteSpace = 'pre-wrap';
    element.style.overflowWrap = 'normal';
    element.style.wordBreak = 'normal';
    element.style.hyphens = 'none';
    element.style.fontFamily = "'Georgia', 'Times New Roman', serif";
    element.style.fontSize = `${style.fontSize}pt`;
    element.style.lineHeight = String(style.lineHeight);
    element.style.textAlign = style.textAlign;
    element.style.fontWeight = String(style.fontWeight);
    element.style.letterSpacing = `${style.letterSpacing}em`;
    if (style.color) element.style.color = style.color;
    if (style.maxWidth != null) {
      element.style.maxWidth = `${style.maxWidth}%`;
      if (style.textAlign === 'right') {
        element.style.marginInline = 'auto 0';
      } else if (style.textAlign === 'left') {
        element.style.marginInline = '0 auto';
      } else {
        element.style.marginInline = 'auto';
      }
    }

    let verticalPaddingPx = 0;
    if (blockType === 'QUOTE') {
      const padBlock = style.fontSize * PT_TO_PX * 0.5;
      const padInline = style.fontSize * PT_TO_PX * 0.9;
      verticalPaddingPx = padBlock * 2;
      element.style.padding = `${padBlock}px 0 ${padBlock}px ${padInline}px`;
      element.style.borderLeft = '3px solid transparent';
    } else if (blockType === 'CENTERED_PHRASE') {
      element.style.fontStyle = 'italic';
    }

    this.host.appendChild(element);
    void element.offsetHeight;

    const contentHeight = element.getBoundingClientRect().height;
    const totalHeightPx = contentHeight
      + marginTopPx(style, continuedFromPreviousPage)
      + marginBottomPx(style, continuesOnNextPage);

    const lineCount = Math.max(
      1,
      Math.round((contentHeight - verticalPaddingPx) / Math.max(1, lineHeightPx(style))),
    );

    return {
      totalHeightPx,
      lineCount,
    };
  }

  private tagNameForBlock(blockType: DocumentBlock['blockType']): 'p' | 'h1' | 'h2' | 'blockquote' {
    switch (blockType) {
      case 'HEADING_1': return 'h1';
      case 'HEADING_2': return 'h2';
      case 'QUOTE': return 'blockquote';
      default: return 'p';
    }
  }
}
