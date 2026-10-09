import { useEffect, useRef, useState } from 'preact/hooks';
import { getFearlessSeries } from '../../services/api/series';
import { FearlessApiError } from '../../services/api/client';
import type { FearlessSeries } from '../../types/fearless';
import { mockMode } from '../../services/api/mode';

const defaultSeriesId = 'fearless-001';
const selectedSeriesStorageKey = 'fearless-sync:selected-series-id';

function readSelectedSeriesId(): string {
  try {
    return localStorage.getItem(selectedSeriesStorageKey)?.trim() || defaultSeriesId;
  } catch {
    return defaultSeriesId;
  }
}

function rememberSelectedSeriesId(seriesId: string | null): void {
  try {
    if (seriesId) localStorage.setItem(selectedSeriesStorageKey, seriesId);
    else localStorage.removeItem(selectedSeriesStorageKey);
  } catch {
    // The dashboard still works when browser storage is unavailable.
  }
}

export function useSeries() {
  const [searchId, setSearchId] = useState(readSelectedSeriesId);
  const [series, setSeries] = useState<FearlessSeries | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [status, setStatus] = useState('Conectando con la API…');
  const requestNumber = useRef(0);
  const lastSearch = useRef(readSelectedSeriesId());

  const forgetSeries = () => {
    requestNumber.current++;
    rememberSelectedSeriesId(null);
    setSeries(null);
    setLoading(false);
    setError(false);
    setNotFound(false);
    setStatus('Serie eliminada');
  };


  const loadSeries = async (seriesId: string) => {
    const clean = seriesId.trim();
    if (!clean) return;
    lastSearch.current = clean;
    const currentRequest = ++requestNumber.current;
    setLoading(true);
    setError(false);
    setNotFound(false);
    setStatus('Consultando serie…');
    try {
      const result = await getFearlessSeries(clean);
      if (currentRequest === requestNumber.current) {
        rememberSelectedSeriesId(clean);
        setSearchId(clean);
        setSeries(result);
        setStatus(mockMode ? 'Vista local de ejemplo' : 'API disponible');
      }
    } catch (reason) {
      if (currentRequest === requestNumber.current) {
        const missing = reason instanceof FearlessApiError && reason.status === 404;
        setSeries(null);
        setError(true);
        setNotFound(missing);
        setStatus(missing ? 'Serie no encontrada' : 'No se pudo conectar con la API');
      }
    } finally {
      if (currentRequest === requestNumber.current) setLoading(false);
    }
  };

  useEffect(() => {
    void loadSeries(lastSearch.current);
    return () => { requestNumber.current++; };
  }, []);

  return { searchId, setSearchId, series, loading, error, notFound, status, setStatus, lastSearch, loadSeries, forgetSeries };
}
