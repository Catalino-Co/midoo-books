#!/usr/bin/env node
/**
 * scripts/build-electron.mjs
 *
 * Compila los archivos TypeScript del proceso principal y preload de Electron
 * usando esbuild. Genera bundles CJS en dist-electron/.
 *
 * Uso:
 *   node scripts/build-electron.mjs           → build único
 *   node scripts/build-electron.mjs --watch   → modo watch
 */

import { build, context } from 'esbuild';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outdir = join(root, 'dist-electron');
const isWatch = process.argv.includes('--watch');

// Aseguramos que el directorio de salida exista
mkdirSync(outdir, { recursive: true });

/** @type {import('esbuild').BuildOptions} */
const shared = {
  bundle: true,
  platform: 'node',
  target: 'node20',    // Electron 31 usa Node.js 20.x
  format: 'cjs',
  // Marcar TODOS los paquetes de node_modules como externos.
  // Se cargarán desde el directorio node_modules en tiempo de ejecución.
  packages: 'external',
  sourcemap: true,
  logLevel: 'info',
};

/** Puntos de entrada → archivos de salida */
const entries = [
  {
    label: 'main process',
    in: join(root, 'electron/main/index.ts'),
    out: join(outdir, 'main.cjs'),
  },
  {
    label: 'preload',
    in: join(root, 'electron/preload/index.ts'),
    out: join(outdir, 'preload.cjs'),
  },
];

async function run() {
  if (isWatch) {
    // Modo watch: reconstruye automáticamente cuando cambian los archivos
    const contexts = await Promise.all(
      entries.map(e =>
        context({ ...shared, entryPoints: [e.in], outfile: e.out })
      )
    );
    await Promise.all(contexts.map(ctx => ctx.watch()));
    console.log('[esbuild] Watching electron source files...');
    console.log('[esbuild] Press Ctrl+C to stop.');
  } else {
    // Build único
    await Promise.all(
      entries.map(async e => {
        await build({ ...shared, entryPoints: [e.in], outfile: e.out });
        console.log(`[esbuild] ✓ ${e.label} → ${e.out.replace(root, '.')}`);
      })
    );
    console.log('[esbuild] Build completo.');
  }
}

run().catch(err => {
  console.error('[esbuild] Error:', err.message);
  process.exit(1);
});
