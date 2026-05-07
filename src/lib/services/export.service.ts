/**
 * src/lib/services/export.service.ts
 *
 * Servicio de exportación de libros.
 *
 * Exports:
 *   buildBookExportData — Agrega todo el contenido necesario para exportar
 *   exportMarkdown      — Genera y guarda un archivo Markdown
 *   exportEpub          — Genera y guarda un archivo EPUB 3
 *   exportDocx          — Genera y guarda un archivo DOCX
 *   exportPdf           — Genera y guarda un PDF via printToPDF (Electron)
 *   createExportJob / updateExportJob / listExportJobs — CRUD de historial
 */

import { getPlatformAdapter } from '$lib/persistence';
import type { BookProject }    from '$lib/core/domain/book';
import type { LayoutSettings } from '$lib/core/domain/layout';
import type { DocumentSection } from '$lib/core/domain/section';
import type { DocumentBlock }  from '$lib/core/domain/block';
import type { Asset }          from '$lib/core/domain/asset';
import type { ExportJob, ExportType, CreateExportJobInput, UpdateExportJobInput } from '$lib/core/domain/export';
import { bookToMarkdown }      from '$lib/core/editorial/blocks-to-markdown';

// ─── Tipo agregado ────────────────────────────────────────────────────────────

export interface BookExportData {
  book: BookProject;
  layout: LayoutSettings;
  sections: DocumentSection[];
  blocksBySectionId: Record<string, DocumentBlock[]>;
  assets: Asset[];
}

// ─── Carga de datos ───────────────────────────────────────────────────────────

export async function buildBookExportData(bookId: string): Promise<BookExportData> {
  const api = getPlatformAdapter();
  const [book, layout, sections, assets] = await Promise.all([
    api.getBookById(bookId),
    api.getLayoutSettingsByBookId(bookId),
    api.listSectionsByBook(bookId),
    api.listAssetsByBook(bookId),
  ]);

  if (!book) throw new Error(`Libro ${bookId} no encontrado.`);

  const blocksBySectionId: Record<string, DocumentBlock[]> = {};
  await Promise.all(
    sections.map(async s => {
      blocksBySectionId[s.id] = await api.listBlocksBySection(s.id);
    }),
  );

  return { book, layout, sections, blocksBySectionId, assets };
}

// ─── CRUD de jobs ─────────────────────────────────────────────────────────────

export function createExportJob(input: CreateExportJobInput): Promise<ExportJob> {
  return getPlatformAdapter().createExportJob(input);
}

export function updateExportJob(id: string, updates: UpdateExportJobInput): Promise<ExportJob | null> {
  return getPlatformAdapter().updateExportJob(id, updates);
}

export function listExportJobs(bookId: string, limit = 10): Promise<ExportJob[]> {
  return getPlatformAdapter().listExportJobsByBook(bookId, limit);
}

// ─── Markdown ─────────────────────────────────────────────────────────────────

