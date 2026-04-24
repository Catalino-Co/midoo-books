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
