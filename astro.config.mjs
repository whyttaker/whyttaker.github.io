// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';

// User site (whyttaker.github.io) serves from the domain root, so no `base`.
export default defineConfig({
  site: 'https://whyttaker.github.io',
  output: 'static',
  integrations: [react(), mdx()],
  build: {
    // Emit /work/ninth-circle/index.html so links resolve without .html suffixes.
    format: 'directory',
    inlineStylesheets: 'auto',
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
