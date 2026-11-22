import { describe, expect, it } from 'vitest';
import { hyphenateSpanish, materializeTrailingSoftHyphen, SOFT_HYPHEN, stripSoftHyphens } from './hyphenation';
import { formatFolio, furnitureTextAlign, parseFooterConfig, parseHeaderConfig, resolveHeaderSource } from './page-furniture';
import { parseSeparatorContent, separatorHeightPx, separatorOrnamentSvg, serializeSeparatorContent } from './separator-content';
import { parseChapterOpeningContent, serializeChapterOpeningContent, EMPTY_CHAPTER_OPENING_CONTENT } from './chapter-opening-content';
import { buildPaginatedLayout } from './page-layout-engine';
import { DEFAULT_LAYOUT_SETTINGS, type LayoutSettings } from '$lib/core/domain/layout';
import type { DocumentBlock } from '$lib/core/domain/block';
import type { DocumentSection } from '$lib/core/domain/section';

describe('guionización (español)', () => {
  it('inserta guiones blandos en sílabas válidas y respeta palabras cortas', () => {
    const out = hyphenateSpanish('El anaranjado del cielo profundo');
    expect(out).toContain(`ana${SOFT_HYPHEN}ran${SOFT_HYPHEN}ja${SOFT_HYPHEN}do`);
    expect(out.startsWith('El ')).toBe(true);
    expect(stripSoftHyphens(out)).toBe('El anaranjado del cielo profundo');
  });

  it('un fragmento cortado en guion blando muestra un guion visible', () => {
    expect(materializeTrailingSoftHyphen(`pro${SOFT_HYPHEN}`)).toBe('pro-');
    expect(materializeTrailingSoftHyphen('fin.')).toBe('fin.');
  });
});

describe('folio y cabecera', () => {
  it('formatea el folio con el estilo elegido', () => {
    expect(formatFolio('7', 'dashes')).toBe('— 7 —');
    expect(formatFolio('7', 'plain')).toBe('7');
  });

  it('cabecera alternada: libro en pares, capítulo en impares', () => {
    const cfg = parseHeaderConfig(JSON.stringify({ content: 'alternate' }));
    expect(resolveHeaderSource(cfg, 'left', 'Capítulo 1', 'Mi libro')).toBe('Mi libro');
    expect(resolveHeaderSource(cfg, 'right', 'Capítulo 1', 'Mi libro')).toBe('Capítulo 1');
  });

  it('posición exterior alinea a la izquierda en pares y a la derecha en impares', () => {
    expect(furnitureTextAlign('outside', 'left')).toBe('left');
    expect(furnitureTextAlign('outside', 'right')).toBe('right');
    expect(furnitureTextAlign('center', 'left')).toBe('center');
  });

  it('configuración vacía o inválida → valores por defecto', () => {
    expect(parseFooterConfig(null)).toEqual({ folioStyle: 'plain', position: 'center', ornament: 'none' });
    expect(parseFooterConfig('{"folioStyle":"raro"}').folioStyle).toBe('plain');
  });
});

describe('separadores con ornamento', () => {
  it('ida y vuelta del content_json', () => {
    expect(parseSeparatorContent(serializeSeparatorContent({ ornament: 'flourish' })).ornament).toBe('flourish');
    expect(serializeSeparatorContent({ ornament: 'line' })).toBeNull();
    expect(parseSeparatorContent('basura').ornament).toBe('line');
  });

  it('cada ornamento tiene alto y SVG', () => {
    for (const o of ['line', 'diamond', 'flourish', 'asterism', 'dots'] as const) {
      expect(separatorHeightPx(o)).toBeGreaterThan(0);
      expect(separatorOrnamentSvg(o)).toContain('<svg');
    }
  });
});

describe('apertura de capítulo', () => {
  it('aperturas nuevas nacen a sangre; las antiguas sin el campo no', () => {
    const fresh = parseChapterOpeningContent(serializeChapterOpeningContent({ ...EMPTY_CHAPTER_OPENING_CONTENT }));
    expect(fresh.bleed).toBe(true);
    expect(parseChapterOpeningContent('{"title":"X"}').bleed).toBe(false);
  });

  it('«página par» coloca la apertura a la izquierda y el texto empieza enfrente', () => {
    const settings: LayoutSettings = {
      ...DEFAULT_LAYOUT_SETTINGS, id: 'l' as LayoutSettings['id'], bookId: 'b', createdAt: '', updatedAt: '',
    };
    const section = (id: string, order: number): DocumentSection => ({
      id: id as DocumentSection['id'], bookId: 'b', sectionType: 'CHAPTER', title: id, orderIndex: order,
      includeInToc: true, startOnRightPage: true, settingsJson: null, createdAt: '', updatedAt: '',
    });
    const blk = (sid: string, t: DocumentBlock['blockType'], extra: Partial<DocumentBlock> = {}): DocumentBlock => ({
      id: `${sid}-${t}` as DocumentBlock['id'], sectionId: sid, blockType: t, orderIndex: t === 'CHAPTER_OPENING' ? 0 : 1,
      contentText: 'Texto', contentJson: null, styleVariant: 'default' as DocumentBlock['styleVariant'],
      includeInToc: false, keepTogether: false, pageBreakBefore: false, pageBreakAfter: false,
      metadataJson: null, createdAt: '', updatedAt: '', ...extra,
    });
    const opening = JSON.stringify({ ...EMPTY_CHAPTER_OPENING_CONTENT, title: 'Cap. 2', startOn: 'left' });
    const r = buildPaginatedLayout({
      bookId: 'b', bookTitle: 'Libro', layoutSettings: settings,
      sections: [section('s1', 0), section('s2', 1)],
      blocksBySectionId: {
        s1: [blk('s1', 'PARAGRAPH')],
        s2: [blk('s2', 'CHAPTER_OPENING', { contentJson: opening }), blk('s2', 'PARAGRAPH')],
      },
    });
    const openingPage = r.pages.find(p => p.placements.some(pl => pl.block?.blockType === 'CHAPTER_OPENING'))!;
    expect(openingPage.side).toBe('left');
    const next = r.pages[openingPage.internalIndex + 1];
    expect(next.side).toBe('right');
    expect(next.placements[0]?.block?.blockType).toBe('PARAGRAPH');
  });
});
