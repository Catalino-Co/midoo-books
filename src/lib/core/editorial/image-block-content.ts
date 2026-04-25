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
}

export const EMPTY_IMAGE_BLOCK_CONTENT: ImageBlockContent = {
  assetId: null,
  altText: '',
  caption: '',
  fillPage: false,
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
    return { assetId, altText, caption, fillPage };
  } catch {
    return { ...EMPTY_IMAGE_BLOCK_CONTENT };
  }
}

export function serializeImageBlockContent(c: ImageBlockContent): string | null {
  const has =
    (c.assetId != null && c.assetId !== '')
    || c.altText.trim() !== ''
    || c.caption.trim() !== ''
    || c.fillPage;
  if (!has) return null;
  return JSON.stringify({
    assetId: c.assetId && c.assetId !== '' ? c.assetId : null,
    altText: c.altText,
    caption: c.caption,
    fillPage: c.fillPage,
  });
}
