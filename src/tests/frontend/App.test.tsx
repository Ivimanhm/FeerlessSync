import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../frontend/app/App';
import ChampionCard from '../../frontend/components/champions/ChampionCard';
import MatchHistory from '../../frontend/components/history/MatchHistory';
import { getChampionCatalog } from '../../frontend/services/championCatalog';
import { mapStoredSeries } from '../../frontend/services/api/series';
import type { FearlessSeries } from '../../frontend/types/fearless';
import { clearSeriesGames, getFearlessSeries, setGameWinner } from '../../frontend/services/api/series';
import { FearlessApiError } from '../../frontend/services/api/client';
import { getChampionWinStats } from '../../frontend/services/api/championWins';

vi.mock('../../frontend/services/api/series', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../frontend/services/api/series')>()), getFearlessSeries: vi.fn(), clearSeriesGames: vi.fn(), setGameWinner: vi.fn() }));
vi.mock('../../frontend/services/api/championWins', () => ({ getChampionWinStats: vi.fn() }));

const getSeriesMock = vi.mocked(getFearlessSeries);
const clearGamesMock = vi.mocked(clearSeriesGames);
const setWinnerMock = vi.mocked(setGameWinner);
const championWinsMock = vi.mocked(getChampionWinStats);

let testSeries: FearlessSeries;

beforeEach(async () => {
  window.localStorage.clear();
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
  window.history.replaceState(null, '', '/#/campeones');
  getSeriesMock.mockReset();
  clearGamesMock.mockReset();
  setWinnerMock.mockReset();
  championWinsMock.mockReset();
  championWinsMock.mockResolvedValue({ champions: [], completedGames: 0, pendingGames: 7 });
  getSeriesMock.mockImplementation(async (id) => {
    if (!id.trim()) throw new Error('ID vacío');
    return { ...testSeries, seriesId: id.trim() };
  });
});

describe('Fearless Sync', () => {
  it('recuerda la última serie seleccionada entre Campeones, Historial y la portada', async () => {
    render(<App />);
    await screen.findByRole('region', { name: 'Campeones disponibles' });

    fireEvent.click(screen.getByRole('button', { name: 'Cambiar serie' }));
    fireEvent.input(screen.getByRole('textbox', { name: 'ID de serie' }), { target: { value: 'fearless-42' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(getSeriesMock).toHaveBeenLastCalledWith('fearless-42'));
    expect(window.localStorage.getItem('fearless-sync:selected-series-id')).toBe('fearless-42');

    fireEvent.click(within(screen.getByRole('navigation', { name: 'Ruta de navegación' })).getByRole('button', { name: 'Inicio' }));
    fireEvent.click(screen.getByRole('button', { name: 'Comenzar ahora' }));
    await waitFor(() => expect(getSeriesMock).toHaveBeenLastCalledWith('fearless-42'));

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Navegación principal' })).getByRole('button', { name: 'Historial' }));
    await screen.findAllByRole('table');
    expect(screen.getByText('fearless-42')).toBeTruthy();
  });

  it('muestra la portada sin consultar series y enlaza las releases de PersoBuilder', () => {
    window.history.replaceState(null, '', '/');
    const open = vi.spyOn(window, 'open');
    render(<App />);
    expect(screen.getByRole('heading', { name: /Tus equipos.*Mis reglas/, level: 1 })).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Ejemplo de composición de equipo' }).textContent).toMatch(/Sett.*Viego.*Akali.*Aphelios.*Thresh/);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(7);
    for (const button of buttons.filter(button => !/Comenzar ahora|cómo funciona/i.test(button.textContent ?? ''))) fireEvent.click(button);
    const download = screen.getByRole('link', { name: 'Descargar app' });
    expect(download.getAttribute('href')).toBe('https://github.com/Ivimanhm/PersoBuilder/releases');
    expect(download.getAttribute('target')).toBe('_blank');
    expect(download.getAttribute('rel')).toBe('noopener noreferrer');
    expect(window.location.hash).toBe('');
    expect(open).not.toHaveBeenCalled();
    expect(getSeriesMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('abre los campeones al comenzar y permite volver a la portada', async () => {
    window.history.replaceState(null, '', '/');
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Comenzar ahora' }));
    expect(window.location.hash).toBe('#/campeones');
    await screen.findByRole('region', { name: 'Campeones disponibles' });
    expect(getSeriesMock).toHaveBeenCalledTimes(1);
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Ruta de navegación' })).getByRole('button', { name: 'Inicio' }));
    expect(window.location.hash).toBe('#/');
    expect(screen.getByRole('heading', { name: /Tus equipos.*Mis reglas/, level: 1 })).toBeTruthy();
  });

  it('conserva la ruta del historial y vuelve a la nueva portada', async () => {
    window.history.replaceState(null, '', '/#/historial');
    render(<App />);
    await screen.findAllByRole('table');
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Ruta de navegación' })).getByRole('button', { name: 'Inicio' }));
    expect(screen.getByRole('heading', { name: /Tus equipos.*Mis reglas/, level: 1 })).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('abre directamente los campeones y pasa al historial completo', async () => {
    render(<App />);

    expect(screen.getByRole('status', { name: 'Cargando serie' })).toBeTruthy();
    await screen.findByRole('region', { name: 'Campeones disponibles' });
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Navegación principal' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
    expect(within(screen.getByRole('navigation', { name: 'Navegación principal' })).getAllByRole('button')).toHaveLength(2);

    fireEvent.click(within(screen.getByRole('navigation', { name: 'Navegación principal' })).getByRole('button', { name: 'Historial' }));
    expect(window.location.hash).toBe('#/historial');
    expect(screen.getByRole('heading', { name: 'Historial de partidas', level: 1 })).toBeTruthy();
    expect(screen.getAllByRole('table')).toHaveLength(7);
    expect(within(screen.getByRole('table', { name: 'Partida 1: equipos por posición' })).getAllByRole('row')).toHaveLength(6);

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Navegación principal' })).getByRole('button', { name: 'Campeones' }));
    expect(window.location.hash).toBe('#/campeones');
    expect(screen.getByRole('heading', { name: 'Fearless Sync', level: 1 })).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('abre directamente Historial y permite ordenar las partidas', async () => {
    window.history.replaceState(null, '', '/#/historial');
    render(<App />);
    const tables = await screen.findAllByRole('table');

    expect(screen.getByRole('heading', { name: 'Historial de partidas', level: 1 })).toBeTruthy();
    expect(tables).toHaveLength(7);
    expect(tables[0].getAttribute('aria-label')).toBe('Partida 7: equipos por posición');
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar orden del historial' }));
    expect(screen.getAllByRole('table')[0].getAttribute('aria-label')).toBe('Partida 1: equipos por posición');
  });

  it('busca otra serie, ignora IDs vacíos como Sites y permite reintentar errores', async () => {
    render(<App />);
    await screen.findByRole('region', { name: 'Campeones disponibles' });
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar serie' }));
    const input = screen.getByRole('textbox', { name: 'ID de serie' });

    fireEvent.input(input, { target: { value: 'fearless-42' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(getSeriesMock).toHaveBeenLastCalledWith('fearless-42'));
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
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
    expect(await screen.findAllByRole('table')).toHaveLength(7);
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

    fireEvent.input(screen.getByRole('textbox', { name: 'Buscar campeón' }), { target: { value: 'Lux' } });
    expect(screen.getByText('Lux')).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por posición' }), { target: { value: 'SUP' } });
    expect(screen.getByText('Lux')).toBeTruthy();

    fireEvent.input(screen.getByRole('textbox', { name: 'Buscar campeón' }), { target: { value: 'kai sa' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por posición' }), { target: { value: 'ADC' } });
    expect(screen.getByText("Kai'Sa")).toBeTruthy();

    fireEvent.input(screen.getByRole('textbox', { name: 'Buscar campeón' }), { target: { value: 'master yi' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por posición' }), { target: { value: 'JG' } });
    expect(screen.getByText('Maestro Yi')).toBeTruthy();
  });

  it('asigna al menos un rol válido a todos los campeones del catálogo', async () => {
    const catalog = await getChampionCatalog();
    const roles = new Set(['TOP', 'JG', 'MID', 'ADC', 'SUP']);
    expect(catalog).toHaveLength(173);
    expect(catalog.every((champion) => champion.roles.length > 0 &&
      champion.roles.every((role) => roles.has(role)) &&
      new Set(champion.roles).size === champion.roles.length)).toBe(true);
    expect(catalog.find((champion) => champion.name === 'Lux')?.roles).toEqual(expect.arrayContaining(['SUP', 'MID']));
    expect(catalog.find((champion) => champion.name === 'Vayne')?.roles).toEqual(['ADC', 'TOP']);
    expect(catalog.find((champion) => champion.name === 'Ashe')?.roles).toEqual(['ADC', 'SUP']);
    expect(catalog.find((champion) => champion.name === 'Aurora')?.roles).toEqual(['MID', 'TOP']);
    expect(catalog.map((champion) => champion.name)).toEqual(expect.arrayContaining(['Locke', 'Yunara', 'Zaahen']));
  });

  it('muestra un placeholder si falla el retrato de un campeón', () => {
    const { container } = render(<ChampionCard champion={{ id: 103, name: 'Ahri', roles: ['MID'], imageUrl: '/inexistente.png' }} />);
    expect(container.querySelector('.portrait-image-fallback')?.textContent).toBe('A');
    expect(container.querySelector('.portrait-image--loaded')).toBeNull();
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('A')).toBeTruthy();
  });

  it('muestra el retrato sobre el placeholder cuando termina de cargar', () => {
    const { container } = render(<ChampionCard champion={{ id: 103, name: 'Ahri', roles: ['MID'], imageUrl: '/champions/Ahri.jpg' }} eager />);
    const portrait = container.querySelector('img')!;
    expect(portrait.getAttribute('loading')).toBe('eager');
    fireEvent.load(portrait);
    expect(container.querySelector('.portrait-image--loaded')).toBeTruthy();
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
    getSeriesMock.mockResolvedValueOnce({ ...testSeries, seriesId: 'fearless-001', games: [], gamesCount: 0, usedChampions: [], usedChampionsCount: 0, availableChampionsCount: 173 });
    fireEvent.click(confirmButton);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(clearGamesMock).toHaveBeenCalledExactlyOnceWith('fearless-001', 'admin-test');
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Partidas borradas: 7'));
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Navegación principal' })).getByRole('button', { name: 'Historial' }));
    expect(screen.getByRole('heading', { name: 'Esperando la primera partida' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Campeones utilizados' })).toBeNull();
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
    const roles = ['TOP', 'JG', 'MID', 'ADC', 'SUP'] as const;
    const champions = Array.from({ length: 10 }, (_, index) => ({
      championId: index + 1,
      championName: `Campeón ${index + 1}`,
      team: index < 5 ? 'blue' as const : 'red' as const,
      role: roles[index % 5],
    }));
    render(<MatchHistory seriesId="fearless-001" onWinnerChanged={async () => {}} games={[{ gameNumber: 1, date: '2026-09-23T21:33:00Z', winner: 'blue', champions: [...champions].reverse() }]} />);
    const table = screen.getByRole('table', { name: 'Partida 1: equipos por posición' });
    expect(within(table).getAllByRole('row')).toHaveLength(6);
    expect(within(table).getByRole('row', { name: /TOP/ }).textContent).toContain('Campeón 1');
    expect(within(table).getByRole('row', { name: /TOP/ }).textContent).toContain('Campeón 6');
    expect(screen.getByText('Ganador: Equipo Azul')).toBeTruthy();
  });

  it('ordena las partidas por fecha reciente incluso si el número no coincide', () => {
    const games = [
      { gameNumber: 5, date: '2026-09-23T12:00:00Z', winner: null, champions: [] },
      { gameNumber: 2, date: '2026-09-25T12:00:00Z', winner: null, champions: [] },
    ];
    render(<MatchHistory seriesId="fearless-001" onWinnerChanged={async () => {}} games={games} />);
    expect(screen.getAllByRole('table')[0].getAttribute('aria-label')).toBe('Partida 2: equipos por posición');
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar orden del historial' }));
    expect(screen.getAllByRole('table')[0].getAttribute('aria-label')).toBe('Partida 5: equipos por posición');
  });

  it('guarda el ganador desde Historial con la clave de administrador y refresca la partida', async () => {
    window.history.replaceState(null, '', '/#/historial');
    setWinnerMock.mockImplementation(async (_seriesId, gameNumber, winner) => {
      testSeries.games.find((game) => game.gameNumber === gameNumber)!.winner = winner;
    });
    render(<App />);
    await screen.findAllByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar ganador de la partida 1' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Equipo Rojo' }));
    fireEvent.input(within(dialog).getByLabelText('Clave de administrador'), { target: { value: 'admin-test' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar ganador' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(setWinnerMock).toHaveBeenCalledExactlyOnceWith('fearless-001', 1, 'red', 'admin-test');
    expect(getSeriesMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Ganador: Equipo Rojo')).toBeTruthy();
  });

  it('mantiene la selección y muestra un error si la clave de administrador es incorrecta', async () => {
    window.history.replaceState(null, '', '/#/historial');
    setWinnerMock.mockRejectedValue(new FearlessApiError(401, 'UNAUTHORIZED', 'Error'));
    render(<App />);
    await screen.findAllByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar ganador de la partida 1' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Equipo Azul' }));
    fireEvent.input(within(dialog).getByLabelText('Clave de administrador'), { target: { value: 'wrong' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar ganador' }));
    expect((await within(dialog).findByRole('alert')).textContent).toBe('La clave de administrador no es válida.');
    expect((within(dialog).getByRole('radio', { name: 'Equipo Azul' }) as HTMLInputElement).checked).toBe(true);
    expect(getSeriesMock).toHaveBeenCalledTimes(1);
  });

});
