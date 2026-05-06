/**
 * src/lib/services/content.service.ts
 *
 * Capa de servicio para el módulo de contenido editorial.
 * Thin wrapper alrededor de getPlatformAdapter() para las operaciones
 * de secciones y bloques. Los componentes Svelte solo importan desde aquí.
 *
 * Uso siempre client-side (onMount / event handlers).
 */

import { getPlatformAdapter } from '$lib/persistence';
import type {
  DocumentSection,
  CreateSectionInput,
  UpdateSectionInput,
  DocumentBlock,
  CreateBlockInput,
  UpdateBlockInput,
  BlockStyleVariant,
} from '$lib/core/domain/index';

export {
  SECTION_TYPE_CATALOG,
  SECTION_GROUP_LABELS,
  SECTION_TYPES_BY_GROUP,
  ALL_SECTION_TYPES,
  getSectionCreationDefaults,
  getSectionEditorialPreset,
  resolveSectionEditorialRules,
  sectionPropertyIsOverridden,
  sectionTypeLabel,
  sectionTypeBadge,
  sectionOpeningBehaviorLabel,
  sectionDefaultTextAlignLabel,
  type SectionTypeMeta,
  type SectionTypeGroup,
  type SectionCreationDefaults,
  type SectionEditorialPreset,
  type SectionEditorialRules,
  type SectionDefaultOpeningBehavior,
  type SectionDefaultTextAlign,
} from '$lib/core/editorial/section-type-catalog';

import { getSectionCreationDefaults, sectionTypeLabel } from '$lib/core/editorial/section-type-catalog';
import {
  parseMarkdownToBlockDrafts,
  validateMarkdownForImport,
} from '$lib/core/editorial/markdown-to-blocks';
import {
  parseMarkdownBookToSectionDrafts,
  validateMarkdownBookForImport,
} from '$lib/core/editorial/markdown-book-import';

export {
  parseMarkdownToBlockDrafts,
  validateMarkdownForImport,
  buildMarkdownImportPreview,
  type MarkdownBlockDraft,
  type MarkdownImportPreview,
} from '$lib/core/editorial/markdown-to-blocks';

export {
  segmentMarkdownBookByH1,
  parseMarkdownBookToSectionDrafts,
  validateMarkdownBookForImport,
  buildMarkdownBookImportPreview,
  type MarkdownBookSectionDraft,
  type BookMarkdownImportPreview,
  type BookMarkdownImportPreviewSectionRow,
} from '$lib/core/editorial/markdown-book-import';

export {
  inferMarkdownImportSuggestion,
  type MarkdownImportHint,
  type MarkdownImportTargetHint,
} from '$lib/core/editorial/markdown-import-hints';

export { inferSectionTypeFromTitle } from '$lib/core/editorial/section-title-heuristic';

export {
  parseImageBlockContent,
  serializeImageBlockContent,
  type ImageBlockContent,
} from '$lib/core/editorial/image-block-content';

export {
  parseChapterOpeningContent,
  serializeChapterOpeningContent,
  EMPTY_CHAPTER_OPENING_CONTENT,
  CHAPTER_OPENING_TEXT_POSITION_VALUES,
  CHAPTER_OPENING_TEXT_ALIGN_VALUES,
  CHAPTER_OPENING_TEXT_COLOR_MODE_VALUES,
  chapterOpeningPreviewRootClassNames,
  chapterOpeningTextPositionLabel,
  chapterOpeningTextAlignLabel,
  chapterOpeningTextColorModeLabel,
  type ChapterOpeningBlockContent,
  type ChapterOpeningTextPosition,
  type ChapterOpeningTextAlign,
  type ChapterOpeningTextColorMode,
} from '$lib/core/editorial/chapter-opening-content';

// ─── Secciones ────────────────────────────────────────────────────────────────

export async function listSections(bookId: string): Promise<DocumentSection[]> {
  const sections = await getPlatformAdapter().listSectionsByBook(bookId);
  return [...sections].sort((a, b) => a.orderIndex - b.orderIndex);
}

