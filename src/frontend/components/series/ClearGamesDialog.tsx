import { useEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { clearSeriesGames } from '../../services/api/series';
import { FearlessApiError } from '../../services/api/client';

interface Props {
  open: boolean;
  seriesId: string;
  gamesCount: number;
  onClose: () => void;
  onCleared: (count: number, seriesId: string) => Promise<void>;
}

export default function ClearGamesDialog({ open, seriesId, gamesCount, onClose, onCleared }: Props) {
  const [token, setToken] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLElement>(null);

  const close = () => {
    if (clearing) return;
    setToken('');
    setConfirmation('');
    setError('');
    onClose();
  };

  useEffect(() => {
    if (!open) {
      setToken('');
      setConfirmation('');
      setError('');
      return;
    }
    setError('');
    const previousFocus = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLInputElement>('input')?.focus();
    return () => previousFocus?.focus();
  }, [open]);

  if (!open) return null;

  const keyDown = (event: JSX.TargetedKeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && !clearing) close();
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
    if (confirmation !== 'BORRAR' || !token || clearing) return;
    setClearing(true);
    setError('');
    try {
      const deleted = await clearSeriesGames(seriesId, token);
      setToken('');
      setConfirmation('');
      await onCleared(deleted, seriesId);
    } catch (reason) {
      setError(reason instanceof FearlessApiError && reason.status === 401 ? 'La clave de administrador no es válida.'
        : reason instanceof FearlessApiError && reason.status === 503 ? 'Falta configurar la clave de administrador en el servidor.'
          : 'No se pudieron borrar las partidas. Inténtalo de nuevo.');
    } finally { setClearing(false); }
  };

  return (
    <div class="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section ref={dialog} class="clear-modal" role="dialog" aria-modal="true" aria-labelledby="clear-title" aria-describedby="clear-description" onKeyDown={keyDown}>
        <button class="modal-close" type="button" aria-label="Cerrar" disabled={clearing} onClick={close}>×</button>
        <p class="modal-eyebrow">ACCIÓN DE ADMINISTRACIÓN</p>
        <h2 id="clear-title">Borrar partidas de {seriesId}</h2>
        <p id="clear-description">Se borrarán las {gamesCount} partidas y se conservará la serie. Esta acción no se puede deshacer.</p>
        <form onSubmit={(event) => void submit(event)}>
          <label for="admin-token">Clave de administrador</label>
          <input id="admin-token" type="password" autoComplete="current-password" required disabled={clearing} value={token} onInput={(event) => setToken(event.currentTarget.value)} />
          <label for="clear-confirm">Escribe BORRAR para confirmar</label>
          <input id="clear-confirm" required disabled={clearing} value={confirmation} onInput={(event) => setConfirmation(event.currentTarget.value)} />
          {error && <p class="modal-error" role="alert">{error}</p>}
          <div class="modal-actions">
            <button type="button" class="cancel-button" disabled={clearing} onClick={close}>Cancelar</button>
            <button type="submit" class="confirm-delete" disabled={clearing || confirmation !== 'BORRAR' || !token}>{clearing ? 'Borrando…' : 'Borrar partidas'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
