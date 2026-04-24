import type { SqlValue } from 'sql.js';
import type { LayoutSettings } from '../../../src/lib/core/domain/layout';
import { DEFAULT_LAYOUT_SETTINGS } from '../../../src/lib/core/domain/layout';

declare const LayoutSettingsIdBrand: unique symbol;

function asLayoutSettingsId(id: string): LayoutSettings['id'] {
  return id as LayoutSettings['id'];
}

export function rowToLayoutSettings(row: Record<string, SqlValue>): LayoutSettings {
  return {
    id:                       asLayoutSettingsId(String(row.id ?? '')),
    bookId:                   String(row.book_id ?? ''),
    pageWidth:                Number(row.page_width ?? DEFAULT_LAYOUT_SETTINGS.pageWidth),
    pageHeight:               Number(row.page_height ?? DEFAULT_LAYOUT_SETTINGS.pageHeight),
    pageUnit:                 (String(row.page_unit ?? DEFAULT_LAYOUT_SETTINGS.pageUnit)) as LayoutSettings['pageUnit'],
    marginTop:                Number(row.margin_top ?? DEFAULT_LAYOUT_SETTINGS.marginTop),
    marginBottom:             Number(row.margin_bottom ?? DEFAULT_LAYOUT_SETTINGS.marginBottom),
    marginInside:             Number(row.margin_inside ?? DEFAULT_LAYOUT_SETTINGS.marginInside),
    marginOutside:            Number(row.margin_outside ?? DEFAULT_LAYOUT_SETTINGS.marginOutside),
    facingPages:              Number(row.facing_pages ?? (DEFAULT_LAYOUT_SETTINGS.facingPages ? 1 : 0)) === 1,
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
    createdAt:                String(row.created_at ?? ''),
    updatedAt:                String(row.updated_at ?? ''),
  };
}
