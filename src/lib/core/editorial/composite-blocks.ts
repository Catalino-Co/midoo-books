/**
 * composite-blocks.ts — bloques «Etiqueta» (BADGE) y «Cita bíblica» (VERSE).
 *
 * Son bloques con varias piezas (marco, texto, referencia, filetes). Para que la
 * vista previa, el PDF y la paginación coincidan, su HTML sale de UNA función:
 *   - BookPage.svelte lo pinta con {@html …} dentro del envoltorio flow-root;
 *   - el medidor (BrowserPreviewTextMeasurer.measureHtml) mide ese mismo HTML.
 * Todo el CSS va en línea: no depende de hojas de estilo del componente.
 *
 * Etiqueta: «Día {n}» se numera sola (1, 2, 3…) en el orden del libro; ver
 * applyBadgeNumbering(). Formas: placa (hexágono con doble filete), píldora,
 * recuadro, subrayado o sin marco.
 *
 * Cita bíblica: texto del versículo (opcional) + referencia, con filetes y adorno
 * arriba y abajo. Suele ir «anclada al pie de la página» (block-placement.ts).
 */

import type { DocumentBlock } from '$lib/core/domain/block';
import type { DocumentSection } from '$lib/core/domain/section';
import type { BookStyleDefinition, BookStyleMap } from './book-styles';
import { buildBookStyleCss } from './book-styles';
import { textBaseCss, textBlockCss } from './block-render-css';

// ─── Etiqueta ────────────────────────────────────────────────────────────────

export const BADGE_SHAPES = ['plaque', 'pill', 'box', 'underline', 'none'] as const;
export type BadgeShape = (typeof BADGE_SHAPES)[number];

export interface BadgeBlockContent {
  shape: BadgeShape;
  /** Relleno del marco (hex). */
  fill: string;
  /** Color del filete (hex). */
  stroke: string;
}

export const DEFAULT_BADGE_CONTENT: BadgeBlockContent = {
  shape: 'plaque',
  fill: '#F3E3B5',
  stroke: '#4A3524',
};

const HEX = /^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/;

function pickHex(v: unknown, fallback: string): string {
  return typeof v === 'string' && HEX.test(v.trim()) ? v.trim() : fallback;
}

