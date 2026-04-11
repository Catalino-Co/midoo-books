/**
 * electron/database/repositories/BlockRepository.ts
 *
 * Repositorio de DocumentBlock — CRUD sobre la tabla document_blocks.
 *
 * En Fase 2 se implementa la base mínima (crear, listar, actualizar, eliminar).
 * En Fase 3 se añadirán: reorder, duplicar, mover entre secciones, historial de ediciones.
 */

import type {
  DocumentBlock,
  CreateBlockInput,
  UpdateBlockInput,
} from '../../../src/lib/core/domain/block';
import { rowToDocumentBlock } from '../mappers/block.mapper';
import { queryResultToObjects } from '../mappers/book.mapper';
import { getDatabase, persist } from '../connection';

function newId(): string { return crypto.randomUUID(); }
function now(): string   { return new Date().toISOString(); }
function db()            { return getDatabase(); }

// ─── Repositorio ──────────────────────────────────────────────────────────────

/**
 * Crea un nuevo bloque dentro de una sección.
 * Si no se provee orderIndex, se añade al final.
 */
export function createBlock(input: CreateBlockInput): DocumentBlock {
  const id = newId();
  const ts = now();

  let orderIndex = input.orderIndex;
  if (orderIndex === undefined) {
    const result = db().exec(
      'SELECT COALESCE(MAX(order_index), -1) + 1 AS next_idx FROM document_blocks WHERE section_id = ?',
      [input.sectionId]
    );
    orderIndex = Number(result[0]?.values[0]?.[0] ?? 0);
  }

  db().run(
    `INSERT INTO document_blocks
       (id, section_id, block_type, order_index, content_text, content_json,
        style_variant, include_in_toc, keep_together,
        page_break_before, page_break_after, metadata_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.sectionId,
      input.blockType,
      orderIndex,
      input.contentText     ?? '',
      input.contentJson     ?? null,
      input.styleVariant    ?? 'default',
      input.includeInToc    !== undefined ? (input.includeInToc    ? 1 : 0) : 0,
      input.keepTogether    !== undefined ? (input.keepTogether    ? 1 : 0) : 0,
      input.pageBreakBefore !== undefined ? (input.pageBreakBefore ? 1 : 0) : 0,
      input.pageBreakAfter  !== undefined ? (input.pageBreakAfter  ? 1 : 0) : 0,
      input.metadataJson    ?? null,
      ts,
      ts,
    ]
  );
  persist();

  const block = getBlockById(id);
  if (!block) throw new Error(`[BlockRepository] Error al crear bloque ${id}`);
  return block;
}

/**
 * Obtiene todos los bloques de una sección, ordenados por orderIndex.
 */
export function listBlocksBySection(sectionId: string): DocumentBlock[] {
  const result = db().exec(
    'SELECT * FROM document_blocks WHERE section_id = ? ORDER BY order_index ASC',
    [sectionId]
  );
  return queryResultToObjects(result).map(rowToDocumentBlock);
}

/**
 * Obtiene un bloque por ID. Retorna null si no existe.
 */
export function getBlockById(id: string): DocumentBlock | null {
  const result = db().exec(
    'SELECT * FROM document_blocks WHERE id = ?',
    [id]
  );
  const rows = queryResultToObjects(result);
  if (!rows.length) return null;
  return rowToDocumentBlock(rows[0]);
}

/**
 * Actualiza los campos editables de un bloque.
 */
export function updateBlock(
  id: string,
  input: UpdateBlockInput
): DocumentBlock | null {
  const existing = getBlockById(id);
  if (!existing) return null;

  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (input.blockType       !== undefined) { fields.push('block_type = ?');        values.push(input.blockType); }
  if (input.contentText     !== undefined) { fields.push('content_text = ?');      values.push(input.contentText); }
  if ('contentJson' in input)              { fields.push('content_json = ?');      values.push(input.contentJson ?? null); }
  if (input.styleVariant    !== undefined) { fields.push('style_variant = ?');     values.push(input.styleVariant); }
  if (input.orderIndex      !== undefined) { fields.push('order_index = ?');       values.push(input.orderIndex); }
  if (input.includeInToc    !== undefined) { fields.push('include_in_toc = ?');    values.push(input.includeInToc    ? 1 : 0); }
  if (input.keepTogether    !== undefined) { fields.push('keep_together = ?');     values.push(input.keepTogether    ? 1 : 0); }
  if (input.pageBreakBefore !== undefined) { fields.push('page_break_before = ?'); values.push(input.pageBreakBefore ? 1 : 0); }
  if (input.pageBreakAfter  !== undefined) { fields.push('page_break_after = ?');  values.push(input.pageBreakAfter  ? 1 : 0); }
  if ('metadataJson' in input)             { fields.push('metadata_json = ?');     values.push(input.metadataJson ?? null); }

  if (fields.length === 0) return existing;

  fields.push('updated_at = ?');
  values.push(now());
  values.push(id);

  db().run(
    `UPDATE document_blocks SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
  persist();
  return getBlockById(id);
}

/**
 * Elimina un bloque.
 */
export function deleteBlock(id: string): boolean {
  const existing = getBlockById(id);
  if (!existing) return false;
  db().run('DELETE FROM document_blocks WHERE id = ?', [id]);
  persist();
  return true;
}

/**
 * Reordena los bloques de una sección.
 */
export function reorderBlocks(sectionId: string, orderedIds: string[]): void {
  const ts = now();
  orderedIds.forEach((id, index) => {
    db().run(
      'UPDATE document_blocks SET order_index = ?, updated_at = ? WHERE id = ? AND section_id = ?',
      [index, ts, id, sectionId]
    );
  });
  persist();
}
