/**
 * src/lib/core/domain/layout.ts
 *
 * Entidad LayoutSettings.
 *
 * Configuración de diseño tipográfico y de maquetación asociada a un BookProject.
 * Hay exactamente un LayoutSettings por libro.
 *
 * Unidades de medida: mm (milímetros) para dimensiones físicas.
 * Unidades tipográficas: pt (puntos tipográficos) para fuentes y espaciados.
 */

declare const LayoutSettingsIdBrand: unique symbol;
export type LayoutSettingsId = string & { readonly [LayoutSettingsIdBrand]: never };

// ─── Enumeraciones ────────────────────────────────────────────────────────────

export type PageUnit = 'mm' | 'in' | 'pt' | 'px';

/** Preset de trim size; CUSTOM = medidas manuales. */
export type PageSizePresetId = 'A5' | 'LETTER' | 'TRADE_6X9' | 'A4' | 'CUSTOM';

export type FrontmatterNumberingStyle = 'none' | 'roman-lower' | 'roman-upper';
export type BodyNumberingStyle = 'arabic';

// ─── Entidad LayoutSettings ───────────────────────────────────────────────────

export interface LayoutSettings {
  id:                       LayoutSettingsId;
  bookId:                   string;             // FK → BookProject.id (1:1)

  // ── Dimensiones de página ────────────────────────────────────────────────
  pageWidth:                number;             // En la unidad indicada por pageUnit
  pageHeight:               number;
  pageUnit:                 PageUnit;           // Unidad de las dimensiones

  // ── Márgenes ─────────────────────────────────────────────────────────────
  marginTop:                number;
  marginBottom:             number;
  marginInside:             number;             // Interior (lomo) en doble cara
  marginOutside:            number;             // Exterior (corte)
  facingPages:              boolean;            // ¿Márgenes espejo para doble cara?

  /** Preset de tamaño (UI); no sustituye pageWidth/pageHeight al renderizar. */
  pageSizePreset:           PageSizePresetId;
  /** Sangrado hacia fuera del corte (mm). 0 = desactivado; base para bleed real en fases futuras. */
  bleedMm:                  number;
  /** Inset uniforme (mm) dentro del área útil para guía de zona segura en preview. */
  safeAreaInsetMm:          number;

  // ── Tipografía cuerpo ────────────────────────────────────────────────────
  bodyFontFamily:           string;             // Nombre de familia tipográfica
  headingFontFamily:        string;
  bodyFontSize:             number;             // En puntos (pt)
  bodyLineHeight:           number;             // Multiplicador (ej. 1.4)
  paragraphSpacing:         number;             // Espacio entre párrafos (pt)
  firstLineIndent:          number;             // Sangría de primera línea (mm)

  // ── Numeración editorial ─────────────────────────────────────────────────
  showPageNumbers:          boolean;
  pageNumberStart:          number;             // Número inicial del cuerpo principal
  frontmatterNumberingStyle: FrontmatterNumberingStyle;
  bodyNumberingStyle:       BodyNumberingStyle;
  bodyStartsAtSectionId:    string | null;
  hideNumberOnSectionTypes: string;             // JSON: SectionType[]

  // ── Cabeceras y pies ─────────────────────────────────────────────────────
  showHeader:               boolean;
  showFooter:               boolean;
  headerConfigJson:         string | null;      // JSON de configuración de cabecera
  footerConfigJson:         string | null;      // JSON de configuración de pie

  // ── TOC ───────────────────────────────────────────────────────────────────
  tocConfigJson:            string | null;      // JSON de configuración del TOC
  stylesJson:               string | null;      // JSON de estilos editoriales globales del libro

  createdAt:                string;
  updatedAt:                string;
}

// ─── Payloads ─────────────────────────────────────────────────────────────────

export type CreateLayoutSettingsInput = Omit<LayoutSettings,
  'id' | 'createdAt' | 'updatedAt'
>;

export type UpdateLayoutSettingsInput = Partial<Omit<LayoutSettings,
  'id' | 'bookId' | 'createdAt' | 'updatedAt'
>>;

export const DEFAULT_HIDE_PAGE_NUMBER_SECTION_TYPES = [
  'COVER',
  'BACK_COVER',
  'RIGHTS',
  'DEDICATION',
] as const;

// ─── Preset por defecto (A5) ──────────────────────────────────────────────────

export const DEFAULT_LAYOUT_SETTINGS: Omit<LayoutSettings, 'id' | 'bookId' | 'createdAt' | 'updatedAt'> = {
  pageWidth:                148,       // A5 ancho en mm
  pageHeight:               210,       // A5 alto en mm
  pageUnit:                 'mm',
  marginTop:                20,
  marginBottom:             22,
  marginInside:             22,
  marginOutside:            18,
  facingPages:              true,
  pageSizePreset:           'A5',
  bleedMm:                  0,
  safeAreaInsetMm:          0,
  bodyFontFamily:           'Georgia, serif',
  headingFontFamily:        'Helvetica Neue, Arial, sans-serif',
  bodyFontSize:             11,
  bodyLineHeight:           1.5,
  paragraphSpacing:         6,
  firstLineIndent:          5,
  showPageNumbers:          true,
  pageNumberStart:          1,
  frontmatterNumberingStyle:'roman-lower',
  bodyNumberingStyle:       'arabic',
  bodyStartsAtSectionId:    null,
  hideNumberOnSectionTypes: JSON.stringify(DEFAULT_HIDE_PAGE_NUMBER_SECTION_TYPES),
  showHeader:               false,
  showFooter:               true,
  headerConfigJson:         null,
  footerConfigJson:         null,
  tocConfigJson:            null,
  stylesJson:               null,
};
