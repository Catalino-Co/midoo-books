import { describe, expect, it } from 'vitest';
import {
  applyBadgeNumbering,
  badgeHtml,
  compositeBlockHtml,
  parseBadgeContent,
  parseVerseContent,
  serializeVerseContent,
  verseHtml,
  DEFAULT_BADGE_CONTENT,
} from './composite-blocks';
import { isBlockAnchoredBottom, mergeAnchorIntoMetadata, parseBlockAnchor } from './block-placement';
import { mergeLayoutIntoMetadata, resolveBlockLayout } from './block-layout';
import {
  mergeSectionDecoration,
  parsePageBackground,
  parseSectionDecoration,
  serializePageBackground,
} from './page-decoration';
import { parseFooterConfig, serializeFooterConfig } from './page-furniture';
import { separatorOrnamentSvg } from './separator-content';
import { buildPaginatedLayout } from './page-layout-engine';
import { buildDefaultBookStyles } from './book-styles';
import { BOOK_TEMPLATES } from './book-templates';
import { BLOCK_TYPE_VALUES } from '$lib/core/domain/block';
import { SECTION_TYPE_VALUES } from '$lib/core/domain/section';
import { DEFAULT_LAYOUT_SETTINGS, type LayoutSettings } from '$lib/core/domain/layout';
import type { DocumentBlock } from '$lib/core/domain/block';
import type { DocumentSection } from '$lib/core/domain/section';

const settings = (patch: Partial<LayoutSettings> = {}): LayoutSettings => ({
  ...DEFAULT_LAYOUT_SETTINGS, id: 'l' as LayoutSettings['id'], bookId: 'b', createdAt: '', updatedAt: '', ...patch,
});
const section = (id: string, order: number, type: DocumentSection['sectionType'] = 'CHAPTER'): DocumentSection => ({
  id: id as DocumentSection['id'], bookId: 'b', sectionType: type, title: id, orderIndex: order,
  includeInToc: true, startOnRightPage: false, settingsJson: null, createdAt: '', updatedAt: '',
});
let seq = 0;
const blk = (sid: string, t: DocumentBlock['blockType'], extra: Partial<DocumentBlock> = {}): DocumentBlock => ({
  id: `${sid}-${seq++}` as DocumentBlock['id'], sectionId: sid, blockType: t, orderIndex: seq,
  contentText: 'Texto', contentJson: null, styleVariant: 'default' as DocumentBlock['styleVariant'],
  includeInToc: false, keepTogether: false, pageBreakBefore: false, pageBreakAfter: false,
  metadataJson: null, createdAt: '', updatedAt: '', ...extra,
});

describe('etiqueta «Día {n}»', () => {
  it('numera las etiquetas en el orden del libro', () => {
    const s1 = section('s1', 0), s2 = section('s2', 1);
    const out = applyBadgeNumbering([s2, s1], {
      s1: [blk('s1', 'BADGE', { contentText: 'Día {n}' }), blk('s1', 'BADGE', { contentText: 'Sin número' })],
      s2: [blk('s2', 'BADGE', { contentText: 'Día {n}' })],
    });
    expect(out.s1[0].contentText).toBe('Día 1');
    expect(out.s1[1].contentText).toBe('Sin número');
    expect(out.s2[0].contentText).toBe('Día 2');
  });

  it('el HTML escapa el texto y lleva el marco elegido', () => {
    const style = buildDefaultBookStyles(DEFAULT_LAYOUT_SETTINGS).BADGE;
    const html = badgeHtml('Día <1>', style, DEFAULT_BADGE_CONTENT);
    expect(html).toContain('Día &lt;1&gt;');
    expect(html).toContain('data-badge="plaque"');
    expect(html).toContain('clip-path');
    expect(parseBadgeContent('{"shape":"pill","fill":"nope"}')).toEqual({ ...DEFAULT_BADGE_CONTENT, shape: 'pill' });
  });
});

