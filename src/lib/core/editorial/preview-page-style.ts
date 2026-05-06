/**
 * PARTE 13 — Valores derivados para el render de preview (CSS variables / inline).
 */

import type { LayoutSettings } from '$lib/core/domain/layout';
import { getPageContentBoxMm, pageDimensionsMm, safeAreaInsetsFromContentMm } from './document-page-geometry';
import {
  PREVIEW_FLOW_PAD_BOTTOM_MM,
  PREVIEW_FLOW_PAD_TOP_MM,
  PREVIEW_FLOW_PAD_X_MM,
} from './document-layout-metrics';
import type { PageSpreadSide } from './page-layout-model';

/** Aspecto alto/ancho de la hoja (sin bleed). */
export function pageAspectRatio(settings: Pick<LayoutSettings, 'pageWidth' | 'pageHeight' | 'pageUnit'>): number {
  const { widthMm, heightMm } = pageDimensionsMm(settings);
  return heightMm / Math.max(1e-6, widthMm);
}

export function buildPreviewSheetCssVars(settings: LayoutSettings): Record<string, string> {
  const { widthMm, heightMm } = pageDimensionsMm(settings);
  const bleedMm = Math.max(0, settings.bleedMm ?? 0);
  const bleedFracW = widthMm > 0 ? bleedMm / widthMm : 0;
  const bleedFracH = heightMm > 0 ? bleedMm / heightMm : 0;
  return {
    '--preview-page-ar': String(pageAspectRatio(settings)),
    '--preview-bleed-x-fr': String(bleedFracW),
    '--preview-bleed-y-fr': String(bleedFracH),
  };
}

/** Estilo inline para la caja útil (posición dentro de la hoja). */
export function buildPreviewContentBoxStyle(settings: LayoutSettings, side: PageSpreadSide): string {
  const box = getPageContentBoxMm(settings, side);
  const pw = box.pageWidthMm;
  const ph = box.pageHeightMm;
  const topPct = (box.marginTopMm / ph) * 100;
  const leftPct = (box.marginLeftMm / pw) * 100;
  const rightPct = (box.marginRightMm / pw) * 100;
  const bottomPct = (box.marginBottomMm / ph) * 100;
  return `top:${topPct}%;left:${leftPct}%;right:${rightPct}%;bottom:${bottomPct}%;`;
}

/** Inset % dentro de la caja de contenido para mostrar guía de zona segura (0 si no aplica). */
export function buildPreviewSafeAreaStyle(settings: LayoutSettings): string {
  const safe = safeAreaInsetsFromContentMm(settings);
  if (safe <= 0) return 'display:none;';
  const boxR = getPageContentBoxMm(settings, 'right');
  const w = boxR.contentWidthMm;
  const h = boxR.contentHeightMm;
  const xp = w > 0 ? (safe / w) * 100 : 0;
  const yp = h > 0 ? (safe / h) * 100 : 0;
  return `top:${yp}%;left:${xp}%;right:${xp}%;bottom:${yp}%;`;
}

/** Padding del flujo respecto a la caja útil (proporcional al trim / márgenes). */
export function buildPreviewBodyPaddingStyle(settings: LayoutSettings, side: PageSpreadSide): string {
  const b = getPageContentBoxMm(settings, side);
  const padTop = (PREVIEW_FLOW_PAD_TOP_MM / b.contentHeightMm) * 100;
  const padX = (PREVIEW_FLOW_PAD_X_MM / b.contentWidthMm) * 100;
  const padBottom = (PREVIEW_FLOW_PAD_BOTTOM_MM / b.contentHeightMm) * 100;
  return [
    `padding:${padTop}% ${padX}% ${padBottom}% ${padX}%`,
    `--flow-pull-y:${padTop}%`,
    `--flow-pull-x:${padX}%`,
  ].join(';');
}

/** Ratio alto/ancho de la hoja (para --page-h = --page-w * ratio). */
export function pageHeightOverWidthRatio(settings: Pick<LayoutSettings, 'pageWidth' | 'pageHeight' | 'pageUnit'>): number {
  const { widthMm, heightMm } = pageDimensionsMm(settings);
  return heightMm / Math.max(1e-6, widthMm);
}
