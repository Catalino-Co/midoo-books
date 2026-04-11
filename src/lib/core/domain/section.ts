/**
 * src/lib/core/domain/section.ts
 *
 * Entidad DocumentSection.
 *
 * Una sección es la unidad organizativa de un libro: portada, índice,
 * capítulos, apéndices. Cada sección puede contener uno o más DocumentBlock.
 * Las secciones de un libro están ordenadas por orderIndex.
 */

// ─── Identificador ────────────────────────────────────────────────────────────

declare const SectionIdBrand: unique symbol;
export type SectionId = string & { readonly [SectionIdBrand]: never };

export function asSectionId(id: string): SectionId {
  return id as SectionId;
}

// ─── Tipos de sección ─────────────────────────────────────────────────────────

/**
 * Tipos de sección predefinidos.
 * - cover:         Portada del libro
 * - blank:         Página en blanco (recto/verso)
 * - title_page:    Página de título (título, subtítulo, autor)
 * - copyright:     Página de derechos y créditos
 * - dedication:    Dedicatoria
 * - toc:           Tabla de contenidos (generada automáticamente)
 * - preface:       Prefacio / prólogo
 * - chapter:       Capítulo numerado (el más común)
 * - appendix:      Apéndice
 * - bibliography:  Bibliografía
 * - index:         Índice analítico
 * - colophon:      Colofón / datos de impresión
 */
export type SectionType =
  | 'cover'
  | 'blank'
  | 'title_page'
  | 'copyright'
  | 'dedication'
  | 'toc'
  | 'preface'
  | 'chapter'
  | 'appendix'
  | 'bibliography'
  | 'index'
  | 'colophon';

// ─── Entidad DocumentSection ──────────────────────────────────────────────────

export interface DocumentSection {
  id:                SectionId;
  bookId:            string;        // FK → BookProject.id
  sectionType:       SectionType;
  title:             string;        // Título visible en el TOC
  orderIndex:        number;        // Posición en el libro (0-based, ascendente)
  includeInToc:      boolean;       // ¿Aparece en la tabla de contenidos?
  startOnRightPage:  boolean;       // ¿Empieza siempre en página recto (impar)?
  settingsJson:      string | null; // JSON para overrides de layout por sección
  createdAt:         string;
  updatedAt:         string;
}

// ─── Payloads ─────────────────────────────────────────────────────────────────

export interface CreateSectionInput {
  bookId:            string;
  sectionType:       SectionType;
  title:             string;
  orderIndex?:       number;        // Si no se provee, se añade al final
  includeInToc?:     boolean;
  startOnRightPage?: boolean;
  settingsJson?:     string | null;
}

export interface UpdateSectionInput {
  title?:            string;
  sectionType?:      SectionType;
  orderIndex?:       number;
  includeInToc?:     boolean;
  startOnRightPage?: boolean;
  settingsJson?:     string | null;
}