export async function exportMarkdown(
  bookId: string,
  opts: { singleFile: boolean } = { singleFile: true },
): Promise<{ success: boolean; path?: string; canceled?: boolean }> {
  const api = getPlatformAdapter();
  const data = await buildBookExportData(bookId);
  const result = bookToMarkdown(data.book, data.sections, data.blocksBySectionId);

  const safeTitle = data.book.title.replace(/[/\\?%*:|"<>]/g, '-');
  const content = opts.singleFile ? result.singleFile : result.singleFile;

  const buf = new TextEncoder().encode(content);

  return api.saveExportFile(
    buf as unknown as Buffer,
    `${safeTitle}.md`,
    [{ name: 'Markdown', extensions: ['md'] }],
  );
}

// ─── EPUB ─────────────────────────────────────────────────────────────────────

interface EpubImageEntry {
  assetId: string;
  mimeType: string;
  storagePath: string;
}

function blockImageAssets(
  sections: DocumentSection[],
  blocksBySectionId: Record<string, DocumentBlock[]>,
  assets: Asset[],
): EpubImageEntry[] {
  const assetMap = new Map(assets.map(a => [a.id, a]));
  const seen = new Set<string>();
  const result: EpubImageEntry[] = [];

  for (const s of sections) {
    for (const b of blocksBySectionId[s.id] ?? []) {
      if (b.blockType !== 'IMAGE') continue;
      let parsed: { assetId?: string } = {};
      try { parsed = JSON.parse(b.contentJson ?? '{}'); } catch { /* noop */ }
      const id = parsed.assetId;
      if (!id || seen.has(id)) continue;
      const asset = assetMap.get(id as Asset['id']);
      if (!asset) continue;
      seen.add(id);
      const ext = asset.storagePath.split('.').pop()?.toLowerCase() ?? 'jpg';
      const mimeType =
        ext === 'png'  ? 'image/png' :
        ext === 'gif'  ? 'image/gif' :
        ext === 'webp' ? 'image/webp' :
        'image/jpeg';
      result.push({ assetId: id, mimeType, storagePath: asset.storagePath });
    }
  }
  return result;
}

function blocksToXhtml(
  section: DocumentSection,
  blocks: DocumentBlock[],
  sectionIndex: number,
  /** assetId → filename (e.g. "abc123.jpg") usado en ../images/ */
  assetFilenames: Map<string, string>,
): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<!DOCTYPE html>');
  lines.push('<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">');
  lines.push('<head>');
  lines.push(`  <title>${xmlEsc(section.title ?? '')}</title>`);
  lines.push('  <link rel="stylesheet" type="text/css" href="../styles/main.css"/>');
  lines.push('</head>');
  lines.push('<body>');

  for (const b of blocks) {
    const text = xmlEsc(b.contentText ?? '');
    switch (b.blockType) {
      case 'HEADING_1': lines.push(`  <h1>${text}</h1>`); break;
      case 'HEADING_2': lines.push(`  <h2>${text}</h2>`); break;
      case 'HEADING_3': lines.push(`  <h3>${text}</h3>`); break;
      case 'HEADING_4': lines.push(`  <h4>${text}</h4>`); break;
      case 'PARAGRAPH': lines.push(`  <p>${text}</p>`); break;
      case 'CENTERED_PHRASE': lines.push(`  <p class="centered">${text}</p>`); break;
      case 'SEPARATOR': lines.push('  <hr/>'); break;
      case 'PAGE_BREAK': lines.push('  <p class="page-break"/>'); break;
      case 'QUOTE': {
        const qlines = (b.contentText ?? '').split('\n');
        lines.push('  <blockquote>');
        qlines.forEach(l => lines.push(`    <p>${xmlEsc(l)}</p>`));
        lines.push('  </blockquote>');
        break;
      }
      case 'IMAGE': {
        let parsed: { assetId?: string; altText?: string; caption?: string } = {};
        try { parsed = JSON.parse(b.contentJson ?? '{}'); } catch { /* noop */ }
        const filename = parsed.assetId ? assetFilenames.get(parsed.assetId) : undefined;
        const src = filename ? `../images/${filename}` : '';
        const alt = xmlEsc(parsed.altText ?? '');
        if (src) {
          lines.push('  <figure>');
          lines.push(`    <img src="${src}" alt="${alt}"/>`);
          if (parsed.caption) lines.push(`    <figcaption>${xmlEsc(parsed.caption)}</figcaption>`);
          lines.push('  </figure>');
        }
        break;
      }
      case 'CHAPTER_OPENING': {
        let co: { chapterLabel?: string; title?: string; subtitle?: string } = {};
        try { co = JSON.parse(b.contentJson ?? '{}'); } catch { /* noop */ }
        if (co.chapterLabel) lines.push(`  <p class="chapter-label">${xmlEsc(co.chapterLabel)}</p>`);
        if (co.title)        lines.push(`  <h1 class="chapter-title">${xmlEsc(co.title)}</h1>`);
        if (co.subtitle)     lines.push(`  <p class="chapter-subtitle">${xmlEsc(co.subtitle)}</p>`);
        break;
      }
    }
  }

  lines.push('</body>');
  lines.push('</html>');
  return lines.join('\n');
}

function xmlEsc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function buildEpubZip(data: BookExportData, bookId: string): Promise<Uint8Array> {
  const JSZip = (await import('jszip')).default;
  const { assetDisplayUrl } = await import('$lib/services/assets.service');
  const zip = new JSZip();

  // mimetype — must be first, uncompressed
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  // META-INF/container.xml
  zip.file('META-INF/container.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">',
    '  <rootfiles>',
    '    <rootfile full-path="OEBPS/package.opf" media-type="application/oebps-package+xml"/>',
    '  </rootfiles>',
    '</container>',
  ].join('\n'));

  // Styles
  const css = [
    'body { font-family: Georgia, serif; font-size: 1em; line-height: 1.5; margin: 0; padding: 0; }',
    'h1, h2, h3, h4 { font-family: inherit; }',
    '.centered { text-align: center; }',
    '.chapter-label { text-align: center; font-size: 0.85em; letter-spacing: 0.1em; text-transform: uppercase; }',
    '.chapter-title { text-align: center; font-size: 1.8em; margin: 0.5em 0; }',
    '.chapter-subtitle { text-align: center; font-size: 1.1em; font-style: italic; }',
    '.page-break { page-break-after: always; height: 0; margin: 0; padding: 0; }',
    'hr { border: none; border-top: 1px solid currentColor; opacity: 0.4; margin: 1em 0; }',
    'img { max-width: 100%; }',
  ].join('\n');
  zip.file('OEBPS/styles/main.css', css);

  // Content XHTML files
  const imageEntries = blockImageAssets(data.sections, data.blocksBySectionId, data.assets);

  // Fetch image binary data and embed in zip; build assetId → filename map for XHTML
  const assetFilenames = new Map<string, string>();
  await Promise.all(imageEntries.map(async (img) => {
    const ext = img.storagePath.split('.').pop()?.toLowerCase() ?? 'jpg';
    const filename = `${img.assetId}.${ext}`;
    assetFilenames.set(img.assetId, filename);
    try {
      const url = assetDisplayUrl(bookId, img.storagePath);
      const resp = await fetch(url);
      if (resp.ok) {
        const buf = await resp.arrayBuffer();
        zip.file(`OEBPS/images/${filename}`, buf);
      }
    } catch {
      // Si no se puede obtener la imagen, omitir silenciosamente
    }
  }));

  const tocSections: DocumentSection[] = [];

  for (let i = 0; i < data.sections.length; i++) {
    const s = data.sections[i];
    const blocks = data.blocksBySectionId[s.id] ?? [];
    const xhtml = blocksToXhtml(s, blocks, i, assetFilenames);
    zip.file(`OEBPS/content/section-${String(i).padStart(3, '0')}.xhtml`, xhtml);
    if (s.includeInToc !== false) tocSections.push(s);
  }

  // package.opf
  const manifestItems: string[] = [
    '    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
    '    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    '    <item id="css" href="styles/main.css" media-type="text/css"/>',
  ];
  const spineItems: string[] = [];

  for (let i = 0; i < data.sections.length; i++) {
    const id = `section-${String(i).padStart(3, '0')}`;
    manifestItems.push(`    <item id="${id}" href="content/${id}.xhtml" media-type="application/xhtml+xml"/>`);
    spineItems.push(`    <itemref idref="${id}"/>`);
  }

  for (const img of imageEntries) {
    const filename = assetFilenames.get(img.assetId);
    if (!filename) continue; // skip images that failed to fetch
    manifestItems.push(`    <item id="img-${img.assetId}" href="images/${filename}" media-type="${img.mimeType}"/>`);
  }

  const now = new Date().toISOString().slice(0, 10);
  const opf = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">',
    '  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">',
    `    <dc:identifier id="uid">${data.book.id}</dc:identifier>`,
    `    <dc:title>${xmlEsc(data.book.title)}</dc:title>`,
    data.book.authorName ? `    <dc:creator>${xmlEsc(data.book.authorName)}</dc:creator>` : '',
    data.book.languageCode ? `    <dc:language>${data.book.languageCode}</dc:language>` : '    <dc:language>es</dc:language>',
    `    <meta property="dcterms:modified">${now}T00:00:00Z</meta>`,
    '  </metadata>',
    '  <manifest>',
    ...manifestItems,
    '  </manifest>',
    '  <spine toc="ncx">',
    ...spineItems,
    '  </spine>',
    '</package>',
  ].filter(Boolean).join('\n');
  zip.file('OEBPS/package.opf', opf);

  // nav.xhtml (EPUB 3 TOC)
  const navItems = tocSections.map((s, i) => {
    const idx = data.sections.indexOf(s);
    const href = `content/section-${String(idx).padStart(3, '0')}.xhtml`;
    return `      <li><a href="${href}">${xmlEsc(s.title ?? s.sectionType)}</a></li>`;
  });
  const nav = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE html>',
    '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">',
    '<head><title>Índice</title></head>',
    '<body>',
    '  <nav epub:type="toc" id="toc">',
    '    <h1>Índice</h1>',
    '    <ol>',
    ...navItems,
    '    </ol>',
    '  </nav>',
    '</body>',
    '</html>',
  ].join('\n');
  zip.file('OEBPS/nav.xhtml', nav);

  // toc.ncx (EPUB 2 compatibility)
  const ncxPoints = tocSections.map((s, i) => {
    const idx = data.sections.indexOf(s);
    const href = `content/section-${String(idx).padStart(3, '0')}.xhtml`;
    return [
      `  <navPoint id="navPoint-${i + 1}" playOrder="${i + 1}">`,
      `    <navLabel><text>${xmlEsc(s.title ?? s.sectionType)}</text></navLabel>`,
      `    <content src="${href}"/>`,
      `  </navPoint>`,
    ].join('\n');
  });
  const ncx = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">',
    '<head>',
    `  <meta name="dtb:uid" content="${data.book.id}"/>`,
    '</head>',
    `<docTitle><text>${xmlEsc(data.book.title)}</text></docTitle>`,
    '<navMap>',
    ...ncxPoints,
    '</navMap>',
    '</ncx>',
  ].join('\n');
  zip.file('OEBPS/toc.ncx', ncx);

  return zip.generateAsync({ type: 'uint8array', mimeType: 'application/epub+zip' });
}

