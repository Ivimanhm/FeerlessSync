import snapshot from '../data/championCatalog.json';
import type { Champion, Role } from '../types/fearless';

// Matches the 170-champion pool used by the current Sites page.
const catalog: Champion[] = snapshot.champions.map((champion) => ({
  id: champion.id,
  name: champion.name,
  imageUrl: `/champions/${champion.asset}.png`,
  roles: champion.roles as Role[],
})).sort((a, b) => a.name.localeCompare(b.name, 'es'));

export async function getChampionCatalog(): Promise<Champion[]> {
  return catalog;
}
