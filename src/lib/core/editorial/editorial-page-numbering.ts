import type { LayoutSettings } from '$lib/core/domain/layout';
import type { SectionType, DocumentSection } from '$lib/core/domain/section';
import type { RenderedPage } from './page-layout-model';
import { resolveSectionEditorialRules } from './section-type-catalog';

export type EditorialNumberingScope = 'frontmatter' | 'body' | null;

export interface PageEditorialFrame {
  physicalPageNumber: number;
  numberingScope: EditorialNumberingScope;
  editorialOrdinal: number | null;
  editorialLabel: string | null;
  showPageNumber: boolean;
  headerText: string | null;
  footerText: string | null;
}

const NEVER_NUMBERED_SECTION_TYPES = new Set<SectionType | 'BLANK_PAGE'>([
  'COVER',
  'BACK_COVER',
  'BLANK',
  'BLANK_PAGE',
]);

function parseHiddenSectionTypes(settings: LayoutSettings): Set<string> {
  try {
    const parsed = JSON.parse(settings.hideNumberOnSectionTypes);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((value): value is string => typeof value === 'string'));
    }
  } catch {
    // noop
  }
  return new Set();
}

function toRoman(value: number): string {
  if (value <= 0) return '';
  const numerals: Array<[number, string]> = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let remaining = value;
  let result = '';
  for (const [amount, glyph] of numerals) {
    while (remaining >= amount) {
      result += glyph;
      remaining -= amount;
    }
  }
  return result;
}

function formatEditorialNumber(
  scope: EditorialNumberingScope,
  ordinal: number,
  settings: LayoutSettings,
): string | null {
  if (scope === 'frontmatter') {
    if (settings.frontmatterNumberingStyle === 'none') return null;
    const roman = toRoman(ordinal);
    return settings.frontmatterNumberingStyle === 'roman-upper'
      ? roman
      : roman.toLowerCase();
  }
  if (scope === 'body') {
    return String(ordinal);
  }
  return null;
}

function resolveBodyStartSectionId(
  sections: DocumentSection[],
  settings: LayoutSettings,
): string | null {
  if (settings.bodyStartsAtSectionId) return settings.bodyStartsAtSectionId;
  return sections.find(section => section.sectionType === 'CHAPTER')?.id
    ?? sections[0]?.id
    ?? null;
}

function pageCountsTowardNumbering(page: RenderedPage): boolean {
  if (page.kind === 'editorial_blank') return false;
  const key = page.primarySectionType ?? 'BLANK_PAGE';
  return !NEVER_NUMBERED_SECTION_TYPES.has(key);
}

function shouldShowPageNumber(
  page: RenderedPage,
  section: DocumentSection | undefined,
  hiddenSectionTypes: Set<string>,
  settings: LayoutSettings,
  editorialLabel: string | null,
): boolean {
  if (!settings.showPageNumbers || !settings.showFooter || !editorialLabel) return false;
  if (page.kind === 'editorial_blank') return false;
  if (!page.primarySectionType) return false;
  if (NEVER_NUMBERED_SECTION_TYPES.has(page.primarySectionType)) return false;
  if (section && !resolveSectionEditorialRules(section).showPageNumber) return false;
  if (section && !resolveSectionEditorialRules(section).allowFooter) return false;
  return !hiddenSectionTypes.has(page.primarySectionType);
}

function resolveHeaderText(
  page: RenderedPage,
  section: DocumentSection | undefined,
  bookTitle: string,
  settings: LayoutSettings,
): string | null {
  if (!settings.showHeader || page.kind !== 'content') return null;
  if (!page.primarySectionType || NEVER_NUMBERED_SECTION_TYPES.has(page.primarySectionType)) {
    return null;
  }
  if (section && !resolveSectionEditorialRules(section).allowHeader) return null;
  return page.primarySectionTitle?.trim() || bookTitle.trim() || null;
}

export function buildEditorialFrames(params: {
  pages: RenderedPage[];
  sections: DocumentSection[];
  bookTitle: string;
  settings: LayoutSettings;
}): PageEditorialFrame[] {
  const { pages, sections, bookTitle, settings } = params;
  const bodyStartSectionId = resolveBodyStartSectionId(sections, settings);
  const hiddenSectionTypes = parseHiddenSectionTypes(settings);
  const sectionsById = new Map<string, DocumentSection>(sections.map(section => [section.id, section]));

  let bodyStarted = false;
  let frontmatterOrdinal = 0;
  let bodyOrdinal = Math.max(1, settings.pageNumberStart);

  return pages.map(page => {
    const section = page.primarySectionId ? sectionsById.get(page.primarySectionId) : undefined;
    if (!bodyStarted && bodyStartSectionId && page.primarySectionId === bodyStartSectionId) {
      bodyStarted = true;
    }

    const countsTowardNumbering = pageCountsTowardNumbering(page);
    const numberingScope: EditorialNumberingScope = countsTowardNumbering
      ? (bodyStarted ? 'body' : 'frontmatter')
      : null;

    let editorialOrdinal: number | null = null;
    if (numberingScope === 'frontmatter') {
      frontmatterOrdinal += 1;
      editorialOrdinal = frontmatterOrdinal;
    } else if (numberingScope === 'body') {
      editorialOrdinal = bodyOrdinal;
      bodyOrdinal += 1;
    }

    const editorialLabel = editorialOrdinal != null
      ? formatEditorialNumber(numberingScope, editorialOrdinal, settings)
      : null;

    const showPageNumber = shouldShowPageNumber(page, section, hiddenSectionTypes, settings, editorialLabel);
    const headerText = resolveHeaderText(page, section, bookTitle, settings);
    const footerText = showPageNumber ? editorialLabel : null;

    return {
      physicalPageNumber: page.visualPageNumber,
      numberingScope,
      editorialOrdinal,
      editorialLabel,
      showPageNumber,
      headerText,
      footerText,
    };
  });
}
