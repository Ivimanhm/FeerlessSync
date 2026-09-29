import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function runNode(relativePath, args) {
  const root = new URL('../../', import.meta.url);
  const result = spawnSync(process.execPath, [fileURLToPath(new URL(relativePath, root)), ...args], {
    cwd: fileURLToPath(root),
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
