/**
 * book-templates.service.ts — aplica una plantilla (book-templates.ts) a un libro
 * con los servicios de siempre (maqueta, secciones, bloques).
 */

import { updateLayoutSettings } from './layout.service';
import { createBlock, createSection, listSections } from './content.service';
import {
  getBookTemplate,
  type BookTemplateId,
  type TemplateContext,
} from '$lib/core/editorial/book-templates';

/** Solo el diseño: tamaño, márgenes, tipografía, estilos, pie, fondo. No toca el contenido. */
export async function applyTemplateDesign(bookId: string, templateId: BookTemplateId): Promise<void> {
  const t = getBookTemplate(templateId);
  const patch = t.layout();
  if (Object.keys(patch).length === 0) return;
  await updateLayoutSettings(bookId, patch);
}

/** Diseño + secciones y bloques de ejemplo (para libros nuevos). */
export async function applyBookTemplate(
  bookId: string,
  templateId: BookTemplateId,
  ctx: Omit<TemplateContext, 'year'> & { year?: number },
): Promise<void> {
  const t = getBookTemplate(templateId);
  await applyTemplateDesign(bookId, templateId);
  const existing = await listSections(bookId);
  let order = existing.length;
  for (const s of t.scaffold({ ...ctx, year: ctx.year ?? new Date().getFullYear() })) {
    const section = await createSection({
      bookId,
      sectionType: s.sectionType,
      title: s.title,
      orderIndex: order++,
      includeInToc: s.includeInToc,
      startOnRightPage: s.startOnRightPage,
      settingsJson: s.settingsJson ?? null,
    });
    let bi = 0;
    for (const b of s.blocks) {
      await createBlock({
        sectionId: section.id,
        blockType: b.blockType,
        contentText: b.contentText ?? '',
        contentJson: b.contentJson ?? null,
        metadataJson: b.metadataJson ?? null,
        styleVariant: b.styleVariant ?? 'default',
        orderIndex: bi++,
      });
    }
  }
}
