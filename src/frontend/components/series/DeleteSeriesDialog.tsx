import { useEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { deleteFearlessSeries } from '../../services/api/series';
import { FearlessApiError } from '../../services/api/client';

interface Props {
  open: boolean;
  seriesId: string;
  gamesCount: number;
  onClose: () => void;
  onDeleted: () => void;
}

export default function DeleteSeriesDialog({ open, seriesId, gamesCount, onClose, onDeleted }: Props) {
  const [token, setToken] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLElement>(null);

  const close = () => {
    if (deleting) return;
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
    const previousFocus = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLInputElement>('input')?.focus();
    return () => previousFocus?.focus();
  }, [open]);

  if (!open) return null;

  const keyDown = (event: JSX.TargetedKeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && !deleting) close();
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
    if (confirmation !== seriesId || !token || deleting) return;
    setDeleting(true);
    setError('');
    try {
      await deleteFearlessSeries(seriesId, token);
      setToken('');
      setConfirmation('');
      setDeleting(false);
      onDeleted();
    } catch (reason) {
      setDeleting(false);
      setError(reason instanceof FearlessApiError && reason.status === 401 ? 'La clave de administrador no es válida.'
        : reason instanceof FearlessApiError && reason.status === 503 ? 'El borrado no está disponible. Contacta con el administrador del sitio.'
          : reason instanceof FearlessApiError && reason.status === 404 ? 'La serie ya no existe.'
            : 'No se pudo eliminar la serie. Inténtalo de nuevo.');
    }
  };

  return (
    <div class="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section ref={dialog} class="clear-modal" role="dialog" aria-modal="true" aria-labelledby="delete-series-title" aria-describedby="delete-series-description" onKeyDown={keyDown}>
        <button class="modal-close" type="button" aria-label="Cerrar" disabled={deleting} onClick={close}>×</button>
        <p class="modal-eyebrow">ACCIÓN IRREVERSIBLE</p>
        <h2 id="delete-series-title">Eliminar serie {seriesId}</h2>
        <p id="delete-series-description">Se eliminarán la serie, sus {gamesCount} partidas y el historial de eventos. No se puede deshacer.</p>
        <form onSubmit={(event) => void submit(event)}>
          <label for="delete-admin-token">Clave de administrador</label>
          <input id="delete-admin-token" type="password" autoComplete="off" required disabled={deleting} value={token} onInput={(event) => setToken(event.currentTarget.value)} />
          <label for="delete-series-confirm">Escribe el ID exacto para confirmar: {seriesId}</label>
          <input id="delete-series-confirm" type="text" autoComplete="off" spellcheck={false} required disabled={deleting} value={confirmation} onInput={(event) => setConfirmation(event.currentTarget.value)} />
          {error && <p class="modal-error" role="alert">{error}</p>}
          <div class="modal-actions">
            <button type="button" class="cancel-button" disabled={deleting} onClick={close}>Cancelar</button>
            <button type="submit" class="confirm-delete" disabled={deleting || confirmation !== seriesId || !token}>{deleting ? 'Eliminando…' : 'Eliminar serie y datos'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
