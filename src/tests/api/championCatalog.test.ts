// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { DataDragonCatalogProvider } from '../../server/services/championCatalog.ts';

const response = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe('catálogo versionado del servicio', () => {
  it('valida y reutiliza la lista completa de IDs', async () => {
    const data = Object.fromEntries(Array.from({ length: 100 }, (_, index) => [`Champion${index + 1}`, { key: String(100 - index) }]));
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response(['16.19.1']))
      .mockResolvedValueOnce(response({ data }));
    const provider = new DataDragonCatalogProvider(fetcher);

    const catalog = await provider.getCatalog();
    expect(catalog.version).toBe('16.19.1');
    expect(catalog.championIds).toHaveLength(100);
    expect(catalog.championIds[0]).toBe(1);
    expect((await provider.getCatalog()).championIds).toEqual(catalog.championIds);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('usa el catálogo local completo si Data Dragon no está disponible', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('fetch failed'));
    const provider = new DataDragonCatalogProvider(fetcher);

    const catalog = await provider.getCatalog();
    expect(catalog.version).toBe('local-16.18.1');
    expect(catalog.championIds).toHaveLength(173);
    expect(catalog.championIds).toContain(266);
    expect((await provider.getCatalog()).championIds).toEqual(catalog.championIds);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('usa el catálogo local cuando Data Dragon devuelve datos incompletos', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response(['16.19.1']))
      .mockResolvedValueOnce(response({ data: { One: { key: '1' } } }));
    const provider = new DataDragonCatalogProvider(fetcher);

    expect(await provider.getCatalog()).toMatchObject({ version: 'local-16.18.1', championIds: expect.arrayContaining([266]) });
  });
});
