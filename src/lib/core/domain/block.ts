/**
 * src/lib/core/domain/block.ts
 *
 * Entidad DocumentBlock.
 *
 * Un bloque es la unidad atómica de contenido dentro de una sección.
 * Puede ser un párrafo, un heading, una imagen, una tabla, etc.
 * Los bloques dentro de una sección están ordenados por orderIndex.
 *
 * contentText: texto plano o Markdown (para tipos text-based)
 * contentJson: datos estructurados (para tablas, imágenes, etc.)
 * metadataJson: metadatos adicionales opcionales (atributos CSS, IDs de anchor, etc.)
 */

// ─── Identificador ────────────────────────────────────────────────────────────

declare const BlockIdBrand: unique symbol;
export type BlockId = string & { readonly [BlockIdBrand]: never };

export function asBlockId(id: string): BlockId {
  return id as BlockId;
}

// ─── Tipos de bloque ──────────────────────────────────────────────────────────

/**
 * Tipos de bloque soportados.
 * - paragraph:    Texto en prosa (Markdown o texto plano)
 * - heading:      Encabezado h1–h6
 * - image:        Imagen con caption opcional
 * - table:        Tabla de datos
 * - quote:        Cita destacada / blockquote
 * - code:         Bloque de código con sintax highlighting
 * - divider:      Separador visual (línea horizontal o espacio)
 * - list:         Lista ordenada o desordenada
 * - raw_html:     HTML literal (para casos edge)
 */
export type BlockType =
  | 'paragraph'
  | 'heading'
  | 'image'
  | 'table'
  | 'quote'
  | 'code'
  | 'divider'
  | 'list'
  | 'raw_html';

/**
 * Variante de estilo aplicable a un bloque.
 * Complementa el tipo con una clase CSS adicional.
 * Ej.: un paragraph con styleVariant='lead' tendrá font-size mayor.
 */
export type BlockStyleVariant =
  | 'default'
  | 'lead'        // Párrafo de entrada / entradilla
  | 'caption'     // Leyenda de imagen o tabla
  | 'footnote'    // Nota al pie
  | 'pull_quote'  // Cita destacada
  | 'code_inline';

// ─── Entidad DocumentBlock ────────────────────────────────────────────────────

export interface DocumentBlock {
  id:              BlockId;
  sectionId:       string;             // FK → DocumentSection.id
  blockType:       BlockType;
  orderIndex:      number;
  contentText:     string;             // Contenido de texto (Markdown / texto plano)
  contentJson:     string | null;      // Datos estructurados (JSON serializado)
  styleVariant:    BlockStyleVariant;
  includeInToc:    boolean;            // Solo aplica a blockType='heading'
  keepTogether:    boolean;            // Evitar que el bloque se parta entre páginas
  pageBreakBefore: boolean;            // Forzar salto de página antes del bloque
  pageBreakAfter:  boolean;            // Forzar salto de página después del bloque
  metadataJson:    string | null;      // Metadatos adicionales (JSON serializado)
  createdAt:       string;
  updatedAt:       string;
}

// ─── Payloads ─────────────────────────────────────────────────────────────────

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
