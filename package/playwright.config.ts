import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));

export default defineConfig({
  testDir: '../src/tests/e2e',
  outputDir: '../test-results',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5178', channel: process.platform === 'win32' ? 'msedge' : 'chromium', headless: true },
  webServer: [
    { command: 'node src/tests/e2e/fixtures/server.ts', cwd: projectRoot, url: 'http://127.0.0.1:8789/api/health', reuseExistingServer: false },
    {
      command: `${process.platform === 'win32' ? 'npm.cmd' : 'npm'} run dev -- --host 127.0.0.1 --port 5178 --strictPort`,
      cwd: projectRoot,
      url: 'http://127.0.0.1:5178', reuseExistingServer: false,
      env: { VITE_API_BASE_URL: 'http://127.0.0.1:8789' },
    },
  ],
});
