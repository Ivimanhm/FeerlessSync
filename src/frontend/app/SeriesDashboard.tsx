import { useSeries } from './hooks/useSeries';
import type { Page } from './navigation';
import InicioPage from '../pages/Inicio/InicioPage';
import SeriesStats from '../components/series/SeriesStats';
import HistorialPage from '../pages/Historial/HistorialPage';
import { AlertCircle, ChevronDown, Clock3, RotateCw, Trash2 } from 'lucide-preact';
import { useState } from 'preact/hooks';
import ClearGamesDialog from '../components/series/ClearGamesDialog';
import DeleteSeriesDialog from '../components/series/DeleteSeriesDialog';
import Header from '../components/layout/Header';
import SeriesSearch from '../components/series/SeriesSearch';
import Sidebar from '../components/layout/Sidebar';
import { mockMode } from '../services/api/mode';
import { resetMockSeries } from '../services/api/mockSeries';
import './Dashboard.css';

const updatedFormatter = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' });

export default function SeriesDashboard({ page, navigate }: { page: Exclude<Page, 'Inicio'>; navigate: (page: Page) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [seriesSearchOpen, setSeriesSearchOpen] = useState(false);
  const { searchId, setSearchId, series, loading, error, notFound, status, setStatus, lastSearch, loadSeries, forgetSeries } = useSeries();

  const cleared = async (count: number, seriesId: string) => {
    setClearOpen(false);
    await loadSeries(seriesId);
    setStatus(`Partidas borradas: ${count}`);
  };


  const deleted = () => {
    setDeleteOpen(false);
    forgetSeries();
  };

  return (
    <div class={`app-shell app-shell--styled ${page === 'Campeones' ? 'app-shell--home' : ''}`}>
      {menuOpen && <Sidebar status={status} activePage={page} onNavigate={navigate} onClose={() => setMenuOpen(false)} />}
      <div class="app-main">
        <Header activePage={page} menuOpen={menuOpen} onOpenMenu={() => setMenuOpen(true)} onGoHome={() => navigate('Inicio')} />
        <main class={`dashboard dashboard--styled ${page === 'Campeones' ? 'dashboard--home' : 'dashboard--history'}`}>
          {mockMode && <div class="mock-banner" role="note">
            <span><strong>Vista local de ejemplo.</strong> Los cambios se guardan solo en este navegador. Para probar las acciones, escribe cualquier clave de administrador.</span>
            <button type="button" onClick={() => { resetMockSeries(); setSearchId('fearless-001'); void loadSeries('fearless-001'); }}>Restaurar ejemplo</button>
          </div>}
          <div class="page-heading">
            <h1>{page === 'Campeones' ? 'Fearless Sync' : 'Historial de partidas'}</h1>
            <p>{page === 'Campeones' ? 'Gestiona tus series de partidas y analiza los campeones disponibles.' : 'Consulta las partidas recientes de tu serie Fearless.'}</p>
          </div>
          <div id="series-search-controls" class="series-search-container" hidden={!seriesSearchOpen}>
            <SeriesSearch value={searchId} onChange={setSearchId} onSearch={() => void loadSeries(searchId)} loading={loading} />
          </div>
          <div class="series-context">
            <div class="series-context-copy">
              <button class="series-switch" type="button" aria-label="Cambiar serie" aria-expanded={seriesSearchOpen} aria-controls="series-search-controls" onClick={() => setSeriesSearchOpen(!seriesSearchOpen)}><strong>{series?.seriesId ?? lastSearch.current}</strong><ChevronDown size={15} aria-hidden="true" /></button>
              <span class="series-connection" role="status" aria-live="polite"><i class={`series-connection-dot${status === 'API disponible' ? ' series-connection-dot--online' : ''}`} aria-hidden="true" />{status}</span>
            </div>
            <div class="series-context-actions">
              <p class="series-updated"><Clock3 size={17} aria-hidden="true" /><span>{series?.updatedAt ? <>Última actualización <time dateTime={series.updatedAt}>{updatedFormatter.format(new Date(series.updatedAt))}</time></> : 'Aún no hay partidas registradas'}</span></p>
              {series && series.gamesCount > 0 && <div class="series-destructive-actions">
                <button class="clear-button" type="button" disabled={loading} onClick={() => setClearOpen(true)}><Trash2 size={17} aria-hidden="true" />Borrar partidas</button>
                <button class="delete-series-button" type="button" disabled={loading} onClick={() => setDeleteOpen(true)}><Trash2 size={17} aria-hidden="true" />Eliminar serie</button>
              </div>}
            </div>
          </div>
          {error && <div class="error-card" role="alert"><AlertCircle size={23} aria-hidden="true" /><span>{notFound ? 'Serie no encontrada' : 'No se ha podido cargar la serie. Comprueba el ID e inténtalo de nuevo.'}</span><button type="button" onClick={() => void loadSeries(lastSearch.current)}><RotateCw size={16} /> Reintentar</button></div>}
          {page === 'Historial' ? (
            <HistorialPage series={series} loading={loading} onWinnerChanged={() => series ? loadSeries(series.seriesId) : Promise.resolve()} />
          ) : series ? (
            <div class={`dashboard-data dashboard-data--home ${loading ? 'dashboard-data--loading' : ''}`} aria-busy={loading}>
              <InicioPage series={series} />
            </div>
          ) : loading ? (
            <div class="loading-dashboard" role="status" aria-label="Cargando serie">
              <div class="loading-card" /><div class="loading-card" /><div class="loading-card" />
              <div class="loading-panel" />
            </div>
          ) : <><SeriesStats series={null} /><div class="empty-series"><h2>No hay datos de esta serie</h2><p>La aplicación PersoBuilder podrá crearla al sincronizar sus partidas confirmadas.</p></div></>}
        </main>
      </div>
      {series && <ClearGamesDialog open={clearOpen} seriesId={series.seriesId} gamesCount={series.gamesCount} onClose={() => setClearOpen(false)} onCleared={cleared} />}
      {series && <DeleteSeriesDialog open={deleteOpen} seriesId={series.seriesId} gamesCount={series.gamesCount} onClose={() => setDeleteOpen(false)} onDeleted={deleted} />}
    </div>
  );
}
