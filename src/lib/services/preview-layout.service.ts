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

  const pageWidthPx = typeof window === 'undefined'
    ? 440
    : Math.min(440, Math.max(260, window.innerWidth * 0.92));
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
