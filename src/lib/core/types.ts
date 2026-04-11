/**
 * src/lib/core/types.ts
 *
 * Tipos del dominio editorial de MIDOO Books.
 *
 * Regla de oro de este archivo:
 *   CERO imports de: electron, Node.js fs, better-sqlite3, svelte,
 *   window, document, o cualquier API de plataforma.
 *
 * Solo TypeScript puro. Se puede importar en:
 *   - El App Shell (SvelteKit)
 *   - El proceso principal de Electron
 *   - Tests unitarios
 *   - Scripts de Node.js
 */

// ─── Branded Types ───────────────────────────────────────────────────────────
// Los branded types evitan que un BookId sea intercambiable con un string genérico.

declare const BookIdBrand: unique symbol;
export type BookId = string & { readonly [BookIdBrand]: never };

// ─── Enumeraciones de layout ─────────────────────────────────────────────────

export type BookLayout  = 'Standard' | 'FullImage';
export type BookVariant = 'light' | 'dark';
export type PageSize    = 'A5' | 'Letter';

// ─── Metadata del libro ──────────────────────────────────────────────────────

export interface BookMeta {
  title:       string;
  subtitle:    string;
  author:      string;
  layout:      BookLayout;
  variant:     BookVariant;
  pageSize:    PageSize;
  language:    string;
  description: string;
  coverImage:  string | null;
}

// ─── Entidad Libro ───────────────────────────────────────────────────────────

export interface Book {
  id:          BookId;
  slug:        string;
  meta:        BookMeta;
  rawMarkdown: string;
  createdAt:   string; // ISO 8601
  updatedAt:   string; // ISO 8601
}

// ─── Sección (para TOC y headings) ──────────────────────────────────────────

export interface ParsedSection {
  level: 1 | 2;
  text:  string;
  id:    string; // slug CSS-safe
}

// ─── Resultado de parsear un .md ─────────────────────────────────────────────

export interface ParsedBook {
  meta:     BookMeta;
  content:  string;           // HTML generado
  headings: ParsedSection[];
}

// ─── Valores por defecto ─────────────────────────────────────────────────────

export const DEFAULT_BOOK_META: BookMeta = {
  title:       'Sin título',
  subtitle:    '',
  author:      '',
  layout:      'Standard',
  variant:     'light',
  pageSize:    'A5',
  language:    'es',
  description: '',
  coverImage:  null,
};
