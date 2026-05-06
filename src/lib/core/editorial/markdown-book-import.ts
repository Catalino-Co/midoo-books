/**
 * PARTE 6B — Segmentación de manuscrito Markdown por `#` y conversión a borradores
 * de sección + bloques. Reutiliza `parseMarkdownToBlockDrafts` (6A) para el cuerpo.
 */

import type { SectionType } from '$lib/core/domain/section';
import type { BlockType } from '$lib/core/domain/block';
import {
  parseMarkdownToBlockDrafts,
  validateMarkdownForImport,
  type MarkdownBlockDraft,
} from './markdown-to-blocks';
import { inferSectionTypeFromTitle } from './section-title-heuristic';
import { blockTypeLabel } from './block-type-catalog';

/** Línea de título de sección: un solo `#` ATX, sin duplicar el título como bloque H1. */
const TOP_LEVEL_H1 = /^#\s+(?!#)\s*(.*)$/;

export interface MarkdownBookSectionDraft {
  title:         string;
  sectionType:   SectionType;
  bodyMarkdown:  string;
  blockDrafts:   MarkdownBlockDraft[];
}

export interface BookMarkdownImportPreviewSectionRow {
  title:        string;
  sectionType:  SectionType;
  blockCount:   number;
}

export interface BookMarkdownImportPreview {
  sectionCount: number;
  totalBlocks:  number;
  sections:     BookMarkdownImportPreviewSectionRow[];
  /** Tipos de bloque agregados en todo el manuscrito. */
  byType: Partial<Record<BlockType, number>>;
  /** Resumen legible para la cabecera del preview. */
  summaryLine: string;
}

/**
 * Divide el manuscrito en trozos: cada `# Título` abre sección; el cuerpo va hasta el siguiente `#`.
 * Texto antes del primer `#` se antepone al cuerpo de la primera sección (sin crear sección fantasma).
 */
export function segmentMarkdownBookByH1(source: string): { title: string; body: string }[] {
  const normalized = source.replace(/\r\n/g, '\n');
  const lines        = normalized.split('\n');

  type Acc = { title: string; bodyLines: string[] };
  const segments: Acc[] = [];
  const preamble: string[] = [];
  let currentTitle: string | null = null;
  let currentBody: string[] = [];

  function flushSection(): void {
    if (currentTitle === null) return;
    segments.push({ title: currentTitle, bodyLines: currentBody });
    currentBody = [];
  }

  for (const line of lines) {
    const m = line.match(TOP_LEVEL_H1);
    if (m) {
      flushSection();
      const heading = m[1].trim();
      currentTitle = heading.length > 0 ? heading : '(Sin título)';
    } else if (currentTitle === null) {
      preamble.push(line);
    } else {
      currentBody.push(line);
    }
  }
  flushSection();

  if (segments.length === 0) {
    return [];
  }

  if (preamble.length > 0) {
    const first = segments[0];
    segments[0] = {
      title:     first.title,
      bodyLines: [...preamble, ...first.bodyLines],
    };
  }

  return segments.map(s => ({
    title: s.title,
    body:  s.bodyLines.join('\n').replace(/\n+$/, ''),
  }));
}

export function validateMarkdownBookForImport(
  source: string,
): { ok: true } | { ok: false; message: string } {
  const base = validateMarkdownForImport(source);
  if (!base.ok) return base;

  const segments = segmentMarkdownBookByH1(source);
  if (segments.length === 0) {
    return {
      ok:      false,
      message:
        'No se encontró ninguna sección. Añade títulos con un solo `#` al inicio de línea (p. ej. `# Prólogo`, `# Capítulo 1`).',
    };
  }
  return { ok: true };
}

export function parseMarkdownBookToSectionDrafts(source: string): MarkdownBookSectionDraft[] {
  const segments = segmentMarkdownBookByH1(source);
  return segments.map(seg => {
    const sectionType = inferSectionTypeFromTitle(seg.title);
    const blockDrafts = parseMarkdownToBlockDrafts(seg.body);
    return {
      title:        seg.title.trim(),
      sectionType,
      bodyMarkdown: seg.body,
      blockDrafts,
    };
  });
}

function aggregateBlockTypes(drafts: MarkdownBookSectionDraft[]): Partial<Record<BlockType, number>> {
  const byType: Partial<Record<BlockType, number>> = {};
  for (const d of drafts) {
    for (const b of d.blockDrafts) {
      byType[b.blockType] = (byType[b.blockType] ?? 0) + 1;
    }
  }
  return byType;
}

function buildBookSummaryLine(
  sectionCount: number,
  totalBlocks: number,
  byType: Partial<Record<BlockType, number>>,
): string {
  const parts = [`${sectionCount} sección(es)`, `${totalBlocks} bloque(s)`];
  const ranked = Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([ty, n]) => `${n}× ${blockTypeLabel(ty as BlockType)}`);
  if (ranked.length) parts.push(ranked.join(', '));
  return parts.join(' · ');
}

export function buildMarkdownBookImportPreview(
  drafts: MarkdownBookSectionDraft[],
): BookMarkdownImportPreview {
  const sections = drafts.map(d => ({
    title:       d.title,
    sectionType: d.sectionType,
    blockCount:  d.blockDrafts.length,
  }));
  const totalBlocks = drafts.reduce((n, d) => n + d.blockDrafts.length, 0);
  const byType = aggregateBlockTypes(drafts);
  const summaryLine = buildBookSummaryLine(drafts.length, totalBlocks, byType);
  return {
    sectionCount: drafts.length,
    totalBlocks,
    sections,
    byType,
    summaryLine,
  };
}