export async function createSection(input: CreateSectionInput): Promise<DocumentSection> {
  return getPlatformAdapter().createSection(input);
}

export async function updateSection(
  id: string,
  input: UpdateSectionInput,
): Promise<DocumentSection | null> {
  return getPlatformAdapter().updateSection(id, input);
}

export async function deleteSection(id: string): Promise<boolean> {
  return getPlatformAdapter().deleteSection(id);
}

/**
 * Duplica una sección y todos sus bloques al final del libro (nuevos IDs).
 */
export async function duplicateSection(bookId: string, sectionId: string): Promise<DocumentSection> {
  const sections = await listSections(bookId);
  const source = sections.find(s => s.id === sectionId);
  if (!source) throw new Error('Sección no encontrada.');

  const blocks = await listBlocks(sectionId);
  const baseTitle = source.title.trim();
  const title = baseTitle ? `${baseTitle} (copia)` : `${sectionTypeLabel(source.sectionType)} (copia)`;

  const created = await createSection({
    bookId,
    sectionType:       source.sectionType,
    title,
    includeInToc:      source.includeInToc,
    startOnRightPage:  source.startOnRightPage,
    settingsJson:      source.settingsJson,
  });

  for (const b of blocks) {
    await createBlock({
      sectionId:        created.id,
      blockType:        b.blockType,
      contentText:      b.contentText,
      contentJson:      b.contentJson,
      styleVariant:     b.styleVariant,
      includeInToc:     b.includeInToc,
      keepTogether:     b.keepTogether,
      pageBreakBefore:  b.pageBreakBefore,
      pageBreakAfter:   b.pageBreakAfter,
      metadataJson:     b.metadataJson,
    });
  }

  return created;
}

/**
 * Mueve una sección en la dirección indicada y persiste el nuevo orden.
 * Devuelve el array reordenado (sin mutar el original).
 */
export async function moveSectionInList(
  sections: DocumentSection[],
  sectionId: string,
  direction: 'up' | 'down',
): Promise<DocumentSection[]> {
  const list = [...sections].sort((a, b) => a.orderIndex - b.orderIndex);
  const idx  = list.findIndex(s => s.id === sectionId);
  if (idx === -1) return list;

  const newIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (newIdx < 0 || newIdx >= list.length) return list;

  // Swap
  [list[idx], list[newIdx]] = [list[newIdx], list[idx]];

  // Normalizar orderIndex
  const reordered = list.map((s, i) => ({ ...s, orderIndex: i }));
  const bookId    = reordered[0]?.bookId;
  if (bookId) {
    await getPlatformAdapter().reorderSections(bookId, reordered.map(s => s.id));
  }
  return reordered;
}

export async function reorderSectionToIndex(
  sections: DocumentSection[],
  sectionId: string,
  toIndex: number,
): Promise<DocumentSection[]> {
  const list = [...sections].sort((a, b) => a.orderIndex - b.orderIndex);
  const from = list.findIndex(s => s.id === sectionId);
  if (from === -1 || from === toIndex) return list;
  const [item] = list.splice(from, 1);
  list.splice(toIndex, 0, item);
  const reordered = list.map((s, i) => ({ ...s, orderIndex: i }));
  const bookId = reordered[0]?.bookId;
  if (bookId) {
    await getPlatformAdapter().reorderSections(bookId, reordered.map(s => s.id));
  }
  return reordered;
}

// ─── Bloques ──────────────────────────────────────────────────────────────────

export async function listBlocks(sectionId: string): Promise<DocumentBlock[]> {
  const blocks = await getPlatformAdapter().listBlocksBySection(sectionId);
  return [...blocks].sort((a, b) => a.orderIndex - b.orderIndex);
}

export async function createBlock(input: CreateBlockInput): Promise<DocumentBlock> {
  return getPlatformAdapter().createBlock(input);
}

export async function updateBlock(
  id: string,
  input: UpdateBlockInput,
): Promise<DocumentBlock | null> {
  return getPlatformAdapter().updateBlock(id, input);
}

export async function deleteBlock(id: string): Promise<boolean> {
  return getPlatformAdapter().deleteBlock(id);
}

