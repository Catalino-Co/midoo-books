/**
 * src/lib/core/domain/book.ts
 *
 * Entidad principal del dominio: BookProject.
 *
 * Un BookProject es la unidad de trabajo del autor: representa un libro completo
 * con su metadata editorial. Sus contenidos (capítulos, bloques) viven en
 * entidades separadas (DocumentSection, DocumentBlock).
 *
 * Regla de esta carpeta: CERO imports de electron, fs, sql.js, svelte o DOM.
 * Solo TypeScript puro e importaciones desde el mismo módulo core.
 */

// ─── Identificador de dominio ─────────────────────────────────────────────────

declare const BookProjectIdBrand: unique symbol;
/** Identificador único de un BookProject. Branded para evitar mezclar IDs. */
export type BookProjectId = string & { readonly [BookProjectIdBrand]: never };

/** Helper para convertir un string crudo a BookProjectId. */
export function asBookProjectId(id: string): BookProjectId {
  return id as BookProjectId;
}

// ─── Enumeraciones ────────────────────────────────────────────────────────────

/**
 * Estado de ciclo de vida del proyecto editorial.
 * - draft:       Recién creado, aún en estructuración inicial
 * - in_progress: Escritura / edición activa
 * - complete:    Contenido finalizado, listo para maquetación final
 * - archived:    Ya no activo pero conservado en la biblioteca
 */
export type BookStatus = 'draft' | 'in_progress' | 'complete' | 'archived';

// ─── Entidad BookProject ──────────────────────────────────────────────────────

/**
 * Representa un proyecto de libro completo.
 * Contiene la metadata editorial pero no el contenido granular,
 * que se gestiona vía DocumentSection y DocumentBlock.
 */
export interface BookProject {
  id:           BookProjectId;
  title:        string;
  subtitle:     string;
  authorName:   string;
  description:  string;
  languageCode: string;       // ISO 639-1, ej. 'es', 'en', 'fr'
  status:       BookStatus;
  coverAssetId: string | null; // FK → Asset.id, puede ser null
  createdAt:    string;        // ISO 8601
  updatedAt:    string;        // ISO 8601
}

// ─── Payloads de mutación ─────────────────────────────────────────────────────

/** Datos requeridos para crear un nuevo BookProject. */
export interface CreateBookProjectInput {
  title:        string;
  subtitle?:    string;
  authorName?:  string;
  description?: string;
  languageCode?: string;
  status?:      BookStatus;
  coverAssetId?: string | null;
}

/** Campos actualizables de un BookProject. Todos opcionales. */
export interface UpdateBookProjectInput {
  title?:        string;
  subtitle?:     string;
  authorName?:   string;
  description?:  string;
  languageCode?: string;
  status?:       BookStatus;
  coverAssetId?: string | null;
}

// ─── Valor por defecto ────────────────────────────────────────────────────────

export const DEFAULT_BOOK_STATUS: BookStatus = 'draft';
export const DEFAULT_LANGUAGE_CODE = 'es';
