/**
 * src/lib/core/domain/block.ts
 *
 * Entidad DocumentBlock — unidad de contenido dentro de una sección.
 *
 * Tipos v1 (PARTE 5): modelo orientado a redacción de libro sin editor rico.
 * Valores en SCREAMING_SNAKE_CASE. Datos antiguos se normalizan al leer desde SQLite.
 */

declare const BlockIdBrand: unique symbol;
export type BlockId = string & { readonly [BlockIdBrand]: never };

export function asBlockId(id: string): BlockId {
  return id as BlockId;
}

/** Tipos canónicos de bloque (editor de contenido v1). */
export const BLOCK_TYPE_VALUES = [
  'HEADING_1',
  'HEADING_2',
  'PARAGRAPH',
  'QUOTE',
  'IMAGE',
  'SEPARATOR',
  'PAGE_BREAK',
  'CENTERED_PHRASE',
] as const;

export type BlockType = (typeof BLOCK_TYPE_VALUES)[number];

export const DEFAULT_BLOCK_TYPE: BlockType = 'PARAGRAPH';

const _canonical = new Set<string>(BLOCK_TYPE_VALUES);

/**
 * Mapea valores legacy (fase 2) y variantes en minúsculas al tipo canónico.
 */
export function normalizeBlockType(raw: string): BlockType {
  const key = raw.trim().toLowerCase();
  const fromLower: Record<string, BlockType> = {
    heading_1: 'HEADING_1',
    heading_2: 'HEADING_2',
    paragraph: 'PARAGRAPH',
    quote: 'QUOTE',
    image: 'IMAGE',
    separator: 'SEPARATOR',
    page_break: 'PAGE_BREAK',
    centered_phrase: 'CENTERED_PHRASE',
    heading: 'HEADING_1',
    divider: 'SEPARATOR',
    code: 'PARAGRAPH',
    table: 'PARAGRAPH',
    list: 'PARAGRAPH',
    raw_html: 'PARAGRAPH',
  };
  if (fromLower[key]) return fromLower[key];

  const t = raw.trim();
  if (_canonical.has(t)) return t as BlockType;

  return DEFAULT_BLOCK_TYPE;
}

/**
 * Variante de estilo aplicable a un bloque (maquetación futura).
 */
export type BlockStyleVariant =
  | 'default'
  | 'lead'
  | 'caption'
  | 'footnote'
  | 'pull_quote'
  | 'code_inline';

export interface DocumentBlock {
  id:              BlockId;
  sectionId:       string;
  blockType:       BlockType;
  orderIndex:      number;
  contentText:     string;
  contentJson:     string | null;
  styleVariant:    BlockStyleVariant;
  includeInToc:    boolean;
  keepTogether:    boolean;
  pageBreakBefore: boolean;
  pageBreakAfter:  boolean;
  metadataJson:    string | null;
  createdAt:       string;
  updatedAt:       string;
}

export interface CreateBlockInput {
  sectionId:        string;
  blockType:        BlockType;
  contentText?:     string;
  contentJson?:     string | null;
  styleVariant?:    BlockStyleVariant;
  orderIndex?:      number;
  includeInToc?:    boolean;
  keepTogether?:    boolean;
  pageBreakBefore?: boolean;
  pageBreakAfter?:  boolean;
  metadataJson?:    string | null;
}

export interface UpdateBlockInput {
  blockType?:       BlockType;
  contentText?:     string;
  contentJson?:     string | null;
  styleVariant?:    BlockStyleVariant;
  orderIndex?:      number;
  includeInToc?:    boolean;
  keepTogether?:    boolean;
  pageBreakBefore?: boolean;
  pageBreakAfter?:  boolean;
  metadataJson?:    string | null;
}
