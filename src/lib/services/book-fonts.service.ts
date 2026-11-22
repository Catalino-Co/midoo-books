/**
 * book-fonts.service.ts
 *
 * Carga en el documento actual las fuentes propias de un libro (assets de tipo 'font')
 * mediante la API FontFace. Se usa en tres sitios que DEBEN ver la misma fuente:
 *   1. El medidor de texto de la paginación (antes de medir).
 *   2. La vista previa (BookPage.svelte).
 *   3. La ruta /export-render que se imprime a PDF.
 *
 * Si una fuente no carga, se registra el error y se sigue: la paginación usará la
 * fuente de reserva, pero no se bloquea la exportación.
 */

import type { Asset } from '$lib/core/domain/asset';
import { assetDisplayUrl, listAssets } from '$lib/services/assets.service';

/** Claves `${bookId}:${assetId}:${updatedAt}` ya registradas en document.fonts. */
const loaded = new Map<string, FontFace>();
/** Carga en curso por libro (evita duplicar trabajo si se llama en paralelo). */
const inflight = new Map<string, Promise<BookFontFamily[]>>();

export interface BookFontFamily {
  family: string;
  /** Variantes disponibles (peso + estilo). */
  variants: { weight: number; style: 'normal' | 'italic'; assetId: string }[];
}

export function isFontAsset(a: Pick<Asset, 'assetType'>): boolean {
  return a.assetType === 'font';
}

/** Agrupa los assets de fuente del libro por familia (para el selector de Estilos). */
export function groupFontFamilies(assets: Asset[]): BookFontFamily[] {
  const byFamily = new Map<string, BookFontFamily>();
  for (const a of assets) {
    if (!isFontAsset(a) || !a.fontFamily) continue;
    const fam = byFamily.get(a.fontFamily) ?? { family: a.fontFamily, variants: [] };
    fam.variants.push({
      weight: a.fontWeight ?? 400,
      style:  a.fontStyle === 'italic' ? 'italic' : 'normal',
      assetId: a.id,
    });
    byFamily.set(a.fontFamily, fam);
  }
  for (const f of byFamily.values()) {
    f.variants.sort((x, y) => x.weight - y.weight || x.style.localeCompare(y.style));
  }
  return [...byFamily.values()].sort((a, b) => a.family.localeCompare(b.family));
}

/** Valor CSS de font-family para una familia propia (entre comillas + reserva serif). */
export function cssFontFamilyValue(family: string, fallback = 'serif'): string {
  return `'${family.replace(/'/g, "\\'")}', ${fallback}`;
}

async function loadOne(bookId: string, a: Asset): Promise<void> {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined') return;
  if (!a.fontFamily) return;
  const key = `${bookId}:${a.id}:${a.updatedAt}:${a.fontFamily}:${a.fontWeight}:${a.fontStyle}`;
  if (loaded.has(key)) return;
  try {
    const res = await fetch(assetDisplayUrl(bookId, a.storagePath));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.arrayBuffer();
    const face = new FontFace(a.fontFamily, data, {
      weight: String(a.fontWeight ?? 400),
      style:  a.fontStyle === 'italic' ? 'italic' : 'normal',
    });
    await face.load();
    document.fonts.add(face);
    loaded.set(key, face);
  } catch (err) {
    console.warn(`[fonts] No se pudo cargar «${a.originalName}» (${a.fontFamily}):`, err);
  }
}

/**
 * Registra todas las fuentes del libro y espera a que estén listas.
 * Idempotente: llamarla varias veces no vuelve a descargar las mismas fuentes.
 */
export function ensureBookFontsLoaded(bookId: string, assets?: Asset[]): Promise<BookFontFamily[]> {
  if (typeof document === 'undefined') return Promise.resolve([]);
  const existing = inflight.get(bookId);
  if (existing && !assets) return existing;

  const p = (async () => {
    const list = assets ?? await listAssets(bookId).catch(() => [] as Asset[]);
    const fonts = list.filter(isFontAsset);
    await Promise.all(fonts.map(a => loadOne(bookId, a)));
    // Fuentes del sistema o ya presentes: esperar a que el documento termine de cargar.
    await document.fonts.ready;
    return groupFontFamilies(fonts);
  })();
  inflight.set(bookId, p);
  p.finally(() => {
    if (inflight.get(bookId) === p) inflight.delete(bookId);
  });
  return p;
}
