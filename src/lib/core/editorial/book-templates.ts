/**
 * book-templates.ts — plantillas de libro: diseño (maqueta + estilos) y esqueleto
 * de contenido de ejemplo.
 *
 *   - «Novela ilustrada»: 135,5 × 211,7 mm (384 × 600 pt, como «Caminando con el
 *     Nazareno»), aperturas a sangre, título centrado con floritura, folio «— 7 —»,
 *     guionización.
 *   - «Devocional»: mismo formato, papel con cuadrícula tenue, etiqueta «Día {n}»,
 *     cita bíblica anclada al pie, página de oración y laurel en el pie, sin folio.
 *
 * TypeScript puro: book-templates.service.ts lo aplica con los servicios existentes.
 * Fuentes: se pide 'Quattrocento' primero; si el libro no la tiene importada, se usa
 * Georgia.
 */

import type { BlockStyleVariant, BlockType } from '$lib/core/domain/block';
import type { SectionType } from '$lib/core/domain/section';
import type { UpdateLayoutSettingsInput } from '$lib/core/domain/layout';
import {
  buildDefaultBookStyles,
  serializeBookStyles,
  type BookStyleDefinition,
  type BookStyleMap,
  type BookStyleRole,
} from './book-styles';
import { serializeFooterConfig, serializeHeaderConfig } from './page-furniture';
import { mergeSectionDecoration, serializePageBackground } from './page-decoration';
import { serializeChapterOpeningContent, EMPTY_CHAPTER_OPENING_CONTENT } from './chapter-opening-content';
import { serializeTitlePageContent } from './title-page-content';
import { serializeImageBlockContent, EMPTY_IMAGE_BLOCK_CONTENT } from './image-block-content';
import { serializeSeparatorContent } from './separator-content';
import { serializeBadgeContent, serializeVerseContent, DEFAULT_BADGE_CONTENT } from './composite-blocks';
import { mergeAnchorIntoMetadata } from './block-placement';
import { mergeLayoutIntoMetadata } from './block-layout';

export type BookTemplateId = 'blank' | 'illustrated-novel' | 'devotional';

export interface TemplateBlock {
  blockType: BlockType;
  contentText?: string;
  contentJson?: string | null;
  metadataJson?: string | null;
  styleVariant?: BlockStyleVariant;
}

export interface TemplateSection {
  sectionType: SectionType;
  title: string;
  includeInToc: boolean;
  startOnRightPage: boolean;
  settingsJson?: string | null;
  blocks: TemplateBlock[];
}

export interface TemplateContext {
  title: string;
  subtitle: string;
  author: string;
  year: number;
}

export interface BookTemplate {
  id: BookTemplateId;
  label: string;
  description: string;
  /** Ajustes de maqueta (incluye stylesJson ya serializado). Vacío en «blank». */
  layout(): UpdateLayoutSettingsInput;
  /** Secciones y bloques de ejemplo. */
  scaffold(ctx: TemplateContext): TemplateSection[];
}

// ─── utilidades ──────────────────────────────────────────────────────────────

/** 384 × 600 pt en mm. */
const EBOOK_WIDTH_MM = 135.5;
const EBOOK_HEIGHT_MM = 211.7;
const SERIF_STACK = "'Quattrocento', Georgia, 'Times New Roman', serif";

type StyleOverrides = Partial<Record<BookStyleRole, Partial<BookStyleDefinition>>>;

function buildStyles(base: { bodyFontSize: number; bodyLineHeight: number; paragraphSpacing: number }, o: StyleOverrides): string {
  const d = buildDefaultBookStyles(base);
  const merged = { ...d } as BookStyleMap;
  for (const [role, patch] of Object.entries(o) as [BookStyleRole, Partial<BookStyleDefinition>][]) {
    merged[role] = { ...d[role], ...patch };
  }
  return serializeBookStyles(merged);
}

const align = (textAlign: 'left' | 'center' | 'right' | 'justify') =>
  mergeLayoutIntoMetadata(null, { textAlign, widthMode: 'full', emphasis: 'normal' });
const anchored = (meta: string | null = null) => mergeAnchorIntoMetadata(meta, 'bottom');

const p = (text: string, styleVariant?: BlockStyleVariant): TemplateBlock =>
  ({ blockType: 'PARAGRAPH', contentText: text, ...(styleVariant ? { styleVariant } : {}) });
