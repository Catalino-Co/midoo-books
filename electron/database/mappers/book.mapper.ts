/**
 * electron/database/mappers/book.mapper.ts
 *
 * Convierte entre filas de SQLite (snake_case, tipos primitivos)
 * y entidades TypeScript del dominio (camelCase, tipos branded).
 *
 * Principio: la BD no conoce los tipos de dominio; el mapper es el puente.
 * Los mappers son funciones puras — no tienen estado ni efectos secundarios.
 */

import type { BookProject } from '../../../src/lib/core/domain/book';
import { asBookProjectId } from '../../../src/lib/core/domain/book';
import type { SqlValue } from 'sql.js';

/** Fila cruda de la tabla book_projects */
export interface BookProjectRow {
  id:             SqlValue;
  title:          SqlValue;
  subtitle:       SqlValue;
  author_name:    SqlValue;
  description:    SqlValue;
  language_code:  SqlValue;
  status:         SqlValue;
  cover_asset_id: SqlValue;
  created_at:     SqlValue;
  updated_at:     SqlValue;
}

/**
 * Convierte un objeto de columnas de sql.js en un BookProject del dominio.
 * Aplica defaults seguros si alguna columna es null.
 */
export function rowToBookProject(row: Record<string, SqlValue>): BookProject {
  return {
    id:           asBookProjectId(String(row.id ?? '')),
    title:        String(row.title ?? ''),
    subtitle:     String(row.subtitle ?? ''),
    authorName:   String(row.author_name ?? ''),
    description:  String(row.description ?? ''),
    languageCode: String(row.language_code ?? 'es'),
    status:       (String(row.status ?? 'draft')) as BookProject['status'],
    coverAssetId: row.cover_asset_id != null ? String(row.cover_asset_id) : null,
    createdAt:    String(row.created_at ?? ''),
    updatedAt:    String(row.updated_at ?? ''),
  };
}

/**
 * Helper genérico: convierte el resultado de db.exec() en un array de objetos.
 * Útil en todos los mappers para convertir QueryExecResult[] a Record[].
 */
export function queryResultToObjects(
  result: Array<{ columns: string[]; values: SqlValue[][] }>
): Record<string, SqlValue>[] {
  if (!result.length || !result[0].values.length) return [];
  const { columns, values } = result[0];
  return values.map(row => {
    const obj: Record<string, SqlValue> = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}
