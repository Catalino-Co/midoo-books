import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),

  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      // Fallback SPA para rutas dinámicas (library, books/new, books/[bookId]/*).
      // Se llama 200.html (no index.html) para no pisar la página raíz prerenderizada.
      // En producción Electron lo sirve mediante el protocolo app://midoo/
      // (electron/main/app-protocol.ts) para cualquier ruta sin extensión.
      fallback: '200.html',
      precompress: false,
      strict: false,
    }),

    // paths.relative = true genera rutas relativas en las páginas prerenderizadas.
    // Ojo: el fallback SPA (200.html) siempre usa rutas absolutas (/_app/...), por eso
    // Electron sirve la UI con app://midoo/ en lugar de loadFile() (file://).
    paths: {
      relative: true,
    },

    prerender: {
      handleHttpError: 'warn'
    }
  }
};

export default config;
