/**
 * page-decoration.ts — fondo de página del libro y ajustes visuales por sección.
 *
 * Fondo (LayoutSettings.pageBackgroundJson):
 *   - none   → página blanca (por defecto).
 *   - paper  → color de papel liso.
 *   - grid   → papel con cuadrícula muy tenue (como el devocional de referencia).
 *   - image  → una imagen del libro (textura escaneada, acuarela…) a sangre.
 * Se dibuja detrás de todo, a sangre, en vista previa y PDF. No afecta a la
 * paginación. En EPUB no se exporta (los lectores de ebook ignoran fondos de página).
 *
 * Por sección (DocumentSection.settingsJson):
 *   - pageBackground: 'none' → esa sección no lleva el fondo del libro.
 *   - textTone: 'light'      → texto claro (para portadas o páginas sobre imagen oscura).
 */

import type { DocumentSection } from '$lib/core/domain/section';

export const PAGE_BACKGROUND_KINDS = ['none', 'paper', 'grid', 'image'] as const;
export type PageBackgroundKind = (typeof PAGE_BACKGROUND_KINDS)[number];

export interface PageBackgroundConfig {
  kind: PageBackgroundKind;
  /** Color del papel (paper / grid) en hex. */
  color: string;
  /** Asset de imagen (kind = image). */
  assetId: string | null;
  /** Opacidad de la imagen o de la cuadrícula (0,05–1). */
  opacity: number;
  /** No dibujar el fondo bajo composiciones a página completa (aperturas, imágenes a sangre). */
  skipFullPage: boolean;
}

export const DEFAULT_PAGE_BACKGROUND: PageBackgroundConfig = {
  kind: 'none',
  color: '#F6F1E7',
  assetId: null,
  opacity: 1,
  skipFullPage: true,
};

const HEX = /^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/;

function parseObject(json: string | null | undefined): Record<string, unknown> {
  if (!json?.trim()) return {};
  try {
    const o = JSON.parse(json) as unknown;
    return o && typeof o === 'object' && !Array.isArray(o) ? { ...(o as Record<string, unknown>) } : {};
  } catch {
    return {};
  }
}

export function parsePageBackground(json: string | null | undefined): PageBackgroundConfig {
  const o = parseObject(json);
  const kind = typeof o.kind === 'string' && (PAGE_BACKGROUND_KINDS as readonly string[]).includes(o.kind)
    ? o.kind as PageBackgroundKind
    : DEFAULT_PAGE_BACKGROUND.kind;
  const opacity = typeof o.opacity === 'number' && Number.isFinite(o.opacity)
    ? Math.min(1, Math.max(0.05, o.opacity))
    : DEFAULT_PAGE_BACKGROUND.opacity;
  return {
    kind,
    color: typeof o.color === 'string' && HEX.test(o.color.trim()) ? o.color.trim() : DEFAULT_PAGE_BACKGROUND.color,
    assetId: typeof o.assetId === 'string' && o.assetId.trim() ? o.assetId.trim() : null,
    opacity,
    skipFullPage: typeof o.skipFullPage === 'boolean' ? o.skipFullPage : DEFAULT_PAGE_BACKGROUND.skipFullPage,
  };
}

export function serializePageBackground(c: PageBackgroundConfig): string | null {
  if (c.kind === 'none') return null;
  return JSON.stringify({
    kind: c.kind,
    color: c.color,
    assetId: c.kind === 'image' ? c.assetId : null,
    opacity: c.opacity,
    skipFullPage: c.skipFullPage,
  });
}

export function pageBackgroundKindLabel(k: PageBackgroundKind): string {
  switch (k) {
    case 'none':  return 'Sin fondo (blanco)';
    case 'paper': return 'Color de papel';
    case 'grid':  return 'Papel con cuadrícula tenue';
    case 'image': return 'Imagen o textura del libro';
  }
}

/**
 * SVG de la cuadrícula (vectorial: en el PDF pesa unos bytes y no se pixela).
 * Medidas en mm; cubre la hoja más el sangrado.
 */
export function gridBackgroundSvg(widthMm: number, heightMm: number, opacity: number): string {
  const step = 5;
  const lineOpacity = (0.16 * opacity).toFixed(3);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${widthMm.toFixed(2)} ${heightMm.toFixed(2)}" `
    + 'preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;display:block" aria-hidden="true">'
    + `<defs><pattern id="midoo-grid" width="${step}" height="${step}" patternUnits="userSpaceOnUse">`
    + `<path d="M ${step} 0 L 0 0 0 ${step}" fill="none" stroke="#6b5a3e" stroke-opacity="${lineOpacity}" stroke-width="0.12"/>`
    + '</pattern></defs>'
    + '<rect width="100%" height="100%" fill="url(#midoo-grid)"/></svg>';
}

// ─── Ajustes por sección ────────────────────────────────────────────────────

export type SectionBackgroundMode = 'inherit' | 'none';
export type SectionTextTone = 'default' | 'light';

export interface SectionDecoration {
  background: SectionBackgroundMode;
  textTone: SectionTextTone;
}

export function parseSectionDecoration(
  section: Pick<DocumentSection, 'settingsJson'> | null | undefined,
): SectionDecoration {
  const o = parseObject(section?.settingsJson);
  return {
    background: o.pageBackground === 'none' ? 'none' : 'inherit',
    textTone: o.textTone === 'light' ? 'light' : 'default',
  };
}

/** Escribe los ajustes visuales en settingsJson sin perder otras claves. */
export function mergeSectionDecoration(settingsJson: string | null | undefined, d: SectionDecoration): string | null {
  const root = parseObject(settingsJson);
  if (d.background === 'none') root.pageBackground = 'none';
  else delete root.pageBackground;
  if (d.textTone === 'light') root.textTone = 'light';
  else delete root.textTone;
  return Object.keys(root).length ? JSON.stringify(root) : null;
}
