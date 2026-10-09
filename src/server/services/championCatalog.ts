import type { ChampionCatalog, ChampionCatalogProvider } from '../types.ts';
import snapshot from '../../frontend/data/championCatalog.json' with { type: 'json' };

const dragon = 'https://ddragon.leagueoflegends.com';
const bundledCatalog: ChampionCatalog = {
  version: `local-${snapshot.version}`,
  championIds: snapshot.champions.map((champion) => champion.id).sort((a, b) => a - b),
};

export class DataDragonCatalogProvider implements ChampionCatalogProvider {
  private readonly fetcher: typeof fetch;
  private cached: ChampionCatalog | null = null;
  private expiresAt = 0;
  private loading: Promise<ChampionCatalog> | null = null;

  constructor(fetcher: typeof fetch = fetch) {
    this.fetcher = fetcher;
  }

  getCatalog(): Promise<ChampionCatalog> {
    if (this.cached && Date.now() < this.expiresAt) return Promise.resolve(this.cached);
    this.loading ??= this.load().then((catalog) => {
      this.cached = catalog;
      this.expiresAt = Date.now() + (catalog.version.startsWith('local-') ? 5 : 60) * 60 * 1000;
      return catalog;
    }).finally(() => { this.loading = null; });
    return this.loading;
  }

  private async load(): Promise<ChampionCatalog> {
    try {
      return await this.loadFromDataDragon();
    } catch {
      if (bundledCatalog.championIds.length < 100 || new Set(bundledCatalog.championIds).size !== bundledCatalog.championIds.length) {
        throw new Error('No se pudo cargar un catálogo de campeones válido.');
      }
      return bundledCatalog;
    }
  }

  private async loadFromDataDragon(): Promise<ChampionCatalog> {
    const versionsResponse = await this.fetcher(`${dragon}/api/versions.json`, { signal: AbortSignal.timeout(10_000) });
    if (!versionsResponse.ok) throw new Error('No se pudo consultar la versión del catálogo.');
    const versions: unknown = await versionsResponse.json();
    const version = Array.isArray(versions) && typeof versions[0] === 'string' ? versions[0] : null;
    if (!version || !/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Versión del catálogo no válida.');

    const response = await this.fetcher(`${dragon}/cdn/${version}/data/es_ES/champion.json`, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error('No se pudo consultar el catálogo.');
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== 'object' || !('data' in payload) || !payload.data || typeof payload.data !== 'object') {
      throw new Error('Catálogo no válido.');
    }
    const championIds = Object.values(payload.data).map((value) => {
      if (!value || typeof value !== 'object' || !('key' in value) || typeof value.key !== 'string') {
        throw new Error('ID de campeón no válido.');
      }
      const id = Number(value.key);
      if (!Number.isSafeInteger(id) || id < 1) throw new Error('ID de campeón no válido.');
      return id;
    });
    if (championIds.length < 100 || new Set(championIds).size !== championIds.length) {
      throw new Error('Catálogo incompleto o duplicado.');
    }
    return { version, championIds: championIds.sort((a, b) => a - b) };
  }
}
