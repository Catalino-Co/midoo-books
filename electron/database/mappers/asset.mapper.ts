/**
 * Mapeo fila SQLite → entidad Asset (dominio).
 */

import type { Asset, AssetType } from '../../../src/lib/core/domain/asset';
import { asAssetId } from '../../../src/lib/core/domain/asset';
import type { SqlValue } from 'sql.js';

const CANON: Set<string> = new Set([
  'image', 'cover_image', 'illustration', 'font', 'background', 'logo', 'other',
]);

export function normalizeAssetType(raw: string): AssetType {
  const k = raw.trim().toLowerCase();
  if (CANON.has(k)) return k as AssetType;
  return 'image';
}

export function rowToAsset(row: Record<string, SqlValue>): Asset {
  return {
    id:            asAssetId(String(row.id ?? '')),
    bookId:        String(row.book_id ?? ''),
    assetType:     normalizeAssetType(String(row.asset_type ?? 'image')),
    filename:      String(row.filename ?? ''),
    originalName:  String(row.original_name ?? ''),
    mimeType:      String(row.mime_type ?? ''),
    fileExt:       String(row.file_ext ?? ''),
    fileSizeBytes: Number(row.file_size_bytes ?? 0),
    widthPx:       row.width_px != null ? Number(row.width_px) : null,
    heightPx:      row.height_px != null ? Number(row.height_px) : null,
    storagePath:   String(row.storage_path ?? ''),
    checksum:      String(row.checksum ?? ''),
    altText:       String(row.alt_text ?? ''),
    caption:       String(row.caption ?? ''),
    fontFamily:    row.font_family != null && String(row.font_family).trim() ? String(row.font_family) : null,
    fontWeight:    row.font_weight != null ? Number(row.font_weight) : null,
    fontStyle:     row.font_style === 'italic' ? 'italic' : row.font_style === 'normal' ? 'normal' : null,
    createdAt:     String(row.created_at ?? ''),
    updatedAt:     String(row.updated_at ?? ''),
  };
}
