/**
 * Geometría de render de UNA página (vista previa y PDF comparten estas cifras).
 *
 * Todo en mm: Chromium convierte mm ↔ px a 96 dpi tanto en pantalla como al imprimir,
 * así que la misma hoja en mm se ve igual en la vista previa (escalada) y en el PDF.
 */

import type { LayoutSettings } from '$lib/core/domain/layout';
import { getPageContentBoxMm, pageDimensionsMm, safeAreaInsetsFromContentMm } from './document-page-geometry';
import type { PageSpreadSide } from './page-layout-model';

export function pageAspectRatio(settings: Pick<LayoutSettings, 'pageWidth' | 'pageHeight' | 'pageUnit'>): number {
  const { widthMm, heightMm } = pageDimensionsMm(settings);
  return heightMm / Math.max(1e-6, widthMm);
}

export function pageHeightOverWidthRatio(settings: Pick<LayoutSettings, 'pageWidth' | 'pageHeight' | 'pageUnit'>): number {
  return pageAspectRatio(settings);
}

export interface PageFrameMm {
  pageWidthMm: number;
  pageHeightMm: number;
  /** Caja de texto (posición absoluta dentro de la hoja). */
  box: { topMm: number; leftMm: number; widthMm: number; heightMm: number };
  /** Línea base aproximada de la cabecera (centro del margen superior). */
  headerCenterFromTopMm: number;
  /** Centro del margen inferior, donde va el folio. */
  footerCenterFromBottomMm: number;
  /** Margen lateral izquierdo/derecho reales de esta cara. */
  marginLeftMm: number;
  marginRightMm: number;
  /** Inset de zona segura (guía de preview); 0 = sin guía. */
  safeInsetMm: number;
}

export function pageFrameMm(settings: LayoutSettings, side: PageSpreadSide): PageFrameMm {
  const b = getPageContentBoxMm(settings, side);
  return {
    pageWidthMm:  b.pageWidthMm,
    pageHeightMm: b.pageHeightMm,
    box: {
      topMm:    b.marginTopMm,
      leftMm:   b.marginLeftMm,
      widthMm:  b.contentWidthMm,
      heightMm: b.contentHeightMm,
    },
    headerCenterFromTopMm:    b.marginTopMm / 2,
    footerCenterFromBottomMm: b.marginBottomMm / 2,
    marginLeftMm:  b.marginLeftMm,
    marginRightMm: b.marginRightMm,
    safeInsetMm:   safeAreaInsetsFromContentMm(settings),
  };
}
