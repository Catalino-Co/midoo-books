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
