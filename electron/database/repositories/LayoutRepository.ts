import type { LayoutSettings, UpdateLayoutSettingsInput } from '../../../src/lib/core/domain/layout';
import { DEFAULT_LAYOUT_SETTINGS } from '../../../src/lib/core/domain/layout';
import { getDatabase, persist } from '../connection';
import { rowToLayoutSettings } from '../mappers/layout.mapper';
import { queryResultToObjects } from '../mappers/book.mapper';

function db() { return getDatabase(); }
function now(): string { return new Date().toISOString(); }

export function getLayoutSettingsByBookId(bookId: string): LayoutSettings | null {
  const result = db().exec('SELECT * FROM layout_settings WHERE book_id = ? LIMIT 1', [bookId]);
  const rows = queryResultToObjects(result);
  if (!rows.length) return null;
  return rowToLayoutSettings(rows[0]);
}

export function ensureLayoutSettingsForBook(bookId: string): LayoutSettings {
  const existing = getLayoutSettingsByBookId(bookId);
  if (existing) return existing;

  const ts = now();
  const id = crypto.randomUUID();
  db().run(
    `INSERT INTO layout_settings (
      id, book_id,
      page_width, page_height, page_unit,
      margin_top, margin_bottom, margin_inside, margin_outside, facing_pages,
      body_font_family, heading_font_family, body_font_size, body_line_height,
      paragraph_spacing, first_line_indent,
      show_page_numbers, page_number_start, frontmatter_numbering_style, body_numbering_style,
      body_starts_at_section_id, hide_number_on_section_types,
      show_header, show_footer, header_config_json, footer_config_json, toc_config_json,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      bookId,
      DEFAULT_LAYOUT_SETTINGS.pageWidth,
      DEFAULT_LAYOUT_SETTINGS.pageHeight,
      DEFAULT_LAYOUT_SETTINGS.pageUnit,
      DEFAULT_LAYOUT_SETTINGS.marginTop,
      DEFAULT_LAYOUT_SETTINGS.marginBottom,
      DEFAULT_LAYOUT_SETTINGS.marginInside,
      DEFAULT_LAYOUT_SETTINGS.marginOutside,
      DEFAULT_LAYOUT_SETTINGS.facingPages ? 1 : 0,
      DEFAULT_LAYOUT_SETTINGS.bodyFontFamily,
      DEFAULT_LAYOUT_SETTINGS.headingFontFamily,
      DEFAULT_LAYOUT_SETTINGS.bodyFontSize,
      DEFAULT_LAYOUT_SETTINGS.bodyLineHeight,
      DEFAULT_LAYOUT_SETTINGS.paragraphSpacing,
      DEFAULT_LAYOUT_SETTINGS.firstLineIndent,
      DEFAULT_LAYOUT_SETTINGS.showPageNumbers ? 1 : 0,
      DEFAULT_LAYOUT_SETTINGS.pageNumberStart,
      DEFAULT_LAYOUT_SETTINGS.frontmatterNumberingStyle,
      DEFAULT_LAYOUT_SETTINGS.bodyNumberingStyle,
      DEFAULT_LAYOUT_SETTINGS.bodyStartsAtSectionId,
      DEFAULT_LAYOUT_SETTINGS.hideNumberOnSectionTypes,
      DEFAULT_LAYOUT_SETTINGS.showHeader ? 1 : 0,
      DEFAULT_LAYOUT_SETTINGS.showFooter ? 1 : 0,
      DEFAULT_LAYOUT_SETTINGS.headerConfigJson,
      DEFAULT_LAYOUT_SETTINGS.footerConfigJson,
      DEFAULT_LAYOUT_SETTINGS.tocConfigJson,
      ts,
      ts,
    ],
  );
  persist();
  const created = getLayoutSettingsByBookId(bookId);
  if (!created) throw new Error(`[LayoutRepository] No se pudo crear layout_settings para ${bookId}`);
  return created;
}

export function updateLayoutSettings(
  bookId: string,
  input: UpdateLayoutSettingsInput,
): LayoutSettings | null {
  const existing = ensureLayoutSettingsForBook(bookId);
  if (!existing) return null;

  const fields: string[] = [];
  const values: Array<string | number | null> = [];

  if (input.pageWidth !== undefined) { fields.push('page_width = ?'); values.push(input.pageWidth); }
  if (input.pageHeight !== undefined) { fields.push('page_height = ?'); values.push(input.pageHeight); }
  if (input.pageUnit !== undefined) { fields.push('page_unit = ?'); values.push(input.pageUnit); }
  if (input.marginTop !== undefined) { fields.push('margin_top = ?'); values.push(input.marginTop); }
  if (input.marginBottom !== undefined) { fields.push('margin_bottom = ?'); values.push(input.marginBottom); }
  if (input.marginInside !== undefined) { fields.push('margin_inside = ?'); values.push(input.marginInside); }
  if (input.marginOutside !== undefined) { fields.push('margin_outside = ?'); values.push(input.marginOutside); }
  if (input.facingPages !== undefined) { fields.push('facing_pages = ?'); values.push(input.facingPages ? 1 : 0); }
  if (input.bodyFontFamily !== undefined) { fields.push('body_font_family = ?'); values.push(input.bodyFontFamily); }
  if (input.headingFontFamily !== undefined) { fields.push('heading_font_family = ?'); values.push(input.headingFontFamily); }
  if (input.bodyFontSize !== undefined) { fields.push('body_font_size = ?'); values.push(input.bodyFontSize); }
  if (input.bodyLineHeight !== undefined) { fields.push('body_line_height = ?'); values.push(input.bodyLineHeight); }
  if (input.paragraphSpacing !== undefined) { fields.push('paragraph_spacing = ?'); values.push(input.paragraphSpacing); }
  if (input.firstLineIndent !== undefined) { fields.push('first_line_indent = ?'); values.push(input.firstLineIndent); }
  if (input.showPageNumbers !== undefined) { fields.push('show_page_numbers = ?'); values.push(input.showPageNumbers ? 1 : 0); }
  if (input.pageNumberStart !== undefined) { fields.push('page_number_start = ?'); values.push(input.pageNumberStart); }
  if (input.frontmatterNumberingStyle !== undefined) {
    fields.push('frontmatter_numbering_style = ?');
    values.push(input.frontmatterNumberingStyle);
  }
  if (input.bodyNumberingStyle !== undefined) {
    fields.push('body_numbering_style = ?');
    values.push(input.bodyNumberingStyle);
  }
  if ('bodyStartsAtSectionId' in input) {
    fields.push('body_starts_at_section_id = ?');
    values.push(input.bodyStartsAtSectionId ?? null);
  }
  if (input.hideNumberOnSectionTypes !== undefined) {
    fields.push('hide_number_on_section_types = ?');
    values.push(input.hideNumberOnSectionTypes);
  }
  if (input.showHeader !== undefined) { fields.push('show_header = ?'); values.push(input.showHeader ? 1 : 0); }
  if (input.showFooter !== undefined) { fields.push('show_footer = ?'); values.push(input.showFooter ? 1 : 0); }
  if ('headerConfigJson' in input) { fields.push('header_config_json = ?'); values.push(input.headerConfigJson ?? null); }
  if ('footerConfigJson' in input) { fields.push('footer_config_json = ?'); values.push(input.footerConfigJson ?? null); }
  if ('tocConfigJson' in input) { fields.push('toc_config_json = ?'); values.push(input.tocConfigJson ?? null); }

  if (fields.length === 0) return existing;

  fields.push('updated_at = ?');
  values.push(now());
  values.push(bookId);

  db().run(`UPDATE layout_settings SET ${fields.join(', ')} WHERE book_id = ?`, values);
  persist();
  return getLayoutSettingsByBookId(bookId);
}
