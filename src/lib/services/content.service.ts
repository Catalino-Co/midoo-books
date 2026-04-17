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
  BlockType,
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

/** Etiqueta legible para BlockType */
export function blockTypeLabel(type: BlockType): string {
  const map: Record<BlockType, string> = {
    paragraph: 'Párrafo',
    heading:   'Encabezado',
    image:     'Imagen',
    table:     'Tabla',
    quote:     'Cita',
    code:      'Código',
    divider:   'Separador',
    list:      'Lista',
    raw_html:  'HTML',
  };
  return map[type] ?? type;
}

/** Todos los BlockType disponibles para el selector */
export const ALL_BLOCK_TYPES: BlockType[] = [
  'paragraph', 'heading', 'quote', 'image', 'divider',
  'list', 'code', 'table', 'raw_html',
];

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

/** Icono SVG path-data para cada BlockType (para mostrar en la lista de bloques) */
export function blockTypeIcon(type: BlockType): string {
  const icons: Record<BlockType, string> = {
    paragraph: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM9 13h6M9 17h6M9 9h1',
    heading:   'M4 6h16M4 12h16M4 18h7',
    image:     'M21 15a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5-5 5',
    table:     'M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18',
    quote:     'M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1zm12 0c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z',
    code:      'M16 18l6-6-6-6M8 6l-6 6 6 6',
    divider:   'M5 12h14',
    list:      'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    raw_html:  'M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z',
  };
  return icons[type] ?? 'M12 5v14M5 12h14';
}

/**
 * ¿El tipo de bloque tiene contenido de texto editable (contentText)?
 * Usado para mostrar/ocultar el textarea en el inspector.
 */
export function blockHasTextContent(type: BlockType): boolean {
  return ['paragraph', 'heading', 'quote', 'code', 'list', 'raw_html'].includes(type);
}

/** Preview corto del contenido de un bloque para mostrar en la lista */
export function blockContentPreview(block: DocumentBlock, maxLen = 72): string {
  if (block.contentText) {
    const text = block.contentText.replace(/\s+/g, ' ').trim();
    return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
  }
  return '';
}
