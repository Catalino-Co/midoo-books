/**
 * PARTE 9 — Modelo de página y colocación para preview paginado.
 *
 * `visualPageNumber` es numeración física simple (1…N) para depuración y UI.
 * `editorialPageNumber` reservado para futura numeración omitiendo portadas, etc.
 */

import type { SectionType, DocumentSection } from '$lib/core/domain/section';
import type { DocumentBlock } from '$lib/core/domain/block';
import type { LayoutSettings } from '$lib/core/domain/layout';
import type { PageEditorialFrame } from './editorial-page-numbering';
import type { TocConfig, TocEntry } from './toc-model';

export type PageSpreadSide = 'left' | 'right';

/** Página normal con flujo, o hueco editorial explícito (p. ej. forzar recto). */
export type RenderedPageKind = 'content' | 'editorial_blank';

/**
 * Primer índice físico = recto (página impar en impresión típica).
 * Par = verso.
 */
export function pageSpreadSide(physicalIndex: number): PageSpreadSide {
  return physicalIndex % 2 === 0 ? 'right' : 'left';
}

export interface PlacedBlock {
  /** Bloque original (no mutar al serializar). */
  block: DocumentBlock | null;
  /** Texto mostrado si se fragmentó un párrafo/cita en varias colocaciones. */
  textOverride?: string | null;
  /** Altura estimada consumida en unidades internas del motor v1. */
  estimatedUnits: number;
  /** Composición que debe ocupar el cuerpo completo de la página (apertura de capítulo). */
  fullPageComposition?: boolean;
  tocEntries?: TocEntry[];
  tocConfig?: TocConfig;
  syntheticType?: 'TOC';
  debugMeta?: {
    fragmented?: boolean;
    continuedFromPreviousPage?: boolean;
    continuesOnNextPage?: boolean;
    fragmentLineStart?: number;
    fragmentLineCount?: number;
    keepWithNextApplied?: boolean;
  };
}

export interface RenderedPage {
  internalIndex: number;
  /** 1-based, contigua; equivale a “folio físico” en v1. */
  visualPageNumber: number;
  /** Alias explícito para el folio físico del render. */
  physicalPageNumber: number;
  /** Ordinal editorial sin formatear (romanos/arábigos se resuelven aparte). */
  editorialPageNumber: number | null;
  /** Etiqueta visible al lector: `iii`, `IV`, `1` o null. */
  editorialPageLabel: string | null;
  side: PageSpreadSide;
  kind: RenderedPageKind;
  /** Sección “principal” de la página (primera colocación o null en blancos). */
  primarySectionId: string | null;
  primarySectionType: SectionType | null;
  primarySectionTitle: string | null;
  placements: PlacedBlock[];
  /** Notas para depuración (saltos forzados, desbordes, etc.). */
  debugNotes: string[];
  layoutMeta: {
    bodyHeightUnits: number;
    usedContentUnits: number;
  };
  editorial: PageEditorialFrame;
}

export interface BookLayoutSnapshot {
  bookId: string;
  bookTitle: string;
  layoutSettings: LayoutSettings;
  sections: DocumentSection[];
  blocksBySectionId: Record<string, DocumentBlock[]>;
}

export interface PaginatedBookResult {
  bookId: string;
  pages: RenderedPage[];
  tocEntries: TocEntry[];
  /** Unidades de altura del cuerpo útil (constante del motor v1). */
  pageBodyHeightUnits: number;
  /** Ancho lógico (constante v1). */
  pageBodyWidthUnits: number;
}
