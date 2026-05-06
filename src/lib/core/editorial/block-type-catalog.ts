/**
 * Catálogo UI y pistas de edición para tipos de bloque (sin Svelte / SQL).
 */

import type { BlockType } from '$lib/core/domain/block';
import { parseImageBlockContent } from './image-block-content';
import { parseChapterOpeningContent } from './chapter-opening-content';

export type BlockEditorSurface =
  | 'none'
  | 'short'
  | 'medium'
  | 'large'
  | 'image_placeholder'
  | 'chapter_opening'
  | 'static_page_break';

export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  HEADING_1:       'Título principal',
  HEADING_2:       'Subtítulo',
  HEADING_3:       'Subtítulo 3',
  HEADING_4:       'Subtítulo 4',
  CHAPTER_OPENING: 'Apertura de capítulo',
  PARAGRAPH:       'Párrafo',
  QUOTE:           'Cita',
  IMAGE:           'Imagen',
  SEPARATOR:       'Separador',
  PAGE_BREAK:      'Salto de página',
  CENTERED_PHRASE: 'Línea centrada',
};

export const ALL_BLOCK_TYPES: BlockType[] = [
  'HEADING_1',
  'HEADING_2',
  'HEADING_3',
  'HEADING_4',
  'CHAPTER_OPENING',
  'PARAGRAPH',
  'QUOTE',
  'CENTERED_PHRASE',
  'IMAGE',
  'SEPARATOR',
  'PAGE_BREAK',
];

export function blockTypeLabel(type: BlockType): string {
  return BLOCK_TYPE_LABELS[type] ?? type;
}

/** Superficie de edición de texto sugerida para el inspector. */
export function blockEditorSurface(type: BlockType): BlockEditorSurface {
  switch (type) {
    case 'HEADING_1':
    case 'HEADING_2':
    case 'HEADING_3':
    case 'HEADING_4':
      return 'short';
    case 'PARAGRAPH':
    case 'QUOTE':
      return 'large';
    case 'CENTERED_PHRASE':
      return 'medium';
    case 'CHAPTER_OPENING':
      return 'chapter_opening';
    case 'IMAGE':
      return 'image_placeholder';
    case 'SEPARATOR':
      return 'none';
    case 'PAGE_BREAK':
      return 'static_page_break';
    default:
      return 'large';
  }
}

export function blockShowsIncludeInToc(type: BlockType): boolean {
  return type === 'HEADING_1' || type === 'HEADING_2' || type === 'HEADING_3' || type === 'HEADING_4';
}

export function blockShowsStyleVariant(type: BlockType): boolean {
  return type !== 'PAGE_BREAK' && type !== 'SEPARATOR' && type !== 'CHAPTER_OPENING';
}

/** Alineación / ancho / énfasis (PARTE 7): no aplica al marcador de salto de página. */
export function blockShowsLayoutControls(type: BlockType): boolean {
  return type !== 'PAGE_BREAK' && type !== 'CHAPTER_OPENING';
}

/** Opciones de salto / keepTogether: el PAGE_BREAK ya es un salto explícito. */
export function blockShowsFlowOptions(type: BlockType): boolean {
  return type !== 'PAGE_BREAK';
}

export function blockHasEditableText(surface: BlockEditorSurface): boolean {
  return (
    surface !== 'none'
    && surface !== 'static_page_break'
    && surface !== 'chapter_opening'
  );
}

/** Icono SVG (path d=) por tipo. */
export function blockTypeIcon(type: BlockType): string {
  const icons: Record<BlockType, string> = {
    HEADING_1:       'M4 6h16M4 12h12M4 18h8',
    HEADING_2:       'M4 8h16M4 14h14',
    HEADING_3:       'M4 9h16M4 15h12',
    HEADING_4:       'M4 10h16M4 16h10',
    PARAGRAPH:       'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM9 13h6M9 17h6M9 9h1',
    QUOTE:           'M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1zm12 0c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z',
    CHAPTER_OPENING:
      'M4 5h16v14H4zM4 5l8 6 8-6M8 19h8M10 15h4',
    IMAGE:           'M21 15a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5-5 5',
    SEPARATOR:       'M5 12h14',
    PAGE_BREAK:      'M8 6h8M8 18h8M12 6v12',
    CENTERED_PHRASE: 'M8 12h8M9 8h6M9 16h6',
  };
  return icons[type] ?? 'M12 5v14M5 12h14';
}

/** Texto de lista / preview cuando no hay cuerpo. */
export function blockEmptyPreviewHint(type: BlockType): string {
  switch (type) {
    case 'PAGE_BREAK':
      return 'Salto de página';
    case 'SEPARATOR':
      return 'Separador';
    case 'IMAGE':
      return 'Imagen (pendiente de recurso)';
    case 'CHAPTER_OPENING':
      return 'Apertura (sin imagen ni texto)';
    case 'HEADING_1':
    case 'HEADING_2':
    case 'HEADING_3':
    case 'HEADING_4':
      return 'Sin título';
    case 'CENTERED_PHRASE':
      return 'Texto centrado';
    case 'QUOTE':
      return 'Cita vacía';
    default:
      return '— sin texto —';
  }
}

export function blockContentPreview(
  block: { blockType: BlockType; contentText: string; contentJson?: string | null },
  maxLen = 80,
): string {
  const t = block.blockType;
  if (t === 'PAGE_BREAK') return 'Salto de página';
  if (t === 'SEPARATOR') {
    const s = block.contentText.replace(/\s+/g, ' ').trim();
    return s ? (s.length > maxLen ? s.slice(0, maxLen) + '…' : s) : 'Separador';
  }
  if (t === 'IMAGE') {
    const img = parseImageBlockContent(block.contentJson ?? null);
    if (img.assetId) {
      const hint = img.caption.trim() || img.altText.trim();
      return hint ? (hint.length > maxLen ? hint.slice(0, maxLen) + '…' : hint) : 'Imagen vinculada';
    }
    const s = block.contentText.replace(/\s+/g, ' ').trim();
    return s ? (s.length > maxLen ? s.slice(0, maxLen) + '…' : s) : 'Imagen (sin recurso)';
  }
  if (t === 'CHAPTER_OPENING') {
    const co = parseChapterOpeningContent(block.contentJson ?? null);
    const parts = [co.chapterLabel.trim(), co.title.trim()].filter(Boolean);
    const line = parts.join(' ').replace(/\s+/g, ' ').trim();
    if (line) return line.length > maxLen ? line.slice(0, maxLen) + '…' : line;
    return co.assetId ? 'Apertura (imagen)' : blockEmptyPreviewHint(t);
  }
  const text = block.contentText.replace(/\s+/g, ' ').trim();
  if (!text) return blockEmptyPreviewHint(t);
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
}
