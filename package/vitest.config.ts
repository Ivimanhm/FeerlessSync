import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('../', import.meta.url)),
  plugins: [preact()],
  test: {
    include: ['src/tests/frontend/**/*.test.{ts,tsx}', 'src/tests/api/**/*.test.ts'],
    environment: 'jsdom',
    setupFiles: ['./src/tests/frontend/setup.ts'],
    restoreMocks: true,
  },
});
