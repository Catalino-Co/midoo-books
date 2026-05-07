/**
 * src/lib/core/editorial/section-type-catalog.ts
 *
 * Catálogo editorial de tipos de sección: etiquetas en español, agrupación UI
 * y defaults al crear una sección. Sin dependencias de Svelte ni Electron.
 *
 * La lista de tipos canónicos viene del dominio (`SectionType`).
 */

import type { DocumentSection, SectionType } from '$lib/core/domain/section';

/** Defaults editoriales aplicados al crear una sección si no se indican explícitos. */
export interface SectionCreationDefaults {
  includeInToc:     boolean;
  startOnRightPage: boolean;
}

export type SectionDefaultTextAlign = 'left' | 'center' | 'justify';
export type SectionDefaultOpeningBehavior = 'none' | 'chapter-opening' | 'standalone';

export interface SectionEditorialPreset extends SectionCreationDefaults {
  showPageNumber: boolean;
  allowHeader: boolean;
  allowFooter: boolean;
  defaultTextAlign: SectionDefaultTextAlign;
  defaultOpeningBehavior: SectionDefaultOpeningBehavior;
  isStandalonePage: boolean;
}

export interface SectionEditorialRules extends SectionEditorialPreset {
  sectionType: SectionType;
}

export interface SectionSettingsOverrides {
  showPageNumber?: boolean;
  allowHeader?: boolean;
  allowFooter?: boolean;
  defaultTextAlign?: SectionDefaultTextAlign;
  defaultOpeningBehavior?: SectionDefaultOpeningBehavior;
  isStandalonePage?: boolean;
}

/**
 * Entrada del catálogo (una fila por tipo canónico).
 */
export interface SectionTypeMeta {
  type:   SectionType;
  label:  string;
  badge:  string;
  group:  SectionTypeGroup;
}

export type SectionTypeGroup =
  | 'external'
  | 'frontmatter'
  | 'body'
  | 'backmatter'
  | 'special';

export const SECTION_GROUP_LABELS: Record<SectionTypeGroup, string> = {
  external:    'Externas',
  frontmatter: 'Páginas iniciales',
  body:        'Cuerpo',
  backmatter:  'Páginas finales',
  special:     'Especial',
};

/**
 * Orden fijo del catálogo: define orden en selectores y en ALL_SECTION_TYPES.
 */
export const SECTION_TYPE_CATALOG: SectionTypeMeta[] = [
  { type: 'COVER',             label: 'Portada',                     badge: 'Portada',       group: 'external'    },
  { type: 'BACK_COVER',        label: 'Contraportada',               badge: 'Contrap.',      group: 'external'    },
  { type: 'BLANK',             label: 'En blanco',                   badge: 'Blanco',        group: 'external'    },
  { type: 'TITLE_PAGE',        label: 'Página de título',            badge: 'Título',        group: 'frontmatter' },
  { type: 'CREDITS',           label: 'Créditos',                    badge: 'Créditos',      group: 'frontmatter' },
  { type: 'RIGHTS',            label: 'Derechos / detalle legal',    badge: 'Derechos',      group: 'frontmatter' },
  { type: 'DEDICATION',        label: 'Dedicatoria',                 badge: 'Dedicat.',      group: 'frontmatter' },
  { type: 'TOC',               label: 'Índice / tabla de contenidos', badge: 'Índice',     group: 'frontmatter' },
  { type: 'PREFACE',           label: 'Prefacio',                    badge: 'Prefacio',      group: 'frontmatter' },
  { type: 'PROLOGUE',          label: 'Prólogo',                     badge: 'Prólogo',       group: 'frontmatter' },
  { type: 'CHAPTER',           label: 'Capítulo',                    badge: 'Capítulo',      group: 'body'        },
  { type: 'EPILOGUE',          label: 'Epílogo',                     badge: 'Epílogo',       group: 'backmatter'  },
  { type: 'APPENDIX',          label: 'Apéndice',                    badge: 'Apéndice',      group: 'backmatter'  },
  { type: 'AUTHOR_NOTE',       label: 'Palabras de autor',           badge: 'Autor',         group: 'backmatter'  },
  { type: 'BIBLIOGRAPHY',      label: 'Bibliografía',                badge: 'Bibliogr.',     group: 'backmatter'  },
  { type: 'INDEX_ANALYTICAL',  label: 'Índice analítico',            badge: 'Analítico',     group: 'backmatter'  },
  { type: 'COLOPHON',          label: 'Colofón',                     badge: 'Colofón',       group: 'backmatter'  },
  { type: 'SPECIAL',           label: 'Sección especial',            badge: 'Especial',      group: 'special'     },
];

