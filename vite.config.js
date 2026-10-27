import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // Inline hero models so the game also works as a single HTML page
    assetsInlineLimit: 8 * 1024 * 1024,
    // three.js alone is ~500 kB; one bundle is fine for a prototype
    chunkSizeWarningLimit: 4000,
  },
});
