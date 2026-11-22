/**
 * hyphenation.ts — guionización del español con guiones blandos (U+00AD).
 *
 * Se inserta en el texto ANTES de medir y pintar, así la partición es idéntica en
 * Windows, macOS y Linux (la guionización nativa del navegador depende del sistema y
 * en Electron no está disponible en todas las plataformas). El CSS usa
 * `hyphens: manual`, que solo parte por los guiones blandos insertados aquí.
 *
 * Patrones: paquete `hyphen` (ISC), derivados de hyph-utf8 para español.
 */

import hyphenEs from 'hyphen/es';
import type { DocumentBlock } from '$lib/core/domain/block';

export const SOFT_HYPHEN = '­';

/** Palabras de menos letras no se parten (evita cortes feos tipo «ca-sa»). */
const MIN_WORD_LENGTH = 6;

/** Bloques de texto corrido que se guionizan (los títulos nunca). */
const HYPHENATED_BLOCK_TYPES = new Set<DocumentBlock['blockType']>(['PARAGRAPH', 'QUOTE', 'CENTERED_PHRASE']);

export function hyphenateSpanish(text: string): string {
  if (!text) return text;
  return hyphenEs.hyphenateSync(text, { minWordLength: MIN_WORD_LENGTH });
}

export function stripSoftHyphens(text: string): string {
  return text.split(SOFT_HYPHEN).join('');
}

/** Devuelve una copia del bloque con el texto guionizado (o el mismo si no aplica). */
export function hyphenateBlock(block: DocumentBlock): DocumentBlock {
  if (!HYPHENATED_BLOCK_TYPES.has(block.blockType) || !block.contentText) return block;
  return { ...block, contentText: hyphenateSpanish(block.contentText) };
}

/**
 * Si un fragmento de párrafo termina en guion blando (la página se cortó en mitad de
 * una palabra), el navegador no lo dibujaría al ser fin de párrafo: se cambia por un
 * guion visible.
 */
export function materializeTrailingSoftHyphen(fragment: string): string {
  return fragment.endsWith(SOFT_HYPHEN) ? `${fragment.slice(0, -1)}-` : fragment;
}