const emptyImage = (extra: Partial<typeof EMPTY_IMAGE_BLOCK_CONTENT> = {}): TemplateBlock => ({
  blockType: 'IMAGE',
  contentJson: serializeImageBlockContent({ ...EMPTY_IMAGE_BLOCK_CONTENT, ...extra }),
});

/** Portadas de novela: ilustración oscura con texto claro (se cambia en la sección). */
const LIGHT_TEXT = mergeSectionDecoration(null, { background: 'inherit', textTone: 'light' });

const LOREM_NOVEL = [
  'El amanecer llegó despacio sobre el valle. Nadie en la aldea imaginaba que aquel día cambiaría la historia de todos; ni siquiera ella, que caminaba hacia el pozo con el cántaro vacío y la cabeza llena de preguntas.',
  'Sustituye este texto por tu primer capítulo. Puedes pegarlo entero o importar un archivo Markdown desde el menú de la sección: cada línea en blanco crea un párrafo nuevo.',
];

// ─── Plantillas ──────────────────────────────────────────────────────────────

const BLANK: BookTemplate = {
  id: 'blank',
  label: 'En blanco',
  description: 'A5 con los ajustes por defecto y sin contenido.',
  layout: () => ({}),
  scaffold: () => [],
};

const ILLUSTRATED_NOVEL: BookTemplate = {
  id: 'illustrated-novel',
  label: 'Novela ilustrada',
  description: '135,5 × 211,7 mm. Aperturas de capítulo a sangre, título centrado con floritura, ilustraciones en el texto y folio «— 7 —».',
  layout: () => {
    const base = { bodyFontSize: 10.5, bodyLineHeight: 1.5, paragraphSpacing: 5 };
    return {
      pageSizePreset: 'CUSTOM',
      pageUnit: 'mm',
      pageWidth: EBOOK_WIDTH_MM,
      pageHeight: EBOOK_HEIGHT_MM,
      marginTop: 17,
      marginBottom: 19,
      marginInside: 16,
      marginOutside: 13,
      facingPages: true,
      bleedMm: 3.2,
      bodyFontFamily: SERIF_STACK,
      headingFontFamily: SERIF_STACK,
      ...base,
      showPageNumbers: true,
      frontmatterNumberingStyle: 'none',
      showFooter: true,
      showHeader: false,
      hyphenate: true,
      footerConfigJson: serializeFooterConfig({ folioStyle: 'dashes', position: 'center', ornament: 'none' }),
      headerConfigJson: serializeHeaderConfig({ content: 'alternate', position: 'outside', uppercase: true }),
      pageBackgroundJson: null,
      stylesJson: buildStyles(base, {
        TITLE: { fontSize: 26, textTransform: 'uppercase', letterSpacing: 0.04, lineHeight: 1.08, maxWidth: 90 },
        HEADING_1: { fontSize: 18, textAlign: 'center', fontWeight: 700, marginTop: 6, marginBottom: 2, lineHeight: 1.2 },
        HEADING_4: { fontSize: 9, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.18, fontWeight: 500, marginTop: 14, marginBottom: 4 },
        CHAPTER_OPENING_LABEL: { fontSize: 11, letterSpacing: 0.14, textTransform: 'uppercase', fontWeight: 500 },
        CHAPTER_OPENING_TITLE: { fontSize: 24, lineHeight: 1.1 },
        CENTERED_PHRASE: { fontSize: 10.5, marginTop: 8, marginBottom: 8 },
      }),
    };
  },
  scaffold: (ctx) => [
    {
      sectionType: 'COVER', title: 'Portada', includeInToc: false, startOnRightPage: false,
      settingsJson: LIGHT_TEXT,
      blocks: [
        emptyImage({ altText: 'Ilustración de portada' }),
        { blockType: 'HEADING_1', contentText: ctx.title },
        ...(ctx.subtitle ? [{ blockType: 'CENTERED_PHRASE' as const, contentText: ctx.subtitle }] : []),
        { blockType: 'CENTERED_PHRASE', contentText: ctx.author || 'Nombre del autor', metadataJson: anchored() },
      ],
    },
    {
      sectionType: 'TITLE_PAGE', title: 'Portadilla', includeInToc: false, startOnRightPage: true,
      blocks: [{
        blockType: 'TITLE_PAGE',
        contentJson: serializeTitlePageContent({
          seriesLabel: '', title: ctx.title, subtitle: ctx.subtitle,
          authorLine: ctx.author, publisherInfo: '', textAlign: 'center',
        }),
      }],
    },
    {
      sectionType: 'RIGHTS', title: 'Créditos', includeInToc: false, startOnRightPage: false,
      blocks: [
        p(`© ${ctx.year} ${ctx.author || 'Autor'}. Todos los derechos reservados.`, 'rights'),
        p('Ninguna parte de este libro puede ser reproducida sin permiso escrito del autor.', 'rights'),
      ],
    },
    {
      sectionType: 'DEDICATION', title: 'Dedicatoria', includeInToc: false, startOnRightPage: true,
      blocks: [p('A quienes siguen caminando.', 'dedication')],
    },
    { sectionType: 'TOC', title: 'Índice', includeInToc: false, startOnRightPage: true, blocks: [] },
    ...[1, 2].map((n): TemplateSection => ({
      sectionType: 'CHAPTER', title: `Título del capítulo ${n}`, includeInToc: true, startOnRightPage: false,
      blocks: [
        {
          blockType: 'CHAPTER_OPENING',
          contentJson: serializeChapterOpeningContent({
            ...EMPTY_CHAPTER_OPENING_CONTENT,
            chapterLabel: `Capítulo ${n}`,
            title: `Título del capítulo ${n}`,
            textPosition: 'bottom-left',
            overlay: true,
            bleed: true,
            startOn: 'left',
          }),
        },
        { blockType: 'HEADING_4', contentText: `Capítulo ${n}` },
        { blockType: 'HEADING_1', contentText: `Título del capítulo ${n}` },
        { blockType: 'SEPARATOR', contentJson: serializeSeparatorContent({ ornament: 'flourish' }) },
        p(LOREM_NOVEL[0]),
        emptyImage({ widthPercent: 75 }),
        p(LOREM_NOVEL[1]),
      ],
    })),
    {
      sectionType: 'BACK_COVER', title: 'Contraportada', includeInToc: false, startOnRightPage: false,
      settingsJson: LIGHT_TEXT,
      blocks: [
        emptyImage({ altText: 'Ilustración de contraportada' }),
        p('Escribe aquí la sinopsis de la contraportada: dos o tres párrafos que inviten a leer.'),
        { blockType: 'CENTERED_PHRASE', contentText: ctx.author || '', metadataJson: anchored() },
      ],
    },
  ],
};

