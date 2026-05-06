/**
 * PARTE 7 — Estilo editorial básico por bloque (alineación, ancho, énfasis).
 * Los valores persisten en `DocumentBlock.metadataJson` bajo la clave `layout`.
 */

import type { BlockType, BlockStyleVariant } from '$lib/core/domain/block';
import type { DocumentBlock } from '$lib/core/domain/block';

export type BlockTextAlign = 'left' | 'center' | 'right' | 'justify';

export type BlockWidthMode = 'full' | 'narrow' | 'medium';

export type BlockEmphasis = 'normal' | 'muted' | 'strong';

/** Layout resuelto (siempre definido) tras aplicar defaults + metadata. */
export interface BlockLayoutStyle {
  textAlign: BlockTextAlign;
  widthMode: BlockWidthMode;
  emphasis:  BlockEmphasis;
}

const LAYOUT_KEY = 'layout';

function isTextAlign(v: unknown): v is BlockTextAlign {
  return v === 'left' || v === 'center' || v === 'right' || v === 'justify';
}

function isWidthMode(v: unknown): v is BlockWidthMode {
  return v === 'full' || v === 'narrow' || v === 'medium';
}

function isEmphasis(v: unknown): v is BlockEmphasis {
  return v === 'normal' || v === 'muted' || v === 'strong';
}

/** Extrae solo claves de layout válidas desde metadata JSON. */
export function parseLayoutFromMetadata(metadataJson: string | null): Partial<BlockLayoutStyle> {
  if (!metadataJson?.trim()) return {};
  try {
    const root = JSON.parse(metadataJson) as unknown;
    if (!root || typeof root !== 'object' || Array.isArray(root)) return {};
    const layout = (root as Record<string, unknown>)[LAYOUT_KEY];
    if (!layout || typeof layout !== 'object' || Array.isArray(layout)) return {};
    const L = layout as Record<string, unknown>;
    const out: Partial<BlockLayoutStyle> = {};
    if (isTextAlign(L.textAlign)) out.textAlign = L.textAlign;
    if (isWidthMode(L.widthMode)) out.widthMode = L.widthMode;
    if (isEmphasis(L.emphasis)) out.emphasis = L.emphasis;
    return out;
  } catch {
    return {};
  }
}

function typeLayoutDefaults(blockType: BlockType): BlockLayoutStyle {
  switch (blockType) {
    case 'PARAGRAPH':
      return { textAlign: 'justify', widthMode: 'full', emphasis: 'normal' };
    case 'HEADING_1':
      return { textAlign: 'left', widthMode: 'full', emphasis: 'strong' };
    case 'HEADING_2':
      return { textAlign: 'left', widthMode: 'full', emphasis: 'normal' };
    case 'HEADING_3':
      return { textAlign: 'left', widthMode: 'full', emphasis: 'normal' };
    case 'HEADING_4':
      return { textAlign: 'left', widthMode: 'full', emphasis: 'normal' };
    case 'QUOTE':
      return { textAlign: 'left', widthMode: 'medium', emphasis: 'normal' };
    case 'CENTERED_PHRASE':
      return { textAlign: 'center', widthMode: 'narrow', emphasis: 'normal' };
    case 'IMAGE':
    case 'CHAPTER_OPENING':
    case 'SEPARATOR':
    case 'PAGE_BREAK':
    default:
      return { textAlign: 'left', widthMode: 'full', emphasis: 'normal' };
  }
}

function variantLayoutOverlay(variant: BlockStyleVariant): Partial<BlockLayoutStyle> {
  switch (variant) {
    case 'dedication':
      return { textAlign: 'center', widthMode: 'narrow', emphasis: 'normal' };
    case 'toc_entry':
      return { textAlign: 'left', widthMode: 'full', emphasis: 'normal' };
    case 'rights':
      return { textAlign: 'left', widthMode: 'full', emphasis: 'muted' };
    case 'author_note':
      return { textAlign: 'justify', widthMode: 'medium', emphasis: 'normal' };
    case 'quote_large':
      return { textAlign: 'left', widthMode: 'medium', emphasis: 'strong' };
    case 'lead':
      return { textAlign: 'justify', widthMode: 'medium', emphasis: 'normal' };
    case 'pull_quote':
      return { textAlign: 'center', widthMode: 'medium', emphasis: 'strong' };
    default:
      return {};
  }
}

