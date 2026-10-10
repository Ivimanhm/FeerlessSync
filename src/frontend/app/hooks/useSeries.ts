import { useEffect, useRef, useState } from 'preact/hooks';
import { getFearlessSeries, getLatestFearlessSeriesId, getSeriesIds } from '../../services/api/series';
import { FearlessApiError } from '../../services/api/client';
import type { FearlessSeries } from '../../types/fearless';
import { mockMode } from '../../services/api/mode';

const defaultSeriesId = 'fearless-001';

export function useSeries() {
  const [searchId, setSearchId] = useState(defaultSeriesId);
  const [seriesIds, setSeriesIds] = useState<string[]>([]);
  const [listFailed, setListFailed] = useState(false);
  const [series, setSeries] = useState<FearlessSeries | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [status, setStatus] = useState('Conectando con la API…');
  const requestNumber = useRef(0);
  const lastSearch = useRef(defaultSeriesId);

  const forgetSeries = () => {
    requestNumber.current++;
    setSeriesIds(ids => ids.filter(id => id !== lastSearch.current));
    setSearchId('');
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
    setSearchId(clean);
    const currentRequest = ++requestNumber.current;
    setLoading(true);
    setError(false);
    setNotFound(false);
    setStatus('Consultando serie…');
    try {
      const result = await getFearlessSeries(clean);
      if (currentRequest === requestNumber.current) {
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

  const reloadSeriesList = async () => {
    const currentRequest = ++requestNumber.current;
    setLoading(true);
    setError(false);
    setNotFound(false);
    setStatus('Cargando series…');
    try {
      const ids = await getSeriesIds();
      const latestId = ids.length ? await getLatestFearlessSeriesId(ids) : '';
      if (currentRequest !== requestNumber.current) return;
      setSeriesIds(ids);
      setListFailed(false);
      if (latestId) await loadSeries(latestId);
      else {
        setSeries(null);
        setSearchId('');
        setLoading(false);
        setStatus('No hay series disponibles');
      }
    } catch {
      if (currentRequest !== requestNumber.current) return;
      setLoading(false);
      setError(true);
      setListFailed(true);
      setStatus('No se pudieron cargar las series');
    }
  };

  useEffect(() => {
    void reloadSeriesList();
    return () => { requestNumber.current++; };
  }, []);

  return { searchId, seriesIds, series, loading, error, notFound, status, setStatus, lastSearch, loadSeries, forgetSeries, reloadSeriesList,
    retry: () => listFailed ? reloadSeriesList() : loadSeries(lastSearch.current) };
}
