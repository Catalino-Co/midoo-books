/**
 * electron/database/repositories/BookRepository.ts
 *
 * Repositorio de BookProject — CRUD completo sobre la tabla book_projects.
 *
 * Responsabilidades:
 *   - Leer y escribir BookProject en SQLite
 *   - Convertir entre filas de BD y entidades del dominio (via mapper)
 *   - Llamar a persist() después de cada escritura
 *
 * No conoce IPC, Electron window, ni SvelteKit. Solo BD y dominio.
 */

import type { Database } from 'sql.js';
import type {
  BookProject,
  CreateBookProjectInput,
  UpdateBookProjectInput,
} from '../../../src/lib/core/domain/book';
import { asBookProjectId } from '../../../src/lib/core/domain/book';
import { rowToBookProject, queryResultToObjects } from '../mappers/book.mapper';
import { getDatabase, persist } from '../connection';

// ─── Helpers internos ─────────────────────────────────────────────────────────

/** Genera un ID único (UUID v4) sin dependencias externas. */
function newId(): string {
  return crypto.randomUUID();
}

/** ISO 8601 timestamp del momento actual. */
function now(): string {
  return new Date().toISOString();
}

/**
 * Obtiene la instancia activa de la BD.
 * Centraliza el acceso para facilitar tests futuros (inyección de dependencia).
 */
function db(): Database {
  return getDatabase();
}

// ─── Repositorio ──────────────────────────────────────────────────────────────

/**
 * Crea un nuevo BookProject en la base de datos.
 * Genera ID y timestamps automáticamente.
 * Crea también un LayoutSettings con los valores por defecto.
 */
export function createBook(input: CreateBookProjectInput): BookProject {
  const id = newId();
  const ts = now();

  db().run(
    `INSERT INTO book_projects
       (id, title, subtitle, author_name, description, language_code,
        status, cover_asset_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.title,
      input.subtitle     ?? '',
      input.authorName   ?? '',
      input.description  ?? '',
      input.languageCode ?? 'es',
      input.status       ?? 'draft',
      input.coverAssetId ?? null,
      ts,
      ts,
    ]
  );

  // Crear LayoutSettings por defecto para el libro
  const layoutId = newId();
  db().run(
    `INSERT INTO layout_settings (id, book_id, created_at, updated_at)
     VALUES (?, ?, ?, ?)`,
    [layoutId, id, ts, ts]
  );

  persist();

  const book = getBookById(id);
  if (!book) throw new Error(`[BookRepository] Error al crear libro con id ${id}`);
  return book;
}

/**
 * Obtiene todos los libros, ordenados por fecha de actualización descendente.
 */
export function listBooks(): BookProject[] {
  const result = db().exec(
    'SELECT * FROM book_projects ORDER BY updated_at DESC'
  );
  return queryResultToObjects(result).map(rowToBookProject);
}

/**
 * Obtiene un libro por su ID. Retorna null si no existe.
 */
export function getBookById(id: string): BookProject | null {
  const result = db().exec(
    'SELECT * FROM book_projects WHERE id = ?',
    [id]
  );
  const rows = queryResultToObjects(result);
  if (!rows.length) return null;
  return rowToBookProject(rows[0]);
}

/**
 * Actualiza los campos editables de un BookProject.
 * Solo modifica los campos explícitamente incluidos en el input.
 * Retorna el libro actualizado, o null si el ID no existe.
 */
export function updateBook(
  id: string,
  input: UpdateBookProjectInput
): BookProject | null {
  const existing = getBookById(id);
  if (!existing) return null;

  const ts = now();

  // Construimos el SET dinámicamente para solo tocar los campos provistos
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (input.title        !== undefined) { fields.push('title = ?');          values.push(input.title); }
  if (input.subtitle     !== undefined) { fields.push('subtitle = ?');        values.push(input.subtitle); }
  if (input.authorName   !== undefined) { fields.push('author_name = ?');     values.push(input.authorName); }
  if (input.description  !== undefined) { fields.push('description = ?');     values.push(input.description); }
  if (input.languageCode !== undefined) { fields.push('language_code = ?');   values.push(input.languageCode); }
  if (input.status       !== undefined) { fields.push('status = ?');          values.push(input.status); }
  if ('coverAssetId' in input)          { fields.push('cover_asset_id = ?');  values.push(input.coverAssetId ?? null); }

  if (fields.length === 0) return existing; // Nada que actualizar

  fields.push('updated_at = ?');
  values.push(ts);
  values.push(id); // Para el WHERE

  db().run(
    `UPDATE book_projects SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
  persist();

  return getBookById(id);
}

/**
 * Elimina un libro y todas sus entidades relacionadas (CASCADE en la BD).
 * Retorna true si el libro existía y fue eliminado, false si no existía.
 */
export function deleteBook(id: string): boolean {
  const existing = getBookById(id);
  if (!existing) return false;

  db().run('DELETE FROM book_projects WHERE id = ?', [id]);
  persist();
  return true;
}

/**
 * Cuenta el total de libros en la biblioteca.
 */
export function countBooks(): number {
  const result = db().exec('SELECT COUNT(*) as total FROM book_projects');
  if (!result.length || !result[0].values.length) return 0;
  return Number(result[0].values[0][0]) || 0;
}
