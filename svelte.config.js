import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),

  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      // fallback: 'index.html' habilita el modo SPA para rutas dinámicas
      // (library, books/new, books/[bookId]/*). Electron carga loadFile('build/index.html')
      // y el router de SvelteKit maneja la navegación en el cliente.
      fallback: 'index.html',
      precompress: false,
      strict: false,
    }),

    // paths.relative = true genera rutas relativas en el build estático.
    // Requerido para que Electron pueda cargar el index.html con loadFile()
    // sin que los assets fallen por usar rutas absolutas como /_app/...
    paths: {
      relative: true,
    },

    prerender: {
      handleHttpError: 'warn'
    }
  }
};

export default config;
