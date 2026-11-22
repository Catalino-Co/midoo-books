/**
 * page-furniture.ts — cabecera (titulillo) y folio.
 *
 * Se guardan en LayoutSettings.headerConfigJson / footerConfigJson.
 * El motor usa formatFolio() y resolveHeaderSource() para el texto; BookPage usa
 * la posición para alinear (centro o corte exterior: izquierda en par, derecha en impar).
 */

export const FOLIO_STYLES = ['plain', 'dashes', 'dots', 'brackets'] as const;
export type FolioStyle = (typeof FOLIO_STYLES)[number];

export const FURNITURE_POSITIONS = ['center', 'outside'] as const;
export type FurniturePosition = (typeof FURNITURE_POSITIONS)[number];

export const HEADER_CONTENTS = ['section', 'book', 'alternate'] as const;
export type HeaderContent = (typeof HEADER_CONTENTS)[number];

export interface FooterConfig {
  folioStyle: FolioStyle;
  position: FurniturePosition;
}

export interface HeaderConfig {
  content: HeaderContent;
  position: FurniturePosition;
  /** Versalitas/mayúsculas espaciadas, típico de titulillos. */
  uppercase: boolean;
}

export const DEFAULT_FOOTER_CONFIG: FooterConfig = { folioStyle: 'plain', position: 'center' };
export const DEFAULT_HEADER_CONFIG: HeaderConfig = { content: 'section', position: 'center', uppercase: true };

function pick<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? v as T : fallback;
}

function parseObject(json: string | null | undefined): Record<string, unknown> {
  if (!json?.trim()) return {};
  try {
    const o = JSON.parse(json);
    return o && typeof o === 'object' && !Array.isArray(o) ? o as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export function parseFooterConfig(json: string | null | undefined): FooterConfig {
  const o = parseObject(json);
  return {
    folioStyle: pick(o.folioStyle, FOLIO_STYLES, DEFAULT_FOOTER_CONFIG.folioStyle),
    position:   pick(o.position, FURNITURE_POSITIONS, DEFAULT_FOOTER_CONFIG.position),
  };
}

export function parseHeaderConfig(json: string | null | undefined): HeaderConfig {
  const o = parseObject(json);
  return {
    content:   pick(o.content, HEADER_CONTENTS, DEFAULT_HEADER_CONFIG.content),
    position:  pick(o.position, FURNITURE_POSITIONS, DEFAULT_HEADER_CONFIG.position),
    uppercase: typeof o.uppercase === 'boolean' ? o.uppercase : DEFAULT_HEADER_CONFIG.uppercase,
  };
}

export function serializeFooterConfig(c: FooterConfig): string {
  return JSON.stringify({ folioStyle: c.folioStyle, position: c.position });
}

export function serializeHeaderConfig(c: HeaderConfig): string {
  return JSON.stringify({ content: c.content, position: c.position, uppercase: c.uppercase });
}

/** «7» → «— 7 —», «· 7 ·», «[ 7 ]». Usa espacios finos para que no se separen. */
export function formatFolio(label: string, style: FolioStyle): string {
  const thin = ' ';
  switch (style) {
    case 'dashes':   return `—${thin}${label}${thin}—`;
    case 'dots':     return `·${thin}${label}${thin}·`;
    case 'brackets': return `[${thin}${label}${thin}]`;
    default:         return label;
  }
}

export function folioStyleLabel(s: FolioStyle): string {
  return formatFolio('7', s) + (s === 'plain' ? ' (solo el número)' : '');
}

export function positionLabel(p: FurniturePosition): string {
  return p === 'outside' ? 'Corte exterior (izq. en pares, der. en impares)' : 'Centrado';
}

export function headerContentLabel(c: HeaderContent): string {
  switch (c) {
    case 'book':      return 'Título del libro';
    case 'alternate': return 'Alternado: libro en pares, capítulo en impares';
    default:          return 'Título del capítulo o sección';
  }
}

/** Texto del titulillo según configuración y lado de la página. */
export function resolveHeaderSource(
  cfg: HeaderConfig,
  side: 'left' | 'right',
  sectionTitle: string | null | undefined,
  bookTitle: string,
): string | null {
  const section = sectionTitle?.trim() || null;
  const book = bookTitle.trim() || null;
  switch (cfg.content) {
    case 'book':      return book ?? section;
    case 'alternate': return side === 'left' ? (book ?? section) : (section ?? book);
    default:          return section ?? book;
  }
}

/** Alineación CSS en la página según posición y lado. */
export function furnitureTextAlign(position: FurniturePosition, side: 'left' | 'right'): 'center' | 'left' | 'right' {
  if (position !== 'outside') return 'center';
  return side === 'left' ? 'left' : 'right';
}
