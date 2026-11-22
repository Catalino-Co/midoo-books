/**
 * Protocolo personalizado midoo-media: sirve archivos bajo userData/books/{bookId}/...
 * sin exponer rutas absolutas al renderer.
 */

import { protocol } from 'electron';
import { readFileSync, existsSync } from 'fs';
import { extname } from 'path';
import { resolveBookStoragePath } from '../lib/book-media-paths';

function mimeForExt(ext: string): string {
  const e = ext.toLowerCase();
  if (e === '.png')  return 'image/png';
  if (e === '.jpg' || e === '.jpeg') return 'image/jpeg';
  if (e === '.gif')  return 'image/gif';
  if (e === '.webp') return 'image/webp';
  if (e === '.svg')  return 'image/svg+xml';
  if (e === '.ttf')   return 'font/ttf';
  if (e === '.otf')   return 'font/otf';
  if (e === '.woff')  return 'font/woff';
  if (e === '.woff2') return 'font/woff2';
  return 'application/octet-stream';
}

/**
 * URL: midoo-media://r/{bookId}/{storagePath segments…}
 */
export function registerMidooMediaProtocol(): void {
  protocol.handle('midoo-media', async request => {
    try {
      const url = new URL(request.url);
      if (url.hostname !== 'r') {
        return new Response(null, { status: 404 });
      }
      const segments = url.pathname.replace(/^\/+/, '').split('/').filter(Boolean);
      if (segments.length < 2) {
        return new Response(null, { status: 404 });
      }
      const bookId = decodeURIComponent(segments[0]);
      const rel    = segments.slice(1).map(decodeURIComponent).join('/');
      const abs    = resolveBookStoragePath(bookId, rel);
      if (!existsSync(abs)) {
        return new Response(null, { status: 404 });
      }
      const buf  = readFileSync(abs);
      const mime = mimeForExt(extname(abs));
      return new Response(buf, {
        headers: {
          'Content-Type':  mime,
          'Cache-Control': 'private, max-age=3600',
          // La UI (app://midoo o localhost en dev) descarga las fuentes con fetch()
          // para registrarlas con FontFace: es una petición cross-origin.
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch {
      return new Response(null, { status: 500 });
    }
  });
}
