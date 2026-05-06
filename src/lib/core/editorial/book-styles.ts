import type { DocumentBlock } from '$lib/core/domain/block';
import type { LayoutSettings } from '$lib/core/domain/layout';
import type { DocumentSection, SectionType } from '$lib/core/domain/section';
import { DEFAULT_LAYOUT_SETTINGS } from '$lib/core/domain/layout';
import { resolveBlockLayoutOverrides, type BlockLayoutStyle } from './block-layout';

export const BOOK_STYLE_ROLE_VALUES = [
  'TITLE',
  'HEADING_1',
  'HEADING_2',
  'PARAGRAPH',
  'QUOTE',
  'CENTERED_PHRASE',
  'TOC_ENTRY',
  'CHAPTER_OPENING_LABEL',
  'CHAPTER_OPENING_TITLE',
] as const;

export type BookStyleRole = (typeof BOOK_STYLE_ROLE_VALUES)[number];

export type BookStyleTextAlign = 'left' | 'center' | 'right' | 'justify';

export interface BookStyleDefinition {
  fontSize: number;
  lineHeight: number;
  textAlign: BookStyleTextAlign;
  fontWeight: 400 | 500 | 600 | 700;
  letterSpacing: number;
  marginTop: number;
  marginBottom: number;
  color: string | null;
  maxWidth: number | null;
}

export type BookStyleMap = Record<BookStyleRole, BookStyleDefinition>;

export interface BookStyleRoleMeta {
  role: BookStyleRole;
  label: string;
  description: string;
  sampleText: string;
}

export interface ResolvedBookStyleInfo {
  role: BookStyleRole;
  baseStyle: BookStyleDefinition;
  blockLayout: Partial<BlockLayoutStyle>;
  finalStyle: BookStyleDefinition;
}

export const BOOK_STYLE_ROLE_CATALOG: BookStyleRoleMeta[] = [
  {
    role: 'TITLE',
    label: 'Título principal',
    description: 'Título principal usado en portada, página de título y aperturas editoriales equivalentes.',
    sampleText: 'Caminando con el Nazareno',
  },
  {
    role: 'HEADING_1',
    label: 'Título de sección',
    description: 'Título principal dentro del flujo de secciones o capítulos.',
    sampleText: 'Una invitación a caminar.',
  },
  {
    role: 'HEADING_2',
    label: 'Subtítulo',
    description: 'Subtítulo de segundo nivel.',
    sampleText: 'Los primeros pasos del relato',
  },
  {
    role: 'PARAGRAPH',
    label: 'Párrafo',
    description: 'Texto corrido principal del libro.',
    sampleText: 'Hay historias que comienzan con una mirada, una conversación o un gesto de compasión.',
  },
  {
    role: 'QUOTE',
    label: 'Cita',
    description: 'Cita o texto destacado dentro del flujo.',
    sampleText: '“Cada encuentro con Él fue una semilla de eternidad sembrada en tierra humana.”',
  },
  {
    role: 'CENTERED_PHRASE',
    label: 'Línea centrada',
    description: 'Línea breve centrada para dedicatorias o separadores.',
    sampleText: 'Para quienes siguen caminando con fe.',
  },
  {
    role: 'TOC_ENTRY',
    label: 'Entrada de índice',
    description: 'Entrada de índice / tabla de contenidos.',
    sampleText: 'Prólogo ..................................... iii',
  },
  {
    role: 'CHAPTER_OPENING_LABEL',
    label: 'Etiqueta de apertura de capítulo',
    description: 'Etiqueta corta del hero de apertura.',
    sampleText: 'Capítulo 1',
  },
  {
    role: 'CHAPTER_OPENING_TITLE',
    label: 'Título de apertura de capítulo',
    description: 'Título principal de la apertura de capítulo.',
    sampleText: 'El llamado en la orilla',
  },
];

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function isTextAlign(value: unknown): value is BookStyleTextAlign {
  return value === 'left' || value === 'center' || value === 'right' || value === 'justify';
}

function isFontWeight(value: unknown): value is BookStyleDefinition['fontWeight'] {
  return value === 400 || value === 500 || value === 600 || value === 700;
}

