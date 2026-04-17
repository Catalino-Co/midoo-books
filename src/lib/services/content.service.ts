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
  sectionTypeLabel,
  sectionTypeBadge,
  type SectionTypeMeta,
  type SectionTypeGroup,
  type SectionCreationDefaults,
} from '$lib/core/editorial/section-type-catalog';

import { sectionTypeLabel } from '$lib/core/editorial/section-type-catalog';

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

export {
  ALL_BLOCK_TYPES,
  BLOCK_TYPE_LABELS,
  blockTypeLabel,
  blockTypeIcon,
  blockEditorSurface,
  blockShowsIncludeInToc,
  blockShowsStyleVariant,
  blockShowsFlowOptions,
  blockHasEditableText,
  blockContentPreview,
  blockEmptyPreviewHint,
} from '$lib/core/editorial/block-type-catalog';

/** Etiqueta para BlockStyleVariant */
export function styleVariantLabel(variant: BlockStyleVariant): string {
  const map: Record<BlockStyleVariant, string> = {
    default:     'Por defecto',
    lead:        'Lead / entradilla',
    caption:     'Leyenda',
    footnote:    'Nota al pie',
    pull_quote:  'Cita destacada',
    code_inline: 'Código inline',
  };
  return map[variant] ?? variant;
}

export const ALL_STYLE_VARIANTS: BlockStyleVariant[] = [
  'default', 'lead', 'caption', 'footnote', 'pull_quote', 'code_inline',
];
