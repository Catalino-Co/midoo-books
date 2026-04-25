import type { DocumentSection } from '$lib/core/domain/section';
import type { RenderedPage } from './page-layout-model';
import type { TocConfig, TocEntry } from './toc-model';
import { parseTocConfig } from './toc-model';

export const TOC_MARKER = '[[TOC]]';

export function blockContainsTocMarker(text: string): boolean {
  return text.trim() === TOC_MARKER;
}

export function buildTocEntries(params: {
  sections: DocumentSection[];
  pages: RenderedPage[];
}): TocEntry[] {
  const { sections, pages } = params;
  const sortedSections = [...sections].sort((a, b) => a.orderIndex - b.orderIndex);

  return sortedSections
    .filter(section => section.includeInToc && section.title.trim() !== '')
    .map((section, index) => {
      const firstPage = pages.find(page => page.primarySectionId === section.id);
      return {
        label: section.title.trim(),
        targetSectionId: section.id,
        targetSectionType: section.sectionType,
        pageNumberVisible: firstPage?.editorialPageLabel ?? null,
        orderIndex: index,
        level: 1,
        sourceType: 'section',
      };
    });
}

export function resolveTocConfig(rawJson: string | null | undefined): TocConfig {
  return parseTocConfig(rawJson);
}
