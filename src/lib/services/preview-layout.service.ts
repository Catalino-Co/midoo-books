/**
 * PARTE 9 — Carga de datos para preview paginado (sin SQL en Svelte: usa content.service).
 */

import { listSections, listBlocks } from '$lib/services/content.service';
import { getBook } from '$lib/services/books.service';
import { getLayoutSettings } from '$lib/services/layout.service';
import type { DocumentBlock } from '$lib/core/domain/block';
import type { BookLayoutSnapshot } from '$lib/core/editorial/page-layout-model';
import { buildPaginatedLayout } from '$lib/core/editorial/page-layout-engine';
import type { PaginatedBookResult } from '$lib/core/editorial/page-layout-model';
import { BrowserPreviewTextMeasurer } from '$lib/core/editorial/browser-preview-text-measurer';
import { computeLayoutEngineMetricsForPreviewWidth } from '$lib/core/editorial/document-layout-metrics';
import { pageDimensionsMm } from '$lib/core/editorial/document-page-geometry';
import type { LayoutSettings } from '$lib/core/domain/layout';

/** Conversión mm → px a 96 dpi (resolución estándar de pantalla). */
export const SCREEN_MM_TO_PX = 96 / 25.4;

type PageDimInput = Pick<LayoutSettings, 'pageWidth' | 'pageHeight' | 'pageUnit'>;

/** Ancho físico real de la página en px a 96 dpi. */
export function physicalPageWidthPx(settings: PageDimInput): number {
  const { widthMm } = pageDimensionsMm(settings);
  return Math.round(widthMm * SCREEN_MM_TO_PX);
}

/** Alto físico real de la página en px a 96 dpi. */
export function physicalPageHeightPx(settings: PageDimInput): number {
  const { heightMm } = pageDimensionsMm(settings);
  return Math.round(heightMm * SCREEN_MM_TO_PX);
}

export async function loadBookLayoutSnapshot(bookId: string): Promise<BookLayoutSnapshot> {
  const book = await getBook(bookId);
  if (!book) {
    throw new Error('Libro no encontrado.');
  }
  const layoutSettings = await getLayoutSettings(bookId);
  const sections = await listSections(bookId);
  const blocksBySectionId: Record<string, DocumentBlock[]> = {};
  for (const s of sections) {
    blocksBySectionId[s.id] = await listBlocks(s.id);
  }
  return {
    bookId,
    bookTitle: book.title,
    layoutSettings,
    sections,
    blocksBySectionId,
  };
}

export function computePaginatedPreview(snapshot: BookLayoutSnapshot): PaginatedBookResult {
  return buildPaginatedLayout(snapshot);
}

export async function computePaginatedPreviewForBrowser(snapshot: BookLayoutSnapshot): Promise<PaginatedBookResult> {
  if (typeof document === 'undefined') {
    return buildPaginatedLayout(snapshot);
  }

  // Usar el ancho físico real de la página (96 dpi) en lugar del techo de 440 px.
  // Esto garantiza que el motor de paginación mida el texto con las mismas
  // proporciones físicas que tendrá el PDF exportado.
  const pageWidthPx = physicalPageWidthPx(snapshot.layoutSettings);
  const engineMetrics = computeLayoutEngineMetricsForPreviewWidth(snapshot.layoutSettings, pageWidthPx);
  const measurer = new BrowserPreviewTextMeasurer(engineMetrics);
  try {
    return buildPaginatedLayout(snapshot, {
      engineMetrics,
      textMeasurement: measurer,
    });
  } finally {
    measurer.dispose();
  }
}

export interface PreviewLocationTarget {
  physicalPageNumber: number;
  sectionId: string | null;
  blockId: string | null;
}

export function findPreviewLocationForSelection(
  layout: PaginatedBookResult,
  params: {
    sectionId?: string | null;
    blockId?: string | null;
  },
): PreviewLocationTarget | null {
  const blockId = params.blockId?.trim() || null;
  const sectionId = params.sectionId?.trim() || null;

  const page = blockId
    ? layout.pages.find(candidate => candidate.placements.some(placement => placement.block?.id === blockId))
    : sectionId
      ? layout.pages.find(candidate => candidate.primarySectionId === sectionId)
      : null;

  if (!page) return null;

  const firstBlockId = page.placements.find(placement => placement.block?.id)?.block?.id ?? null;

  return {
    physicalPageNumber: page.physicalPageNumber,
    sectionId: page.primarySectionId,
    blockId: firstBlockId,
  };
}
