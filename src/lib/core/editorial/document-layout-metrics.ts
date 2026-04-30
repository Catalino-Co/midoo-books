/**
 * PARTE 13 — Traduce geometría física del libro a unidades internas del motor v1
 * (alturas/anchos lógicos y anchura de columna de texto).
 */

import type { LayoutSettings } from '$lib/core/domain/layout';
import { DEFAULT_LAYOUT_SETTINGS } from '$lib/core/domain/layout';
import { getPageContentBoxMm } from './document-page-geometry';
import type { LayoutEngineMetrics, PageSpreadSide } from './page-layout-model';

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

const REF_UNITS_HEIGHT = 540;
const REF_UNITS_WIDTH = 396;
const REF_CHARS_PER_LINE = 58;

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
  return {
    contentWidthMm: a.contentWidthMm,
    contentHeightMm: a.contentHeightMm,
  };
}

export function computeLayoutEngineMetrics(settings: LayoutSettings): LayoutEngineMetrics {
  const { contentWidthMm, contentHeightMm } = getEngineContentBoxMm(settings);

  const scaleH = contentHeightMm / REF_CONTENT_BOX.contentHeightMm;
  const scaleW = contentWidthMm / REF_CONTENT_BOX.contentWidthMm;

  const pageBodyHeightUnits = Math.round(clamp(REF_UNITS_HEIGHT * scaleH, 320, 1400));
  const pageBodyWidthUnits = Math.round(clamp(REF_UNITS_WIDTH * scaleW, 240, 980));

  const chars = Math.round(
    REF_CHARS_PER_LINE * (REF_CONTENT_BOX.contentWidthMm / Math.max(20, contentWidthMm)),
  );

  return {
    pageBodyHeightUnits,
    pageBodyWidthUnits,
    charsPerLine: clamp(chars, 28, 96),
  };
}
