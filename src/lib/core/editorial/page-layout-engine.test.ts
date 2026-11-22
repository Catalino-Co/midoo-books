import { describe, expect, it } from 'vitest';
import { buildPaginatedLayout } from './page-layout-engine';
import { computeLayoutEngineMetricsForPreviewWidth, CSS_PX_PER_MM, getEngineContentBoxMm } from './document-layout-metrics';
import { DEFAULT_LAYOUT_SETTINGS, type LayoutSettings } from '$lib/core/domain/layout';
import type { DocumentBlock } from '$lib/core/domain/block';
import type { DocumentSection } from '$lib/core/domain/section';
import type { BookLayoutSnapshot } from './page-layout-model';

/** Formato de los PDF de referencia del autor: 384 × 600 pt = 135,5 × 211,7 mm. */
function settings(overrides: Partial<LayoutSettings> = {}): LayoutSettings {
  return {
    ...DEFAULT_LAYOUT_SETTINGS,
    id: 'ls-1' as LayoutSettings['id'],
    bookId: 'book-1',
    pageWidth: 135.5,
    pageHeight: 211.7,
    pageUnit: 'mm',
    marginTop: 16,
    marginBottom: 18,
    marginInside: 16,
    marginOutside: 13,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

let seq = 0;
function block(sectionId: string, blockType: DocumentBlock['blockType'], extra: Partial<DocumentBlock> = {}): DocumentBlock {
  seq++;
  return {
    id: `b-${seq}` as DocumentBlock['id'],
    sectionId,
    blockType,
    orderIndex: seq,
    contentText: '',
    contentJson: null,
    styleVariant: 'default' as DocumentBlock['styleVariant'],
    includeInToc: false,
    keepTogether: false,
    pageBreakBefore: false,
    pageBreakAfter: false,
    metadataJson: null,
    createdAt: '',
    updatedAt: '',
    ...extra,
  };
}

function chapter(id = 's-1'): DocumentSection {
  return {
    id: id as DocumentSection['id'],
    bookId: 'book-1',
    sectionType: 'CHAPTER',
    title: 'Capítulo 1',
    orderIndex: 0,
    includeInToc: true,
    startOnRightPage: false,
    settingsJson: null,
    createdAt: '',
    updatedAt: '',
  };
}

function snapshot(blocks: DocumentBlock[], s = settings(), dims: BookLayoutSnapshot['assetDimensionsById'] = {}): BookLayoutSnapshot {
  return {
    bookId: 'book-1',
    bookTitle: 'Prueba',
    layoutSettings: s,
    sections: [chapter()],
    blocksBySectionId: { 's-1': blocks },
    assetDimensionsById: dims,
  };
}

/** Métricas como en el navegador: 1 unidad = 1 px CSS. */
function browserMetrics(s: LayoutSettings) {
  return computeLayoutEngineMetricsForPreviewWidth(s, s.pageWidth * CSS_PX_PER_MM);
}

describe('geometría del motor', () => {
  it('la caja de texto es la hoja menos los márgenes (sin rellenos de preview)', () => {
    const box = getEngineContentBoxMm(settings());
    expect(box.contentWidthMm).toBeCloseTo(135.5 - 16 - 13, 5);
    expect(box.contentHeightMm).toBeCloseTo(211.7 - 16 - 18, 5);
  });

  it('en modo navegador 1 unidad = 1 px CSS (96 dpi)', () => {
    const m = browserMetrics(settings());
    expect(m.unitsPerMm).toBeCloseTo(96 / 25.4, 6);
    expect(m.pageBodyHeightUnits).toBe(Math.floor((211.7 - 34) * 96 / 25.4));
  });
});

describe('imágenes en el flujo', () => {
  const s = settings();
  const colMm = 135.5 - 16 - 13;

  it('ancho = % de la columna y alto según la proporción del asset', () => {
    const b = block('s-1', 'IMAGE', { contentJson: JSON.stringify({ assetId: 'a1', widthPercent: 50 }) });
    const r = buildPaginatedLayout(snapshot([b], s, { a1: { widthPx: 800, heightPx: 600 } }), {
      engineMetrics: browserMetrics(s),
    });
    const pl = r.pages[0].placements[0];
    expect(pl.imageBox?.widthMm).toBeCloseTo(colMm * 0.5, 4);
    expect(pl.imageBox?.heightMm).toBeCloseTo(colMm * 0.5 * 0.75, 4);
  });

  it('una imagen más alta que la página se reduce para caber', () => {
    const b = block('s-1', 'IMAGE', { contentJson: JSON.stringify({ assetId: 'tall' }) });
    const m = browserMetrics(s);
    const r = buildPaginatedLayout(snapshot([b], s, { tall: { widthPx: 500, heightPx: 2000 } }), { engineMetrics: m });
    const box = r.pages[0].placements[0].imageBox!;
    expect(box.heightMm * m.unitsPerMm!).toBeLessThanOrEqual(m.pageBodyHeightUnits);
    // Conserva la proporción 1:4
    expect(box.heightMm / box.widthMm).toBeCloseTo(4, 4);
  });

  it('sin dimensiones conocidas asume 4:3', () => {
    const b = block('s-1', 'IMAGE', { contentJson: JSON.stringify({ assetId: 'unknown' }) });
    const r = buildPaginatedLayout(snapshot([b], s), { engineMetrics: browserMetrics(s) });
    const box = r.pages[0].placements[0].imageBox!;
    expect(box.heightMm / box.widthMm).toBeCloseTo(0.75, 4);
  });

  it('la suma de alturas colocadas nunca supera el cuerpo de la página', () => {
    const m = browserMetrics(s);
    const text = 'Palabra '.repeat(60);
    const blocks = [
      block('s-1', 'HEADING_1', { contentText: 'Capítulo 01' }),
      block('s-1', 'IMAGE', { contentJson: JSON.stringify({ assetId: 'w' }) }),
      ...Array.from({ length: 6 }, () => block('s-1', 'PARAGRAPH', { contentText: text })),
      block('s-1', 'IMAGE', { contentJson: JSON.stringify({ assetId: 'p', caption: 'Pie de imagen' }) }),
      ...Array.from({ length: 6 }, () => block('s-1', 'PARAGRAPH', { contentText: text })),
    ];
    const r = buildPaginatedLayout(
      snapshot(blocks, s, { w: { widthPx: 1600, heightPx: 900 }, p: { widthPx: 690, heightPx: 1076 } }),
      { engineMetrics: m },
    );
    for (const p of r.pages) {
      expect(p.layoutMeta.usedContentUnits).toBeLessThanOrEqual(m.pageBodyHeightUnits + 3);
    }
  });
});
