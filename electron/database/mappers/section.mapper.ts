/**
 * electron/database/mappers/section.mapper.ts
 *
 * Convierte entre filas de SQLite y entidades DocumentSection del dominio.
 */

import type { DocumentSection, SectionType } from '../../../src/lib/core/domain/section';
import { asSectionId } from '../../../src/lib/core/domain/section';
import type { SqlValue } from 'sql.js';
import { queryResultToObjects } from './book.mapper';

export { queryResultToObjects };

export function rowToDocumentSection(row: Record<string, SqlValue>): DocumentSection {
  return {
    id:               asSectionId(String(row.id ?? '')),
    bookId:           String(row.book_id ?? ''),
    sectionType:      (String(row.section_type ?? 'chapter')) as SectionType,
    title:            String(row.title ?? ''),
    orderIndex:       Number(row.order_index ?? 0),
    includeInToc:     Number(row.include_in_toc ?? 1) === 1,
    startOnRightPage: Number(row.start_on_right_page ?? 0) === 1,
    settingsJson:     row.settings_json != null ? String(row.settings_json) : null,
    createdAt:        String(row.created_at ?? ''),
    updatedAt:        String(row.updated_at ?? ''),
  };
}
