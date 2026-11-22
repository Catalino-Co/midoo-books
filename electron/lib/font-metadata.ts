/**
 * electron/lib/font-metadata.ts
 *
 * Lee familia, peso y estilo de un archivo de fuente al importarlo.
 *   - TTF / OTF: tablas 'name' (IDs 16/17 o 1/2) y 'OS/2' (usWeightClass, fsSelection).
 *   - WOFF / WOFF2 (comprimidas) o fuentes ilegibles: se deduce del nombre del archivo
 *     («Quattrocento-Bold.ttf» → Quattrocento, 700, normal).
 * El usuario puede corregir la familia después en Estilos.
 */

export const FONT_EXTENSIONS = ['.ttf', '.otf', '.woff', '.woff2'] as const;

export interface FontMetadata {
  family: string;
  weight: number;
  style: 'normal' | 'italic';
}

export function isFontExtension(ext: string): boolean {
  return (FONT_EXTENSIONS as readonly string[]).includes(ext.toLowerCase());
}

export function fontMimeForExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.ttf':   return 'font/ttf';
    case '.otf':   return 'font/otf';
    case '.woff':  return 'font/woff';
    case '.woff2': return 'font/woff2';
    default:       return 'application/octet-stream';
  }
}

const WEIGHT_WORDS: [RegExp, number][] = [
  [/thin|hairline/i, 100],
  [/extra[\s-]?light|ultra[\s-]?light/i, 200],
  [/light/i, 300],
  [/medium/i, 500],
  [/semi[\s-]?bold|demi[\s-]?bold/i, 600],
  [/extra[\s-]?bold|ultra[\s-]?bold/i, 800],
  [/black|heavy/i, 900],
  [/bold/i, 700],
];

function weightFromWords(s: string): number {
  for (const [re, w] of WEIGHT_WORDS) if (re.test(s)) return w;
  return 400;
}

/** «EBGaramond-SemiBoldItalic» → { family: 'EB Garamond', weight: 600, style: 'italic' }. */
export function fontMetadataFromFilename(filename: string): FontMetadata {
  const base = filename.replace(/\.[^.]+$/, '');
  const [rawFamily, ...rest] = base.split(/[-_]/);
  const styleWords = rest.join(' ');
  const family = (rawFamily || base)
    // «EBGaramond» → «EB Garamond», «GlacialIndifference» → «Glacial Indifference»
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim();
  return {
    family: family || 'Fuente',
    weight: weightFromWords(styleWords),
    style:  /italic|oblique/i.test(styleWords) ? 'italic' : 'normal',
  };
}

function readTag(buf: Buffer, off: number): string {
  return buf.toString('latin1', off, off + 4);
}

function decodeNameString(buf: Buffer, platformId: number, start: number, length: number): string {
  if (start + length > buf.length) return '';
  if (platformId === 0 || platformId === 3) {
    // UTF-16BE
    let out = '';
    for (let i = 0; i + 1 < length; i += 2) out += String.fromCharCode(buf.readUInt16BE(start + i));
    return out;
  }
  return buf.toString('latin1', start, start + length);
}

/** Lee metadatos de un TTF/OTF. Devuelve null si el formato no es sfnt o está dañado. */
export function readSfntFontMetadata(buf: Buffer): FontMetadata | null {
  try {
    if (buf.length < 12) return null;
    const version = buf.readUInt32BE(0);
    const tag = readTag(buf, 0);
    if (version !== 0x00010000 && tag !== 'OTTO' && tag !== 'true') return null;

    const numTables = buf.readUInt16BE(4);
    const tables = new Map<string, { offset: number; length: number }>();
    for (let i = 0; i < numTables; i++) {
      const rec = 12 + i * 16;
      if (rec + 16 > buf.length) return null;
      tables.set(readTag(buf, rec), { offset: buf.readUInt32BE(rec + 8), length: buf.readUInt32BE(rec + 12) });
    }

    const name = tables.get('name');
    if (!name) return null;
    const count = buf.readUInt16BE(name.offset + 2);
    const stringOffset = name.offset + buf.readUInt16BE(name.offset + 4);
    const found: Record<number, { score: number; value: string }> = {};
    for (let i = 0; i < count; i++) {
      const r = name.offset + 6 + i * 12;
      const platformId = buf.readUInt16BE(r);
      const languageId = buf.readUInt16BE(r + 4);
      const nameId = buf.readUInt16BE(r + 6);
      if (![1, 2, 16, 17].includes(nameId)) continue;
      const length = buf.readUInt16BE(r + 8);
      const offset = buf.readUInt16BE(r + 10);
      const value = decodeNameString(buf, platformId, stringOffset + offset, length).trim();
      if (!value) continue;
      // Preferir Windows inglés (3/0x409), luego cualquier Windows, luego Mac.
      const score = platformId === 3 ? (languageId === 0x409 ? 3 : 2) : 1;
      if (!found[nameId] || found[nameId].score < score) found[nameId] = { score, value };
    }

    const family = (found[16] ?? found[1])?.value;
    if (!family) return null;
    const subfamily = (found[17] ?? found[2])?.value ?? '';

    let weight = weightFromWords(subfamily);
    let italic = /italic|oblique/i.test(subfamily);
    const os2 = tables.get('OS/2');
    if (os2 && os2.length >= 64) {
      const w = buf.readUInt16BE(os2.offset + 4);
      if (w >= 100 && w <= 1000) weight = Math.min(900, Math.round(w / 100) * 100);
      const fsSelection = buf.readUInt16BE(os2.offset + 62);
      if (fsSelection & 0x1) italic = true;
    }
    return { family, weight, style: italic ? 'italic' : 'normal' };
  } catch {
    return null;
  }
}

export function readFontMetadata(buf: Buffer, filename: string): FontMetadata {
  return readSfntFontMetadata(buf) ?? fontMetadataFromFilename(filename);
}
