/**
 * block-render-css.ts
 *
 * CSS compartido entre el MEDIDOR de texto (paginación) y el RENDER de páginas
 * (vista previa y PDF). Si ambos no usan exactamente las mismas reglas, los cortes
 * de línea cambian y aparecen páginas medio vacías o texto que desborda el pie.
 *
 * Regla: cualquier propiedad que afecte a la altura de un bloque de texto debe
 * vivir aquí y en ningún otro sitio.
 *
 * TypeScript puro (sin DOM): devuelve cadenas `prop:valor;…` para `style=""` o `cssText`.
 */

import type { DocumentBlock } from '$lib/core/domain/block';
import type { LayoutSettings } from '$lib/core/domain/layout';
import { buildBookStyleCss, type BookStyleDefinition } from './book-styles';

/** Fuente por defecto del libro si LayoutSettings.bodyFontFamily está vacío. */
export const DEFAULT_BOOK_FONT_STACK = "Georgia, 'Times New Roman', serif";

/** El alto del bloque SEPARATOR depende del ornamento: ver separatorHeightPx() en separator-content.ts. */

/** Margen vertical (pt) por encima y por debajo de una imagen en el flujo. */
export const IMAGE_BLOCK_MARGIN_PT = 6;

/** Estilo del pie de imagen (figcaption). */
export const IMAGE_CAPTION_FONT_PT = 8.5;
export const IMAGE_CAPTION_LINE_HEIGHT = 1.35;
export const IMAGE_CAPTION_GAP_PT = 4;

/** Familia tipográfica base del libro (la heredan los estilos con fontFamily = null). */
export function bookBaseFontFamily(settings: Pick<LayoutSettings, 'bodyFontFamily'>): string {
  const v = settings.bodyFontFamily?.trim();
  return v ? v : DEFAULT_BOOK_FONT_STACK;
}

/** Reglas base comunes a todos los bloques de texto (antes del estilo del rol). */
const TEXT_BASE_CSS = [
  'margin:0',
  'padding:0',
  'border:none',
  'box-sizing:border-box',
  'width:auto',
  'white-space:pre-wrap',
  'overflow-wrap:normal',
  'word-break:normal',
  // manual: solo parte en guiones blandos (U+00AD) insertados por hyphenation.ts.
  // Sin guionización activada el texto no los lleva y el efecto es el de «none».
  'hyphens:manual',
].join(';');

/** Reglas propias del tipo de bloque (padding, estilo) que afectan a la altura. */
function blockTypeCss(blockType: DocumentBlock['blockType'] | 'CAPTION'): string {
  switch (blockType) {
    case 'QUOTE':
      // padding en em → proporcional al font-size del rol (igual en medición y render)
      return 'padding:0.5em 0 0.5em 0.9em;border-left:3px solid rgba(0,0,0,0.18)';
    case 'CENTERED_PHRASE':
      return 'font-style:italic';
    default:
      return '';
  }
}

export interface TextBlockCssOptions {
  /** Fragmento que continúa un párrafo de la página anterior → sin margen superior. */
  continuedFromPreviousPage?: boolean;
  /** Fragmento que continúa en la página siguiente → sin margen inferior. */
  continuesOnNextPage?: boolean;
}

/**
 * CSS completo de un bloque de texto: base + tipo + estilo editorial resuelto.
 * Se usa tal cual en `style=""` del render y en `element.style.cssText` del medidor.
 */
export function textBlockCss(
  blockType: DocumentBlock['blockType'],
  style: BookStyleDefinition,
  options: TextBlockCssOptions = {},
): string {
  const effective: BookStyleDefinition = {
    ...style,
    marginTop:    options.continuedFromPreviousPage ? 0 : style.marginTop,
    marginBottom: options.continuesOnNextPage ? 0 : style.marginBottom,
  };
  return [TEXT_BASE_CSS, blockTypeCss(blockType), buildBookStyleCss(effective)]
    .filter(Boolean)
    .join(';');
}

/** CSS del pie de imagen (medición y render). */
export function imageCaptionCss(): string {
  return [
    TEXT_BASE_CSS,
    `font-size:${IMAGE_CAPTION_FONT_PT}pt`,
    `line-height:${IMAGE_CAPTION_LINE_HEIGHT}`,
    'text-align:center',
    'font-style:italic',
    `margin-top:${IMAGE_CAPTION_GAP_PT}pt`,
    'color:rgba(0,0,0,0.6)',
  ].join(';');
}

/** Etiqueta HTML semántica por tipo de bloque de texto. */
export function textBlockTag(blockType: DocumentBlock['blockType']): 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'blockquote' {
  switch (blockType) {
    case 'HEADING_1': return 'h1';
    case 'HEADING_2': return 'h2';
    case 'HEADING_3': return 'h3';
    case 'HEADING_4': return 'h4';
    case 'QUOTE':     return 'blockquote';
    default:          return 'p';
  }
}