/** Presets editoriales por tipo: base centralizada y extensible. */
const PRESETS: Record<SectionType, SectionEditorialPreset> = {
  COVER: {
    includeInToc: false,
    startOnRightPage: true,
    showPageNumber: false,
    allowHeader: false,
    allowFooter: false,
    defaultTextAlign: 'center',
    defaultOpeningBehavior: 'standalone',
    isStandalonePage: true,
  },
  BACK_COVER: {
    includeInToc: false,
    startOnRightPage: false,
    showPageNumber: false,
    allowHeader: false,
    allowFooter: false,
    defaultTextAlign: 'center',
    defaultOpeningBehavior: 'standalone',
    isStandalonePage: true,
  },
  BLANK: {
    includeInToc: false,
    startOnRightPage: false,
    showPageNumber: false,
    allowHeader: false,
    allowFooter: false,
    defaultTextAlign: 'center',
    defaultOpeningBehavior: 'standalone',
    isStandalonePage: true,
  },
  TITLE_PAGE: {
    includeInToc: false,
    startOnRightPage: true,
    showPageNumber: false,
    allowHeader: false,
    allowFooter: false,
    defaultTextAlign: 'center',
    defaultOpeningBehavior: 'standalone',
    isStandalonePage: true,
  },
  CREDITS: {
    includeInToc: false,
    startOnRightPage: false,
    showPageNumber: false,
    allowHeader: false,
    allowFooter: false,
    defaultTextAlign: 'left',
    defaultOpeningBehavior: 'standalone',
    isStandalonePage: true,
  },
  RIGHTS: {
    includeInToc: false,
    startOnRightPage: false,
    showPageNumber: false,
    allowHeader: false,
    allowFooter: false,
    defaultTextAlign: 'left',
    defaultOpeningBehavior: 'standalone',
    isStandalonePage: true,
  },
  DEDICATION: {
    includeInToc: false,
    startOnRightPage: false,
    showPageNumber: false,
    allowHeader: false,
    allowFooter: false,
    defaultTextAlign: 'center',
    defaultOpeningBehavior: 'standalone',
    isStandalonePage: true,
  },
  TOC: {
    includeInToc: false,
    startOnRightPage: true,
    showPageNumber: true,
    allowHeader: false,
    allowFooter: true,
    defaultTextAlign: 'left',
    defaultOpeningBehavior: 'none',
    isStandalonePage: false,
  },
  PREFACE: {
    includeInToc: true,
    startOnRightPage: true,
    showPageNumber: true,
    allowHeader: true,
    allowFooter: true,
    defaultTextAlign: 'left',
    defaultOpeningBehavior: 'none',
    isStandalonePage: false,
  },
  PROLOGUE: {
    includeInToc: true,
    startOnRightPage: true,
    showPageNumber: true,
    allowHeader: true,
    allowFooter: true,
    defaultTextAlign: 'left',
    defaultOpeningBehavior: 'none',
    isStandalonePage: false,
  },
  CHAPTER: {
    includeInToc: true,
    startOnRightPage: true,
    showPageNumber: true,
    allowHeader: true,
    allowFooter: true,
    defaultTextAlign: 'justify',
    defaultOpeningBehavior: 'chapter-opening',
    isStandalonePage: false,
  },
  EPILOGUE: {
    includeInToc: true,
    startOnRightPage: true,
    showPageNumber: true,
    allowHeader: true,
    allowFooter: true,
    defaultTextAlign: 'left',
    defaultOpeningBehavior: 'none',
    isStandalonePage: false,
  },
  APPENDIX: {
    includeInToc: true,
    startOnRightPage: true,
    showPageNumber: true,
    allowHeader: true,
    allowFooter: true,
    defaultTextAlign: 'left',
    defaultOpeningBehavior: 'none',
    isStandalonePage: false,
  },
  AUTHOR_NOTE: {
    includeInToc: true,
    startOnRightPage: false,
    showPageNumber: true,
    allowHeader: true,
    allowFooter: true,
    defaultTextAlign: 'left',
    defaultOpeningBehavior: 'none',
    isStandalonePage: false,
  },
  BIBLIOGRAPHY: {
    includeInToc: true,
    startOnRightPage: true,
    showPageNumber: true,
    allowHeader: true,
    allowFooter: true,
    defaultTextAlign: 'left',
    defaultOpeningBehavior: 'none',
    isStandalonePage: false,
  },
  INDEX_ANALYTICAL: {
    includeInToc: true,
    startOnRightPage: true,
    showPageNumber: true,
    allowHeader: true,
    allowFooter: true,
    defaultTextAlign: 'left',
    defaultOpeningBehavior: 'none',
    isStandalonePage: false,
  },
  COLOPHON: {
    includeInToc: false,
    startOnRightPage: false,
    showPageNumber: false,
    allowHeader: false,
    allowFooter: false,
    defaultTextAlign: 'left',
    defaultOpeningBehavior: 'standalone',
    isStandalonePage: true,
  },
  SPECIAL: {
    includeInToc: false,
    startOnRightPage: false,
    showPageNumber: true,
    allowHeader: true,
    allowFooter: true,
    defaultTextAlign: 'left',
    defaultOpeningBehavior: 'none',
    isStandalonePage: false,
  },
};

