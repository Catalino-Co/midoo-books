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
import {
  DEFAULT_BOOK_FONT_STACK,
  imageCaptionCss,
  textBlockCss,
  textBlockTag,
} from './block-render-css';
import { materializeTrailingSoftHyphen } from './hyphenation';

const PT_TO_PX = 96 / 72;
/** Sin holgura: el medidor usa el mismo CSS y ancho que el render. */
const SPLIT_FIT_TOLERANCE_PX = 0;
/** Umbral para agrupar rectángulos en la misma línea visual (subpíxeles / zoom). */
const LINE_TOP_EPSILON_PX = 1;

function lineHeightPx(style: BookStyleDefinition): number {
  return Math.max(1, style.fontSize * PT_TO_PX * style.lineHeight);
}

export class BrowserPreviewTextMeasurer implements LayoutTextMeasurementAdapter {
  private readonly host: HTMLDivElement;
  private readonly bodyWidthPx: number;

  /**
   * @param metrics         métricas del motor; si traen `contentWidthMm` el ancho de
   *                        medición es exactamente el de la caja de texto en mm.
   * @param baseFontFamily  familia base del libro (la heredan estilos con fontFamily null),
   *                        igual que en BookPage.svelte.
   */
  constructor(metrics: LayoutEngineMetrics, baseFontFamily: string = DEFAULT_BOOK_FONT_STACK) {
    this.bodyWidthPx = Math.max(60, metrics.pageBodyWidthUnits);
    this.host = document.createElement('div');
    this.host.setAttribute('aria-hidden', 'true');
    this.host.style.position = 'fixed';
    this.host.style.left = '-10000px';
    this.host.style.top = '0';
    this.host.style.width = metrics.contentWidthMm != null
      ? `${metrics.contentWidthMm}mm`
      : `${this.bodyWidthPx}px`;
    this.host.style.fontFamily = baseFontFamily;
    this.host.style.color = '#111';
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

    // Corte en mitad de palabra (guion blando): el guion debe verse al pie de página.
    const firstText = materializeTrailingSoftHyphen(text.slice(0, cut).replace(/\s+$/u, ''));
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
    element.style.cssText = textBlockCss('PARAGRAPH', style, {
      continuedFromPreviousPage,
      continuesOnNextPage,
    });
    // Los márgenes se suman aparte (measureElement); aquí solo interesan las líneas.
    element.style.marginTop = '0';
    element.style.marginBottom = '0';
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

    // Envoltorio flow-root, igual que en BookPage.svelte: los márgenes del bloque
    // quedan dentro de su caja y no colapsan con los vecinos → alturas sumables.
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flow-root';
    const element = document.createElement(this.tagNameForBlock(blockType));
    element.textContent = text;
    element.style.cssText = textBlockCss(blockType, style, {
      continuedFromPreviousPage,
      continuesOnNextPage,
    });
    wrapper.appendChild(element);
    this.host.appendChild(wrapper);
    void wrapper.offsetHeight;

    const totalHeightPx = wrapper.getBoundingClientRect().height;
    const cs = getComputedStyle(element);
    const verticalPaddingPx = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    const contentHeight = element.getBoundingClientRect().height;

    const lineCount = Math.max(
      1,
      Math.round((contentHeight - verticalPaddingPx) / Math.max(1, lineHeightPx(style))),
    );

    return {
      totalHeightPx,
      lineCount,
    };
  }

  /** Alto (px) de un pie de imagen con el CSS compartido. */
  measureCaption(text: string): number {
    this.host.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flow-root';
    const el = document.createElement('figcaption');
    el.textContent = text;
    el.style.cssText = imageCaptionCss();
    wrapper.appendChild(el);
    this.host.appendChild(wrapper);
    return Math.ceil(wrapper.getBoundingClientRect().height);
  }

  private tagNameForBlock(blockType: DocumentBlock['blockType']): ReturnType<typeof textBlockTag> {
    return textBlockTag(blockType);
  }
}
