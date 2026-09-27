import { runNode } from './run.mjs';

runNode('node_modules/typescript/bin/tsc', ['--project', 'package/tsconfig.json']);
runNode('node_modules/vite/bin/vite.js', [
  'build', '--config', 'package/vite.config.ts', '--configLoader', 'runner', '--mode', 'production',
]);
