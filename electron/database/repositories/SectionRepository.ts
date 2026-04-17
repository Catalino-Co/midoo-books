/**
 * electron/database/repositories/SectionRepository.ts
 *
 * Repositorio de DocumentSection — CRUD sobre la tabla document_sections.
 *
 * Las secciones están ordenadas por orderIndex dentro de un libro.
 * Al crear, si no se provee orderIndex, la sección se añade al final.
 * reorderSections() permite reorganizar las secciones de un libro completo.
 */

import type {
  DocumentSection,
  CreateSectionInput,
  UpdateSectionInput,
} from '../../../src/lib/core/domain/section';
import { asSectionId } from '../../../src/lib/core/domain/section';
import { getSectionCreationDefaults } from '../../../src/lib/core/editorial/section-type-catalog';
import { rowToDocumentSection, queryResultToObjects } from '../mappers/section.mapper';
import { getDatabase, persist } from '../connection';

function newId(): string { return crypto.randomUUID(); }
function now(): string   { return new Date().toISOString(); }
function db()            { return getDatabase(); }

// ─── Repositorio ──────────────────────────────────────────────────────────────

/**
 * Crea una nueva sección al final del libro (o en el orderIndex indicado).
 */
export function createSection(input: CreateSectionInput): DocumentSection {
  const id = newId();
  const ts = now();

  // Si no se provee orderIndex, calcularlo como el mayor existente + 1
  let orderIndex = input.orderIndex;
  if (orderIndex === undefined) {
    const result = db().exec(
      'SELECT COALESCE(MAX(order_index), -1) + 1 AS next_idx FROM document_sections WHERE book_id = ?',
      [input.bookId]
    );
    orderIndex = Number(result[0]?.values[0]?.[0] ?? 0);
  }

  const editorialDefaults = getSectionCreationDefaults(input.sectionType);
  const includeInToc =
    input.includeInToc !== undefined ? input.includeInToc : editorialDefaults.includeInToc;
  const startOnRightPage =
    input.startOnRightPage !== undefined
      ? input.startOnRightPage
      : editorialDefaults.startOnRightPage;

  db().run(
    `INSERT INTO document_sections
       (id, book_id, section_type, title, order_index,
        include_in_toc, start_on_right_page, settings_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.bookId,
      input.sectionType,
      input.title,
      orderIndex,
      includeInToc ? 1 : 0,
      startOnRightPage ? 1 : 0,
      input.settingsJson ?? null,
      ts,
      ts,
    ]
  );
  persist();

  const section = getSectionById(id);
  if (!section) throw new Error(`[SectionRepository] Error al crear sección ${id}`);
  return section;
}

/**
 * Obtiene todas las secciones de un libro, ordenadas por orderIndex.
 */
export function listSectionsByBook(bookId: string): DocumentSection[] {
  const result = db().exec(
    'SELECT * FROM document_sections WHERE book_id = ? ORDER BY order_index ASC',
    [bookId]
  );
  return queryResultToObjects(result).map(rowToDocumentSection);
}

/**
 * Obtiene una sección por ID. Retorna null si no existe.
 */
export function getSectionById(id: string): DocumentSection | null {
  const result = db().exec(
    'SELECT * FROM document_sections WHERE id = ?',
    [id]
  );
  const rows = queryResultToObjects(result);
  if (!rows.length) return null;
  return rowToDocumentSection(rows[0]);
}

/**
 * Actualiza los campos editables de una sección.
 * Retorna la sección actualizada o null si no existe.
 */
export function updateSection(
  id: string,
  input: UpdateSectionInput
): DocumentSection | null {
  const existing = getSectionById(id);
  if (!existing) return null;

  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (input.title             !== undefined) { fields.push('title = ?');              values.push(input.title); }
  if (input.sectionType       !== undefined) { fields.push('section_type = ?');       values.push(input.sectionType); }
  if (input.orderIndex        !== undefined) { fields.push('order_index = ?');        values.push(input.orderIndex); }
  if (input.includeInToc      !== undefined) { fields.push('include_in_toc = ?');     values.push(input.includeInToc ? 1 : 0); }
  if (input.startOnRightPage  !== undefined) { fields.push('start_on_right_page = ?'); values.push(input.startOnRightPage ? 1 : 0); }
  if ('settingsJson' in input)               { fields.push('settings_json = ?');      values.push(input.settingsJson ?? null); }

  if (fields.length === 0) return existing;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db().run(
    `UPDATE document_sections SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
  persist();
  return getSectionById(id);
}

/**
 * Elimina una sección y sus bloques (CASCADE en la BD).
 */
export function deleteSection(id: string): boolean {
  const existing = getSectionById(id);
  if (!existing) return false;
  db().run('DELETE FROM document_sections WHERE id = ?', [id]);
  persist();
  return true;
}

/**
 * Reordena las secciones de un libro recibiendo un array de IDs en el orden deseado.
 * Asigna orderIndex 0, 1, 2 … según la posición en el array.
 */
export function reorderSections(bookId: string, orderedIds: string[]): void {
  const ts = now();
  orderedIds.forEach((id, index) => {
    db().run(
      'UPDATE document_sections SET order_index = ?, updated_at = ? WHERE id = ? AND book_id = ?',
      [index, ts, id, bookId]
    );
  });
  persist();
}
