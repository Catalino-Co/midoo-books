import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],

  server: {
    port: 5178,
    strictPort: true,
  },

  optimizeDeps: {
    // Incluir pagedjs en el pre-bundle de Vite (esbuild).
    // Esto convierte sus dependencias CJS (como event-emitter) a ESM
    // y resuelve el error "does not provide an export named 'default'".
    include: ['pagedjs']
  },

  ssr: {
    // Evitar que SvelteKit intente resolver pagedjs en el servidor
    // (solo se usa en el cliente vía import() dinámico en onMount)
    noExternal: []
  }
});