describe('cita bíblica', () => {
  it('ida y vuelta y HTML con referencia y filetes', () => {
    const c = parseVerseContent(serializeVerseContent({ reference: 'Mateo 4,19', frame: 'ornament' }));
    expect(c.reference).toBe('Mateo 4,19');
    const st = buildDefaultBookStyles(DEFAULT_LAYOUT_SETTINGS);
    const html = verseHtml('', c, st.VERSE_TEXT, st.VERSE_REFERENCE);
    expect(html).toContain('Mateo 4,19');
    expect(html.match(/<svg/g)?.length).toBe(2);
    expect(compositeBlockHtml(blk('x', 'PARAGRAPH'), st.PARAGRAPH, st)).toBeNull();
  });
});

describe('anclar al pie', () => {
  it('se guarda en metadata sin perder la alineación', () => {
    const meta = mergeLayoutIntoMetadata(null, { textAlign: 'center', widthMode: 'full', emphasis: 'normal' });
    const anchored = mergeAnchorIntoMetadata(meta, 'bottom');
    expect(parseBlockAnchor(anchored)).toBe('bottom');
    expect(resolveBlockLayout(blk('x', 'PARAGRAPH', { metadataJson: anchored })).textAlign).toBe('center');
    expect(parseBlockAnchor(mergeAnchorIntoMetadata(anchored, 'flow'))).toBe('flow');
    expect(isBlockAnchoredBottom(blk('x', 'CHAPTER_OPENING', { metadataJson: anchored }))).toBe(false);
  });

  it('el motor coloca el bloque anclado y manda lo siguiente a otra página', () => {
    const anchored = mergeAnchorIntoMetadata(null, 'bottom');
    const r = buildPaginatedLayout({
      bookId: 'b', bookTitle: 'Libro', layoutSettings: settings(),
      sections: [section('s1', 0)],
      blocksBySectionId: {
        s1: [
          blk('s1', 'BADGE', { contentText: 'Día {n}' }),
          blk('s1', 'PARAGRAPH', { contentText: 'Reflexión breve.' }),
          blk('s1', 'VERSE', { contentText: '', contentJson: serializeVerseContent({ reference: 'Mateo 4,19', frame: 'ornament' }), metadataJson: anchored }),
          blk('s1', 'HEADING_4', { contentText: 'Oración' }),
          blk('s1', 'PARAGRAPH', { contentText: 'Señor…' }),
        ],
      },
    });
    expect(r.pages.length).toBe(2);
    const first = r.pages[0].placements;
    expect(first.map(p => p.block?.blockType)).toEqual(['BADGE', 'PARAGRAPH', 'VERSE']);
    expect(first[0].block?.contentText).toBe('Día 1');
    expect(first[2].anchorBottom).toBe(true);
    expect(r.pages[1].placements[0].block?.blockType).toBe('HEADING_4');
  });
});

describe('portada con texto encima', () => {
  it('la imagen de portada no ocupa flujo y el texto va en la misma página', () => {
    const r = buildPaginatedLayout({
      bookId: 'b', bookTitle: 'Libro', layoutSettings: settings(),
      sections: [section('c', 0, 'COVER'), section('s1', 1)],
      blocksBySectionId: {
        c: [blk('c', 'IMAGE'), blk('c', 'HEADING_1', { contentText: 'Título' })],
        s1: [blk('s1', 'PARAGRAPH')],
      },
    });
    const cover = r.pages[0];
    expect(cover.placements.map(p => p.block?.blockType)).toEqual(['IMAGE', 'HEADING_1']);
    expect(cover.placements[0].coverBackdrop).toBe(true);
    expect(cover.placements[0].estimatedUnits).toBe(0);
  });
});

describe('sin páginas vacías de más', () => {
  it('tras una portadilla, la sección siguiente usa la página que quedó abierta', () => {
    const r = buildPaginatedLayout({
      bookId: 'b', bookTitle: 'Libro', layoutSettings: settings(),
      sections: [section('t', 0, 'TITLE_PAGE'), section('r', 1, 'RIGHTS')],
      blocksBySectionId: { t: [blk('t', 'TITLE_PAGE', { contentJson: '{"title":"X"}' })], r: [blk('r', 'PARAGRAPH')] },
    });
    expect(r.pages.length).toBe(2);
    expect(r.pages[1].primarySectionType).toBe('RIGHTS');
  });
});