function parseObject(json: string | null | undefined): Record<string, unknown> {
  if (!json?.trim()) return {};
  try {
    const o = JSON.parse(json) as unknown;
    return o && typeof o === 'object' && !Array.isArray(o) ? o as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export function parseBadgeContent(json: string | null | undefined): BadgeBlockContent {
  const o = parseObject(json);
  return {
    shape: typeof o.shape === 'string' && (BADGE_SHAPES as readonly string[]).includes(o.shape)
      ? o.shape as BadgeShape
      : DEFAULT_BADGE_CONTENT.shape,
    fill:   pickHex(o.fill, DEFAULT_BADGE_CONTENT.fill),
    stroke: pickHex(o.stroke, DEFAULT_BADGE_CONTENT.stroke),
  };
}

export function serializeBadgeContent(c: BadgeBlockContent): string {
  return JSON.stringify({ shape: c.shape, fill: c.fill, stroke: c.stroke });
}

export function badgeShapeLabel(s: BadgeShape): string {
  switch (s) {
    case 'plaque':    return 'Placa con doble filete';
    case 'pill':      return 'Píldora';
    case 'box':       return 'Recuadro';
    case 'underline': return 'Subrayado';
    case 'none':      return 'Sin marco';
  }
}

/** Marcador de numeración automática dentro del texto de una etiqueta. */
export const BADGE_COUNTER_TOKEN = '{n}';

export function badgeTextWithNumber(text: string, n: number): string {
  return text.split(BADGE_COUNTER_TOKEN).join(String(n));
}

/**
 * Devuelve una copia de los bloques con «{n}» sustituido en las etiquetas, numeradas
 * en el orden de lectura (secciones por orderIndex, bloques por orderIndex).
 */
export function applyBadgeNumbering(
  sections: Pick<DocumentSection, 'id' | 'orderIndex'>[],
  blocksBySectionId: Record<string, DocumentBlock[]>,
): Record<string, DocumentBlock[]> {
  const ordered = [...sections].sort((a, b) => a.orderIndex - b.orderIndex);
  const out: Record<string, DocumentBlock[]> = { ...blocksBySectionId };
  let n = 0;
  for (const s of ordered) {
    const list = blocksBySectionId[s.id];
    if (!list) continue;
    const sorted = [...list].sort((a, b) => a.orderIndex - b.orderIndex);
    let changed = false;
    const mapped = sorted.map(b => {
      if (b.blockType !== 'BADGE' || !b.contentText.includes(BADGE_COUNTER_TOKEN)) return b;
      n += 1;
      changed = true;
      return { ...b, contentText: badgeTextWithNumber(b.contentText, n) };
    });
    if (changed) out[s.id] = mapped;
  }
  return out;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inlineMarginsFor(align: string): string {
  if (align === 'left') return 'margin-left:0;margin-right:auto';
  if (align === 'right') return 'margin-left:auto;margin-right:0';
  return 'margin-left:auto;margin-right:auto';
}

/** Hexágono alargado: puntas de `tip` a izquierda y derecha. */
function plaquePolygon(tip: string): string {
  return `polygon(0 50%,${tip} 0,calc(100% - ${tip}) 0,100% 50%,calc(100% - ${tip}) 100%,${tip} 100%)`;
}

function plaqueLayers(c: BadgeBlockContent): string {
  const tip = '0.8em';
  const layer = (insetPt: number, color: string, tipShrink: number) =>
    `<span aria-hidden="true" style="position:absolute;inset:${insetPt}pt;background:${color};`
    + `clip-path:${plaquePolygon(`calc(${tip} - ${tipShrink}pt)`)}"></span>`;
  return layer(0, c.stroke, 0)
    + layer(0.9, c.fill, 0.5)
    + layer(2.1, c.stroke, 1.1)
    + layer(2.7, c.fill, 1.4);
}

/**
 * HTML de una etiqueta. `style` es el estilo efectivo del rol BADGE (con la
 * alineación del bloque ya aplicada).
 */
export function badgeHtml(text: string, style: BookStyleDefinition, content: BadgeBlockContent): string {
  const shapeCss = (() => {
    switch (content.shape) {
      case 'plaque':    return 'padding:0.34em 1.9em';
      case 'pill':      return `padding:0.26em 1.3em;border:1.1pt solid ${content.stroke};border-radius:999px;background:${content.fill}`;
      case 'box':       return `padding:0.26em 1.1em;border:0.9pt solid ${content.stroke};background:${content.fill}`;
      case 'underline': return `padding:0 0.4em 0.12em;border-bottom:1.1pt solid ${content.stroke}`;
      case 'none':      return 'padding:0';
    }
  })();
  const css = [
    textBaseCss(),
    buildBookStyleCss({ ...style, maxWidth: null }),
    'display:block',
    'width:fit-content',
    'max-width:100%',
    inlineMarginsFor(style.textAlign),
    'position:relative',
    'box-sizing:border-box',
    shapeCss,
  ].join(';');
  const layers = content.shape === 'plaque' ? plaqueLayers(content) : '';
  return `<p data-badge="${content.shape}" style="${css}">${layers}`
    + `<span style="position:relative">${escapeHtml(text)}</span></p>`;
}

// ─── Cita bíblica ────────────────────────────────────────────────────────────

export const VERSE_FRAMES = ['ornament', 'rules', 'none'] as const;
export type VerseFrame = (typeof VERSE_FRAMES)[number];

export interface VerseBlockContent {
  reference: string;
  frame: VerseFrame;
}

export const DEFAULT_VERSE_CONTENT: VerseBlockContent = { reference: '', frame: 'ornament' };

export function parseVerseContent(json: string | null | undefined): VerseBlockContent {
  const o = parseObject(json);
  return {
    reference: typeof o.reference === 'string' ? o.reference : '',
    frame: typeof o.frame === 'string' && (VERSE_FRAMES as readonly string[]).includes(o.frame)
      ? o.frame as VerseFrame
      : DEFAULT_VERSE_CONTENT.frame,
  };
}

export function serializeVerseContent(c: VerseBlockContent): string {
  return JSON.stringify({ reference: c.reference, frame: c.frame });
}

export function verseFrameLabel(f: VerseFrame): string {
  switch (f) {
    case 'ornament': return 'Filetes con adorno';
    case 'rules':    return 'Filetes simples';
    case 'none':     return 'Sin filetes';
  }
}

/** Filete con un pequeño adorno central (trazado original de MIDOO). */
function verseRuleSvg(withMark: boolean): string {
  const mark = withMark
    ? '<g stroke-width="0.7">'
      + [0, 30, 60, 90, 120, 150].map(a => {
          const r = (a * Math.PI) / 180;
          const dx = (Math.cos(r) * 3).toFixed(2);
          const dy = (Math.sin(r) * 3).toFixed(2);
          return `<path d="M${(80 - +dx).toFixed(2)} ${(6 - +dy).toFixed(2)} L${(80 + +dx).toFixed(2)} ${(6 + +dy).toFixed(2)}"/>`;
        }).join('')
      + '</g><circle cx="80" cy="6" r="0.9" fill="currentColor" stroke="none"/>'
    : '';
  const line = withMark
    ? '<path d="M2 6 H72 M88 6 H158" stroke-width="0.5"/>'
    : '<path d="M2 6 H158" stroke-width="0.5"/>';
  return '<svg viewBox="0 0 160 12" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" '
    + 'fill="none" stroke="currentColor" stroke-linecap="round" preserveAspectRatio="xMidYMid meet" '
    + 'style="display:block;width:100%;max-width:46mm;height:3.4mm;margin:0 auto;opacity:0.75">'
    + line + mark + '</svg>';
}

/**
 * HTML de una cita bíblica. `textStyle` = rol VERSE_TEXT (con la alineación del
 * bloque); `referenceStyle` = rol VERSE_REFERENCE.
 */
export function verseHtml(
  text: string,
  content: VerseBlockContent,
  textStyle: BookStyleDefinition,
  referenceStyle: BookStyleDefinition,
): string {
  const parts: string[] = [];
  const frame = content.frame;
  const ruleWrap = (svg: string, where: 'top' | 'bottom') =>
    `<div style="margin:${where === 'top' ? '0 0 3pt' : '3pt 0 0'}">${svg}</div>`;
  if (frame !== 'none') parts.push(ruleWrap(verseRuleSvg(frame === 'ornament'), 'top'));
  if (text.trim()) {
    parts.push(`<p style="${textBlockCss('VERSE', textStyle)}">${escapeHtml(text)}</p>`);
  }
  if (content.reference.trim()) {
    const refStyle = { ...referenceStyle, textAlign: textStyle.textAlign };
    parts.push(`<p style="${textBlockCss('VERSE', refStyle)}">${escapeHtml(content.reference)}</p>`);
  }
  if (frame !== 'none') parts.push(ruleWrap(verseRuleSvg(frame === 'ornament'), 'bottom'));
  return `<div data-verse="${frame}" style="display:flow-root;margin:8pt 0">${parts.join('')}</div>`;
}

// ─── Entrada común (motor y render) ───────────────────────────────────────────

/** ¿El tipo de bloque se dibuja con HTML compuesto de este módulo? */
export function isCompositeBlockType(t: DocumentBlock['blockType']): boolean {
  return t === 'BADGE' || t === 'VERSE';
}

/**
 * HTML del bloque compuesto. `style` es el estilo efectivo del bloque (rol BADGE o
 * VERSE_TEXT con la alineación/énfasis del bloque); `styles` aporta VERSE_REFERENCE.
 */
export function compositeBlockHtml(
  block: Pick<DocumentBlock, 'blockType' | 'contentText' | 'contentJson'>,
  style: BookStyleDefinition,
  styles: BookStyleMap,
): string | null {
  if (block.blockType === 'BADGE') {
    return badgeHtml(block.contentText, style, parseBadgeContent(block.contentJson));
  }
  if (block.blockType === 'VERSE') {
    return verseHtml(block.contentText, parseVerseContent(block.contentJson), style, styles.VERSE_REFERENCE);
  }
  return null;
}
