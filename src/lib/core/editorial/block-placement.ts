/**
 * block-placement.ts — dónde se coloca un bloque dentro de la página.
 *
 * «Anclar al pie de la página»: el bloque se dibuja pegado al final de la caja de
 * texto (p. ej. la referencia bíblica al pie de cada día de un devocional, o el lema
 * de una portada). Lo que venga después empieza en la página siguiente.
 *
 * Se guarda en `DocumentBlock.metadataJson` bajo la clave `placement`, sin tocar
 * la clave `layout` (alineación, ancho, énfasis).
 */

import type { BlockType, DocumentBlock } from '$lib/core/domain/block';

export type BlockAnchor = 'flow' | 'bottom';

const PLACEMENT_KEY = 'placement';

function parseRoot(metadataJson: string | null | undefined): Record<string, unknown> {
  if (!metadataJson?.trim()) return {};
  try {
    const p = JSON.parse(metadataJson) as unknown;
    return p && typeof p === 'object' && !Array.isArray(p) ? { ...(p as Record<string, unknown>) } : {};
  } catch {
    return {};
  }
}

/** Tipos que se pueden anclar: bloques que no se parten y no ocupan la página entera. */
export function blockSupportsAnchor(type: BlockType): boolean {
  switch (type) {
    case 'HEADING_1': case 'HEADING_2': case 'HEADING_3': case 'HEADING_4':
    case 'QUOTE': case 'CENTERED_PHRASE': case 'PARAGRAPH':
    case 'IMAGE': case 'SEPARATOR': case 'BADGE': case 'VERSE':
      return true;
    default:
      return false;
  }
}

export function parseBlockAnchor(metadataJson: string | null | undefined): BlockAnchor {
  const placement = parseRoot(metadataJson)[PLACEMENT_KEY];
  if (placement && typeof placement === 'object' && !Array.isArray(placement)) {
    return (placement as Record<string, unknown>).anchor === 'bottom' ? 'bottom' : 'flow';
  }
  return 'flow';
}

/** ¿El bloque va anclado al pie? (solo tipos que lo admiten). */
export function isBlockAnchoredBottom(block: Pick<DocumentBlock, 'blockType' | 'metadataJson'>): boolean {
  return blockSupportsAnchor(block.blockType) && parseBlockAnchor(block.metadataJson) === 'bottom';
}

/** Guarda el anclaje preservando el resto de claves del metadata. */
export function mergeAnchorIntoMetadata(metadataJson: string | null | undefined, anchor: BlockAnchor): string | null {
  const root = parseRoot(metadataJson);
  if (anchor === 'bottom') root[PLACEMENT_KEY] = { anchor: 'bottom' };
  else delete root[PLACEMENT_KEY];
  return Object.keys(root).length ? JSON.stringify(root) : null;
}