describe('fondo de página, tono y pie', () => {
  it('fondo: valores por defecto, ida y vuelta, «none» se guarda como null', () => {
    expect(parsePageBackground(null).kind).toBe('none');
    const cfg = { kind: 'grid' as const, color: '#F5F0E6', assetId: null, opacity: 0.5, skipFullPage: true };
    expect(parsePageBackground(serializePageBackground(cfg))).toEqual(cfg);
    expect(serializePageBackground({ ...cfg, kind: 'none' })).toBeNull();
  });

  it('ajustes de sección: conserva otras claves de settingsJson', () => {
    const merged = mergeSectionDecoration('{"allowHeader":false}', { background: 'none', textTone: 'light' });
    expect(JSON.parse(merged!)).toEqual({ allowHeader: false, pageBackground: 'none', textTone: 'light' });
    expect(parseSectionDecoration({ settingsJson: merged })).toEqual({ background: 'none', textTone: 'light' });
    expect(mergeSectionDecoration(null, { background: 'inherit', textTone: 'default' })).toBeNull();
  });

  it('ornamento del pie (laurel) en páginas de texto, no en portada', () => {
    expect(parseFooterConfig(serializeFooterConfig({ folioStyle: 'plain', position: 'center', ornament: 'laurel' })).ornament).toBe('laurel');
    expect(separatorOrnamentSvg('laurel')).toContain('<svg');
    const r = buildPaginatedLayout({
      bookId: 'b', bookTitle: 'Libro',
      layoutSettings: settings({ footerConfigJson: serializeFooterConfig({ folioStyle: 'plain', position: 'center', ornament: 'laurel' }) }),
      sections: [section('c', 0, 'COVER'), section('r', 1, 'RIGHTS'), section('s1', 2)],
      blocksBySectionId: {
        c: [blk('c', 'HEADING_1')],
        r: [blk('r', 'PARAGRAPH')],
        s1: [blk('s1', 'PARAGRAPH')],
      },
    });
    const bySection = (t: string) => r.pages.find(p => p.primarySectionType === t)!;
    expect(bySection('COVER').editorial.footerOrnament).toBeNull();
    expect(bySection('RIGHTS').editorial.footerOrnament).toBe('laurel');
    expect(bySection('CHAPTER').editorial.footerOrnament).toBe('laurel');
  });
});

describe('plantillas', () => {
  it('solo usan tipos de sección y bloque válidos y paginan sin errores', () => {
    for (const t of BOOK_TEMPLATES) {
      const sections = t.scaffold({ title: 'Mi libro', subtitle: '', author: 'Autora', year: 2026 });
      const domainSections = sections.map((s, i) => ({ ...section(`t${i}`, i, s.sectionType), startOnRightPage: s.startOnRightPage, settingsJson: s.settingsJson ?? null }));
      const blocksBySectionId: Record<string, DocumentBlock[]> = {};
      sections.forEach((s, i) => {
        expect(SECTION_TYPE_VALUES).toContain(s.sectionType);
        blocksBySectionId[`t${i}`] = s.blocks.map((b, j) => {
          expect(BLOCK_TYPE_VALUES).toContain(b.blockType);
          return blk(`t${i}`, b.blockType, {
            orderIndex: j, contentText: b.contentText ?? '', contentJson: b.contentJson ?? null, metadataJson: b.metadataJson ?? null,
          });
        });
      });
      const layout = { ...settings(), ...t.layout() } as LayoutSettings;
      const r = buildPaginatedLayout({ bookId: 'b', bookTitle: 'Mi libro', layoutSettings: layout, sections: domainSections, blocksBySectionId });
      expect(r.pages.length).toBeGreaterThan(sections.length - 1);
    }
  });

  it('el devocional trae cuadrícula, laurel, sin folio y «Día {n}»', () => {
    const dev = BOOK_TEMPLATES.find(t => t.id === 'devotional')!;
    const l = dev.layout();
    expect(parsePageBackground(l.pageBackgroundJson).kind).toBe('grid');
    expect(parseFooterConfig(l.footerConfigJson).ornament).toBe('laurel');
    expect(l.showPageNumbers).toBe(false);
    const days = dev.scaffold({ title: 'T', subtitle: '', author: 'A', year: 2026 }).filter(s => s.sectionType === 'CHAPTER');
    expect(days.every(d => d.blocks[0].blockType === 'BADGE' && d.blocks[0].contentText === 'Día {n}')).toBe(true);
  });
});
