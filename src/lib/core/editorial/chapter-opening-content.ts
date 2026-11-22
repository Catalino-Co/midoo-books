/**
 * PARTE 8.5 — Contenido estructurado del bloque CHAPTER_OPENING (content_json).
 *
 * Composición editorial (hero de capítulo): imagen + texto superpuesto.
 * Saltos de página y keepTogether viven en columnas del DocumentBlock, no aquí.
 */

export const CHAPTER_OPENING_TEXT_POSITION_VALUES = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
  'center',
] as const;

export type ChapterOpeningTextPosition = (typeof CHAPTER_OPENING_TEXT_POSITION_VALUES)[number];

export const CHAPTER_OPENING_TEXT_ALIGN_VALUES = ['left', 'center', 'right'] as const;
export type ChapterOpeningTextAlign = (typeof CHAPTER_OPENING_TEXT_ALIGN_VALUES)[number];

export const CHAPTER_OPENING_TEXT_COLOR_MODE_VALUES = ['light', 'dark', 'auto'] as const;
export type ChapterOpeningTextColorMode = (typeof CHAPTER_OPENING_TEXT_COLOR_MODE_VALUES)[number];

/**
 * Dónde se coloca la página de apertura:
 *   - 'next'  → página siguiente (sea par o impar).
 *   - 'left'  → página par (izquierda, verso): queda enfrente del inicio del texto.
 *   - 'right' → página impar (derecha, recto).
 */
export const CHAPTER_OPENING_START_ON_VALUES = ['next', 'left', 'right'] as const;
export type ChapterOpeningStartOn = (typeof CHAPTER_OPENING_START_ON_VALUES)[number];

export interface ChapterOpeningBlockContent {
  chapterLabel: string;
  title: string;
  assetId: string | null;
  textPosition: ChapterOpeningTextPosition;
  textAlign: ChapterOpeningTextAlign;
  overlay: boolean;
  /** Contraste del texto sobre la imagen (maquetación futura). */
  textColorMode: ChapterOpeningTextColorMode;
  /** true = la ilustración llega hasta el borde de la hoja (ignora márgenes). */
  bleed: boolean;
  /** Lado de la página de apertura. */
  startOn: ChapterOpeningStartOn;
}

export const EMPTY_CHAPTER_OPENING_CONTENT: ChapterOpeningBlockContent = {
  chapterLabel: '',
  title: '',
  assetId: null,
  textPosition: 'bottom-left',
  textAlign: 'left',
  overlay: true,
  textColorMode: 'light',
  // Las aperturas nuevas nacen a sangre; las existentes sin el campo se leen como false.
  bleed: true,
  startOn: 'next',
};

function isPosition(v: unknown): v is ChapterOpeningTextPosition {
  return (
    typeof v === 'string'
    && (CHAPTER_OPENING_TEXT_POSITION_VALUES as readonly string[]).includes(v)
  );
}

function isAlign(v: unknown): v is ChapterOpeningTextAlign {
  return typeof v === 'string' && (CHAPTER_OPENING_TEXT_ALIGN_VALUES as readonly string[]).includes(v);
}

function isColorMode(v: unknown): v is ChapterOpeningTextColorMode {
  return typeof v === 'string' && (CHAPTER_OPENING_TEXT_COLOR_MODE_VALUES as readonly string[]).includes(v);
}

export function parseChapterOpeningContent(contentJson: string | null): ChapterOpeningBlockContent {
  if (!contentJson?.trim()) return { ...EMPTY_CHAPTER_OPENING_CONTENT };
  try {
    const raw = JSON.parse(contentJson) as unknown;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { ...EMPTY_CHAPTER_OPENING_CONTENT };
    }
    const o = raw as Record<string, unknown>;
    const chapterLabel = typeof o.chapterLabel === 'string' ? o.chapterLabel : '';
    const title = typeof o.title === 'string' ? o.title : '';
    const assetId = o.assetId != null && typeof o.assetId === 'string' ? o.assetId : null;
    const textPosition = isPosition(o.textPosition) ? o.textPosition : EMPTY_CHAPTER_OPENING_CONTENT.textPosition;
    const textAlign = isAlign(o.textAlign) ? o.textAlign : EMPTY_CHAPTER_OPENING_CONTENT.textAlign;
    const overlay = typeof o.overlay === 'boolean' ? o.overlay : EMPTY_CHAPTER_OPENING_CONTENT.overlay;
    const textColorMode = isColorMode(o.textColorMode)
      ? o.textColorMode
      : EMPTY_CHAPTER_OPENING_CONTENT.textColorMode;
    const bleed = o.bleed === true;
    const startOn: ChapterOpeningStartOn = typeof o.startOn === 'string'
      && (CHAPTER_OPENING_START_ON_VALUES as readonly string[]).includes(o.startOn)
      ? o.startOn as ChapterOpeningStartOn
      : 'next';
    return {
      chapterLabel,
      title,
      assetId,
      textPosition,
      textAlign,
      overlay,
      textColorMode,
      bleed,
      startOn,
    };
  } catch {
    return { ...EMPTY_CHAPTER_OPENING_CONTENT };
  }
}

export function serializeChapterOpeningContent(c: ChapterOpeningBlockContent): string {
  return JSON.stringify({
    chapterLabel: c.chapterLabel,
    title: c.title,
    assetId: c.assetId && c.assetId !== '' ? c.assetId : null,
    textPosition: c.textPosition,
    textAlign: c.textAlign,
    overlay: c.overlay,
    textColorMode: c.textColorMode,
    bleed: c.bleed === true,
    startOn: c.startOn ?? 'next',
  });
}

export function chapterOpeningStartOnLabel(v: ChapterOpeningStartOn): string {
  switch (v) {
    case 'left':  return 'Página par (izquierda, frente al texto)';
    case 'right': return 'Página impar (derecha)';
    default:      return 'Página siguiente';
  }
}

/** Clases para preview en lista / inspector (sin lógica de maquetación paginada). */
export function chapterOpeningPreviewRootClassNames(c: ChapterOpeningBlockContent): string {
  const tone = `co-preview--tone-${c.textColorMode}`;
  return [
    'co-preview',
    c.overlay ? 'co-preview--overlay' : '',
    `co-preview--pos-${c.textPosition}`,
    tone,
    `co-preview--ta-${c.textAlign}`,
  ]
    .filter(Boolean)
    .join(' ');
}

export function chapterOpeningTextPositionLabel(p: ChapterOpeningTextPosition): string {
  const map: Record<ChapterOpeningTextPosition, string> = {
    'top-left':     'Arriba · izquierda',
    'top-right':    'Arriba · derecha',
    'bottom-left':  'Abajo · izquierda',
    'bottom-right': 'Abajo · derecha',
    center:         'Centro',
  };
  return map[p];
}

export function chapterOpeningTextAlignLabel(a: ChapterOpeningTextAlign): string {
  const map: Record<ChapterOpeningTextAlign, string> = {
    left:   'Izquierda',
    center: 'Centrado',
    right:  'Derecha',
  };
  return map[a];
}

export function chapterOpeningTextColorModeLabel(m: ChapterOpeningTextColorMode): string {
  const map: Record<ChapterOpeningTextColorMode, string> = {
    light: 'Claro (sobre imagen oscura)',
    dark:  'Oscuro (sobre imagen clara)',
    auto:  'Automático (futuro)',
  };
  return map[m];
}
