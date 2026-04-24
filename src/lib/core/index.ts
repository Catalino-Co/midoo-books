/**
 * src/lib/core/index.ts
 *
 * Punto de entrada del Core editorial.
 * Re-exporta todos los tipos públicos del dominio.
 *
 * Regla: CERO imports de electron, Node.js, sql.js, svelte o DOM.
 * Solo TypeScript puro — utilizable en cualquier contexto.
 */

// ── Tipos heredados Fase 1 (compatibilidad con rutas existentes) ─────────────
export type {
  BookId,
  BookLayout,
  BookVariant,
  PageSize,
  BookMeta,
  Book,
  ParsedSection,
  ParsedBook,
} from './types';
export { DEFAULT_BOOK_META } from './types';

// ── Dominio editorial Fase 2 ──────────────────────────────────────────────────
export type {
  BookProjectId,
  BookStatus,
  BookProject,
  CreateBookProjectInput,
  UpdateBookProjectInput,
  SectionId,
  SectionType,
  DocumentSection,
  CreateSectionInput,
  UpdateSectionInput,
  BlockId,
  BlockType,
  BlockStyleVariant,
  DocumentBlock,
  CreateBlockInput,
  UpdateBlockInput,
  LayoutSettingsId,
  PageUnit,
  FrontmatterNumberingStyle,
  BodyNumberingStyle,
  LayoutSettings,
  CreateLayoutSettingsInput,
  UpdateLayoutSettingsInput,
  AssetId,
  AssetType,
  Asset,
  CreateAssetInput,
  UpdateAssetInput,
  SnapshotId,
  SnapshotType,
  Snapshot,
  CreateSnapshotInput,
  ExportJobId,
  ExportType,
  ExportStatus,
  ExportJob,
  CreateExportJobInput,
  UpdateExportJobInput,
} from './domain/index';

export {
  asBookProjectId,
  DEFAULT_BOOK_STATUS,
  DEFAULT_LANGUAGE_CODE,
  asSectionId,
  SECTION_TYPE_VALUES,
  normalizeSectionType,
  DEFAULT_SECTION_TYPE,
  asBlockId,
  BLOCK_TYPE_VALUES,
  normalizeBlockType,
  DEFAULT_BLOCK_TYPE,
  asAssetId,
  DEFAULT_LAYOUT_SETTINGS,
  DEFAULT_HIDE_PAGE_NUMBER_SECTION_TYPES,
} from './domain/index';
