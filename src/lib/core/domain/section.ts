/**
 * src/lib/core/domain/section.ts
 *
 * Entidad DocumentSection.
 *
 * Una sección es la unidad organizativa de un libro: portada, índice,
 * capítulos, apéndices. Cada sección puede contener uno o más DocumentBlock.
 * Las secciones de un libro están ordenadas por orderIndex.
 *
 * Los valores de SectionType usan SCREAMING_SNAKE_CASE (p. ej. COVER, CHAPTER).
 * Los datos antiguos en minúsculas o alias legacy se normalizan al leer desde SQLite.
 */

// ─── Identificador ────────────────────────────────────────────────────────────

declare const SectionIdBrand: unique symbol;
export type SectionId = string & { readonly [SectionIdBrand]: never };

export function asSectionId(id: string): SectionId {
  return id as SectionId;
}

// ─── Tipos de sección ─────────────────────────────────────────────────────────

/**
 * Valores canónicos de tipo de sección (almacenamiento + dominio).
 * Mantener sincronizado con `section-type-catalog.ts` y migraciones de BD.
 */
export const SECTION_TYPE_VALUES = [
  'COVER',
  'BACK_COVER',
  'BLANK',
  'TITLE_PAGE',
  'CREDITS',
  'RIGHTS',
  'DEDICATION',
  'TOC',
  'PREFACE',
  'PROLOGUE',
  'CHAPTER',
  'EPILOGUE',
  'APPENDIX',
  'AUTHOR_NOTE',
  'BIBLIOGRAPHY',
  'INDEX_ANALYTICAL',
  'COLOPHON',
  'SPECIAL',
] as const;

export type SectionType = (typeof SECTION_TYPE_VALUES)[number];

const _canonicalSet = new Set<string>(SECTION_TYPE_VALUES);

/** Tipo por defecto al crear contenido nuevo o si llega un valor desconocido. */
export const DEFAULT_SECTION_TYPE: SectionType = 'CHAPTER';

/**
 * Convierte texto persistido (minúsculas, legacy) al SectionType canónico.
 *
 * Legacy:
 *   copyright → RIGHTS
 *   index     → INDEX_ANALYTICAL
 */
export function normalizeSectionType(raw: string): SectionType {
  const key = raw.trim().toLowerCase();
  const legacy: Record<string, SectionType> = {
    copyright: 'RIGHTS',
    index: 'INDEX_ANALYTICAL',
  };
  if (legacy[key]) return legacy[key];

  const fromLower: Record<string, SectionType> = {
    cover: 'COVER',
    back_cover: 'BACK_COVER',
    blank: 'BLANK',
    title_page: 'TITLE_PAGE',
    credits: 'CREDITS',
    rights: 'RIGHTS',
    dedication: 'DEDICATION',
    toc: 'TOC',
    preface: 'PREFACE',
    prologue: 'PROLOGUE',
    chapter: 'CHAPTER',
    epilogue: 'EPILOGUE',
    appendix: 'APPENDIX',
    author_note: 'AUTHOR_NOTE',
    bibliography: 'BIBLIOGRAPHY',
    index_analytical: 'INDEX_ANALYTICAL',
    colophon: 'COLOPHON',
    special: 'SPECIAL',
  };
  if (fromLower[key]) return fromLower[key];

  const trimmed = raw.trim();
  if (_canonicalSet.has(trimmed)) return trimmed as SectionType;

  return DEFAULT_SECTION_TYPE;
}

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
