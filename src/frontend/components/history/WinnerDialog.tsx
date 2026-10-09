import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { FearlessApiError } from '../../services/api/client';
import { setGameWinner } from '../../services/api/series';
import type { Game, TeamSide } from '../../types/fearless';
import { AlertCircle, Check, KeyRound, LoaderCircle, Minus, Trophy, X } from 'lucide-preact';
import OrnamentalFrame from '../ui/OrnamentalFrame';
import PortraitImage from '../champions/PortraitImage';
import './WinnerDialog.css';

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
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.querySelector<HTMLInputElement>('input[type="radio"]:checked')?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
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

  return <div class="modal-backdrop winner-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section ref={dialog} class="winner-modal" role="dialog" aria-modal="true" aria-labelledby="winner-title" aria-describedby="winner-description" onKeyDown={keyDown}>
      <OrnamentalFrame />
      <button class="winner-modal-close" type="button" aria-label="Cerrar" disabled={saving} onClick={close}><X size={20} aria-hidden="true" /></button>
      <header class="winner-modal-header">
        <div class="winner-modal-heading">
          <Trophy size={34} aria-hidden="true" />
          <div><p class="winner-modal-eyebrow">RESULTADO DE PARTIDA</p><h2 id="winner-title">Ganador de la partida {game.gameNumber}</h2></div>
        </div>
        <p id="winner-description">Selecciona el equipo ganador para actualizar el historial.</p>
      </header>
      <form onSubmit={(event) => void submit(event)}>
        <div class="winner-modal-body">
          <fieldset class="winner-options" disabled={saving}>
            <legend class="sr-only">Equipo ganador</legend>
            {(['blue', 'red'] as const).map(side => <label key={side} class={`winner-team-option winner-team-option--${side}`}>
              <input class="winner-choice-input" type="radio" name="winner" aria-label={side === 'blue' ? 'Equipo Azul' : 'Equipo Rojo'} checked={winner === side} onChange={() => setWinner(side)} />
              <span class="winner-team-head"><span class="winner-team-gem" aria-hidden="true" /><strong>Equipo {side === 'blue' ? 'Azul' : 'Rojo'}</strong><span class="winner-choice-check" aria-hidden="true"><Check size={14} /></span></span>
              <span class="winner-team-roster" aria-hidden="true">{game.champions.filter(champion => champion.team === side).map(champion => <PortraitImage key={champion.championId} name={champion.championName} src={champion.imageUrl} eager />)}</span>
            </label>)}
            <label class="winner-pending-option">
              <input class="winner-choice-input" type="radio" name="winner" aria-label="Sin ganador" checked={winner === null} onChange={() => setWinner(null)} />
              <Minus size={24} aria-hidden="true" />
              <span><strong>Sin ganador</strong><small>Dejar el resultado pendiente</small></span>
              <span class="winner-choice-check" aria-hidden="true"><Check size={14} /></span>
            </label>
          </fieldset>
          <p class="winner-choice-hint">{winner === null ? 'La partida quedará pendiente y no sumará victorias.' : `Los campeones del equipo ${winner === 'blue' ? 'Azul' : 'Rojo'} sumarán una victoria.`}</p>
          <label class="winner-token-label" for="winner-token">Clave de administrador</label>
          <div class="winner-token-field"><KeyRound size={18} aria-hidden="true" /><input id="winner-token" type="password" autoComplete="current-password" placeholder="Introduce tu clave" required disabled={saving} aria-describedby={error ? 'winner-error' : undefined} value={token} onInput={(event) => setToken(event.currentTarget.value)} /></div>
          {error && <p id="winner-error" class="winner-modal-error" role="alert"><AlertCircle size={18} aria-hidden="true" />{error}</p>}
        </div>
        <div class="winner-modal-actions">
          <button type="button" class="winner-cancel" disabled={saving} onClick={close}>Cancelar</button>
          <button type="submit" class="winner-save" disabled={saving || !token.trim() || winner === game.winner}>{saving ? <LoaderCircle class="winner-saving-icon" size={17} aria-hidden="true" /> : <Check size={17} aria-hidden="true" />}{saving ? 'Guardando…' : 'Guardar ganador'}</button>
        </div>
      </form>
    </section>
  </div>;
}