const _catalogByType = new Map<SectionType, SectionTypeMeta>(
  SECTION_TYPE_CATALOG.map(m => [m.type, m]),
);

export function getSectionCreationDefaults(type: SectionType): SectionCreationDefaults {
  const d = PRESETS[type] ?? PRESETS.CHAPTER;
  return {
    includeInToc: d.includeInToc,
    startOnRightPage: d.startOnRightPage,
  };
}

export function getSectionEditorialPreset(type: SectionType): SectionEditorialPreset {
  const preset = PRESETS[type] ?? PRESETS.CHAPTER;
  return { ...preset };
}

export function parseSectionSettingsOverrides(rawJson: string | null | undefined): SectionSettingsOverrides {
  if (!rawJson) return {};
  try {
    const parsed = JSON.parse(rawJson) as SectionSettingsOverrides;
    return {
      showPageNumber: typeof parsed.showPageNumber === 'boolean' ? parsed.showPageNumber : undefined,
      allowHeader: typeof parsed.allowHeader === 'boolean' ? parsed.allowHeader : undefined,
      allowFooter: typeof parsed.allowFooter === 'boolean' ? parsed.allowFooter : undefined,
      defaultTextAlign: parsed.defaultTextAlign === 'left' || parsed.defaultTextAlign === 'center' || parsed.defaultTextAlign === 'justify'
        ? parsed.defaultTextAlign
        : undefined,
      defaultOpeningBehavior: parsed.defaultOpeningBehavior === 'none'
        || parsed.defaultOpeningBehavior === 'chapter-opening'
        || parsed.defaultOpeningBehavior === 'standalone'
        ? parsed.defaultOpeningBehavior
        : undefined,
      isStandalonePage: typeof parsed.isStandalonePage === 'boolean' ? parsed.isStandalonePage : undefined,
    };
  } catch {
    return {};
  }
}

export function resolveSectionEditorialRules(section: Pick<DocumentSection, 'sectionType' | 'includeInToc' | 'startOnRightPage' | 'settingsJson'>): SectionEditorialRules {
  const preset = getSectionEditorialPreset(section.sectionType);
  const overrides = parseSectionSettingsOverrides(section.settingsJson);
  return {
    sectionType: section.sectionType,
    includeInToc: section.includeInToc,
    startOnRightPage: section.startOnRightPage,
    showPageNumber: overrides.showPageNumber ?? preset.showPageNumber,
    allowHeader: overrides.allowHeader ?? preset.allowHeader,
    allowFooter: overrides.allowFooter ?? preset.allowFooter,
    defaultTextAlign: overrides.defaultTextAlign ?? preset.defaultTextAlign,
    defaultOpeningBehavior: overrides.defaultOpeningBehavior ?? preset.defaultOpeningBehavior,
    isStandalonePage: overrides.isStandalonePage ?? preset.isStandalonePage,
  };
}

