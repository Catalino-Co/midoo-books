import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildMarkdownBookImportPreview,
  parseMarkdownBookToSectionDrafts,
  segmentMarkdownBookByH1,
} from './markdown-book-import';
import { inferMarkdownImportSuggestion } from './markdown-import-hints';
import { buildMarkdownImportPreview, parseMarkdownToBlockDrafts } from './markdown-to-blocks';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function fixture(name: string): string {
  return readFileSync(path.join(__dirname, '__fixtures__', name), 'utf8');
}

describe('markdown import — fixtures tipo libro real', () => {
  it('sample-short-story: varias secciones H1 y tipos de bloque', () => {
    const md = fixture('sample-short-story.md');
    const segments = segmentMarkdownBookByH1(md);
    expect(segments.length).toBe(3);
    expect(segments[0]?.title).toBe('Prólogo');
    expect(segments[1]?.title).toBe('Capítulo I — El encuentro');
    expect(segments[2]?.title).toBe('Epílogo');

    const drafts = parseMarkdownBookToSectionDrafts(md);
    const preview = buildMarkdownBookImportPreview(drafts);
    expect(preview.sectionCount).toBe(3);
    expect(preview.totalBlocks).toBeGreaterThan(5);
    expect(preview.summaryLine).toContain('sección');
    expect(preview.summaryLine).toContain('bloque');
    expect(preview.byType.PARAGRAPH).toBeGreaterThan(0);
    expect(preview.byType.QUOTE).toBeGreaterThanOrEqual(1);
    expect(preview.byType.SEPARATOR).toBeGreaterThanOrEqual(1);
    expect(preview.byType.PAGE_BREAK).toBeGreaterThanOrEqual(1);
    expect(preview.byType.IMAGE).toBeGreaterThanOrEqual(1);
  });

  it('section-only-chapter: encaja como importación por sección (bloques)', () => {
    const md = fixture('section-only-chapter.md');
    const drafts = parseMarkdownToBlockDrafts(md);
    expect(drafts.length).toBeGreaterThan(0);
    const prev = buildMarkdownImportPreview(drafts);
    expect(prev.blockCount).toBe(drafts.length);
    expect(prev.byType.HEADING_1).toBeGreaterThanOrEqual(1);
  });

  it('inferMarkdownImportSuggestion favorece libro con varios H1', () => {
    const md = fixture('sample-short-story.md');
    const h = inferMarkdownImportSuggestion(md);
    expect(h.suggested).toBe('book');
    expect(h.message.length).toBeGreaterThan(10);
  });

  it('inferMarkdownImportSuggestion sin H1 de sección → sección', () => {
    const md = 'Solo párrafo.\n\nOtro párrafo.\n\n> cita\n';
    const h = inferMarkdownImportSuggestion(md);
    expect(h.suggested).toBe('section');
  });
});