function normalizeStyleDefinition(
  base: BookStyleDefinition,
  raw: Partial<BookStyleDefinition> | undefined,
): BookStyleDefinition {
  const fontSize = typeof raw?.fontSize === 'number' ? raw.fontSize : base.fontSize;
  const lineHeight = typeof raw?.lineHeight === 'number' ? raw.lineHeight : base.lineHeight;
  const letterSpacing = typeof raw?.letterSpacing === 'number' ? raw.letterSpacing : base.letterSpacing;
  const marginTop = typeof raw?.marginTop === 'number' ? raw.marginTop : base.marginTop;
  const marginBottom = typeof raw?.marginBottom === 'number' ? raw.marginBottom : base.marginBottom;
  const color = typeof raw?.color === 'string'
    ? raw.color.trim() || null
    : raw?.color === null
      ? null
      : base.color;
  const maxWidth = typeof raw?.maxWidth === 'number' ? raw.maxWidth : raw?.maxWidth === null ? null : base.maxWidth;

  return {
    fontSize: clamp(fontSize, 8, 72),
    lineHeight: clamp(lineHeight, 1, 2.4),
    textAlign: isTextAlign(raw?.textAlign) ? raw.textAlign : base.textAlign,
    fontWeight: isFontWeight(raw?.fontWeight) ? raw.fontWeight : base.fontWeight,
    letterSpacing: clamp(letterSpacing, -0.1, 0.4),
    marginTop: clamp(marginTop, 0, 72),
    marginBottom: clamp(marginBottom, 0, 72),
    color,
    maxWidth: maxWidth == null ? null : clamp(maxWidth, 20, 100),
  };
}

export function buildDefaultBookStyles(
  settings: Pick<LayoutSettings, 'bodyFontSize' | 'bodyLineHeight' | 'paragraphSpacing'>,
): BookStyleMap {
  const bodySize = settings.bodyFontSize ?? DEFAULT_LAYOUT_SETTINGS.bodyFontSize;
  const bodyLineHeight = settings.bodyLineHeight ?? DEFAULT_LAYOUT_SETTINGS.bodyLineHeight;
  const paragraphSpacing = settings.paragraphSpacing ?? DEFAULT_LAYOUT_SETTINGS.paragraphSpacing;

  return {
    TITLE: {
      fontSize: Math.round(bodySize * 2.2 * 10) / 10,
      lineHeight: 1.14,
      textAlign: 'center',
      fontWeight: 700,
      letterSpacing: 0.01,
      marginTop: 10,
      marginBottom: 12,
      color: null,
      maxWidth: 82,
    },
    HEADING_1: {
      fontSize: Math.round(bodySize * 1.7 * 10) / 10,
      lineHeight: 1.18,
      textAlign: 'left',
      fontWeight: 700,
      letterSpacing: 0,
      marginTop: 10,
      marginBottom: 8,
      color: null,
      maxWidth: null,
    },
    HEADING_2: {
      fontSize: Math.round(bodySize * 1.32 * 10) / 10,
      lineHeight: 1.22,
      textAlign: 'left',
      fontWeight: 600,
      letterSpacing: 0,
      marginTop: 8,
      marginBottom: 6,
      color: null,
      maxWidth: null,
    },
    PARAGRAPH: {
      fontSize: bodySize,
      lineHeight: bodyLineHeight,
      textAlign: 'justify',
      fontWeight: 400,
      letterSpacing: 0,
      marginTop: 0,
      marginBottom: paragraphSpacing,
      color: null,
      maxWidth: null,
    },
    QUOTE: {
      fontSize: Math.round(bodySize * 1.05 * 10) / 10,
      lineHeight: Math.min(2.2, bodyLineHeight + 0.03),
      textAlign: 'left',
      fontWeight: 400,
      letterSpacing: 0,
      marginTop: 6,
      marginBottom: 8,
      color: '#4b4b54',
      maxWidth: 86,
    },
    CENTERED_PHRASE: {
      fontSize: Math.round(bodySize * 1.08 * 10) / 10,
      lineHeight: Math.min(2.2, bodyLineHeight + 0.05),
      textAlign: 'center',
      fontWeight: 400,
      letterSpacing: 0.01,
      marginTop: 10,
      marginBottom: 10,
      color: null,
      maxWidth: 72,
    },
    TOC_ENTRY: {
      fontSize: Math.round(bodySize * 0.95 * 10) / 10,
      lineHeight: 1.24,
      textAlign: 'left',
      fontWeight: 400,
      letterSpacing: 0,
      marginTop: 2,
      marginBottom: 2,
      color: null,
      maxWidth: null,
    },
    CHAPTER_OPENING_LABEL: {
      fontSize: Math.max(10, Math.round(bodySize * 0.95 * 10) / 10),
      lineHeight: 1.2,
      textAlign: 'left',
      fontWeight: 500,
      letterSpacing: 0.08,
      marginTop: 0,
      marginBottom: 4,
      color: null,
      maxWidth: 76,
    },
    CHAPTER_OPENING_TITLE: {
      fontSize: Math.round(bodySize * 2.1 * 10) / 10,
      lineHeight: 1.1,
      textAlign: 'left',
      fontWeight: 700,
      letterSpacing: 0,
      marginTop: 0,
      marginBottom: 0,
      color: null,
      maxWidth: 78,
    },
  };
}

