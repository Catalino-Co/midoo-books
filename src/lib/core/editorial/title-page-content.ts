/**
 * src/lib/core/editorial/title-page-content.ts
 *
 * Contenido estructurado del bloque TITLE_PAGE.
 * Slots de posición fija para los elementos de una página de título literaria.
 *
 * Slots (de arriba a abajo):
 *   seriesLabel   — Género / serie / colección.   Ej: "Novela Ligera Ilustrada"
 *   title         — Título principal del libro.
 *   subtitle      — Subtítulo opcional.
 *   authorLine    — Línea de autor.               Ej: "Escrito por Junior C. Rodriguez V."
 *   publisherInfo — Editorial / año / edición.    Ej: "Horizonte · 2025"
 *   textAlign     — Alineación global de todos los slots.
 */

export const TITLE_PAGE_TEXT_ALIGN_VALUES = ['left', 'center', 'right'] as const;
export type TitlePageTextAlign = (typeof TITLE_PAGE_TEXT_ALIGN_VALUES)[number];

export interface TitlePageBlockContent {
  seriesLabel:   string;
  title:         string;
  subtitle:      string;
  authorLine:    string;
  publisherInfo: string;
  textAlign:     TitlePageTextAlign;
}

export const EMPTY_TITLE_PAGE_CONTENT: TitlePageBlockContent = {
  seriesLabel:   '',
  title:         '',
  subtitle:      '',
  authorLine:    '',
  publisherInfo: '',
  textAlign:     'center',
};

function isTextAlign(v: unknown): v is TitlePageTextAlign {
  return v === 'left' || v === 'center' || v === 'right';
}

export function parseTitlePageContent(contentJson: string | null): TitlePageBlockContent {
  if (!contentJson?.trim()) return { ...EMPTY_TITLE_PAGE_CONTENT };
  try {
    const raw = JSON.parse(contentJson) as unknown;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { ...EMPTY_TITLE_PAGE_CONTENT };
    }
    const o = raw as Record<string, unknown>;
    return {
      seriesLabel:   typeof o.seriesLabel   === 'string' ? o.seriesLabel   : '',
      title:         typeof o.title         === 'string' ? o.title         : '',
      subtitle:      typeof o.subtitle      === 'string' ? o.subtitle      : '',
      authorLine:    typeof o.authorLine    === 'string' ? o.authorLine    : '',
      publisherInfo: typeof o.publisherInfo === 'string' ? o.publisherInfo : '',
      textAlign:     isTextAlign(o.textAlign) ? o.textAlign : 'center',
    };
  } catch {
    return { ...EMPTY_TITLE_PAGE_CONTENT };
  }
}

export function serializeTitlePageContent(c: TitlePageBlockContent): string {
  return JSON.stringify({
    seriesLabel:   c.seriesLabel,
    title:         c.title,
    subtitle:      c.subtitle,
    authorLine:    c.authorLine,
    publisherInfo: c.publisherInfo,
    textAlign:     c.textAlign,
  });
}
