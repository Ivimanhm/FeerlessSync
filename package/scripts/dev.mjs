import { runNode } from './run.mjs';

runNode('node_modules/vite/bin/vite.js', [
  '--config', 'package/vite.config.ts', '--configLoader', 'runner', '--mode', 'development',
  ...process.argv.slice(2),
]);
