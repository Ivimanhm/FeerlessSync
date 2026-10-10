import { fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WinnerDialog from '../../frontend/components/history/WinnerDialog';
import { setGameWinner } from '../../frontend/services/api/series';
import { forgetWinnerSession, getWinnerSession } from '../../frontend/services/api/winnerSession';
import { FearlessApiError } from '../../frontend/services/api/client';
import type { Game } from '../../frontend/types/fearless';

vi.mock('../../frontend/services/api/series', () => ({ setGameWinner: vi.fn() }));
vi.mock('../../frontend/services/api/winnerSession', () => ({ getWinnerSession: vi.fn(), forgetWinnerSession: vi.fn() }));

const game: Game = { gameNumber: 1, date: '2026-09-23T21:33:00Z', winner: null, champions: [] };

beforeEach(() => {
  vi.mocked(getWinnerSession).mockReset().mockResolvedValue(false);
  vi.mocked(forgetWinnerSession).mockReset().mockResolvedValue(undefined);
  vi.mocked(setGameWinner).mockReset().mockResolvedValue(undefined);
});

describe('sesión para seleccionar ganadores', () => {
  it('usa la sesión recordada al volver a abrir el modal, sin pedir otra vez la clave', async () => {
    const first = render(<WinnerDialog seriesId="series-1" game={game} onClose={() => {}} onSaved={async () => {}} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Equipo Azul' }));
    fireEvent.input(screen.getByLabelText('Clave de administrador'), { target: { value: 'first-key' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ganador' }));
    await waitFor(() => expect(setGameWinner).toHaveBeenCalledWith('series-1', 1, 'blue', 'first-key'));
    first.unmount();

    vi.mocked(getWinnerSession).mockResolvedValue(true);
    const onClose = vi.fn();
    render(<WinnerDialog seriesId="series-1" game={game} onClose={onClose} onSaved={async () => {}} />);
    await screen.findByText('Clave recordada en este navegador');
    expect(screen.queryByLabelText('Clave de administrador')).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'Equipo Rojo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ganador' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(setGameWinner).toHaveBeenLastCalledWith('series-1', 1, 'red', '');
  });

  it('permite olvidar la sesión y vuelve a exigir la clave', async () => {
    vi.mocked(getWinnerSession).mockResolvedValue(true);
    render(<WinnerDialog seriesId="series-1" game={game} onClose={() => {}} onSaved={async () => {}} />);
    await screen.findByText('Clave recordada en este navegador');
    fireEvent.click(screen.getByRole('button', { name: 'Olvidar clave' }));
    await screen.findByLabelText('Clave de administrador');
    expect(forgetWinnerSession).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('radio', { name: 'Equipo Azul' }));
    expect((screen.getByRole('button', { name: 'Guardar ganador' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('solicita una nueva clave si el servidor rechaza la sesión caducada', async () => {
    vi.mocked(getWinnerSession).mockResolvedValue(true);
    vi.mocked(setGameWinner).mockRejectedValue(new FearlessApiError(401, 'UNAUTHORIZED', 'Expired'));
    render(<WinnerDialog seriesId="series-1" game={game} onClose={() => {}} onSaved={async () => {}} />);
    await screen.findByText('Clave recordada en este navegador');
    fireEvent.click(screen.getByRole('radio', { name: 'Equipo Azul' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ganador' }));
    const error = await screen.findByRole('alert');
    expect(error.textContent).toContain('La sesión ha caducado');
    expect(screen.getByLabelText('Clave de administrador')).toBeTruthy();
    expect((screen.getByRole('radio', { name: 'Equipo Azul' }) as HTMLInputElement).checked).toBe(true);
  });
});
