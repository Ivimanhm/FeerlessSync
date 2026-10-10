import { ChevronDown } from 'lucide-preact';

interface SeriesSelectProps {
  value: string;
  seriesIds: string[];
  onSelect: (seriesId: string) => void;
  loading: boolean;
}

export default function SeriesSelect({ value, seriesIds, onSelect, loading }: SeriesSelectProps) {
  const selectedLabel = seriesIds.includes(value)
    ? value
    : loading ? 'Cargando series…' : seriesIds.length ? 'Elige una serie' : 'No hay series disponibles';

  return <label class="series-select-label">
    <span class="sr-only">Seleccionar serie</span>
    <select class="series-select" value={value} disabled={loading || !seriesIds.length}
      onChange={event => onSelect(event.currentTarget.value)}>
      <option value="" disabled>{selectedLabel}</option>
      {seriesIds.map(id => <option key={id} value={id}>{id}</option>)}
    </select>
    <span class="series-select-current" aria-hidden="true">
      <span>{selectedLabel}</span>
      <ChevronDown class="series-select-arrow" size={16} strokeWidth={1.8} />
    </span>
  </label>;
}
