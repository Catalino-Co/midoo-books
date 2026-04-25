import type { SectionType } from '$lib/core/domain/section';

export type TocEntrySourceType = 'section';

export interface TocEntry {
  label: string;
  targetSectionId: string;
  targetSectionType: SectionType;
  pageNumberVisible: string | null;
  orderIndex: number;
  level: number;
  sourceType: TocEntrySourceType;
}

export interface TocConfig {
  showTitle: boolean;
  titleText: string;
  showDotLeaders: boolean;
}

export const DEFAULT_TOC_CONFIG: TocConfig = {
  showTitle: true,
  titleText: 'Índice',
  showDotLeaders: true,
};

export function parseTocConfig(rawJson: string | null | undefined): TocConfig {
  if (!rawJson) return { ...DEFAULT_TOC_CONFIG };
  try {
    const parsed = JSON.parse(rawJson) as Partial<TocConfig>;
    return {
      showTitle: parsed.showTitle ?? DEFAULT_TOC_CONFIG.showTitle,
      titleText: typeof parsed.titleText === 'string' && parsed.titleText.trim() !== ''
        ? parsed.titleText
        : DEFAULT_TOC_CONFIG.titleText,
      showDotLeaders: parsed.showDotLeaders ?? DEFAULT_TOC_CONFIG.showDotLeaders,
    };
  } catch {
    return { ...DEFAULT_TOC_CONFIG };
  }
}

export function serializeTocConfig(config: TocConfig): string {
  return JSON.stringify(config);
}