export async function exportEpub(bookId: string): Promise<{ success: boolean; path?: string; canceled?: boolean }> {
  const api = getPlatformAdapter();
  const data = await buildBookExportData(bookId);
  const bytes = await buildEpubZip(data, bookId);
  const safeTitle = data.book.title.replace(/[/\\?%*:|"<>]/g, '-');
  return api.saveExportFile(
    bytes as unknown as Buffer,
    `${safeTitle}.epub`,
    [{ name: 'EPUB', extensions: ['epub'] }],
  );
}

// ─── DOCX ─────────────────────────────────────────────────────────────────────

async function buildDocxBuffer(data: BookExportData): Promise<Uint8Array> {
  const {
    Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel,
    AlignmentType, BorderStyle, PageOrientation,
  } = await import('docx');

  const { widthMm, heightMm } = await import('$lib/core/editorial/document-page-geometry').then(m =>
    m.pageDimensionsMm(data.layout)
  );

  // 1 mm = 56.69 twips; docx uses twips
  const toTwips = (mm: number) => Math.round(mm * 56.69);

  const children: InstanceType<typeof Paragraph>[] = [];

  for (const section of data.sections) {
    for (const block of data.blocksBySectionId[section.id] ?? []) {
      const text = block.contentText ?? '';

      switch (block.blockType) {
        case 'HEADING_1':
          children.push(new Paragraph({ text, heading: HeadingLevel.HEADING_1 }));
          break;
        case 'HEADING_2':
          children.push(new Paragraph({ text, heading: HeadingLevel.HEADING_2 }));
          break;
        case 'HEADING_3':
          children.push(new Paragraph({ text, heading: HeadingLevel.HEADING_3 }));
          break;
        case 'HEADING_4':
          children.push(new Paragraph({ text, heading: HeadingLevel.HEADING_4 }));
          break;
        case 'PARAGRAPH':
          children.push(new Paragraph({ children: [new TextRun(text)] }));
          break;
        case 'CENTERED_PHRASE':
          children.push(new Paragraph({
            children: [new TextRun(text)],
            alignment: AlignmentType.CENTER,
          }));
          break;
        case 'QUOTE':
          children.push(new Paragraph({
            children: [new TextRun({ text, italics: true })],
            indent: { left: toTwips(10) },
          }));
          break;
        case 'SEPARATOR':
          children.push(new Paragraph({
            children: [],
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, space: 1, color: 'auto' } },
          }));
          break;
        case 'PAGE_BREAK':
          children.push(new Paragraph({
            children: [new TextRun({ text: '', break: 1 })],
            pageBreakBefore: true,
          }));
          break;
        case 'CHAPTER_OPENING': {
          let co: { chapterLabel?: string; title?: string; subtitle?: string } = {};
          try { co = JSON.parse(block.contentJson ?? '{}'); } catch { /* noop */ }
          if (co.chapterLabel) children.push(new Paragraph({
            text: co.chapterLabel,
            alignment: AlignmentType.CENTER,
          }));
          if (co.title) children.push(new Paragraph({
            text: co.title,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
          }));
          if (co.subtitle) children.push(new Paragraph({
            text: co.subtitle,
            heading: HeadingLevel.HEADING_2,
            alignment: AlignmentType.CENTER,
          }));
          break;
        }
      }
    }
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: {
            width:  toTwips(widthMm),
            height: toTwips(heightMm),
          },
        },
      },
      children,
    }],
  });

  // Packer.toBuffer usa nodebuffer (Node.js only) y falla en el renderer de Electron.
  // Packer.toBlob devuelve un Blob estándar de Web API, compatible con cualquier entorno.
  const blob = await Packer.toBlob(doc);
  return new Uint8Array(await blob.arrayBuffer());
}