const DEVOTIONAL: BookTemplate = {
  id: 'devotional',
  label: 'Devocional',
  description: '135,5 × 211,7 mm. Papel con cuadrícula, etiqueta «Día N», cita bíblica al pie, página de oración y laurel en cada página.',
  layout: () => {
    const base = { bodyFontSize: 9.5, bodyLineHeight: 1.75, paragraphSpacing: 8 };
    return {
      pageSizePreset: 'CUSTOM',
      pageUnit: 'mm',
      pageWidth: EBOOK_WIDTH_MM,
      pageHeight: EBOOK_HEIGHT_MM,
      marginTop: 18,
      marginBottom: 30,
      marginInside: 13,
      marginOutside: 13,
      facingPages: false,
      bleedMm: 3.2,
      bodyFontFamily: SERIF_STACK,
      headingFontFamily: SERIF_STACK,
      ...base,
      showPageNumbers: false,
      showFooter: true,
      showHeader: false,
      hyphenate: false,
      footerConfigJson: serializeFooterConfig({ folioStyle: 'plain', position: 'center', ornament: 'laurel' }),
      pageBackgroundJson: serializePageBackground({
        kind: 'grid', color: '#F5F0E6', assetId: null, opacity: 1, skipFullPage: true,
      }),
      stylesJson: buildStyles(base, {
        TITLE: { fontSize: 28, textTransform: 'uppercase', letterSpacing: 0.03, lineHeight: 1.05, maxWidth: 92, color: '#2B2118', marginTop: 4, marginBottom: 6 },
        HEADING_3: { fontSize: 10, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.22, fontWeight: 500, marginTop: 4, marginBottom: 2 },
        HEADING_4: { fontSize: 10, fontWeight: 700, letterSpacing: 0.02, marginTop: 2, marginBottom: 8 },
        PARAGRAPH: { textAlign: 'justify' },
        CENTERED_PHRASE: { fontSize: 9.5, marginTop: 6, marginBottom: 6, maxWidth: 90 },
        BADGE: { fontSize: 10.5, marginTop: 0, marginBottom: 16 },
        VERSE_REFERENCE: { fontSize: 11 },
      }),
    };
  },
  scaffold: (ctx) => {
    const day = (ref: string, texts: string[], prayer: string[]): TemplateSection => ({
      sectionType: 'CHAPTER', title: `Día — ${ref}`, includeInToc: true, startOnRightPage: false,
      blocks: [
        { blockType: 'BADGE', contentText: 'Día {n}', contentJson: serializeBadgeContent(DEFAULT_BADGE_CONTENT) },
        ...texts.map(t => p(t)),
        {
          blockType: 'VERSE',
          contentText: '',
          contentJson: serializeVerseContent({ reference: ref, frame: 'ornament' }),
          metadataJson: anchored(),
        },
        { blockType: 'HEADING_4', contentText: 'Oración' },
        ...prayer.map(t => p(t)),
        { blockType: 'CENTERED_PHRASE', contentText: 'Amén.' },
      ],
    });
    return [
      {
        sectionType: 'COVER', title: 'Portada', includeInToc: false, startOnRightPage: false,
        blocks: [
          emptyImage({ altText: 'Ilustración de portada' }),
          { blockType: 'HEADING_3', contentText: 'Devocional', metadataJson: align('center') },
          { blockType: 'HEADING_1', contentText: ctx.title },
          { blockType: 'CENTERED_PHRASE', contentText: (ctx.author || 'Nombre del autor').toUpperCase() },
          {
            blockType: 'CENTERED_PHRASE',
            contentText: (ctx.subtitle || 'Un subtítulo que invite a leer').toUpperCase(),
            metadataJson: anchored(),
          },
        ],
      },
      {
        sectionType: 'RIGHTS', title: 'Créditos', includeInToc: false, startOnRightPage: false,
        blocks: [
          p(`© ${ctx.year} ${ctx.author || 'Autor'}.`, 'rights'),
          p('Todos los derechos reservados. Ninguna parte de este libro puede ser reproducida, almacenada o transmitida sin permiso previo y por escrito del autor.', 'rights'),
          p(`Primera edición digital: ${ctx.year}.`, 'rights'),
        ],
      },
      {
        sectionType: 'DEDICATION', title: 'Dedicatoria', includeInToc: false, startOnRightPage: false,
        blocks: [
          { blockType: 'HEADING_4', contentText: 'Dedicatoria' },
          p('A ti, que buscas a Dios incluso sin darte cuenta.'),
        ],
      },
      day('Mateo 4,19', [
        'Cuando Dios llama, no siempre lo hace en un templo. A veces lo hace en tu cansancio, en tu rutina, en tu orilla.',
        'Sustituye estos párrafos por la reflexión del día. La referencia bíblica queda siempre al pie de la página y la oración empieza en la página siguiente.',
      ], [
        'Señor Jesús, hoy te busco en mi orilla. Dame oídos para reconocerte y valentía para dar el paso.',
      ]),
      day('Lucas 2,19', [
        'Duplica la sección de un día (menú de la sección → Duplicar) para crear el siguiente. La etiqueta «Día {n}» se numera sola.',
      ], [
        'Señor, enséñame a guardar tus palabras en el corazón.',
      ]),
      {
        sectionType: 'SPECIAL', title: 'Otros libros', includeInToc: false, startOnRightPage: false,
        blocks: [
          p('Si este devocional te acompañó, continúa el camino con nuestros otros títulos.'),
          emptyImage({ widthPercent: 75 }),
          { blockType: 'CENTERED_PHRASE', contentText: 'Disponibles en tu librería digital favorita.' },
        ],
      },
      {
        sectionType: 'BACK_COVER', title: 'Contraportada', includeInToc: false, startOnRightPage: false,
        blocks: [
          emptyImage({ altText: 'Ilustración de contraportada' }),
          { blockType: 'CENTERED_PHRASE', contentText: `© ${ctx.year} ${ctx.author || ''}`.trim(), metadataJson: anchored() },
        ],
      },
    ];
  },
};

export const BOOK_TEMPLATES: BookTemplate[] = [BLANK, ILLUSTRATED_NOVEL, DEVOTIONAL];

export function getBookTemplate(id: BookTemplateId): BookTemplate {
  return BOOK_TEMPLATES.find(t => t.id === id) ?? BLANK;
}
