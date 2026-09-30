import { useSeries } from './hooks/useSeries';
import { useNavigation } from './hooks/useNavigation';
import InicioPage from '../pages/Inicio/InicioPage';
import SeriesStats from '../components/series/SeriesStats';
import HistorialPage from '../pages/Historial/HistorialPage';
import { AlertCircle, RotateCw } from 'lucide-preact';
import { useState } from 'preact/hooks';
import ClearGamesDialog from '../components/series/ClearGamesDialog';
import DeleteSeriesDialog from '../components/series/DeleteSeriesDialog';
import Header from '../components/layout/Header';
import SeriesSearch from '../components/series/SeriesSearch';
import Sidebar from '../components/layout/Sidebar';
import { mockMode } from '../services/api/mode';
import { resetMockSeries } from '../services/api/mockSeries';

const updatedFormatter = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' });

export default function App() {
  const { page, navigate } = useNavigation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
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
    <div class={`app-shell ${page === 'Inicio' ? 'app-shell--home' : ''} ${sidebarCollapsed ? 'app-shell--collapsed' : ''}`}>
      <Sidebar status={status} activePage={page} onNavigate={navigate} mobileOpen={mobileMenuOpen} onCloseMobile={() => setMobileMenuOpen(false)} collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <div class="app-main">
        <Header activePage={page} onOpenMobile={() => setMobileMenuOpen(true)} onGoHome={() => navigate('Inicio')} />
        <main class={`dashboard ${page === 'Inicio' ? 'dashboard--home' : ''}`}>
          {mockMode && <div class="mock-banner" role="note">
            <span><strong>Vista local de ejemplo.</strong> Los cambios se guardan solo en este navegador. Para probar las acciones, escribe cualquier clave de administrador.</span>
            <button type="button" onClick={() => { resetMockSeries(); setSearchId('fearless-001'); void loadSeries('fearless-001'); }}>Restaurar ejemplo</button>
          </div>}
          <div class="page-heading">
            <h1>{page === 'Inicio' ? 'Fearless Sync' : 'Historial de partidas'}</h1>
            <p>{page === 'Inicio' ? 'Gestiona tus series de partidas y analiza los campeones disponibles.' : 'Consulta las partidas recientes de tu serie Fearless.'}</p>
          </div>
          <SeriesSearch value={searchId} onChange={setSearchId} onSearch={() => void loadSeries(searchId)} loading={loading} />
          <div class="series-context">
            <div class="series-context-copy"><strong>{series?.seriesId ?? lastSearch.current}</strong><span role="status" aria-live="polite">{status}</span></div>
            <div class="series-context-actions">
              <p>{series?.updatedAt ? <>Última actualización <time dateTime={series.updatedAt}>{updatedFormatter.format(new Date(series.updatedAt))}</time></> : 'Aún no hay partidas registradas'}</p>
              {series && series.gamesCount > 0 && <div class="series-destructive-actions">
                <button class="clear-button" type="button" disabled={loading} onClick={() => setClearOpen(true)}>Borrar partidas</button>
                <button class="delete-series-button" type="button" disabled={loading} onClick={() => setDeleteOpen(true)}>Eliminar serie</button>
              </div>}
            </div>
          </div>
          {error && <div class="error-card" role="alert"><AlertCircle size={23} aria-hidden="true" /><span>{notFound ? 'Serie no encontrada' : 'No se ha podido cargar la serie. Comprueba el ID e inténtalo de nuevo.'}</span><button type="button" onClick={() => void loadSeries(lastSearch.current)}><RotateCw size={16} /> Reintentar</button></div>}
          {series ? (
            <div class={`dashboard-data ${page === 'Inicio' ? 'dashboard-data--home' : ''} ${loading ? 'dashboard-data--loading' : ''}`} aria-busy={loading}>
              {page === 'Inicio' ? <InicioPage series={series} /> : <HistorialPage series={series} onWinnerChanged={() => loadSeries(series.seriesId)} />}
            </div>
          ) : loading ? (
            <div class="loading-dashboard" role="status" aria-label="Cargando serie">
              <div class="loading-card" /><div class="loading-card" /><div class="loading-card" />
              <div class="loading-panel" />
            </div>
          ) : <>{page === 'Inicio' && <SeriesStats series={null} />}<div class="empty-series"><h2>No hay datos de esta serie</h2><p>La aplicación PersoBuilder podrá crearla al sincronizar sus partidas confirmadas.</p></div></>}
        </main>
      </div>
      {series && <ClearGamesDialog open={clearOpen} seriesId={series.seriesId} gamesCount={series.gamesCount} onClose={() => setClearOpen(false)} onCleared={cleared} />}
      {series && <DeleteSeriesDialog open={deleteOpen} seriesId={series.seriesId} gamesCount={series.gamesCount} onClose={() => setDeleteOpen(false)} onDeleted={deleted} />}
    </div>
  );
}
