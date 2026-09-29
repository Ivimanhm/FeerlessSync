import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('../src/frontend/', import.meta.url)),
  envDir: fileURLToPath(new URL('../', import.meta.url)),
  plugins: [preact()],
  build: { outDir: fileURLToPath(new URL('../dist/', import.meta.url)), emptyOutDir: true },
  server: { proxy: { '/api': 'http://127.0.0.1:8787' } },
});
