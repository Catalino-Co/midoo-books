/**
 * Heurística v1 para inferir SectionType desde el título visible de una sección
 * (importación Markdown de libro completo). Extensible por lista de reglas.
 */

import type { SectionType } from '$lib/core/domain/section';

/** Quita marcas diacríticas para comparar títulos en español de forma estable. */
function foldAccents(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '');
}

/**
 * Infiere el tipo editorial a partir del título del `#` en el manuscrito.
 * Orden de reglas: patrones más específicos antes que los genéricos.
 */
export function inferSectionTypeFromTitle(rawTitle: string): SectionType {
  const t   = rawTitle.trim();
  const key = foldAccents(t).toLowerCase().replace(/\s+/g, ' ').trim();
  if (!key) return 'SPECIAL';

  if (key === 'portada') return 'COVER';
  if (key === 'contraportada') return 'BACK_COVER';

  if (key.includes('indice analitico')) return 'INDEX_ANALYTICAL';
  if (
    key === 'indice'
    || key.includes('tabla de contenidos')
    || key.includes('tabla de contenido')
  ) {
    return 'TOC';
  }

  if (key.includes('detalle de edicion') || key === 'creditos') {
    return 'CREDITS';
  }
  if (key.includes('derechos')) {
    return 'RIGHTS';
  }
  if (key === 'dedicatoria') return 'DEDICATION';
  if (key === 'prologo') return 'PROLOGUE';
  if (key === 'prefacio') return 'PREFACE';
  if (key === 'epilogo') return 'EPILOGUE';
  if (key.includes('palabras de autor')) return 'AUTHOR_NOTE';
  if (key === 'bibliografia') return 'BIBLIOGRAPHY';
  if (key === 'colofon') return 'COLOPHON';
  if (key === 'apendice' || key.startsWith('apendice ')) return 'APPENDIX';

  if (key.startsWith('capitulo ') || key.startsWith('capítulo ')) {
    return 'CHAPTER';
  }
  // "Capítulo 1: ..." sin espacio tras stem (fold ya unificó á)
  if (/^capitulo\s*\d+/u.test(key) || /^capitulo\s*:/u.test(key)) {
    return 'CHAPTER';
  }

  // Desconocido: conservador (no asumir capítulo de ficción)
  return 'SPECIAL';
}
