/**
 * electron/database/migrations.ts
 *
 * Sistema de migraciones incremental para la base de datos SQLite de MIDOO Books.
 *
 * Reglas:
 *   - Cada migración tiene un número de versión único y nunca se re-ejecuta.
 *   - Las migraciones son aditivas. Nunca modificar una ya aplicada.
 *   - Para cambiar una tabla existente, añadir una nueva migración.
 *
 * Historial:
 *   v1 — Fase 1: app_settings, books (legacy minimal)
 *   v2 — Fase 2: dominio editorial completo (book_projects, document_sections,
 *                document_blocks, layout_settings, assets, snapshots, export_jobs)
 *   v3 — Tipos de sección ampliados; tabla document_sections sin CHECK en section_type
 *   v4 — Valores section_type normalizados a SCREAMING_SNAKE_CASE (p. ej. CHAPTER)
 *   v5 — Tipos de bloque v1; document_blocks sin CHECK en block_type; datos migrados
 *   v6 — style_variant ampliado (variantes editoriales PARTE 7)
 *   v7 — assets: caption + tipo image (PARTE 8)
 */

import type { Database } from 'sql.js';

interface Migration {
  version: number;
  name: string;
  up: (db: Database) => void;
}

const migrations: Migration[] = [

  // ─── v1: Base técnica (Fase 1) ───────────────────────────────────────────
  {
    version: 1,
    name: 'initial_schema',
    up(db) {
      db.run(`
        CREATE TABLE IF NOT EXISTS app_settings (
          key        TEXT PRIMARY KEY,
          value      TEXT NOT NULL,
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);

      // Tabla books legacy — se mantiene para compatibilidad con Fase 1.
      // En producción migrar datos a book_projects antes de eliminarla.
      db.run(`
        CREATE TABLE IF NOT EXISTS books (
          id         TEXT PRIMARY KEY,
          slug       TEXT UNIQUE NOT NULL,
          title      TEXT NOT NULL,
          author     TEXT NOT NULL DEFAULT '',
          raw_md     TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);

      db.run(`
        INSERT OR IGNORE INTO app_settings (key, value) VALUES
          ('theme',           'dark'),
          ('lastOpenedBook',  ''),
          ('appVersion',      '0.1.0'),
          ('dbCreatedAt',     datetime('now'))
      `);
    },
  },

  // ─── v2: Dominio editorial completo (Fase 2) ─────────────────────────────
  {
    version: 2,
    name: 'editorial_domain',
    up(db) {

      // ── book_projects ────────────────────────────────────────────────────
      // Unidad principal de trabajo del autor.
      db.run(`
        CREATE TABLE IF NOT EXISTS book_projects (
          id             TEXT PRIMARY KEY,
          title          TEXT NOT NULL,
          subtitle       TEXT NOT NULL DEFAULT '',
          author_name    TEXT NOT NULL DEFAULT '',
          description    TEXT NOT NULL DEFAULT '',
          language_code  TEXT NOT NULL DEFAULT 'es',
          status         TEXT NOT NULL DEFAULT 'draft'
                           CHECK(status IN ('draft','in_progress','complete','archived')),
          cover_asset_id TEXT,
          created_at     TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
      db.run(`CREATE INDEX IF NOT EXISTS idx_book_projects_status
              ON book_projects(status)`);

      // ── document_sections ────────────────────────────────────────────────
      // Capítulos, prefacios, portadas, etc. — unidad organizativa.
      db.run(`
        CREATE TABLE IF NOT EXISTS document_sections (
          id                 TEXT PRIMARY KEY,
          book_id            TEXT NOT NULL REFERENCES book_projects(id) ON DELETE CASCADE,
          section_type       TEXT NOT NULL DEFAULT 'chapter'
                               CHECK(section_type IN (
                                 'cover','blank','title_page','copyright','dedication',
                                 'toc','preface','chapter','appendix',
                                 'bibliography','index','colophon'
                               )),
          title              TEXT NOT NULL DEFAULT '',
          order_index        INTEGER NOT NULL DEFAULT 0,
          include_in_toc     INTEGER NOT NULL DEFAULT 1,   -- BOOLEAN (0/1)
          start_on_right_page INTEGER NOT NULL DEFAULT 0,  -- BOOLEAN
          settings_json      TEXT,
          created_at         TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
      db.run(`CREATE INDEX IF NOT EXISTS idx_sections_book_id
              ON document_sections(book_id, order_index)`);

      // ── document_blocks ──────────────────────────────────────────────────
      // Unidad atómica de contenido (párrafo, heading, imagen, etc.)
      db.run(`
        CREATE TABLE IF NOT EXISTS document_blocks (
          id                TEXT PRIMARY KEY,
          section_id        TEXT NOT NULL REFERENCES document_sections(id) ON DELETE CASCADE,
          block_type        TEXT NOT NULL DEFAULT 'paragraph'
                              CHECK(block_type IN (
                                'paragraph','heading','image','table',
                                'quote','code','divider','list','raw_html'
                              )),
          order_index       INTEGER NOT NULL DEFAULT 0,
          content_text      TEXT NOT NULL DEFAULT '',
          content_json      TEXT,
          style_variant     TEXT NOT NULL DEFAULT 'default'
                              CHECK(style_variant IN (
                                'default','lead','caption','footnote',
                                'pull_quote','code_inline'
                              )),
          include_in_toc    INTEGER NOT NULL DEFAULT 0,    -- BOOLEAN
          keep_together     INTEGER NOT NULL DEFAULT 0,    -- BOOLEAN
          page_break_before INTEGER NOT NULL DEFAULT 0,    -- BOOLEAN
          page_break_after  INTEGER NOT NULL DEFAULT 0,    -- BOOLEAN
          metadata_json     TEXT,
          created_at        TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
      db.run(`CREATE INDEX IF NOT EXISTS idx_blocks_section_id
              ON document_blocks(section_id, order_index)`);

      // ── layout_settings ──────────────────────────────────────────────────
      // Configuración tipográfica y de maquetación (1:1 con book_project).
      db.run(`
        CREATE TABLE IF NOT EXISTS layout_settings (
          id                          TEXT PRIMARY KEY,
          book_id                     TEXT NOT NULL UNIQUE
                                        REFERENCES book_projects(id) ON DELETE CASCADE,
          page_width                  REAL NOT NULL DEFAULT 148,
          page_height                 REAL NOT NULL DEFAULT 210,
          page_unit                   TEXT NOT NULL DEFAULT 'mm'
                                        CHECK(page_unit IN ('mm','in','pt','px')),
          margin_top                  REAL NOT NULL DEFAULT 20,
          margin_bottom               REAL NOT NULL DEFAULT 22,
          margin_inside               REAL NOT NULL DEFAULT 22,
          margin_outside              REAL NOT NULL DEFAULT 18,
          facing_pages                INTEGER NOT NULL DEFAULT 1,
          body_font_family            TEXT NOT NULL DEFAULT 'Georgia, serif',
          heading_font_family         TEXT NOT NULL DEFAULT 'Helvetica Neue, Arial, sans-serif',
          body_font_size              REAL NOT NULL DEFAULT 11,
          body_line_height            REAL NOT NULL DEFAULT 1.5,
          paragraph_spacing           REAL NOT NULL DEFAULT 6,
          first_line_indent           REAL NOT NULL DEFAULT 5,
          page_number_mode            TEXT NOT NULL DEFAULT 'continuous'
                                        CHECK(page_number_mode IN ('none','continuous','per_section')),
          page_number_start           INTEGER NOT NULL DEFAULT 1,
          frontmatter_numbering_style TEXT NOT NULL DEFAULT 'roman'
                                        CHECK(frontmatter_numbering_style IN ('none','arabic','roman')),
          body_numbering_style        TEXT NOT NULL DEFAULT 'arabic'
                                        CHECK(body_numbering_style IN ('none','arabic','roman')),
          show_header                 INTEGER NOT NULL DEFAULT 1,
          show_footer                 INTEGER NOT NULL DEFAULT 1,
          header_config_json          TEXT,
          footer_config_json          TEXT,
          toc_config_json             TEXT,
          created_at                  TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at                  TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);

      // ── assets ───────────────────────────────────────────────────────────
      // Recursos binarios (imágenes, fuentes) asociados al libro.
      db.run(`
        CREATE TABLE IF NOT EXISTS assets (
          id              TEXT PRIMARY KEY,
          book_id         TEXT NOT NULL REFERENCES book_projects(id) ON DELETE CASCADE,
          asset_type      TEXT NOT NULL DEFAULT 'illustration'
                            CHECK(asset_type IN (
                              'cover_image','illustration','font',
                              'background','logo','other'
                            )),
          filename        TEXT NOT NULL,
          original_name   TEXT NOT NULL,
          mime_type       TEXT NOT NULL DEFAULT '',
          file_ext        TEXT NOT NULL DEFAULT '',
          file_size_bytes INTEGER NOT NULL DEFAULT 0,
          width_px        INTEGER,
          height_px       INTEGER,
          storage_path    TEXT NOT NULL,
          checksum        TEXT NOT NULL DEFAULT '',
          alt_text        TEXT NOT NULL DEFAULT '',
          created_at      TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
      db.run(`CREATE INDEX IF NOT EXISTS idx_assets_book_id
              ON assets(book_id, asset_type)`);

      // ── snapshots ────────────────────────────────────────────────────────
      // Capturas del estado completo del libro (historial de versiones simple).
      db.run(`
        CREATE TABLE IF NOT EXISTS snapshots (
          id            TEXT PRIMARY KEY,
          book_id       TEXT NOT NULL REFERENCES book_projects(id) ON DELETE CASCADE,
          snapshot_type TEXT NOT NULL DEFAULT 'manual'
                          CHECK(snapshot_type IN ('manual','auto','pre_export','pre_delete')),
          label         TEXT NOT NULL DEFAULT '',
          data_json     TEXT NOT NULL,
          created_at    TEXT NOT NULL DEFAULT (datetime('now'))
          -- Sin updated_at: los snapshots son inmutables
        )
      `);
      db.run(`CREATE INDEX IF NOT EXISTS idx_snapshots_book_id
              ON snapshots(book_id, created_at DESC)`);

      // ── export_jobs ──────────────────────────────────────────────────────
      // Registro histórico de exportaciones realizadas.
      db.run(`
        CREATE TABLE IF NOT EXISTS export_jobs (
          id           TEXT PRIMARY KEY,
          book_id      TEXT NOT NULL REFERENCES book_projects(id) ON DELETE CASCADE,
          export_type  TEXT NOT NULL DEFAULT 'pdf'
                         CHECK(export_type IN ('pdf','epub','odt','html')),
          status       TEXT NOT NULL DEFAULT 'pending'
                         CHECK(status IN ('pending','running','completed','failed')),
          options_json TEXT,
          output_path  TEXT,
          error_msg    TEXT,
          created_at   TEXT NOT NULL DEFAULT (datetime('now')),
          completed_at TEXT
        )
      `);
      db.run(`CREATE INDEX IF NOT EXISTS idx_exports_book_id
              ON export_jobs(book_id, created_at DESC)`);

      // ── Actualizar versión de la app en settings ─────────────────────────
      db.run(`
        INSERT OR REPLACE INTO app_settings (key, value) VALUES
          ('appVersion', '0.2.0'),
          ('schemaVersion', '2')
      `);

      console.log('[DB] Dominio editorial creado: 6 tablas nuevas.');
    },
  },

  // ─── v3: Ampliar tipos de sección (Fase 4) ───────────────────────────────
  // El CHECK constraint original de document_sections solo admitía 12 tipos.
  // SQLite no permite ALTER TABLE ... MODIFY CONSTRAINT, así que recreamos
  // la tabla preservando todos los datos existentes.
  //
  // Tipos nuevos:  back_cover, credits, rights, prologue, epilogue,
  //                author_note, index_analytical, special
  // Tipos legacy que se conservan: copyright (→ rights), index (→ index_analytical)
  //
  // Estrategia:
  //   1. Renombrar tabla original a backup
  //   2. Crear nueva tabla SIN CHECK constraint (la validación queda en TypeScript)
  //   3. Copiar datos
  //   4. Eliminar backup
  //   5. Recrear índice
  {
    version: 3,
    name: 'expand_section_types',
    up(db) {
      // Paso 1: Renombrar la tabla existente
      db.run('ALTER TABLE document_sections RENAME TO _bkp_document_sections_v2');

      // Paso 2: Crear la nueva tabla sin CHECK en section_type
      // La validación de valores permitidos se garantiza en la capa TypeScript.
      db.run(`
        CREATE TABLE document_sections (
          id                  TEXT PRIMARY KEY,
          book_id             TEXT NOT NULL REFERENCES book_projects(id) ON DELETE CASCADE,
          section_type        TEXT NOT NULL DEFAULT 'chapter',
          title               TEXT NOT NULL DEFAULT '',
          order_index         INTEGER NOT NULL DEFAULT 0,
          include_in_toc      INTEGER NOT NULL DEFAULT 1,
          start_on_right_page INTEGER NOT NULL DEFAULT 0,
          settings_json       TEXT,
          created_at          TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);

      // Paso 3: Copiar todos los datos existentes
      db.run(`
        INSERT INTO document_sections
          (id, book_id, section_type, title, order_index,
           include_in_toc, start_on_right_page, settings_json, created_at, updated_at)
        SELECT
          id, book_id, section_type, title, order_index,
          include_in_toc, start_on_right_page, settings_json, created_at, updated_at
        FROM _bkp_document_sections_v2
      `);

      // Paso 4: Eliminar la tabla de respaldo
      db.run('DROP TABLE _bkp_document_sections_v2');

      // Paso 5: Recrear el índice compuesto
      db.run(`
        CREATE INDEX IF NOT EXISTS idx_sections_book_id
        ON document_sections(book_id, order_index)
      `);

      // Actualizar versión
      db.run(`
        INSERT OR REPLACE INTO app_settings (key, value) VALUES
          ('appVersion',    '0.3.0'),
          ('schemaVersion', '3')
      `);

      console.log('[DB] v3: document_sections recreada con tipos de sección expandidos.');
    },
  },

  // ─── v4: Almacenamiento canónico de section_type (SCREAMING_SNAKE_CASE) ──
  {
    version: 4,
    name: 'canonical_section_type_storage',
    up(db) {
      db.run(`
        UPDATE document_sections SET section_type = CASE lower(section_type)
          WHEN 'cover' THEN 'COVER'
          WHEN 'back_cover' THEN 'BACK_COVER'
          WHEN 'blank' THEN 'BLANK'
          WHEN 'title_page' THEN 'TITLE_PAGE'
          WHEN 'credits' THEN 'CREDITS'
          WHEN 'rights' THEN 'RIGHTS'
          WHEN 'dedication' THEN 'DEDICATION'
          WHEN 'toc' THEN 'TOC'
          WHEN 'preface' THEN 'PREFACE'
          WHEN 'prologue' THEN 'PROLOGUE'
          WHEN 'chapter' THEN 'CHAPTER'
          WHEN 'epilogue' THEN 'EPILOGUE'
          WHEN 'appendix' THEN 'APPENDIX'
          WHEN 'author_note' THEN 'AUTHOR_NOTE'
          WHEN 'bibliography' THEN 'BIBLIOGRAPHY'
          WHEN 'index_analytical' THEN 'INDEX_ANALYTICAL'
          WHEN 'colophon' THEN 'COLOPHON'
          WHEN 'special' THEN 'SPECIAL'
          WHEN 'copyright' THEN 'RIGHTS'
          WHEN 'index' THEN 'INDEX_ANALYTICAL'
          ELSE section_type
        END
      `);

      db.run(`
        INSERT OR REPLACE INTO app_settings (key, value) VALUES
          ('appVersion',    '0.3.1'),
          ('schemaVersion', '4')
      `);

      console.log('[DB] v4: section_type normalizado a valores canónicos.');
    },
  },

  // ─── v5: Tipos de bloque editor v1 (SCREAMING_SNAKE_CASE) ─────────────────
  {
    version: 5,
    name: 'block_types_editor_v1',
    up(db) {
      db.run('ALTER TABLE document_blocks RENAME TO _bkp_document_blocks_v5');

      db.run(`
        CREATE TABLE document_blocks (
          id                TEXT PRIMARY KEY,
          section_id        TEXT NOT NULL REFERENCES document_sections(id) ON DELETE CASCADE,
          block_type        TEXT NOT NULL DEFAULT 'PARAGRAPH',
          order_index       INTEGER NOT NULL DEFAULT 0,
          content_text      TEXT NOT NULL DEFAULT '',
          content_json      TEXT,
          style_variant     TEXT NOT NULL DEFAULT 'default'
            CHECK(style_variant IN (
              'default','lead','caption','footnote','pull_quote','code_inline'
            )),
          include_in_toc    INTEGER NOT NULL DEFAULT 0,
          keep_together     INTEGER NOT NULL DEFAULT 0,
          page_break_before INTEGER NOT NULL DEFAULT 0,
          page_break_after  INTEGER NOT NULL DEFAULT 0,
          metadata_json     TEXT,
          created_at        TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);

      db.run(`
        INSERT INTO document_blocks
          (id, section_id, block_type, order_index, content_text, content_json,
           style_variant, include_in_toc, keep_together,
           page_break_before, page_break_after, metadata_json, created_at, updated_at)
        SELECT
          id, section_id,
          CASE lower(block_type)
            WHEN 'paragraph' THEN 'PARAGRAPH'
            WHEN 'heading' THEN 'HEADING_1'
            WHEN 'heading_1' THEN 'HEADING_1'
            WHEN 'heading_2' THEN 'HEADING_2'
            WHEN 'image' THEN 'IMAGE'
            WHEN 'table' THEN 'PARAGRAPH'
            WHEN 'quote' THEN 'QUOTE'
            WHEN 'code' THEN 'PARAGRAPH'
            WHEN 'divider' THEN 'SEPARATOR'
            WHEN 'separator' THEN 'SEPARATOR'
            WHEN 'list' THEN 'PARAGRAPH'
            WHEN 'raw_html' THEN 'PARAGRAPH'
            WHEN 'page_break' THEN 'PAGE_BREAK'
            WHEN 'centered_phrase' THEN 'CENTERED_PHRASE'
            ELSE block_type
          END,
          order_index, content_text, content_json, style_variant, include_in_toc, keep_together,
          page_break_before, page_break_after, metadata_json, created_at, updated_at
        FROM _bkp_document_blocks_v5
      `);

      db.run('DROP TABLE _bkp_document_blocks_v5');

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_blocks_section_id
        ON document_blocks(section_id, order_index)
      `);

      db.run(`
        INSERT OR REPLACE INTO app_settings (key, value) VALUES
          ('appVersion',    '0.4.0'),
          ('schemaVersion', '5')
      `);

      console.log('[DB] v5: document_blocks migrada a tipos editor v1.');
    },
  },

  // ─── v6: Variantes de estilo de bloque (dedicatoria, índice, derechos…) ───
  {
    version: 6,
    name: 'block_style_variants_editorial_v7',
    up(db) {
      db.run('ALTER TABLE document_blocks RENAME TO _bkp_document_blocks_v6');

      db.run(`
        CREATE TABLE document_blocks (
          id                TEXT PRIMARY KEY,
          section_id        TEXT NOT NULL REFERENCES document_sections(id) ON DELETE CASCADE,
          block_type        TEXT NOT NULL DEFAULT 'PARAGRAPH',
          order_index       INTEGER NOT NULL DEFAULT 0,
          content_text      TEXT NOT NULL DEFAULT '',
          content_json      TEXT,
          style_variant     TEXT NOT NULL DEFAULT 'default'
            CHECK(style_variant IN (
              'default','lead','caption','footnote','pull_quote','code_inline',
              'dedication','toc_entry','rights','author_note','quote_large'
            )),
          include_in_toc    INTEGER NOT NULL DEFAULT 0,
          keep_together     INTEGER NOT NULL DEFAULT 0,
          page_break_before INTEGER NOT NULL DEFAULT 0,
          page_break_after  INTEGER NOT NULL DEFAULT 0,
          metadata_json     TEXT,
          created_at        TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);

      db.run(`
        INSERT INTO document_blocks
          (id, section_id, block_type, order_index, content_text, content_json,
           style_variant, include_in_toc, keep_together,
           page_break_before, page_break_after, metadata_json, created_at, updated_at)
        SELECT
          id, section_id, block_type, order_index, content_text, content_json,
          CASE lower(style_variant)
            WHEN 'default' THEN 'default'
            WHEN 'lead' THEN 'lead'
            WHEN 'caption' THEN 'caption'
            WHEN 'footnote' THEN 'footnote'
            WHEN 'pull_quote' THEN 'pull_quote'
            WHEN 'code_inline' THEN 'code_inline'
            WHEN 'dedication' THEN 'dedication'
            WHEN 'toc_entry' THEN 'toc_entry'
            WHEN 'rights' THEN 'rights'
            WHEN 'author_note' THEN 'author_note'
            WHEN 'quote_large' THEN 'quote_large'
            ELSE 'default'
          END,
          include_in_toc, keep_together,
          page_break_before, page_break_after, metadata_json, created_at, updated_at
        FROM _bkp_document_blocks_v6
      `);

      db.run('DROP TABLE _bkp_document_blocks_v6');

      db.run(`
        CREATE INDEX IF NOT EXISTS idx_blocks_section_id
        ON document_blocks(section_id, order_index)
      `);

      db.run(`
        INSERT OR REPLACE INTO app_settings (key, value) VALUES
          ('appVersion',    '0.5.0'),
          ('schemaVersion', '6')
      `);

      console.log('[DB] v6: style_variant ampliado (PARTE 7).');
    },
  },

  // ─── v7: Assets — caption y tipo `image` (PARTE 8) ───────────────────────
  {
    version: 7,
    name: 'assets_caption_image_type',
    up(db) {
      db.run('ALTER TABLE assets RENAME TO _bkp_assets_v7');

      db.run(`
        CREATE TABLE assets (
          id              TEXT PRIMARY KEY,
          book_id         TEXT NOT NULL REFERENCES book_projects(id) ON DELETE CASCADE,
          asset_type      TEXT NOT NULL DEFAULT 'image'
            CHECK(asset_type IN (
              'image','cover_image','illustration','font','background','logo','other'
            )),
          filename        TEXT NOT NULL,
          original_name   TEXT NOT NULL,
          mime_type       TEXT NOT NULL DEFAULT '',
          file_ext        TEXT NOT NULL DEFAULT '',
          file_size_bytes INTEGER NOT NULL DEFAULT 0,
          width_px        INTEGER,
          height_px       INTEGER,
          storage_path    TEXT NOT NULL,
          checksum        TEXT NOT NULL DEFAULT '',
          alt_text        TEXT NOT NULL DEFAULT '',
          caption         TEXT NOT NULL DEFAULT '',
          created_at      TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);

      db.run(`
        INSERT INTO assets
          (id, book_id, asset_type, filename, original_name, mime_type, file_ext,
           file_size_bytes, width_px, height_px, storage_path, checksum, alt_text,
           caption, created_at, updated_at)
        SELECT
          id, book_id,
          CASE lower(asset_type)
            WHEN 'cover_image' THEN 'cover_image'
            WHEN 'illustration' THEN 'illustration'
            WHEN 'font' THEN 'font'
            WHEN 'background' THEN 'background'
            WHEN 'logo' THEN 'logo'
            WHEN 'other' THEN 'other'
            ELSE 'image'
          END,
          filename, original_name, mime_type, file_ext, file_size_bytes, width_px, height_px,
          storage_path, checksum, alt_text, '', created_at, updated_at
        FROM _bkp_assets_v7
      `);

      db.run('DROP TABLE _bkp_assets_v7');

      db.run(`CREATE INDEX IF NOT EXISTS idx_assets_book_id ON assets(book_id, asset_type)`);

      db.run(`
        INSERT OR REPLACE INTO app_settings (key, value) VALUES
          ('appVersion',    '0.7.0'),
          ('schemaVersion', '7')
      `);

      console.log('[DB] v7: assets caption + image (PARTE 8).');
    },
  },

  // ─── v8: Numeración editorial y header/footer básicos (PARTE 10) ─────────
  {
    version: 8,
    name: 'editorial_numbering_layout_settings',
    up(db) {
      db.run('ALTER TABLE layout_settings RENAME TO _bkp_layout_settings_v8');

      db.run(`
        CREATE TABLE layout_settings (
          id                          TEXT PRIMARY KEY,
          book_id                     TEXT NOT NULL UNIQUE
                                        REFERENCES book_projects(id) ON DELETE CASCADE,
          page_width                  REAL NOT NULL DEFAULT 148,
          page_height                 REAL NOT NULL DEFAULT 210,
          page_unit                   TEXT NOT NULL DEFAULT 'mm'
                                        CHECK(page_unit IN ('mm','in','pt','px')),
          margin_top                  REAL NOT NULL DEFAULT 20,
          margin_bottom               REAL NOT NULL DEFAULT 22,
          margin_inside               REAL NOT NULL DEFAULT 22,
          margin_outside              REAL NOT NULL DEFAULT 18,
          facing_pages                INTEGER NOT NULL DEFAULT 1,
          body_font_family            TEXT NOT NULL DEFAULT 'Georgia, serif',
          heading_font_family         TEXT NOT NULL DEFAULT 'Helvetica Neue, Arial, sans-serif',
          body_font_size              REAL NOT NULL DEFAULT 11,
          body_line_height            REAL NOT NULL DEFAULT 1.5,
          paragraph_spacing           REAL NOT NULL DEFAULT 6,
          first_line_indent           REAL NOT NULL DEFAULT 5,
          show_page_numbers           INTEGER NOT NULL DEFAULT 1,
          page_number_start           INTEGER NOT NULL DEFAULT 1,
          frontmatter_numbering_style TEXT NOT NULL DEFAULT 'roman-lower'
                                        CHECK(frontmatter_numbering_style IN ('none','roman-lower','roman-upper')),
          body_numbering_style        TEXT NOT NULL DEFAULT 'arabic'
                                        CHECK(body_numbering_style IN ('arabic')),
          body_starts_at_section_id   TEXT,
          hide_number_on_section_types TEXT NOT NULL DEFAULT '["COVER","BACK_COVER","RIGHTS","DEDICATION"]',
          show_header                 INTEGER NOT NULL DEFAULT 0,
          show_footer                 INTEGER NOT NULL DEFAULT 1,
          header_config_json          TEXT,
          footer_config_json          TEXT,
          toc_config_json             TEXT,
          created_at                  TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at                  TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);

      db.run(`
        INSERT INTO layout_settings (
          id, book_id,
          page_width, page_height, page_unit,
          margin_top, margin_bottom, margin_inside, margin_outside, facing_pages,
          body_font_family, heading_font_family, body_font_size, body_line_height,
          paragraph_spacing, first_line_indent,
          show_page_numbers, page_number_start, frontmatter_numbering_style, body_numbering_style,
          body_starts_at_section_id, hide_number_on_section_types,
          show_header, show_footer, header_config_json, footer_config_json, toc_config_json,
          created_at, updated_at
        )
        SELECT
          id, book_id,
          page_width, page_height, page_unit,
          margin_top, margin_bottom, margin_inside, margin_outside, facing_pages,
          body_font_family, heading_font_family, body_font_size, body_line_height,
          paragraph_spacing, first_line_indent,
          CASE lower(COALESCE(page_number_mode, 'continuous'))
            WHEN 'none' THEN 0
            ELSE 1
          END,
          page_number_start,
          CASE lower(COALESCE(frontmatter_numbering_style, 'roman'))
            WHEN 'none' THEN 'none'
            ELSE 'roman-lower'
          END,
          'arabic',
          NULL,
          '["COVER","BACK_COVER","RIGHTS","DEDICATION"]',
          show_header,
          show_footer,
          header_config_json,
          footer_config_json,
          toc_config_json,
          created_at,
          updated_at
        FROM _bkp_layout_settings_v8
      `);

      db.run('DROP TABLE _bkp_layout_settings_v8');

      db.run(`
        INSERT OR REPLACE INTO app_settings (key, value) VALUES
          ('appVersion',    '0.8.0'),
          ('schemaVersion', '8')
      `);

      console.log('[DB] v8: layout_settings ampliada con numeración editorial básica.');
    },
  },

];

/**
 * Aplica todas las migraciones pendientes sobre la instancia de base de datos.
 */
export function runMigrations(db: Database): void {
  // Tabla de tracking (siempre se crea primero)
  db.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  for (const migration of migrations) {
    const result = db.exec(
      'SELECT version FROM schema_migrations WHERE version = ?',
      [migration.version]
    );
    const alreadyApplied = result.length > 0 && result[0].values.length > 0;

    if (!alreadyApplied) {
      console.log(`[DB] Aplicando migración v${migration.version}: ${migration.name}`);
      migration.up(db);
      db.run(
        'INSERT INTO schema_migrations (version, name) VALUES (?, ?)',
        [migration.version, migration.name]
      );
      console.log(`[DB] ✓ Migración v${migration.version} completada.`);
    }
  }

  console.log('[DB] Todas las migraciones al día.');
}