export async function exportDocx(bookId: string): Promise<{ success: boolean; path?: string; canceled?: boolean }> {
  const api = getPlatformAdapter();
  const data = await buildBookExportData(bookId);
  const bytes = await buildDocxBuffer(data);
  const safeTitle = data.book.title.replace(/[/\\?%*:|"<>]/g, '-');
  return api.saveExportFile(
    bytes as unknown as Buffer,
    `${safeTitle}.docx`,
    [{ name: 'Word Document', extensions: ['docx'] }],
  );
}

// ─── PDF (via Electron printToPDF) ───────────────────────────────────────────

export async function exportPdf(
  bookId: string,
  format: 'screen' | 'print',
): Promise<{ success: boolean; path?: string; canceled?: boolean }> {
  const api = getPlatformAdapter();

  // Determine base URL: use the current window origin
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';

  const data = await buildBookExportData(bookId);
  const pdfBuffer = await api.renderBookPdf(bookId, { format, baseUrl });

  const safeTitle = data.book.title.replace(/[/\\?%*:|"<>]/g, '-');
  const suffix = format === 'print' ? '_impresion' : '_pantalla';

  return api.saveExportFile(
    pdfBuffer,
    `${safeTitle}${suffix}.pdf`,
    [{ name: 'PDF', extensions: ['pdf'] }],
  );
}
