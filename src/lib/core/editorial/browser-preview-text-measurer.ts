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
const SOFT_BREAK_RE = /[,;—–)]$/;
const SENTENCE_END_RE = /[.!?…:"')\]]$/;
const BREAK_SCAN_BACK_WORDS = 24;

function breakScore(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 4;
  if (SENTENCE_END_RE.test(trimmed)) return 3;
  if (SOFT_BREAK_RE.test(trimmed)) return 2;
  return 0;
}

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
      if (fragmentMeasure.totalHeightPx <= input.availableUnits) {
        bestFitWords = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    if (bestFitWords <= 0 || bestFitWords >= words.length) return null;

    let bestCandidate: {
      wordCount: number;
      fragmentMeasure: ReturnType<BrowserPreviewTextMeasurer['measureElement']>;
      score: number;
    } | null = null;

    for (let candidate = bestFitWords; candidate >= 1; candidate--) {
      if (bestFitWords - candidate > BREAK_SCAN_BACK_WORDS && bestCandidate) break;

      const first = words.slice(0, candidate).join(' ');
      const rest = words.slice(candidate).join(' ');
      if (!rest.trim()) continue;

      const fragmentMeasure = this.measureElement(
        'PARAGRAPH',
        first,
        input.style,
        input.continuedFromPreviousPage,
        true,
      );
      if (fragmentMeasure.totalHeightPx > input.availableUnits) continue;

      const restMeasure = this.measureElement(
        'PARAGRAPH',
        rest,
        input.style,
        true,
        false,
      );
      if (fragmentMeasure.lineCount < input.minLinesAtPageBottom) continue;
      if (restMeasure.lineCount < input.minLinesAtPageTop) continue;

      const score = breakScore(first);
      if (
        !bestCandidate
        || score > bestCandidate.score
        || (score === bestCandidate.score && candidate > bestCandidate.wordCount)
      ) {
        bestCandidate = { wordCount: candidate, fragmentMeasure, score };
        if (score >= 3 && bestFitWords - candidate >= 2) break;
      }
    }

    if (!bestCandidate) return null;

    return {
      first: words.slice(0, bestCandidate.wordCount).join(' '),
      rest: words.slice(bestCandidate.wordCount).join(' '),
      measuredUnits: Math.ceil(bestCandidate.fragmentMeasure.totalHeightPx),
      fragmentLineCount: bestCandidate.fragmentMeasure.lineCount,
      widowOrphanAdjusted: bestCandidate.wordCount !== bestFitWords,
    };
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
    element.style.overflowWrap = 'break-word';
    element.style.wordBreak = 'normal';
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
