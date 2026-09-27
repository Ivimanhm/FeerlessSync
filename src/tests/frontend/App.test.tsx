import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../frontend/app/App';
import ChampionCard from '../../frontend/components/champions/ChampionCard';
import MatchHistory from '../../frontend/components/history/MatchHistory';
import { getChampionCatalog } from '../../frontend/services/championCatalog';
import { mapStoredSeries } from '../../frontend/services/api/series';
import type { FearlessSeries } from '../../frontend/types/fearless';
import { clearSeriesGames, getFearlessSeries } from '../../frontend/services/api/series';
import { FearlessApiError } from '../../frontend/services/api/client';

vi.mock('../../frontend/services/api/series', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../frontend/services/api/series')>()), getFearlessSeries: vi.fn(), clearSeriesGames: vi.fn() }));

const getSeriesMock = vi.mocked(getFearlessSeries);
const clearGamesMock = vi.mocked(clearSeriesGames);

let testSeries: FearlessSeries;

beforeEach(async () => {
  const catalog = await getChampionCatalog();
  const usedIds = catalog.slice(-70).map(champion => champion.id);
  testSeries = mapStoredSeries({
    seriesId: 'fearless-001', updatedAt: '2026-09-23T21:33:00Z', usedChampions: usedIds,
    games: Array.from({ length: 7 }, (_, index) => ({
      gameNumber: index + 1,
      blueTeam: usedIds.slice(index * 10, index * 10 + 5),
      redTeam: usedIds.slice(index * 10 + 5, index * 10 + 10),
      createdAt: '2026-09-23T21:33:00Z',
    })),
  }, catalog);
  window.history.replaceState(null, '', '/');
  getSeriesMock.mockReset();
  clearGamesMock.mockReset();
  getSeriesMock.mockImplementation(async (id) => {
    if (!id.trim()) throw new Error('ID vacío');
    return { ...testSeries, seriesId: id.trim() };
  });
});

describe('Fearless Sync', () => {
  it('muestra solo dos páginas y pasa del resumen al historial completo', async () => {
    render(<App />);

    expect(screen.getByRole('status', { name: 'Cargando serie' })).toBeTruthy();
    await screen.findByRole('region', { name: 'Campeones disponibles' });
    expect(screen.queryByRole('table')).toBeNull();
    expect(within(screen.getByRole('navigation', { name: 'Navegación principal' })).getAllByRole('button')).toHaveLength(2);

    fireEvent.click(within(screen.getByRole('navigation', { name: 'Navegación principal' })).getByRole('button', { name: 'Historial' }));
    expect(window.location.hash).toBe('#/historial');
    expect(screen.getByRole('heading', { name: 'Historial de partidas', level: 1 })).toBeTruthy();
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(71);

    fireEvent.click(within(screen.getByRole('navigation', { name: 'Navegación principal' })).getByRole('button', { name: 'Inicio' }));
    expect(screen.getByRole('heading', { name: 'Fearless Sync', level: 1 })).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('abre directamente Historial y permite ordenar las partidas', async () => {
    window.history.replaceState(null, '', '/#/historial');
    render(<App />);
    const table = await screen.findByRole('table');

    expect(screen.getByRole('heading', { name: 'Historial de partidas', level: 1 })).toBeTruthy();
    expect(within(table).getAllByRole('row')).toHaveLength(71);
    fireEvent.click(screen.getByRole('button', { name: 'Ordenar por Partida' }));
    expect(within(table).getAllByRole('row')[1].querySelector('td')?.textContent).toBe('7');
  });

  it('busca otra serie, ignora IDs vacíos como Sites y permite reintentar errores', async () => {
    render(<App />);
    await screen.findByRole('region', { name: 'Campeones disponibles' });
    const input = screen.getByRole('textbox', { name: 'ID de serie' });

    fireEvent.input(input, { target: { value: 'fearless-42' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(getSeriesMock).toHaveBeenLastCalledWith('fearless-42'));
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Navegación principal' })).getByRole('button', { name: 'Historial' }));
    await waitFor(() => expect(screen.getByText('fearless-42')).toBeTruthy());

    fireEvent.input(input, { target: { value: '' } });
    const calls = getSeriesMock.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(getSeriesMock).toHaveBeenCalledTimes(calls);
    getSeriesMock.mockRejectedValueOnce(new Error('offline'));
    fireEvent.input(input, { target: { value: 'offline' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('No se ha podido cargar la serie'));

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('table')).toBeTruthy();
  });

  it('filtra campeones por nombre y posición', async () => {
    render(<App />);
    await screen.findByRole('region', { name: 'Campeones disponibles' });

    fireEvent.input(screen.getByRole('textbox', { name: 'Buscar campeón' }), { target: { value: 'Ahri' } });
    expect(screen.getByText('Ahri')).toBeTruthy();
    expect(screen.queryByText('Aatrox')).toBeNull();

    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por posición' }), { target: { value: 'TOP' } });
    expect(screen.getByText('No hay campeones que coincidan con la búsqueda.')).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por posición' }), { target: { value: 'MID' } });
    expect(screen.getByText('Ahri')).toBeTruthy();
  });

  it('muestra un placeholder si falla el retrato de un campeón', () => {
    const { container } = render(<ChampionCard champion={{ id: 103, name: 'Ahri', roles: ['MID'], imageUrl: '/inexistente.png' }} />);
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('A')).toBeTruthy();
  });

  it('distingue una serie inexistente de un fallo de conexión', async () => {
    getSeriesMock.mockRejectedValueOnce(new FearlessApiError(404, 'SERIES_NOT_FOUND', 'No existe'));
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'No hay datos de esta serie' })).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('Serie no encontrada');
    expect(screen.queryByRole('button', { name: 'Borrar partidas' })).toBeNull();
  });

  it('exige clave y BORRAR, conserva la serie y refresca después del borrado', async () => {
    clearGamesMock.mockResolvedValue(7);
    render(<App />);
    await screen.findByRole('region', { name: 'Campeones disponibles' });
    fireEvent.click(screen.getByRole('button', { name: 'Borrar partidas' }));
    const dialog = screen.getByRole('dialog');
    const confirmButton = within(dialog).getByRole('button', { name: 'Borrar partidas' }) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(true);
    fireEvent.input(within(dialog).getByLabelText('Clave de administrador'), { target: { value: 'admin-test' } });
    fireEvent.input(within(dialog).getByLabelText('Escribe BORRAR para confirmar'), { target: { value: 'borrar' } });
    expect(confirmButton.disabled).toBe(true);
    fireEvent.input(within(dialog).getByLabelText('Escribe BORRAR para confirmar'), { target: { value: 'BORRAR' } });
    getSeriesMock.mockResolvedValueOnce({ ...testSeries, seriesId: 'fearless-001', games: [], gamesCount: 0, usedChampions: [], usedChampionsCount: 0, availableChampionsCount: 170 });
    fireEvent.click(confirmButton);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(clearGamesMock).toHaveBeenCalledExactlyOnceWith('fearless-001', 'admin-test');
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Partidas borradas: 7'));
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Navegación principal' })).getByRole('button', { name: 'Historial' }));
    expect(screen.getByRole('heading', { name: 'Esperando la primera partida' })).toBeTruthy();
    expect(screen.getByText('Todavía no se han bloqueado campeones.')).toBeTruthy();
  });

  it('mantiene abierto el diálogo y muestra el error de clave de Sites', async () => {
    clearGamesMock.mockRejectedValue(new FearlessApiError(401, 'UNAUTHORIZED', 'Error'));
    render(<App />);
    await screen.findByRole('region', { name: 'Campeones disponibles' });
    fireEvent.click(screen.getByRole('button', { name: 'Borrar partidas' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.input(within(dialog).getByLabelText('Clave de administrador'), { target: { value: 'wrong' } });
    fireEvent.input(within(dialog).getByLabelText('Escribe BORRAR para confirmar'), { target: { value: 'BORRAR' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Borrar partidas' }));
    expect((await within(dialog).findByRole('alert')).textContent).toBe('La clave de administrador no es válida.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(getSeriesMock).toHaveBeenCalledTimes(1);
  });

  it('muestra todos los campeones de una partida sincronizada', () => {
    const champions = Array.from({ length: 10 }, (_, index) => ({
      championId: index + 1,
      championName: `Campeón ${index + 1}`,
      team: index < 5 ? 'blue' as const : 'red' as const,
      role: null,
    }));
    render(<MatchHistory games={[{ gameNumber: 1, date: '2026-09-23T21:33:00Z', champions }]} />);
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(11);
    expect(screen.getAllByText('Equipo Azul')).toHaveLength(5);
    expect(screen.getAllByText('Equipo Rojo')).toHaveLength(5);
  });

});
