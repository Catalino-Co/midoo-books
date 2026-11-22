/**
 * PARTE 13 — Traduce geometría física del libro a unidades internas del motor.
 *
 * Desde la Fase 1 (nov 2026) la caja de texto del motor es EXACTAMENTE la caja de
 * contenido de la página (hoja − márgenes). La vista previa y el PDF dibujan el texto
 * en esa misma caja, y la cabecera y el folio viven dentro de los márgenes, como en un
 * libro impreso. Antes se restaban rellenos “de preview” (22 mm por lado, rail, pie…)
 * que el PDF no tenía, y por eso el PDF paginaba distinto a la vista previa.
 *
 * Unidades: en el navegador 1 unidad = 1 px CSS a 96 dpi (pxPerMm = 96 / 25,4).
 * Fuera del navegador (tests) se usa una hoja de referencia de 440 px de ancho.
 */

import type { LayoutSettings } from '$lib/core/domain/layout';
import { getPageContentBoxMm, pageDimensionsMm } from './document-page-geometry';
import type { LayoutEngineMetrics } from './page-layout-model';
import { resolveBookStyles } from './book-styles';

/** px CSS por mm (96 dpi). */
export const CSS_PX_PER_MM = 96 / 25.4;

/** Ancho de hoja de referencia para el modo estimado (sin DOM). */
const DEFAULT_PREVIEW_PAGE_WIDTH_PX = 440;

/** mm por punto tipográfico. */
const MM_PER_PT = 25.4 / 72;
/** Ancho medio de un carácter en ems (aproximación para el modo estimado). */
const AVG_CHAR_WIDTH_EM = 0.5;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Caja de texto del motor en mm. El ancho útil es idéntico en recto y verso
 * (solo se intercambian interior/exterior), así que basta con la cara derecha.
 */
export function getEngineContentBoxMm(settings: LayoutSettings): {
  contentWidthMm: number;
  contentHeightMm: number;
} {
  const box = getPageContentBoxMm(settings, 'right');
  return {
    contentWidthMm:  box.contentWidthMm,
    contentHeightMm: box.contentHeightMm,
  };
}

export function computeLayoutEngineMetrics(settings: LayoutSettings): LayoutEngineMetrics {
  return computeLayoutEngineMetricsForPreviewWidth(settings, DEFAULT_PREVIEW_PAGE_WIDTH_PX);
}

/**
 * @param pageSheetWidthPx  ancho de la hoja completa en px. Para que 1 unidad = 1 px CSS
 *                          pasar `pageWidthMm * CSS_PX_PER_MM` SIN redondear.
 */
export function computeLayoutEngineMetricsForPreviewWidth(
  settings: LayoutSettings,
  pageSheetWidthPx: number,
): LayoutEngineMetrics {
  const { contentWidthMm, contentHeightMm } = getEngineContentBoxMm(settings);
  const { widthMm: pageWidthMm } = pageDimensionsMm(settings);
  const pxPerMm = Math.max(1e-6, pageSheetWidthPx) / Math.max(1e-6, pageWidthMm);

  // floor: nunca prometer más alto del que existe (evita texto sobre el pie).
  const pageBodyHeightUnits = Math.floor(clamp(contentHeightMm * pxPerMm, 120, 4000));
  const pageBodyWidthUnits  = Math.floor(clamp(contentWidthMm * pxPerMm, 80, 3000));

  const paragraphPt = resolveBookStyles(settings).PARAGRAPH.fontSize;
  const charWidthMm = Math.max(0.5, paragraphPt * MM_PER_PT * AVG_CHAR_WIDTH_EM);
  const charsPerLine = Math.round(clamp(contentWidthMm / charWidthMm, 28, 96));

  return {
    pageBodyHeightUnits,
    pageBodyWidthUnits,
    charsPerLine,
    unitsPerMm: pxPerMm,
    contentWidthMm,
    contentHeightMm,
  };
}