export type MarkdownImportMode = 'append' | 'replace';

export type MarkdownBookImportMode = 'append' | 'replace';

/**
 * Importa un manuscrito Markdown completo: segmenta por `#`, crea secciones y bloques.
 * `replace` elimina todas las secciones actuales del libro (y sus bloques en cascada) antes de insertar.
 */
export async function importMarkdownBook(
  bookId: string,
  markdown: string,
  mode: MarkdownBookImportMode,
  currentSections: DocumentSection[],
): Promise<DocumentSection[]> {
  const v = validateMarkdownBookForImport(markdown);
  if (!v.ok) throw new Error(v.message);

  const drafts = parseMarkdownBookToSectionDrafts(markdown);
  if (drafts.length === 0) {
    throw new Error('No se pudo extraer ninguna sección del Markdown.');
  }

  if (mode === 'replace') {
    const sorted = [...currentSections].sort((a, b) => a.orderIndex - b.orderIndex);
    for (const s of sorted) {
      await deleteSection(s.id);
    }
  }

  for (const d of drafts) {
    const defaults = getSectionCreationDefaults(d.sectionType);
    const section = await createSection({
      bookId,
      sectionType:      d.sectionType,
      title:            d.title,
      includeInToc:     defaults.includeInToc,
      startOnRightPage: defaults.startOnRightPage,
    });
    for (const b of d.blockDrafts) {
      await createBlock({
        sectionId:   section.id,
        blockType:   b.blockType,
        contentText: b.contentText,
      });
    }
  }

  return listSections(bookId);
}

/**
 * Importa Markdown en una sección: parsea, opcionalmente borra bloques existentes
 * y crea bloques en orden vía la capa de persistencia.
 */
export async function importMarkdownBlocksToSection(
  sectionId: string,
  markdown: string,
  mode: MarkdownImportMode,
  currentBlocks: DocumentBlock[],
): Promise<DocumentBlock[]> {
  const v = validateMarkdownForImport(markdown);
  if (!v.ok) throw new Error(v.message);

  const drafts = parseMarkdownToBlockDrafts(markdown);
  if (drafts.length === 0) {
    throw new Error(
      'No se detectaron bloques. Revisa el formato (párrafos, títulos #/##, citas >, ---, [[PAGE_BREAK]], etc.).',
    );
  }

  if (mode === 'replace') {
    const sorted = [...currentBlocks].sort((a, b) => a.orderIndex - b.orderIndex);
    for (const b of sorted) {
      await deleteBlock(b.id);
    }
  }

  for (const d of drafts) {
    await createBlock({
      sectionId,
      blockType:   d.blockType,
      contentText: d.contentText,
    });
  }

  return listBlocks(sectionId);
}

/**
 * Crea un bloque e inserta en la posición indicada (reordenando en SQLite).
 * @param afterBlockId — si es null, equivale al final de la sección.
 */
export async function createBlockInSection(
  sectionId: string,
  currentBlocks: DocumentBlock[],
  afterBlockId: string | null,
  input: Omit<CreateBlockInput, 'sectionId'>,
): Promise<DocumentBlock> {
  const sorted = [...currentBlocks].sort((a, b) => a.orderIndex - b.orderIndex);
  const orderedIds = sorted.map(b => b.id);
  let insertPos = sorted.length;
  if (afterBlockId) {
    const i = orderedIds.findIndex(id => id === afterBlockId);
    if (i !== -1) insertPos = i + 1;
  }
  const created = await createBlock({ sectionId, ...input });
  const merged = [...orderedIds];
  merged.splice(insertPos, 0, created.id);
  await getPlatformAdapter().reorderBlocks(sectionId, merged);
  const fresh = await listBlocks(sectionId);
  return fresh.find(b => b.id === created.id) ?? created;
}

/**
 * Crea un bloque al inicio de la sección (antes del primer bloque existente).
 */
