/**
 * PARTE 13 — Geometría física de página: conversión de unidades, márgenes
 * interior/exterior según verso/recto y caja de contenido útil.
 *
 * Sin dependencias de DOM ni Svelte.
 */

import type { LayoutSettings, PageUnit } from '$lib/core/domain/layout';
import type { PageSpreadSide } from './page-layout-model';

/** Convierte una longitud en la unidad dada a milímetros. */
export function lengthToMm(value: number, unit: PageUnit): number {
  switch (unit) {
    case 'mm':
      return value;
    case 'in':
      return value * 25.4;
    case 'pt':
      return value * (25.4 / 72);
    case 'px':
      return value * (25.4 / 96);
    default:
      return value;
  }
}

/** Dimensiones totales de la hoja en mm. */
export function pageDimensionsMm(settings: Pick<LayoutSettings, 'pageWidth' | 'pageHeight' | 'pageUnit'>): {
  widthMm: number;
  heightMm: number;
} {
  return {
    widthMm: lengthToMm(settings.pageWidth, settings.pageUnit),
    heightMm: lengthToMm(settings.pageHeight, settings.pageUnit),
  };
}

/** Márgenes horizontales en mm según lado de spread (lomo vs corte). */
export function horizontalMarginsMmForSide(
  settings: Pick<LayoutSettings, 'marginInside' | 'marginOutside' | 'facingPages' | 'pageUnit'>,
  side: PageSpreadSide,
): { leftMm: number; rightMm: number } {
  const insideMm = lengthToMm(settings.marginInside, settings.pageUnit);
  const outsideMm = lengthToMm(settings.marginOutside, settings.pageUnit);

  if (!settings.facingPages) {
    const sym = (insideMm + outsideMm) / 2;
    return { leftMm: sym, rightMm: sym };
  }

  // Convención PARTE 9: índice 0 = recto (derecha del spread) → lomo a la izquierda.
  if (side === 'right') {
    return { leftMm: insideMm, rightMm: outsideMm };
  }
  return { leftMm: outsideMm, rightMm: insideMm };
}

export interface PageContentBoxMm {
  pageWidthMm: number;
  pageHeightMm: number;
  marginTopMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  marginRightMm: number;
  contentWidthMm: number;
  contentHeightMm: number;
}

/** Caja útil de contenido (interior del área tipográfica, antes de safe area extra). */
export function getPageContentBoxMm(
  settings: LayoutSettings,
  side: PageSpreadSide,
): PageContentBoxMm {
  const { widthMm: pageWidthMm, heightMm: pageHeightMm } = pageDimensionsMm(settings);
  const marginTopMm = lengthToMm(settings.marginTop, settings.pageUnit);
  const marginBottomMm = lengthToMm(settings.marginBottom, settings.pageUnit);
  const { leftMm, rightMm } = horizontalMarginsMmForSide(settings, side);

  const contentWidthMm = Math.max(8, pageWidthMm - leftMm - rightMm);
  const contentHeightMm = Math.max(8, pageHeightMm - marginTopMm - marginBottomMm);

  return {
    pageWidthMm,
    pageHeightMm,
    marginTopMm,
    marginBottomMm,
    marginLeftMm: leftMm,
    marginRightMm: rightMm,
    contentWidthMm,
    contentHeightMm,
  };
}

/**
 * Insets de la zona “safe” respecto a la caja de contenido (mm), uniforme por lado.
 * 0 = desactivado.
 */
export function safeAreaInsetsFromContentMm(settings: LayoutSettings): number {
  const v = settings.safeAreaInsetMm ?? 0;
  return Math.max(0, v);
}
