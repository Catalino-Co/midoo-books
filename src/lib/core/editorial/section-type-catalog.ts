/**
 * src/lib/core/editorial/section-type-catalog.ts
 *
 * Catálogo editorial de tipos de sección: etiquetas en español, agrupación UI
 * y defaults al crear una sección. Sin dependencias de Svelte ni Electron.
 *
 * La lista de tipos canónicos viene del dominio (`SectionType`).
 */

import type { SectionType } from '$lib/core/domain/section';

/** Defaults editoriales aplicados al crear una sección si no se indican explícitos. */
export interface SectionCreationDefaults {
  includeInToc:     boolean;
  startOnRightPage: boolean;
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

/** Defaults por tipo (PARTE 4.5 — reglas iniciales, editables luego por el usuario). */
const DEFAULTS: Record<SectionType, SectionCreationDefaults> = {
  COVER:            { includeInToc: false, startOnRightPage: true  },
  BACK_COVER:       { includeInToc: false, startOnRightPage: false },
  BLANK:            { includeInToc: false, startOnRightPage: false },
  TITLE_PAGE:       { includeInToc: false, startOnRightPage: true  },
  CREDITS:          { includeInToc: false, startOnRightPage: false },
  RIGHTS:           { includeInToc: false, startOnRightPage: false },
  DEDICATION:       { includeInToc: false, startOnRightPage: false },
  TOC:              { includeInToc: false, startOnRightPage: true  },
  PREFACE:          { includeInToc: true,  startOnRightPage: true  },
  PROLOGUE:         { includeInToc: true,  startOnRightPage: true  },
  CHAPTER:          { includeInToc: true,  startOnRightPage: true  },
  EPILOGUE:         { includeInToc: true,  startOnRightPage: true  },
  APPENDIX:         { includeInToc: true,  startOnRightPage: true  },
  AUTHOR_NOTE:      { includeInToc: true,  startOnRightPage: false },
  BIBLIOGRAPHY:     { includeInToc: true,  startOnRightPage: true  },
  INDEX_ANALYTICAL: { includeInToc: true,  startOnRightPage: true  },
  COLOPHON:         { includeInToc: false, startOnRightPage: false },
  SPECIAL:          { includeInToc: false, startOnRightPage: false },
};

const _catalogByType = new Map<SectionType, SectionTypeMeta>(
  SECTION_TYPE_CATALOG.map(m => [m.type, m]),
);

export function getSectionCreationDefaults(type: SectionType): SectionCreationDefaults {
  const d = DEFAULTS[type] ?? DEFAULTS.CHAPTER;
  return { ...d };
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
