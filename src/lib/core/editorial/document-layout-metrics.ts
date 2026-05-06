/**
 * PARTE 13 — Traduce geometría física del libro a unidades internas del motor v1
 * (alturas/anchos lógicos y anchura de columna de texto).
 */

import type { LayoutSettings } from '$lib/core/domain/layout';
import { DEFAULT_LAYOUT_SETTINGS } from '$lib/core/domain/layout';
import { getPageContentBoxMm, pageDimensionsMm } from './document-page-geometry';
import type { LayoutEngineMetrics, PageSpreadSide } from './page-layout-model';
import { resolveBookStyles } from './book-styles';

function referenceLayoutSettings(): LayoutSettings {
  return {
    ...DEFAULT_LAYOUT_SETTINGS,
    id: '00000000-0000-0000-0000-000000000001' as LayoutSettings['id'],
    bookId: '00000000-0000-0000-0000-000000000002',
    createdAt: '1970-01-01T00:00:00.000Z',
    updatedAt: '1970-01-01T00:00:00.000Z',
  };
}

/** Valores de referencia calibrados en PARTE 9 (preview A5 por defecto, recto). */
const REF_SIDE: PageSpreadSide = 'right';
const REF_CONTENT_BOX = getPageContentBoxMm(referenceLayoutSettings(), REF_SIDE);

const REF_CHARS_PER_LINE = 58;
const DEFAULT_PREVIEW_PAGE_WIDTH_PX = 440;
export const PREVIEW_FLOW_PAD_TOP_MM = 14;
export const PREVIEW_FLOW_PAD_BOTTOM_MM = 8;
export const PREVIEW_FLOW_PAD_X_MM = 22;
const PREVIEW_RAIL_MM = 8;
const PREVIEW_FOOTER_MM = 8;
const PREVIEW_HEADER_MM = 4;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Misma geometría de contenido en mm para ambas caras (ancho útil idéntico al intercambiar dentro/fuera).
 */
export function getEngineContentBoxMm(settings: LayoutSettings): {
  contentWidthMm: number;
  contentHeightMm: number;
} {
  const a = getPageContentBoxMm(settings, 'right');
  const usableWidthMm = Math.max(
    20,
    a.contentWidthMm - (PREVIEW_FLOW_PAD_X_MM * 2),
  );
  const usableHeightMm = Math.max(
    28,
    a.contentHeightMm
      - PREVIEW_FLOW_PAD_TOP_MM
      - PREVIEW_FLOW_PAD_BOTTOM_MM
      - PREVIEW_RAIL_MM
      - PREVIEW_FOOTER_MM
      - (settings.showHeader ? PREVIEW_HEADER_MM : 0),
  );
  return {
    contentWidthMm: usableWidthMm,
    contentHeightMm: usableHeightMm,
  };
}

export function computeLayoutEngineMetrics(settings: LayoutSettings): LayoutEngineMetrics {
  return computeLayoutEngineMetricsForPreviewWidth(settings, DEFAULT_PREVIEW_PAGE_WIDTH_PX);
}

export function computeLayoutEngineMetricsForPreviewWidth(
  settings: LayoutSettings,
  pageSheetWidthPx: number,
): LayoutEngineMetrics {
  const { contentWidthMm, contentHeightMm } = getEngineContentBoxMm(settings);
  const paragraphStyle = resolveBookStyles(settings).PARAGRAPH;
  const { widthMm: pageWidthMm } = pageDimensionsMm(settings);
  const pxPerMm = Math.max(1, pageSheetWidthPx) / Math.max(1e-6, pageWidthMm);

  const pageBodyHeightUnits = Math.round(clamp(contentHeightMm * pxPerMm, 220, 1800));
  const pageBodyWidthUnits = Math.round(clamp(contentWidthMm * pxPerMm, 120, 1200));

  const chars = Math.round(
    REF_CHARS_PER_LINE
      * (contentWidthMm / Math.max(20, REF_CONTENT_BOX.contentWidthMm))
      * (DEFAULT_LAYOUT_SETTINGS.bodyFontSize / Math.max(8, paragraphStyle.fontSize)),
  );

  return {
    pageBodyHeightUnits,
    pageBodyWidthUnits,
    charsPerLine: clamp(chars, 28, 96),
  };
}
