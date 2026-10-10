import { X } from 'lucide-preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
import './HowItWorksDialog.css';

const steps = [
  {
    title: 'Empieza la serie',
    description: 'En la primera partida, ambos equipos pueden elegir libremente entre todos los campeones disponibles.',
    icon: 'people-fill',
  },
  {
    title: 'Se registran los campeones usados',
    description: 'Cuando termina la partida, los campeones seleccionados quedan marcados como usados para esa serie.',
    icon: 'floppy-fill',
  },
  {
    title: 'Se bloquean para la siguiente partida',
    description: 'Los campeones usados ya no pueden volver a elegirse en las siguientes partidas del Fearless.',
    icon: 'ban',
  },
  {
    title: 'Continúa hasta cerrar la serie',
    description: 'Cada partida reduce el pool disponible, obligando a adaptar la estrategia y variar las composiciones.',
    icon: 'arrow-repeat',
  },
];

export default function HowItWorksDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      previousFocus?.focus();
    };
  }, []);

  return (
    <dialog ref={dialog} className="how-it-works-dialog" aria-labelledby="how-it-works-title"
      onCancel={event => { event.preventDefault(); onClose(); }}
      onKeyDown={event => {
        if (event.key !== 'Tab') return;
        const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>('button');
        if (!buttons?.length) return;
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="how-it-works-surface">
        <header className="how-it-works-header">
          <div>
            <p className="how-it-works-eyebrow">MODO FEARLESS</p>
            <h2 id="how-it-works-title">Cómo funciona</h2>
          </div>
          <button className="how-it-works-close" type="button" aria-label="Cerrar cómo funciona" onClick={onClose} autoFocus>
            <X size={22} aria-hidden="true" />
          </button>
        </header>
        <ol className="how-it-works-steps" aria-label="Pasos de una serie Fearless">
          {steps.map(({ title, description, icon }, index) => (
            <li key={title} className={`how-it-works-step${index === 2 ? ' how-it-works-step--blocked' : ''}`}>
              <svg className="how-it-works-frame" viewBox="0 0 320 148" preserveAspectRatio="none" fill="none" aria-hidden="true">
                <polygon points="8,1 312,1 319,8 319,140 312,147 8,147 1,140 1,8" />
              </svg>
              <span className="how-it-works-number" aria-hidden="true">{index + 1}</span>
              <span className="how-it-works-icon" aria-hidden="true"><i className={`bi bi-${icon}`} /></span>
              <div className="how-it-works-copy">
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            </li>
          ))}
        </ol>
        <footer className="how-it-works-footer">
          <button className="how-it-works-done" type="button" onClick={onClose}>Entendido</button>
        </footer>
      </div>
    </dialog>
  );
}
