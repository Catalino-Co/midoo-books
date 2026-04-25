import { getPlatformAdapter } from '$lib/persistence';
import type {
  LayoutSettings,
  UpdateLayoutSettingsInput,
  FrontmatterNumberingStyle,
} from '$lib/core/domain/index';
import { DEFAULT_HIDE_PAGE_NUMBER_SECTION_TYPES } from '$lib/core/domain/index';
import {
  parseTocConfig,
  serializeTocConfig,
  DEFAULT_TOC_CONFIG,
  type TocConfig,
} from '$lib/core/editorial/toc-model';

export async function getLayoutSettings(bookId: string): Promise<LayoutSettings> {
  return getPlatformAdapter().getLayoutSettingsByBookId(bookId);
}

export async function updateLayoutSettings(
  bookId: string,
  input: UpdateLayoutSettingsInput,
): Promise<LayoutSettings | null> {
  return getPlatformAdapter().updateLayoutSettingsByBookId(bookId, input);
}

export const FRONTMATTER_NUMBERING_STYLE_OPTIONS: FrontmatterNumberingStyle[] = [
  'none',
  'roman-lower',
  'roman-upper',
];

export function frontmatterNumberingStyleLabel(style: FrontmatterNumberingStyle): string {
  switch (style) {
    case 'none': return 'Sin numeración';
    case 'roman-lower': return 'Romanos minúsculos';
    case 'roman-upper': return 'Romanos mayúsculos';
    default: return style;
  }
}

export function parseHiddenPageNumberSectionTypes(rawJson: string): string[] {
  try {
    const parsed = JSON.parse(rawJson);
    if (Array.isArray(parsed)) {
      return parsed.filter((value): value is string => typeof value === 'string');
    }
  } catch {
    // noop
  }
  return [...DEFAULT_HIDE_PAGE_NUMBER_SECTION_TYPES];
}

export function parseLayoutTocConfig(rawJson: string | null | undefined): TocConfig {
  return parseTocConfig(rawJson);
}

export function serializeLayoutTocConfig(config: TocConfig): string {
  return serializeTocConfig(config);
}

export { DEFAULT_TOC_CONFIG, type TocConfig };
