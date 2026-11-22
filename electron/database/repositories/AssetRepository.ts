/**
 * Repositorio de assets (metadatos en SQLite; archivos en disco vía servicio de importación).
 */

import type { Asset, CreateAssetInput, UpdateAssetInput } from '../../../src/lib/core/domain/asset';
import { rowToAsset } from '../mappers/asset.mapper';
import { queryResultToObjects } from '../mappers/book.mapper';
import { getDatabase, persist } from '../connection';

function newId(): string {
  return crypto.randomUUID();
}
function now(): string {
  return new Date().toISOString();
}
function db() {
  return getDatabase();
}

export function createAsset(input: CreateAssetInput): Asset {
  const id = input.id ?? newId();
  const ts = now();
  const caption = input.caption ?? '';

  db().run(
    `INSERT INTO assets
       (id, book_id, asset_type, filename, original_name, mime_type, file_ext,
        file_size_bytes, width_px, height_px, storage_path, checksum, alt_text, caption,
        font_family, font_weight, font_style,
        created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.bookId,
      input.assetType,
      input.filename,
      input.originalName,
      input.mimeType,
      input.fileExt,
      input.fileSizeBytes,
      input.widthPx ?? null,
      input.heightPx ?? null,
      input.storagePath,
      input.checksum,
      input.altText ?? '',
      caption,
      input.fontFamily ?? null,
      input.fontWeight ?? null,
      input.fontStyle ?? null,
      ts,
      ts,
    ],
  );
  persist();
  const a = getAssetById(id);
  if (!a) throw new Error(`[AssetRepository] Error al crear asset ${id}`);
  return a;
}

export function getAssetById(id: string): Asset | null {
  const result = db().exec('SELECT * FROM assets WHERE id = ?', [id]);
  const rows = queryResultToObjects(result);
  if (!rows.length) return null;
  return rowToAsset(rows[0]);
}

export function listAssetsByBook(bookId: string): Asset[] {
  const result = db().exec(
    'SELECT * FROM assets WHERE book_id = ? ORDER BY created_at ASC',
    [bookId],
  );
  return queryResultToObjects(result).map(rowToAsset);
}

export function updateAsset(id: string, input: UpdateAssetInput): Asset | null {
  const existing = getAssetById(id);
  if (!existing) return null;

  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (input.altText !== undefined)   { fields.push('alt_text = ?');   values.push(input.altText); }
  if (input.caption !== undefined)   { fields.push('caption = ?');    values.push(input.caption); }
  if (input.assetType !== undefined) { fields.push('asset_type = ?'); values.push(input.assetType); }
  if (input.fontFamily !== undefined) {
    const fam = input.fontFamily?.trim() || null;
    fields.push('font_family = ?'); values.push(fam);
  }
  if (input.fontWeight !== undefined) {
    const w = input.fontWeight == null ? null : Math.min(900, Math.max(100, Math.round(input.fontWeight / 100) * 100));
    fields.push('font_weight = ?'); values.push(w);
  }
  if (input.fontStyle !== undefined) {
    const st = input.fontStyle === 'italic' ? 'italic' : input.fontStyle === 'normal' ? 'normal' : null;
    fields.push('font_style = ?'); values.push(st);
  }

  if (fields.length === 0) return existing;

  fields.push('updated_at = ?');
  values.push(now());
  values.push(id);

  db().run(`UPDATE assets SET ${fields.join(', ')} WHERE id = ?`, values);
  persist();
  return getAssetById(id);
}

export function deleteAsset(id: string): boolean {
  const existing = getAssetById(id);
  if (!existing) return false;
  db().run('DELETE FROM assets WHERE id = ?', [id]);
  persist();
  return true;
}
