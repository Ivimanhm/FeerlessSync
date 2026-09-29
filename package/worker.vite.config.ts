import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  build: {
    target: 'es2022',
    outDir: fileURLToPath(new URL('../dist/server/', import.meta.url)),
    emptyOutDir: false,
    lib: {
      entry: fileURLToPath(new URL('../src/server/worker.ts', import.meta.url)),
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
});
