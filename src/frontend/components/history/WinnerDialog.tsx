import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { FearlessApiError } from '../../services/api/client';
import { setGameWinner } from '../../services/api/series';
import type { Game, TeamSide } from '../../types/fearless';

interface Props {
  seriesId: string;
  game: Game;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export default function WinnerDialog({ seriesId, game, onClose, onSaved }: Props) {
  const [winner, setWinner] = useState<TeamSide | null>(game.winner);
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLInputElement>('input[type="radio"]')?.focus();
    return () => previousFocus?.focus();
  }, []);

  const close = () => {
    if (saving) return;
    setToken('');
    onClose();
  };

  const keyDown = (event: JSX.TargetedKeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && !saving) close();
    if (event.key !== 'Tab') return;
    const elements = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)');
    if (!elements?.length) return;
    const first = elements[0];
    const last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  const submit = async (event: JSX.TargetedSubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token.trim() || winner === game.winner || saving) return;
    setSaving(true);
    setError('');
    try {
      await setGameWinner(seriesId, game.gameNumber, winner, token.trim());
      setToken('');
      await onSaved();
      onClose();
    } catch (reason) {
      setError(reason instanceof FearlessApiError && reason.status === 401 ? 'La clave de administrador no es válida.'
        : reason instanceof FearlessApiError && reason.status === 503 ? 'Falta configurar la clave de administrador en el servidor.'
          : reason instanceof FearlessApiError && reason.status === 404 ? 'La partida ya no existe. Actualiza el historial.'
            : 'No se pudo guardar el ganador. Inténtalo de nuevo.');
    } finally { setSaving(false); }
  };

  return <div class="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section ref={dialog} class="clear-modal winner-modal" role="dialog" aria-modal="true" aria-labelledby="winner-title" aria-describedby="winner-description" onKeyDown={keyDown}>
      <button class="modal-close" type="button" aria-label="Cerrar" disabled={saving} onClick={close}>×</button>
      <p class="modal-eyebrow">RESULTADO DE PARTIDA</p>
      <h2 id="winner-title">Ganador de la partida {game.gameNumber}</h2>
      <p id="winner-description">Selecciona el equipo ganador e introduce la clave de administrador para guardarlo.</p>
      <form onSubmit={(event) => void submit(event)}>
        <fieldset class="winner-options" disabled={saving}>
          <legend>Equipo ganador</legend>
          <label><input type="radio" name="winner" checked={winner === 'blue'} onChange={() => setWinner('blue')} /> Equipo Azul</label>
          <label><input type="radio" name="winner" checked={winner === 'red'} onChange={() => setWinner('red')} /> Equipo Rojo</label>
          <label><input type="radio" name="winner" checked={winner === null} onChange={() => setWinner(null)} /> Sin ganador</label>
        </fieldset>
        <label for="winner-token">Clave de administrador</label>
        <input id="winner-token" type="password" autoComplete="current-password" required disabled={saving} value={token} onInput={(event) => setToken(event.currentTarget.value)} />
        {error && <p class="modal-error" role="alert">{error}</p>}
        <div class="modal-actions">
          <button type="button" class="cancel-button" disabled={saving} onClick={close}>Cancelar</button>
          <button type="submit" class="winner-save" disabled={saving || !token.trim() || winner === game.winner}>{saving ? 'Guardando…' : 'Guardar ganador'}</button>
        </div>
      </form>
    </section>
  </div>;
}