export async function createBlockFirstInSection(
  sectionId: string,
  currentBlocks: DocumentBlock[],
  input: Omit<CreateBlockInput, 'sectionId'>,
): Promise<DocumentBlock> {
  const sorted = [...currentBlocks].sort((a, b) => a.orderIndex - b.orderIndex);
  const orderedIds = sorted.map(b => b.id);
  const created = await createBlock({ sectionId, ...input });
  const merged = [created.id, ...orderedIds];
  await getPlatformAdapter().reorderBlocks(sectionId, merged);
  const fresh = await listBlocks(sectionId);
  return fresh.find(b => b.id === created.id) ?? created;
}

/**
 * Mueve un bloque arriba/abajo dentro de su sección y persiste el nuevo orden.
 */
export async function moveBlockInList(
  blocks: DocumentBlock[],
  blockId: string,
  direction: 'up' | 'down',
): Promise<DocumentBlock[]> {
  const list = [...blocks].sort((a, b) => a.orderIndex - b.orderIndex);
  const idx  = list.findIndex(b => b.id === blockId);
  if (idx === -1) return list;

  const newIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (newIdx < 0 || newIdx >= list.length) return list;

  [list[idx], list[newIdx]] = [list[newIdx], list[idx]];

  const reordered  = list.map((b, i) => ({ ...b, orderIndex: i }));
  const sectionId  = reordered[0]?.sectionId;
  if (sectionId) {
    await getPlatformAdapter().reorderBlocks(sectionId, reordered.map(b => b.id));
  }
  return reordered;
}

export async function reorderBlockToIndex(
  blocks: DocumentBlock[],
  blockId: string,
  toIndex: number,
): Promise<DocumentBlock[]> {
  const list = [...blocks].sort((a, b) => a.orderIndex - b.orderIndex);
  const from = list.findIndex(b => b.id === blockId);
  if (from === -1 || from === toIndex) return list;
  const [item] = list.splice(from, 1);
  list.splice(toIndex, 0, item);
  const reordered = list.map((b, i) => ({ ...b, orderIndex: i }));
  const sectionId = reordered[0]?.sectionId;
  if (sectionId) {
    await getPlatformAdapter().reorderBlocks(sectionId, reordered.map(b => b.id));
  }
  return reordered;
}

export {
  ALL_BLOCK_TYPES,
  BLOCK_TYPE_LABELS,
  blockTypeLabel,
  blockTypeIcon,
  blockEditorSurface,
  blockShowsIncludeInToc,
  blockShowsStyleVariant,
  blockShowsLayoutControls,
  blockShowsFlowOptions,
  blockHasEditableText,
  blockContentPreview,
  blockEmptyPreviewHint,
} from '$lib/core/editorial/block-type-catalog';

export {
  resolveBlockLayout,
  mergeLayoutIntoMetadata,
  defaultBlockLayout,
  blockLayoutPreviewClassNames,
  blockLayoutEditorWrapClassNames,
  BLOCK_TEXT_ALIGN_OPTIONS,
  BLOCK_WIDTH_MODE_OPTIONS,
  BLOCK_EMPHASIS_OPTIONS,
  textAlignLabel,
  widthModeLabel,
  emphasisLabel,
  type BlockTextAlign,
  type BlockWidthMode,
  type BlockEmphasis,
  type BlockLayoutStyle,
} from '$lib/core/editorial/block-layout';

/** Etiqueta para BlockStyleVariant */
export function styleVariantLabel(variant: BlockStyleVariant): string {
  const map: Record<BlockStyleVariant, string> = {
    default:      'Estándar',
    lead:         'Lead / entradilla',
    caption:      'Leyenda',
    footnote:     'Nota al pie',
    pull_quote:   'Cita destacada',
    code_inline:  'Código inline',
    dedication:   'Dedicatoria',
    toc_entry:    'Entrada de índice',
    rights:       'Derechos / créditos legales',
    author_note:  'Nota del autor',
    quote_large:  'Cita grande',
  };
  return map[variant] ?? variant;
}

export const ALL_STYLE_VARIANTS: BlockStyleVariant[] = [
  'default',
  'lead',
  'dedication',
  'toc_entry',
  'rights',
  'author_note',
  'caption',
  'footnote',
  'pull_quote',
  'quote_large',
  'code_inline',
];
