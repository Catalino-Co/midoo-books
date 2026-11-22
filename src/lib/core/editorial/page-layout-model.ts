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
  /** Caja calculada por el motor para bloques IMAGE en el flujo (no fillPage). */
  imageBox?: PlacedImageBox;
  tocEntries?: TocEntry[];
  tocConfig?: TocConfig;
  syntheticType?: 'TOC';
  debugMeta?: {
    fragmented?: boolean;
    continuedFromPreviousPage?: boolean;
    continuesOnNextPage?: boolean;
    fragmentLineStart?: number;
    fragmentLineCount?: number;
    fragmentIndex?: number;
    wasSplit?: boolean;
    remainingTextPreview?: string;
    keepWithNextApplied?: boolean;
    keepTogetherApplied?: boolean;
    widowOrphanAdjusted?: boolean;
    movedToNextPage?: boolean;
    nonFragmentable?: boolean;
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
  /** Dimensiones de los assets del libro por id (opcional; sin ellas se asume 4:3). */
  assetDimensionsById?: Record<string, AssetDimensions>;
}

/** Métricas internas del motor de paginación (PARTE 13). */
export interface LayoutEngineMetrics {
  pageBodyHeightUnits: number;
  pageBodyWidthUnits: number;
  charsPerLine: number;
  /** Unidades del motor por mm (en el navegador: px CSS por mm = 96/25,4). */
  unitsPerMm?: number;
  /** Caja de texto real en mm (hoja − márgenes). El medidor la usa tal cual. */
  contentWidthMm?: number;
  contentHeightMm?: number;
}

/** Dimensiones intrínsecas de un asset de imagen (para calcular su alto en la página). */
export interface AssetDimensions {
  widthPx: number | null;
  heightPx: number | null;
}

/** Caja final de una imagen colocada en el flujo (mm, la usan preview y PDF por igual). */
export interface PlacedImageBox {
  widthMm: number;
  heightMm: number;
}

export interface PaginatedBookResult {
  bookId: string;
  pages: RenderedPage[];
  tocEntries: TocEntry[];
  /** Unidades de altura del cuerpo útil (derivadas del trim size, PARTE 13). */
  pageBodyHeightUnits: number;
  /** Ancho lógico del cuerpo útil (derivado del trim size). */
  pageBodyWidthUnits: number;
  /** Ajustes persistidos usados para esta pasada (preview + motor). */
  layoutSettings: LayoutSettings;
  /** Métricas internas del motor (chars por línea, etc.). */
  engineMetrics: LayoutEngineMetrics;
}