export function resolveBookStyles(
  settings: Pick<LayoutSettings, 'bodyFontSize' | 'bodyLineHeight' | 'paragraphSpacing' | 'stylesJson'>,
): BookStyleMap {
  const defaults = buildDefaultBookStyles(settings);
  if (!settings.stylesJson?.trim()) return defaults;

  try {
    const raw = JSON.parse(settings.stylesJson) as unknown;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaults;
    const root = raw as Record<string, unknown>;
    const resolved = {} as BookStyleMap;

    for (const role of BOOK_STYLE_ROLE_VALUES) {
      const roleRaw = root[role];
      const partial = roleRaw && typeof roleRaw === 'object' && !Array.isArray(roleRaw)
        ? roleRaw as Partial<BookStyleDefinition>
        : undefined;
      resolved[role] = normalizeStyleDefinition(defaults[role], partial);
    }

    return resolved;
  } catch {
    return defaults;
  }
}

export function serializeBookStyles(styles: BookStyleMap): string {
  const normalized = {} as Record<BookStyleRole, BookStyleDefinition>;
  for (const role of BOOK_STYLE_ROLE_VALUES) {
    normalized[role] = normalizeStyleDefinition(styles[role], styles[role]);
  }
  return JSON.stringify(normalized);
}

export function cloneBookStyles(styles: BookStyleMap): BookStyleMap {
  return JSON.parse(JSON.stringify(styles)) as BookStyleMap;
}

export function bookStyleRoleLabel(role: BookStyleRole): string {
  return BOOK_STYLE_ROLE_CATALOG.find(entry => entry.role === role)?.label ?? role;
}

export function bookStyleRoleDescription(role: BookStyleRole): string {
  return BOOK_STYLE_ROLE_CATALOG.find(entry => entry.role === role)?.description ?? '';
}

export function bookStyleRoleSampleText(role: BookStyleRole): string {
  return BOOK_STYLE_ROLE_CATALOG.find(entry => entry.role === role)?.sampleText ?? role;
}

export function resolveBookStyleRoleForBlock(
  sectionType: SectionType | null | undefined,
  block: Pick<DocumentBlock, 'blockType'>,
): BookStyleRole | null {
  if (
    block.blockType === 'CENTERED_PHRASE'
    && (
      sectionType === 'TITLE_PAGE'
      || sectionType === 'CREDITS'
      || sectionType === 'RIGHTS'
      || sectionType === 'DEDICATION'
      || sectionType === 'COLOPHON'
    )
  ) {
    return 'TITLE';
  }

  if (
    block.blockType === 'HEADING_1'
    && (
      sectionType === 'TITLE_PAGE'
      || sectionType === 'COVER'
      || sectionType === 'CREDITS'
      || sectionType === 'RIGHTS'
      || sectionType === 'DEDICATION'
    )
  ) {
    return 'TITLE';
  }

  switch (block.blockType) {
    case 'HEADING_1': return 'HEADING_1';
    case 'HEADING_2': return 'HEADING_2';
    case 'PARAGRAPH': return 'PARAGRAPH';
    case 'QUOTE': return 'QUOTE';
    case 'CENTERED_PHRASE': return 'CENTERED_PHRASE';
    default: return null;
  }
}

