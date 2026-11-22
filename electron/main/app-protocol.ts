/**
 * electron/main/app-protocol.ts
 *
 * Protocolo `app://midoo/` para servir el build estático de SvelteKit en producción.
 *
 * ¿Por qué no `loadFile('build/index.html')`?
 *   El fallback SPA de adapter-static referencia sus scripts con rutas absolutas
 *   (`/_app/immutable/...`). Bajo `file://` esas rutas apuntan a la raíz del disco
 *   (`file:///_app/...`) y la ventana queda en blanco. Además, `window.location.origin`
 *   vale `"file://"`, lo que rompe cualquier URL construida a partir del origin
 *   (p. ej. la ruta headless de exportación a PDF).
 *
 * Con un esquema propio, estándar y seguro:
 *   - `/_app/...` se resuelve contra el directorio `build/`.
 *   - Cualquier ruta de la app (`/library`, `/books/{id}/content`, recargas…) recibe
 *     el fallback SPA y el router de SvelteKit la resuelve en el cliente.
 *   - `window.location.origin` es estable: `app://midoo`.
 *
 * Seguridad: solo se sirven archivos dentro de `build/`; cualquier intento de salir
 * del directorio (`..`, rutas codificadas) devuelve 403.
 */

import { app, net, protocol } from 'electron';
import { existsSync, statSync } from 'fs';
import { extname, join, normalize, sep } from 'path';
import { pathToFileURL } from 'url';

export const APP_SCHEME = 'app';
export const APP_HOST   = 'midoo';
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;

/**
 * Privilegios del esquema. Debe pasarse a `protocol.registerSchemesAsPrivileged`
 * (que solo puede llamarse una vez y antes de `app.ready`).
 */
export const APP_SCHEME_PRIVILEGES: Electron.CustomScheme = {
  scheme: APP_SCHEME,
  privileges: {
    standard:        true,  // URLs jerárquicas: rutas relativas, origin y router funcionan
    secure:          true,  // contexto seguro (como https)
    supportFetchAPI: true,
    corsEnabled:     true,
  },
};

/** Directorio del build estático de SvelteKit (dentro del ASAR en producción). */
export function getBuildDir(): string {
  return join(app.getAppPath(), 'build');
}

function isFile(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isFile();
  } catch {
    return false;
  }
}

/**
 * Resuelve la ruta de una URL `app://midoo/...` a un archivo dentro de `rootDir`.
 * Exportada para poder testearla sin Electron.
 *
 * @returns
 *   - `{ kind: 'file', path }`     → archivo existente dentro de rootDir
 *   - `{ kind: 'fallback', path }` → ruta de la SPA (sin extensión) → página fallback
 *   - `{ kind: 'error', status }`  → 400 / 403 / 404
 */
export function resolveAppRequest(
  rawUrl: string,
  rootDir: string,
  fallbackFile: string,
  fileExists: (p: string) => boolean = isFile,
): { kind: 'file' | 'fallback'; path: string } | { kind: 'error'; status: 400 | 403 | 404 } {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { kind: 'error', status: 400 };
  }
  if (url.host !== APP_HOST) return { kind: 'error', status: 404 };

  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return { kind: 'error', status: 400 };
  }
  if (pathname.includes('\0')) return { kind: 'error', status: 400 };

  const root      = normalize(rootDir);
  const candidate = normalize(join(root, pathname));
  if (candidate !== root && !candidate.startsWith(root + sep)) {
    return { kind: 'error', status: 403 };
  }

  if (fileExists(candidate)) return { kind: 'file', path: candidate };

  // Un recurso con extensión que no existe (JS, CSS, imagen…) es un 404 real:
  // devolver HTML ahí produciría errores de MIME confusos.
  if (extname(pathname) !== '') return { kind: 'error', status: 404 };

  return { kind: 'fallback', path: join(root, fallbackFile) };
}

/**
 * Registra el handler de `app://`. Llamar dentro de `app.whenReady()` y antes de
 * crear la ventana principal.
 */
export function registerAppProtocol(buildDir: string = getBuildDir()): void {
  // adapter-static genera el fallback SPA como 200.html (ver svelte.config.js).
  // Se acepta index.html por compatibilidad con builds anteriores.
  const fallbackFile = isFile(join(buildDir, '200.html')) ? '200.html' : 'index.html';

  protocol.handle(APP_SCHEME, async request => {
    const result = resolveAppRequest(request.url, buildDir, fallbackFile);
    if (result.kind === 'error') {
      return new Response(null, { status: result.status });
    }
    // net.fetch sobre file:// resuelve el MIME por extensión y lee desde el ASAR.
    return net.fetch(pathToFileURL(result.path).toString());
  });

  console.log(`[Main] Protocolo ${APP_ORIGIN}/ → ${buildDir} (fallback: ${fallbackFile})`);
}
