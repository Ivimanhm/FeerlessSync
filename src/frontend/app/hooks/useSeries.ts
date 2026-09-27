import { useEffect, useRef, useState } from 'preact/hooks';
import { getFearlessSeries } from '../../services/api/series';
import { FearlessApiError } from '../../services/api/client';
import type { FearlessSeries } from '../../types/fearless';

const defaultSeriesId = 'fearless-001';

export function useSeries() {
  const [searchId, setSearchId] = useState(defaultSeriesId);
  const [series, setSeries] = useState<FearlessSeries | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [status, setStatus] = useState('Conectando con la API…');
  const requestNumber = useRef(0);
  const lastSearch = useRef(defaultSeriesId);

  const forgetSeries = () => {
    requestNumber.current++;
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
      if (currentRequest === requestNumber.current) { setSeries(result); setStatus('API disponible'); }
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
    void loadSeries(defaultSeriesId);
    return () => { requestNumber.current++; };
  }, []);

  return { searchId, setSearchId, series, loading, error, notFound, status, setStatus, lastSearch, loadSeries, forgetSeries };
}
