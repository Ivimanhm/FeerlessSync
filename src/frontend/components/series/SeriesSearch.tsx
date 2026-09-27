import { Search } from 'lucide-preact';
import type { JSX } from 'preact';

interface SeriesSearchProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  loading: boolean;
}

export default function SeriesSearch({ value, onChange, onSearch, loading }: SeriesSearchProps) {
  const handleSubmit = (event: JSX.TargetedSubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch();
  };

  return (
    <form class="series-search" role="search" onSubmit={handleSubmit}>
      <label class="search-field series-search-field">
        <Search size={24} strokeWidth={1.7} aria-hidden="true" />
        <span class="sr-only">ID de serie</span>
        <input value={value} onInput={(event) => onChange(event.currentTarget.value)} placeholder="Buscar por ID de serie..." autoComplete="off" />
      </label>
      <button class="gold-button" type="submit" disabled={loading}>
        <Search size={22} strokeWidth={1.8} aria-hidden="true" />
        {loading ? 'Buscando...' : 'Buscar'}
      </button>
    </form>
  );
}
