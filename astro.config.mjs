// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// User site (whyttaker.github.io) serves from the domain root, so no `base`.
export default defineConfig({
  site: 'https://whyttaker.github.io',
  output: 'static',
  integrations: [react(), mdx(), sitemap()],
  build: {
    // Emit /work/ninth-circle/index.html so links resolve without .html suffixes.
    format: 'directory',
    // 21 kB of CSS as an external file was the only render-blocking request.
    // Most visitors see one or two pages, so inlining beats cross-page caching.
    inlineStylesheets: 'always',
  },
  vite: {
    build: {
      // three + R3F are the only heavy chunk; keep them out of the entry bundle.
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/three')) return 'three';
            if (id.includes('@react-three')) return 'r3f';
          },
        },
      },
    },
  },
});
