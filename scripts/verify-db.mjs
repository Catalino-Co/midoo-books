#!/usr/bin/env node
/**
 * scripts/verify-db.mjs
 *
 * Verifica el contenido de la base de datos SQLite de MIDOO Books.
 * Muestra tablas, migraciones, settings y libros registrados.
 *
 * Uso: node scripts/verify-db.mjs
 */

import { createRequire } from 'module';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const require = createRequire(import.meta.url);
const initSqlJs = require('../node_modules/sql.js/dist/sql-wasm.js');

function getDbPath() {
  switch (process.platform) {
    case 'win32':  return join(process.env.APPDATA ?? '', 'midoo-books', 'midoo-books.db');
    case 'darwin': return join(homedir(), 'Library', 'Application Support', 'midoo-books', 'midoo-books.db');
    default:       return join(homedir(), '.config', 'midoo-books', 'midoo-books.db');
  }
}

const dbPath = getDbPath();
console.log('\nMIDOO Books — Verificación de Base de Datos');
console.log('='.repeat(55));
console.log('Ruta:', dbPath);

if (!existsSync(dbPath)) {
  console.error('\n❌ Archivo no encontrado. Inicia la app con "npm run dev" primero.');
  process.exit(1);
}

const SQL = await initSqlJs();
const db  = new SQL.Database(readFileSync(dbPath));

// Tablas
console.log('\n📋 Tablas:');
db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")[0]
  .values.forEach(([n]) => console.log('  •', n));

// Migraciones
console.log('\n🔄 Migraciones aplicadas:');
db.exec('SELECT version, name, applied_at FROM schema_migrations ORDER BY version')[0]
  .values.forEach(([v, n, t]) => console.log(`  v${v}: ${n}  (${t})`));

// Settings
console.log('\n⚙️  App Settings:');
db.exec('SELECT key, value FROM app_settings ORDER BY key')[0]
  .values.forEach(([k, v]) => console.log(`  ${String(k).padEnd(22)} = ${v}`));

// Libros
console.log('\n📚 book_projects:');
const books = db.exec('SELECT id, title, author_name, status, created_at FROM book_projects ORDER BY created_at DESC');
if (!books.length || !books[0].values.length) {
  console.log('  (vacío)');
} else {
  books[0].values.forEach(([id, title, author, status, ts]) =>
    console.log(`  [${String(id).slice(0,8)}…] "${title}" — ${author || '(sin autor)'} [${status}] ${ts}`)
  );
}

// Layout settings
const layouts = db.exec('SELECT id, book_id, page_width, page_height, page_unit FROM layout_settings');
if (layouts.length && layouts[0].values.length) {
  console.log('\n📐 layout_settings:');
  layouts[0].values.forEach(([id, bookId, w, h, unit]) =>
    console.log(`  [${String(id).slice(0,8)}…] book:${String(bookId).slice(0,8)}… → ${w}×${h} ${unit}`)
  );
}

// Secciones
const sections = db.exec('SELECT id, book_id, section_type, title, order_index FROM document_sections ORDER BY order_index');
if (sections.length && sections[0].values.length) {
  console.log('\n📑 document_sections:');
  sections[0].values.forEach(([id, , type, title, idx]) =>
    console.log(`  [${idx}] ${type}: "${title}" (${String(id).slice(0,8)}…)`)
  );
} else {
  console.log('\n📑 document_sections: (vacío)');
}

// Bloques
const blockCount = db.exec('SELECT COUNT(*) as total FROM document_blocks');
const bTotal = blockCount.length ? Number(blockCount[0].values[0][0]) : 0;
console.log(`\n🧱 document_blocks: ${bTotal} bloques en total`);

// Export jobs
const exports = db.exec('SELECT COUNT(*) FROM export_jobs');
console.log(`📤 export_jobs: ${exports[0]?.values[0]?.[0] ?? 0} registros`);

// Snapshots
const snaps = db.exec('SELECT COUNT(*) FROM snapshots');
console.log(`📸 snapshots: ${snaps[0]?.values[0]?.[0] ?? 0} registros`);

db.close();
console.log('\n✅ Verificación completada.\n');
