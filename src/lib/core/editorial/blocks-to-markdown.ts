/**
 * src/lib/core/editorial/blocks-to-markdown.ts
 *
 * Serialización de DocumentBlock[] → Markdown estructurado.
 * Opuesto a markdown-to-blocks.ts (importación).
 *
 * Convenciones de salida:
 *   HEADING_1–4      → # … ####
 *   PARAGRAPH        → texto + línea en blanco
 *   QUOTE            → > línea por línea
 *   CENTERED_PHRASE  → <center>texto</center>
 *   SEPARATOR        → ---
 *   PAGE_BREAK       → <!-- pagebreak -->
 *   IMAGE            → ![altText](storagePath)
 *   CHAPTER_OPENING  → # chapterLabel — title \n ## subtitle
 */

import type { DocumentBlock } from '$lib/core/domain/block';
import type { DocumentSection } from '$lib/core/domain/section';
import type { BookProject } from '$lib/core/domain/book';

// ─── Tipos de contenido JSON ──────────────────────────────────────────────────

interface ImageBlockContent {
  assetId?: string | null;
  storagePath?: string | null;
  altText?: string | null;
  caption?: string | null;
  fillPage?: boolean;
}

interface ChapterOpeningContent {
  chapterLabel?: string | null;
  title?: string | null;
  subtitle?: string | null;
}

function parseJson<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
}

// ─── Serialización de un bloque ───────────────────────────────────────────────

export function blockToMarkdown(block: DocumentBlock): string {
  const text = (block.contentText ?? '').trim();

  switch (block.blockType) {
    case 'HEADING_1':         return `# ${text}`;
    case 'HEADING_2':         return `## ${text}`;
    case 'HEADING_3':         return `### ${text}`;
    case 'HEADING_4':         return `#### ${text}`;
    case 'PARAGRAPH':         return text;
    case 'CENTERED_PHRASE':   return `<center>${text}</center>`;
    case 'SEPARATOR':         return '---';
    case 'PAGE_BREAK':        return '<!-- pagebreak -->';

    case 'QUOTE': {
      if (!text) return '>';
      return text.split('\n').map(line => `> ${line}`).join('\n');
    }

    case 'IMAGE': {
      const img = parseJson<ImageBlockContent>(block.contentJson, {});
      const src = img.storagePath ?? img.assetId ?? '';
      const alt = img.altText ?? '';
      const caption = img.caption ? `\n*${img.caption}*` : '';
      return `![${alt}](${src})${caption}`;
    }

    case 'CHAPTER_OPENING': {
      const co = parseJson<ChapterOpeningContent>(block.contentJson, {});
      const parts: string[] = [];
      const heading = [co.chapterLabel, co.title].filter(Boolean).join(' — ');
      if (heading) parts.push(`# ${heading}`);
      if (co.subtitle) parts.push(`## ${co.subtitle}`);
      return parts.join('\n') || `# ${text}`;
    }

    default:
      return text;
  }
}

// ─── Serialización de una sección ─────────────────────────────────────────────

export function sectionToMarkdown(
  section: DocumentSection,
  blocks: DocumentBlock[],
): string {
  const lines: string[] = [];

  lines.push(`<!-- section: ${section.sectionType} id:${section.id} -->`);
  if (section.title) lines.push(`<!-- title: ${section.title} -->`);
  lines.push('');

  for (const block of blocks) {
    const md = blockToMarkdown(block);
    lines.push(md);
    // Add blank line after paragraphs and headings for spacing
    if (
      block.blockType === 'PARAGRAPH' ||
      block.blockType === 'CHAPTER_OPENING' ||
      block.blockType === 'HEADING_1' ||
      block.blockType === 'HEADING_2' ||
      block.blockType === 'HEADING_3' ||
      block.blockType === 'HEADING_4'
    ) {
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ─── Documento completo ────────────────────────────────────────────────────────

export interface MarkdownBookExport {
  /** Archivo único con todas las secciones */
  singleFile: string;
  /** Archivos por sección: clave = slug de sección, valor = contenido Markdown */
  sectionFiles: Record<string, string>;
}

export function bookToMarkdown(
  book: BookProject,
  sections: DocumentSection[],
  blocksBySectionId: Record<string, DocumentBlock[]>,
): MarkdownBookExport {
  const frontmatter = [
    '---',
    `title: "${book.title.replace(/"/g, '\\"')}"`,
    book.authorName   ? `author: "${book.authorName.replace(/"/g, '\\"')}"` : null,
    book.languageCode ? `language: ${book.languageCode}` : null,
    `date: ${new Date().toISOString().slice(0, 10)}`,
    '---',
  ].filter(Boolean).join('\n');

  const sectionFiles: Record<string, string> = {};
  const bodyParts: string[] = [];

  for (const section of sections) {
    const blocks = blocksBySectionId[section.id] ?? [];
    const content = sectionToMarkdown(section, blocks);

    // Build a filename-safe slug
    const slug = `${section.orderIndex.toString().padStart(3, '0')}_${section.sectionType.toLowerCase()}${section.title ? '_' + section.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40) : ''}`;
    sectionFiles[slug] = content;
    bodyParts.push(content);
  }

  const singleFile = [frontmatter, '', ...bodyParts].join('\n\n');

  return { singleFile, sectionFiles };
}