export function sectionPropertyIsOverridden(
  section: Pick<DocumentSection, 'sectionType' | 'includeInToc' | 'startOnRightPage' | 'settingsJson'>,
  property: keyof SectionEditorialPreset,
): boolean {
  const preset = getSectionEditorialPreset(section.sectionType);
  const overrides = parseSectionSettingsOverrides(section.settingsJson);
  if (property === 'includeInToc') return section.includeInToc !== preset.includeInToc;
  if (property === 'startOnRightPage') return section.startOnRightPage !== preset.startOnRightPage;
  return overrides[property] !== undefined && overrides[property] !== preset[property];
}

export function sectionOpeningBehaviorLabel(behavior: SectionDefaultOpeningBehavior): string {
  switch (behavior) {
    case 'chapter-opening': return 'Apertura de capítulo';
    case 'standalone': return 'Página independiente';
    default: return 'Flujo normal';
  }
}

export function sectionDefaultTextAlignLabel(textAlign: SectionDefaultTextAlign): string {
  switch (textAlign) {
    case 'center': return 'Centrado';
    case 'justify': return 'Justificado';
    default: return 'Izquierda';
  }
}

export function sectionTypeLabel(type: SectionType): string {
  return _catalogByType.get(type)?.label ?? type;
}

export function sectionTypeBadge(type: SectionType): string {
  return _catalogByType.get(type)?.badge ?? type;
}

export const ALL_SECTION_TYPES: SectionType[] = SECTION_TYPE_CATALOG.map(m => m.type);

const GROUP_ORDER: SectionTypeGroup[] = [
  'external',
  'frontmatter',
  'body',
  'backmatter',
  'special',
];

/** Metadatos agrupados para selectores con cabeceras (orden de grupos estable). */
export const SECTION_TYPES_BY_GROUP: Record<SectionTypeGroup, SectionTypeMeta[]> =
  GROUP_ORDER.reduce((acc, g) => {
    acc[g] = SECTION_TYPE_CATALOG.filter(m => m.group === g);
    return acc;
  }, {} as Record<SectionTypeGroup, SectionTypeMeta[]>);

/** SVG path `d=` (24×24 viewBox) por tipo de sección, para el panel lateral. */
export function sectionTypeIconPath(type: SectionType): string {
  switch (type) {
    case 'COVER':
      return 'M4 2h12l4 4v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM4 2v18M16 2v4h4';
    case 'BACK_COVER':
      return 'M20 2H8a1 1 0 0 0-1 1v17a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1zM20 2v18M4 6v13';
    case 'BLANK':
      return 'M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z';
    case 'TITLE_PAGE':
      return 'M4 4h16v16H4zM9 9h6M9 12h6M9 15h4';
    case 'CREDITS':
    case 'RIGHTS':
      return 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 0 2-2h2a2 2 0 0 0 2 2M9 12h6M9 16h4';
    case 'DEDICATION':
      return 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z';
    case 'TOC':
      return 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01';
    case 'PREFACE':
    case 'PROLOGUE':
      return 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z';
    case 'CHAPTER':
      return 'M12 3v18M6 3v18M6 12h6';
    case 'EPILOGUE':
      return 'M3 21c3 0 7-1 7-8V5c0-1.25-.75-2-2-2H4c-1.25 0-2 .75-2 2v11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v2zm12 0c3 0 7-1 7-8V5c0-1.25-.75-2-2-2h-4c-1.25 0-2 .75-2 2v11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v2z';
    case 'APPENDIX':
      return 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8';
    case 'AUTHOR_NOTE':
      return 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z';
    case 'BIBLIOGRAPHY':
      return 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z';
    case 'INDEX_ANALYTICAL':
      return 'M11 17a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM21 21l-4.35-4.35M8 11h6M11 8v6';
    case 'COLOPHON':
      return 'M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10zM12 8h.01M11 12h1v4h1';
    case 'SPECIAL':
      return 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';
    default:
      return 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z';
  }
}
