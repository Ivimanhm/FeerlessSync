import { runNode } from './run.mjs';

// A local preview works out of the box; an explicit API URL selects real data.
if (!process.env.VITE_API_BASE_URL && process.env.VITE_MOCK_DATA === undefined) {
  process.env.VITE_MOCK_DATA = 'true';
}

runNode('node_modules/vite/bin/vite.js', [
  '--config', 'package/vite.config.ts', '--configLoader', 'runner', '--mode', 'development',
  ...process.argv.slice(2),
]);
