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

  it('rechaza catálogos incompletos y permite reintentar', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response(['16.19.1']))
      .mockResolvedValueOnce(response({ data: { One: { key: '1' } } }))
      .mockResolvedValueOnce(response(['16.19.1']))
      .mockResolvedValueOnce(response({ data: Object.fromEntries(Array.from({ length: 100 }, (_, index) => [`C${index}`, { key: String(index + 1) }])) }));
    const provider = new DataDragonCatalogProvider(fetcher);

    await expect(provider.getCatalog()).rejects.toThrow('incompleto');
    expect((await provider.getCatalog()).championIds).toHaveLength(100);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
});
