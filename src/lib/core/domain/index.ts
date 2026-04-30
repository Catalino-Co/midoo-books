/**
 * src/lib/core/domain/index.ts
 *
 * Barrel de exportaciones del dominio editorial.
 * Importa todo desde aquí: `import type { BookProject } from '$lib/core/domain'`
 */

// ── Libro / Proyecto ──────────────────────────────────────────────────────────
export type {
  BookProjectId,
  BookStatus,
  BookProject,
  CreateBookProjectInput,
  UpdateBookProjectInput,
} from './book';
export { asBookProjectId, DEFAULT_BOOK_STATUS, DEFAULT_LANGUAGE_CODE } from './book';

// ── Sección ───────────────────────────────────────────────────────────────────
export type {
  SectionId,
  SectionType,
  DocumentSection,
  CreateSectionInput,
  UpdateSectionInput,
} from './section';
export {
  asSectionId,
  SECTION_TYPE_VALUES,
  normalizeSectionType,
  DEFAULT_SECTION_TYPE,
} from './section';

// ── Bloque ────────────────────────────────────────────────────────────────────
export type {
  BlockId,
  BlockType,
  BlockStyleVariant,
  DocumentBlock,
  CreateBlockInput,
  UpdateBlockInput,
} from './block';
export {
  asBlockId,
  BLOCK_TYPE_VALUES,
  BLOCK_STYLE_VARIANT_VALUES,
  normalizeBlockType,
  normalizeStyleVariant,
  DEFAULT_BLOCK_TYPE,
} from './block';

// ── Layout ────────────────────────────────────────────────────────────────────
export type {
  LayoutSettingsId,
  PageUnit,
  PageSizePresetId,
  FrontmatterNumberingStyle,
  BodyNumberingStyle,
  LayoutSettings,
  CreateLayoutSettingsInput,
  UpdateLayoutSettingsInput,
} from './layout';
export { DEFAULT_LAYOUT_SETTINGS, DEFAULT_HIDE_PAGE_NUMBER_SECTION_TYPES } from './layout';

// ── Asset ─────────────────────────────────────────────────────────────────────
export type {
  AssetId,
  AssetType,
  Asset,
  CreateAssetInput,
  UpdateAssetInput,
} from './asset';
export { asAssetId } from './asset';

// ── Snapshot ──────────────────────────────────────────────────────────────────
export type {
  SnapshotId,
  SnapshotType,
  Snapshot,
  CreateSnapshotInput,
} from './snapshot';

// ── Export ────────────────────────────────────────────────────────────────────
export type {
  ExportJobId,
  ExportType,
  ExportStatus,
  ExportJob,
  CreateExportJobInput,
  UpdateExportJobInput,
} from './export';
