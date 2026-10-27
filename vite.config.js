import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // three.js alone is ~500 kB; one bundle is fine for a prototype
    chunkSizeWarningLimit: 1000,
  },
});
