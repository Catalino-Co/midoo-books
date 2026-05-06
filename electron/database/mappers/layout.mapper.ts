import type { SqlValue } from 'sql.js';
import type { LayoutSettings, PageSizePresetId } from '../../../src/lib/core/domain/layout';
import { DEFAULT_LAYOUT_SETTINGS } from '../../../src/lib/core/domain/layout';
import { detectPageSizePreset } from '../../../src/lib/core/editorial/page-size-presets';

declare const LayoutSettingsIdBrand: unique symbol;

function asLayoutSettingsId(id: string): LayoutSettings['id'] {
  return id as LayoutSettings['id'];
}

const PRESET_IDS = new Set<PageSizePresetId>(['A5', 'LETTER', 'TRADE_6X9', 'A4', 'CUSTOM']);

function parsePageSizePreset(raw: unknown): PageSizePresetId {
  const s = String(raw ?? '').trim();
  if (PRESET_IDS.has(s as PageSizePresetId)) return s as PageSizePresetId;
  return 'CUSTOM';
}

export function rowToLayoutSettings(row: Record<string, SqlValue>): LayoutSettings {
  const pageWidth = Number(row.page_width ?? DEFAULT_LAYOUT_SETTINGS.pageWidth);
  const pageHeight = Number(row.page_height ?? DEFAULT_LAYOUT_SETTINGS.pageHeight);
  const pageUnit = (String(row.page_unit ?? DEFAULT_LAYOUT_SETTINGS.pageUnit)) as LayoutSettings['pageUnit'];
  const presetFromRow = row.page_size_preset != null && String(row.page_size_preset) !== ''
    ? parsePageSizePreset(row.page_size_preset)
    : null;
  const pageSizePreset = presetFromRow
    ?? detectPageSizePreset(pageWidth, pageHeight, pageUnit);

  return {
    id:                       asLayoutSettingsId(String(row.id ?? '')),
    bookId:                   String(row.book_id ?? ''),
    pageWidth,
    pageHeight,
    pageUnit,
    marginTop:                Number(row.margin_top ?? DEFAULT_LAYOUT_SETTINGS.marginTop),
    marginBottom:             Number(row.margin_bottom ?? DEFAULT_LAYOUT_SETTINGS.marginBottom),
    marginInside:             Number(row.margin_inside ?? DEFAULT_LAYOUT_SETTINGS.marginInside),
    marginOutside:            Number(row.margin_outside ?? DEFAULT_LAYOUT_SETTINGS.marginOutside),
    facingPages:              Number(row.facing_pages ?? (DEFAULT_LAYOUT_SETTINGS.facingPages ? 1 : 0)) === 1,
    pageSizePreset,
    bleedMm:                  Number(row.bleed_mm ?? DEFAULT_LAYOUT_SETTINGS.bleedMm),
    safeAreaInsetMm:          Number(row.safe_area_inset_mm ?? DEFAULT_LAYOUT_SETTINGS.safeAreaInsetMm),
    bodyFontFamily:           String(row.body_font_family ?? DEFAULT_LAYOUT_SETTINGS.bodyFontFamily),
    headingFontFamily:        String(row.heading_font_family ?? DEFAULT_LAYOUT_SETTINGS.headingFontFamily),
    bodyFontSize:             Number(row.body_font_size ?? DEFAULT_LAYOUT_SETTINGS.bodyFontSize),
    bodyLineHeight:           Number(row.body_line_height ?? DEFAULT_LAYOUT_SETTINGS.bodyLineHeight),
    paragraphSpacing:         Number(row.paragraph_spacing ?? DEFAULT_LAYOUT_SETTINGS.paragraphSpacing),
    firstLineIndent:          Number(row.first_line_indent ?? DEFAULT_LAYOUT_SETTINGS.firstLineIndent),
    showPageNumbers:          Number(row.show_page_numbers ?? (DEFAULT_LAYOUT_SETTINGS.showPageNumbers ? 1 : 0)) === 1,
    pageNumberStart:          Number(row.page_number_start ?? DEFAULT_LAYOUT_SETTINGS.pageNumberStart),
    frontmatterNumberingStyle: String(
      row.frontmatter_numbering_style ?? DEFAULT_LAYOUT_SETTINGS.frontmatterNumberingStyle,
    ) as LayoutSettings['frontmatterNumberingStyle'],
    bodyNumberingStyle:       String(
      row.body_numbering_style ?? DEFAULT_LAYOUT_SETTINGS.bodyNumberingStyle,
    ) as LayoutSettings['bodyNumberingStyle'],
    bodyStartsAtSectionId:    row.body_starts_at_section_id != null ? String(row.body_starts_at_section_id) : null,
    hideNumberOnSectionTypes: String(
      row.hide_number_on_section_types ?? DEFAULT_LAYOUT_SETTINGS.hideNumberOnSectionTypes,
    ),
    showHeader:               Number(row.show_header ?? (DEFAULT_LAYOUT_SETTINGS.showHeader ? 1 : 0)) === 1,
    showFooter:               Number(row.show_footer ?? (DEFAULT_LAYOUT_SETTINGS.showFooter ? 1 : 0)) === 1,
    headerConfigJson:         row.header_config_json != null ? String(row.header_config_json) : null,
    footerConfigJson:         row.footer_config_json != null ? String(row.footer_config_json) : null,
    tocConfigJson:            row.toc_config_json != null ? String(row.toc_config_json) : null,
    stylesJson:               row.styles_json != null ? String(row.styles_json) : null,
    createdAt:                String(row.created_at ?? ''),
    updatedAt:                String(row.updated_at ?? ''),
  };
}
