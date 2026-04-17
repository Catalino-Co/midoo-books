/**
 * electron/database/mappers/block.mapper.ts
 *
 * Convierte entre filas de SQLite y entidades DocumentBlock del dominio.
 */

import type { DocumentBlock, BlockStyleVariant } from '../../../src/lib/core/domain/block';
import { asBlockId, normalizeBlockType, DEFAULT_BLOCK_TYPE } from '../../../src/lib/core/domain/block';
import type { SqlValue } from 'sql.js';

export function rowToDocumentBlock(row: Record<string, SqlValue>): DocumentBlock {
  return {
    id:              asBlockId(String(row.id ?? '')),
    sectionId:       String(row.section_id ?? ''),
    blockType:       normalizeBlockType(String(row.block_type ?? DEFAULT_BLOCK_TYPE)),
    orderIndex:      Number(row.order_index ?? 0),
    contentText:     String(row.content_text ?? ''),
    contentJson:     row.content_json != null ? String(row.content_json) : null,
    styleVariant:    (String(row.style_variant ?? 'default')) as BlockStyleVariant,
    includeInToc:    Number(row.include_in_toc ?? 0) === 1,
    keepTogether:    Number(row.keep_together ?? 0) === 1,
    pageBreakBefore: Number(row.page_break_before ?? 0) === 1,
    pageBreakAfter:  Number(row.page_break_after ?? 0) === 1,
    metadataJson:    row.metadata_json != null ? String(row.metadata_json) : null,
    createdAt:       String(row.created_at ?? ''),
    updatedAt:       String(row.updated_at ?? ''),
  };
}
