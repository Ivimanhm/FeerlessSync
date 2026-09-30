import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getChampionCatalog } from '../../frontend/services/championCatalog';

const publicRoot = resolve('src/frontend/public');

describe('imágenes optimizadas', () => {
  it('incluye un retrato local para cada campeón y los recursos principales', async () => {
    const catalog = await getChampionCatalog();
    const missing = catalog.filter((champion) => !champion.imageUrl || !existsSync(resolve(publicRoot, champion.imageUrl.slice(1))));
    expect(missing.map((champion) => champion.name)).toEqual([]);
    expect(existsSync(resolve(publicRoot, 'Logo-small.png'))).toBe(true);
    expect(existsSync(resolve(publicRoot, 'landscape.jpg'))).toBe(true);
  });
});
