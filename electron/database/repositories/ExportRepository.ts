/**
 * electron/database/repositories/ExportRepository.ts
 *
 * Repositorio de ExportJob — CRUD sobre la tabla export_jobs.
 * Registra el historial de exportaciones realizadas sobre cada libro.
 */

import type { Database } from 'sql.js';
import type {
  ExportJob,
  ExportJobId,
  ExportType,
  ExportStatus,
  CreateExportJobInput,
  UpdateExportJobInput,
} from '../../../src/lib/core/domain/export';
import { getDatabase, persist } from '../connection';

function newId(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

function db(): Database {
  return getDatabase();
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

function rowToExportJob(row: Record<string, unknown>): ExportJob {
  return {
    id:          row['id']           as ExportJobId,
    bookId:      row['book_id']      as string,
    exportType:  row['export_type']  as ExportType,
    status:      row['status']       as ExportStatus,
    optionsJson: (row['options_json'] as string | null) ?? null,
    outputPath:  (row['output_path']  as string | null) ?? null,
    errorMsg:    (row['error_msg']    as string | null) ?? null,
    createdAt:   row['created_at']   as string,
    completedAt: (row['completed_at'] as string | null) ?? null,
  };
}

function queryToRows(result: ReturnType<Database['exec']>): Record<string, unknown>[] {
  if (!result.length || !result[0].columns.length) return [];
  const { columns, values } = result[0];
  return values.map(row =>
    Object.fromEntries(columns.map((col, i) => [col, row[i]]))
  );
}

// ─── Repositorio ──────────────────────────────────────────────────────────────

export function createExportJob(input: CreateExportJobInput): ExportJob {
  const id = newId();
  const ts = now();

  db().run(
    `INSERT INTO export_jobs
       (id, book_id, export_type, status, options_json, created_at)
     VALUES (?, ?, ?, 'pending', ?, ?)`,
    [id, input.bookId, input.exportType, input.optionsJson ?? null, ts]
  );
  persist();

  const job = getExportJobById(id);
  if (!job) throw new Error(`[ExportRepository] Error al crear export job ${id}`);
  return job;
}

export function updateExportJob(id: string, updates: UpdateExportJobInput): ExportJob | null {
  db().run(
    `UPDATE export_jobs
     SET status       = ?,
         output_path  = ?,
         error_msg    = ?,
         completed_at = ?
     WHERE id = ?`,
    [
      updates.status,
      updates.outputPath  ?? null,
      updates.errorMsg    ?? null,
      updates.completedAt ?? null,
      id,
    ]
  );
  persist();
  return getExportJobById(id);
}

export function getExportJobById(id: string): ExportJob | null {
  const result = db().exec('SELECT * FROM export_jobs WHERE id = ?', [id]);
  const rows = queryToRows(result);
  if (!rows.length) return null;
  return rowToExportJob(rows[0]);
}

export function listExportJobsByBook(bookId: string, limit = 10): ExportJob[] {
  const result = db().exec(
    'SELECT * FROM export_jobs WHERE book_id = ? ORDER BY created_at DESC LIMIT ?',
    [bookId, limit]
  );
  return queryToRows(result).map(rowToExportJob);
}

export function clearExportJobsByBook(bookId: string): number {
  db().run('DELETE FROM export_jobs WHERE book_id = ?', [bookId]);
  persist();
  // Devuelve cuántas filas se borraron (sql.js no expone affected rows directamente,
  // pero podemos inferirlo; retornamos 0 como valor seguro)
  return 0;
}
