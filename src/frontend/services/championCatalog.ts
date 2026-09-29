import snapshot from '../data/championCatalog.json';
import type { Champion, Role } from '../types/fearless';

const catalog: Champion[] = snapshot.champions.map((champion) => ({
  id: champion.id,
  name: champion.name,
  imageUrl: `/champions/${champion.asset}.png`,
  roles: champion.roles as Role[],
  searchAliases: [champion.asset],
})).sort((a, b) => a.name.localeCompare(b.name, 'es'));

export const championCount = catalog.length;

export async function getChampionCatalog(): Promise<Champion[]> {
  return catalog;
}
