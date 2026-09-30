import { ChevronDown, Search, Shuffle } from 'lucide-preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Champion, Role } from '../../types/fearless';
import ChampionCard from './ChampionCard';

interface ChampionGridProps {
  champions: Champion[];
  totalCount: number;
}

type RoleFilter = Role | 'Todos';
const roleOptions: RoleFilter[] = ['Todos', 'TOP', 'JG', 'MID', 'ADC', 'SUP'];
const normalizeSearch = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('es')
  .replace(/[^a-z0-9]/g, '');

export default function ChampionGrid({ champions, totalCount }: ChampionGridProps) {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<RoleFilter>('Todos');
  const scrollArea = useRef<HTMLDivElement>(null);
  useEffect(() => { if (scrollArea.current) scrollArea.current.scrollTop = 0; }, [query, role, champions]);
  const normalizedQuery = normalizeSearch(query.trim());
  const filtered = useMemo(() => champions.filter((champion) =>
    [champion.name, ...(champion.searchAliases ?? [])].some((name) => normalizeSearch(name).includes(normalizedQuery)) &&
    (role === 'Todos' || champion.roles.includes(role)),
  ), [champions, normalizedQuery, role]);

  return (
    <section class={`content-panel champion-panel${filtered.length <= 24 ? ' champion-panel--compact' : ''}`} aria-labelledby="champions-heading">
      <div class="panel-header champion-panel-header">
        <div class="panel-title">
          <Shuffle size={27} strokeWidth={1.7} aria-hidden="true" />
          <h2 id="champions-heading"><span>Campeones</span> que quedan disponibles</h2>
          <span class="count-badge">{query || role !== 'Todos' ? filtered.length : totalCount}</span>
        </div>
        <div class="champion-tools">
          <label class="search-field champion-search-field">
            <Search size={21} strokeWidth={1.7} aria-hidden="true" />
            <span class="sr-only">Buscar campeón</span>
            <input value={query} onInput={(event) => setQuery(event.currentTarget.value)} placeholder="Buscar campeón..." />
          </label>
          <label class="role-select-wrap">
            <span class="sr-only">Filtrar por posición</span>
            <select value={role} onChange={(event) => setRole(event.currentTarget.value as RoleFilter)}>
              {roleOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <ChevronDown size={19} strokeWidth={1.7} aria-hidden="true" />
          </label>
        </div>
      </div>
      <div class="champion-scroll" ref={scrollArea} role="region" aria-label="Campeones disponibles" tabIndex={0}>
      {filtered.length ? (
        <div class="champion-grid">{filtered.map((champion, index) => <ChampionCard key={champion.id} champion={champion} eager={index < 24} />)}</div>
      ) : (
        <div class="empty-champions">No hay campeones que coincidan con la búsqueda.</div>
      )}
      </div>
    </section>
  );
}