function widthModeToMaxWidth(widthMode: BlockLayoutStyle['widthMode']): number | null {
  switch (widthMode) {
    case 'narrow': return 72;
    case 'medium': return 86;
    default: return null;
  }
}

function emphasisOverlay(style: BookStyleDefinition, emphasis: BlockLayoutStyle['emphasis']): Partial<BookStyleDefinition> {
  switch (emphasis) {
    case 'strong':
      return {
        fontWeight: style.fontWeight >= 700 ? style.fontWeight : 700,
      };
    case 'muted':
      return {
        color: style.color ?? '#5d5d68',
      };
    default:
      return {};
  }
}

export function resolveEffectiveBookStyleInfoForBlock(
  settings: Pick<LayoutSettings, 'bodyFontSize' | 'bodyLineHeight' | 'paragraphSpacing' | 'stylesJson'>,
  section: Pick<DocumentSection, 'sectionType'> | null | undefined,
  block: Pick<DocumentBlock, 'blockType' | 'metadataJson' | 'styleVariant'>,
): ResolvedBookStyleInfo | null {
  const role = resolveBookStyleRoleForBlock(section?.sectionType ?? null, block);
  if (!role) return null;
  const base = resolveBookStyles(settings)[role];
  const blockLayout = resolveBlockLayoutOverrides(block as DocumentBlock);
  const widthMaxWidth = blockLayout.widthMode ? widthModeToMaxWidth(blockLayout.widthMode) : undefined;
  const emphasis = blockLayout.emphasis ? emphasisOverlay(base, blockLayout.emphasis) : {};
  const finalStyle: BookStyleDefinition = {
    ...base,
    textAlign: blockLayout.textAlign ?? base.textAlign,
    maxWidth: widthMaxWidth !== undefined ? widthMaxWidth : base.maxWidth,
    ...emphasis,
  };

  return {
    role,
    baseStyle: base,
    blockLayout,
    finalStyle,
  };
}

export function resolveEffectiveBookStyleForBlock(
  settings: Pick<LayoutSettings, 'bodyFontSize' | 'bodyLineHeight' | 'paragraphSpacing' | 'stylesJson'>,
  section: Pick<DocumentSection, 'sectionType'> | null | undefined,
  block: Pick<DocumentBlock, 'blockType' | 'metadataJson' | 'styleVariant'>,
): BookStyleDefinition | null {
  return resolveEffectiveBookStyleInfoForBlock(settings, section, block)?.finalStyle ?? null;
}

export function buildResolvedBookStyleDebug(info: ResolvedBookStyleInfo): string {
  return [
    `rol=${info.role}`,
    `base(size=${info.baseStyle.fontSize}, lh=${info.baseStyle.lineHeight}, align=${info.baseStyle.textAlign})`,
    `override(align=${info.blockLayout.textAlign ?? '-'}, width=${info.blockLayout.widthMode ?? '-'}, emphasis=${info.blockLayout.emphasis ?? '-'})`,
    `final(size=${info.finalStyle.fontSize}, lh=${info.finalStyle.lineHeight}, align=${info.finalStyle.textAlign}, maxWidth=${info.finalStyle.maxWidth ?? '-'}, weight=${info.finalStyle.fontWeight})`,
  ].join(' · ');
}

export function buildBookStyleCss(
  style: BookStyleDefinition,
  options: {
    includeMargins?: boolean;
    includeMaxWidth?: boolean;
  } = {},
): string {
  const parts = [
    `font-size:${style.fontSize}pt`,
    `line-height:${style.lineHeight}`,
    `text-align:${style.textAlign}`,
    `font-weight:${style.fontWeight}`,
    `letter-spacing:${style.letterSpacing}em`,
  ];
  if (options.includeMargins !== false) {
    parts.push(`margin-top:${style.marginTop}pt`);
    parts.push(`margin-bottom:${style.marginBottom}pt`);
  }
  if (style.color) parts.push(`color:${style.color}`);
  if (options.includeMaxWidth !== false && style.maxWidth != null) {
    parts.push(`max-width:${style.maxWidth}%`);
    if (style.textAlign === 'right') {
      parts.push('margin-inline:auto 0');
    } else if (style.textAlign === 'left') {
      parts.push('margin-inline:0 auto');
    } else {
      parts.push('margin-inline:auto');
    }
  }
  return parts.join(';');
}
