import { getLayoutSettings, updateLayoutSettings } from './layout.service';
import {
  resolveBookStyles,
  serializeBookStyles,
  cloneBookStyles,
  buildDefaultBookStyles,
  buildBookStyleCss,
  buildResolvedBookStyleDebug,
  BOOK_STYLE_ROLE_CATALOG,
  BOOK_STYLE_ROLE_VALUES,
  bookStyleRoleLabel,
  bookStyleRoleDescription,
  bookStyleRoleSampleText,
  resolveEffectiveBookStyleInfoForBlock,
  type BookStyleDefinition,
  type BookStyleMap,
  type BookStyleRole,
  type ResolvedBookStyleInfo,
} from '$lib/core/editorial/book-styles';

export {
  BOOK_STYLE_ROLE_CATALOG,
  BOOK_STYLE_ROLE_VALUES,
  bookStyleRoleLabel,
  bookStyleRoleDescription,
  bookStyleRoleSampleText,
  buildDefaultBookStyles,
  buildBookStyleCss,
  buildResolvedBookStyleDebug,
  cloneBookStyles,
  resolveBookStyles,
  resolveEffectiveBookStyleInfoForBlock,
  type BookStyleDefinition,
  type BookStyleMap,
  type BookStyleRole,
  type ResolvedBookStyleInfo,
};

export async function getBookStyles(bookId: string): Promise<BookStyleMap> {
  const settings = await getLayoutSettings(bookId);
  return resolveBookStyles(settings);
}

export async function updateBookStyles(bookId: string, styles: BookStyleMap) {
  return updateLayoutSettings(bookId, {
    stylesJson: serializeBookStyles(styles),
  });
}
