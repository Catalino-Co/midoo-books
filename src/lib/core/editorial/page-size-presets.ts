/**
 * PARTE 13 — Presets reutilizables de tamaño de página (trim size editorial).
 * Dimensiones canónicas en mm; la unidad del documento puede cambiarse en UI.
 */

import type { PageSizePresetId, PageUnit } from '$lib/core/domain/layout';

export interface PageSizePresetDefinition {
  readonly id: Exclude<PageSizePresetId, 'CUSTOM'>;
  /** Etiqueta corta para selects y tooltips. */
  readonly label: string;
  readonly widthMm: number;
  readonly heightMm: number;
}

/** Carta US ≈ Letter. 6×9 in es formato trade típico en pulgadas. */
export const PAGE_SIZE_PRESETS: readonly PageSizePresetDefinition[] = [
  { id: 'A5',        label: 'A5 (148 × 210 mm)',           widthMm: 148, heightMm: 210 },
  { id: 'LETTER',    label: 'Carta / Letter (216 × 279 mm)', widthMm: 216, heightMm: 279 },
  { id: 'TRADE_6X9', label: 'Trade 6 × 9 in (152 × 229 mm)', widthMm: 152, heightMm: 229 },
  { id: 'A4',        label: 'A4 (210 × 297 mm)',           widthMm: 210, heightMm: 297 },
] as const;

const PRESET_BY_ID: Record<Exclude<PageSizePresetId, 'CUSTOM'>, PageSizePresetDefinition> = Object.fromEntries(
  PAGE_SIZE_PRESETS.map(p => [p.id, p]),
) as Record<Exclude<PageSizePresetId, 'CUSTOM'>, PageSizePresetDefinition>;

export function getPageSizePresetDefinition(
  id: Exclude<PageSizePresetId, 'CUSTOM'>,
): PageSizePresetDefinition {
  return PRESET_BY_ID[id];
}

/** Tolerancia al comparar medidas persistidas con un preset (mm). */
const MATCH_EPS_MM = 1.25;

function toMm(value: number, unit: PageUnit): number {
  switch (unit) {
    case 'mm': return value;
    case 'in': return value * 25.4;
    case 'pt': return value * (25.4 / 72);
    case 'px': return value * (25.4 / 96);
    default: return value;
  }
}

/**
 * Detecta qué preset encaja con el tamaño actual, o CUSTOM.
 */
export function detectPageSizePreset(
  pageWidth: number,
  pageHeight: number,
  pageUnit: PageUnit,
): PageSizePresetId {
  const w = toMm(pageWidth, pageUnit);
  const h = toMm(pageHeight, pageUnit);
  for (const p of PAGE_SIZE_PRESETS) {
    if (Math.abs(w - p.widthMm) <= MATCH_EPS_MM && Math.abs(h - p.heightMm) <= MATCH_EPS_MM) {
      return p.id;
    }
  }
  return 'CUSTOM';
}
