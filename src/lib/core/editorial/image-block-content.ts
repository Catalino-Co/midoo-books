/**
 * PARTE 8 — Contenido estructurado del bloque IMAGE (content_json).
 */

export interface ImageBlockContent {
  assetId: string | null;
  /** Texto alternativo en el bloque (puede enriquecer o sustituir el del asset). */
  altText: string;
  /** Pie visible; puede combinarse con caption del asset en maquetación futura. */
  caption: string;
  /** Si es true, la imagen se maquetará como página completa. */
  fillPage: boolean;
  /**
   * Ancho de la imagen en el flujo, en % del ancho de la caja de texto (25–100).
   * El alto se deduce de la proporción de la imagen. Ignorado si fillPage = true.
   */
  widthPercent: number;
  /** Solo con fillPage: la imagen llega hasta el borde de la hoja (ignora márgenes). */
  bleed: boolean;
}

/** Anchos ofrecidos en el inspector. */
export const IMAGE_WIDTH_PERCENT_OPTIONS = [100, 75, 50, 33] as const;
export const DEFAULT_IMAGE_WIDTH_PERCENT = 100;

export function clampImageWidthPercent(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : DEFAULT_IMAGE_WIDTH_PERCENT;
  return Math.min(100, Math.max(25, Math.round(n)));
}

export const EMPTY_IMAGE_BLOCK_CONTENT: ImageBlockContent = {
  assetId: null,
  altText: '',
  caption: '',
  fillPage: false,
  widthPercent: DEFAULT_IMAGE_WIDTH_PERCENT,
  bleed: false,
};

export function parseImageBlockContent(contentJson: string | null): ImageBlockContent {
  if (!contentJson?.trim()) return { ...EMPTY_IMAGE_BLOCK_CONTENT };
  try {
    const raw = JSON.parse(contentJson) as unknown;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { ...EMPTY_IMAGE_BLOCK_CONTENT };
    }
    const o = raw as Record<string, unknown>;
    const assetId = o.assetId != null && typeof o.assetId === 'string' ? o.assetId : null;
    const altText = typeof o.altText === 'string' ? o.altText : '';
    const caption = typeof o.caption === 'string' ? o.caption : '';
    const fillPage = o.fillPage === true;
    const widthPercent = clampImageWidthPercent(o.widthPercent);
    const bleed = o.bleed === true;
    return { assetId, altText, caption, fillPage, widthPercent, bleed };
  } catch {
    return { ...EMPTY_IMAGE_BLOCK_CONTENT };
  }
}

export function serializeImageBlockContent(c: ImageBlockContent): string | null {
  const has =
    (c.assetId != null && c.assetId !== '')
    || c.altText.trim() !== ''
    || c.caption.trim() !== ''
    || c.fillPage
    || clampImageWidthPercent(c.widthPercent) !== DEFAULT_IMAGE_WIDTH_PERCENT
    || c.bleed === true;
  if (!has) return null;
  return JSON.stringify({
    assetId: c.assetId && c.assetId !== '' ? c.assetId : null,
    altText: c.altText,
    caption: c.caption,
    fillPage: c.fillPage,
    widthPercent: clampImageWidthPercent(c.widthPercent),
    bleed: c.fillPage && c.bleed === true,
  });
}
