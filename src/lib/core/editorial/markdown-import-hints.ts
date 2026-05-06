/**
 * Sugerencias de destino para importación Markdown unificada (sección vs libro).
 */

import { validateMarkdownBookForImport, segmentMarkdownBookByH1 } from './markdown-book-import';
import { parseMarkdownToBlockDrafts } from './markdown-to-blocks';

export type MarkdownImportTargetHint = 'section' | 'book';

export interface MarkdownImportHint {
  /** Destino que encaja mejor con el texto actual; null si aún no hay señal clara. */
  suggested: MarkdownImportTargetHint | null;
  /** Mensaje breve para la UI (una frase). */
  message: string;
}

/**
 * Heurística ligera: varios `#` de sección → libro; solo bloques sin libro válido → sección;
 * un solo `#` → ambos válidos, mensaje neutro.
 */
export function inferMarkdownImportSuggestion(source: string): MarkdownImportHint {
  const t = source.trim();
  if (!t.length) {
    return { suggested: null, message: '' };
  }

  const bookValidation = validateMarkdownBookForImport(t);
  const h1Sections = bookValidation.ok ? segmentMarkdownBookByH1(t).length : 0;
  const sectionDrafts = parseMarkdownToBlockDrafts(t);

  if (bookValidation.ok && h1Sections >= 2) {
    return {
      suggested: 'book',
      message: `Detectamos ${h1Sections} partes con título #. Suele encajar «Todo el libro» (cada # crea una sección nueva).`,
    };
  }

  if (bookValidation.ok && h1Sections === 1) {
    return {
      suggested: 'section',
      message:
        'Hay un solo título #. Puedes usar «Todo el libro» (una sección) o «Sección actual» (el # se importa como encabezado dentro de la sección).',
    };
  }

  if (!bookValidation.ok && sectionDrafts.length > 0) {
    return {
      suggested: 'section',
      message:
        'No hay estructura de libro con #. Importa como bloques en la sección actual, o añade títulos # si quieres varias secciones.',
    };
  }

  if (bookValidation.ok && h1Sections >= 1 && sectionDrafts.length === 0) {
    return {
      suggested: 'book',
      message: 'Solo hay títulos de sección sin cuerpo todavía; puedes importar como libro y rellenar después.',
    };
  }

  return { suggested: null, message: '' };
}