/** Defaults editoriales v1: tipo de bloque + variante (la variante sobrescribe donde aplique). */
export function defaultBlockLayout(blockType: BlockType, styleVariant: BlockStyleVariant): BlockLayoutStyle {
  const t = typeLayoutDefaults(blockType);
  const o = variantLayoutOverlay(styleVariant);
  return {
    textAlign: o.textAlign ?? t.textAlign,
    widthMode: o.widthMode ?? t.widthMode,
    emphasis:  o.emphasis  ?? t.emphasis,
  };
}

/** Layout efectivo para mostrar/editar: metadata explícita + defaults. */
export function resolveBlockLayout(block: DocumentBlock): BlockLayoutStyle {
  const stored = parseLayoutFromMetadata(block.metadataJson);
  const base   = defaultBlockLayout(block.blockType, block.styleVariant);
  return {
    textAlign: stored.textAlign ?? base.textAlign,
    widthMode: stored.widthMode ?? base.widthMode,
    emphasis:  stored.emphasis  ?? base.emphasis,
  };
}

/**
 * Devuelve solo las propiedades de layout que realmente modifican el comportamiento
 * base del tipo de bloque. Sirve para combinar overlays locales sobre estilos globales
 * sin arrastrar los defaults genéricos del blockType cuando no hacen falta.
 */
export function resolveBlockLayoutOverrides(block: DocumentBlock): Partial<BlockLayoutStyle> {
  const neutral = defaultBlockLayout(block.blockType, 'default');
  const effective = resolveBlockLayout(block);
  return {
    textAlign: effective.textAlign !== neutral.textAlign ? effective.textAlign : undefined,
    widthMode: effective.widthMode !== neutral.widthMode ? effective.widthMode : undefined,
    emphasis: effective.emphasis !== neutral.emphasis ? effective.emphasis : undefined,
  };
}

/**
 * Serializa layout en metadata preservando otras claves del objeto JSON.
 */
export function mergeLayoutIntoMetadata(
  existingMetadataJson: string | null,
  layout: BlockLayoutStyle,
): string {
  let root: Record<string, unknown> = {};
  if (existingMetadataJson?.trim()) {
    try {
      const p = JSON.parse(existingMetadataJson) as unknown;
      if (p && typeof p === 'object' && !Array.isArray(p)) root = { ...(p as Record<string, unknown>) };
    } catch {
      root = {};
    }
  }
  root[LAYOUT_KEY] = {
    textAlign: layout.textAlign,
    widthMode: layout.widthMode,
    emphasis:  layout.emphasis,
  };
  return JSON.stringify(root);
}

/** Clases CSS para lista central / preview (sin lógica en plantilla). */
export function blockLayoutPreviewClassNames(block: DocumentBlock): string {
  const L = resolveBlockLayout(block);
  const v = block.styleVariant.replace(/_/g, '-');
  return [
    `block-preview--ta-${L.textAlign}`,
    `block-preview--wm-${L.widthMode}`,
    `block-preview--em-${L.emphasis}`,
    `block-preview--var-${v}`,
  ].join(' ');
}

/** Clases para el contenedor del textarea en el inspector. */
export function blockLayoutEditorWrapClassNames(
  layout: BlockLayoutStyle,
  styleVariant: BlockStyleVariant,
): string {
  const v = styleVariant.replace(/_/g, '-');
  return [
    'insp-editor-visual',
    `insp-editor-visual--ta-${layout.textAlign}`,
    `insp-editor-visual--wm-${layout.widthMode}`,
    `insp-editor-visual--em-${layout.emphasis}`,
    `insp-editor-visual--var-${v}`,
  ].join(' ');
}

export const BLOCK_TEXT_ALIGN_OPTIONS: BlockTextAlign[] = ['left', 'center', 'right', 'justify'];

export const BLOCK_WIDTH_MODE_OPTIONS: BlockWidthMode[] = ['full', 'medium', 'narrow'];

export const BLOCK_EMPHASIS_OPTIONS: BlockEmphasis[] = ['normal', 'muted', 'strong'];

export function textAlignLabel(a: BlockTextAlign): string {
  const map: Record<BlockTextAlign, string> = {
    left:    'Izquierda',
    center:  'Centrado',
    right:   'Derecha',
    justify: 'Justificado',
  };
  return map[a];
}

export function widthModeLabel(w: BlockWidthMode): string {
  const map: Record<BlockWidthMode, string> = {
    full:   'Ancho completo',
    medium: 'Medio',
    narrow: 'Estrecho',
  };
  return map[w];
}

export function emphasisLabel(e: BlockEmphasis): string {
  const map: Record<BlockEmphasis, string> = {
    normal: 'Normal',
    muted:  'Suave',
    strong: 'Enfatizado',
  };
  return map[e];
}
