import { useState } from 'preact/hooks';
import HowItWorksDialog from './HowItWorksDialog';
import "./Home.css";

const exampleLineup = [
  { champion: "Sett", role: "top", label: "TOP" },
  { champion: "Viego", role: "jungle", label: "JUNGLA" },
  { champion: "Akali", role: "mid", label: "MID" },
  { champion: "Aphelios", role: "adc", label: "ADC" },
  { champion: "Thresh", role: "support", label: "SUPPORT" },
];

function Glyph({ name }: { name: string }) {
  return <i className={`bi bi-${name}`} aria-hidden="true" />;
}

function FrameOrnaments() {
  return (
    <span className="welcome-frame-ornaments" aria-hidden="true">
      {["top-left", "top-right", "bottom-right", "bottom-left"].map((corner) => (
        <svg key={corner} className={corner} viewBox="0 0 48 48" fill="none">
          <path d="M1 47V19c0-6 1-10 7-11l4-1 5-6h30" />
          <path d="M7 37V20c0-6 2-10 8-11l6-2h16" />
          <path d="M1 15l6 8m8-22 8 6M8 8l7 7 13-4 12 3" />
          <path d="M7 20l5 5-2 9m10-27 5 5 9-2" opacity=".45" />
        </svg>
      ))}
    </span>
  );
}

function DiceIcon() {
  return (
    <svg className="welcome-dice" viewBox="0 0 52 58" fill="none" aria-hidden="true">
      <path d="M26 3 48 16v26L26 55 4 42V16L26 3Z M4 16l22 13 22-13M26 29v26" />
      {[[26,10],[17,16],[35,16],[26,22],[12,27],[20,41],[12,43],[34,37],[41,42]].map(([cx,cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.8" fill="currentColor" stroke="none" />
      ))}
    </svg>
  );
}

function TeamsIcon() {
  return <svg className="welcome-feature-art" viewBox="0 0 48 52" fill="currentColor" aria-hidden="true"><circle cx="24" cy="13" r="8" /><circle cx="9" cy="19" r="5" /><circle cx="39" cy="19" r="5" /><path d="M11 47V36c0-8 5-13 13-13s13 5 13 13v11H11ZM1 42v-8c0-6 3-9 8-9h3c-5 4-7 9-7 17H1Zm42 0c0-8-2-13-7-17h3c5 0 8 3 8 9v8h-4Z" /></svg>;
}

function ShieldIcon() {
  return <svg className="welcome-feature-art" viewBox="0 0 48 56" fill="none" aria-hidden="true"><path d="M24 4C17 8 10 9 5 9v14c0 13 7 23 19 29 12-6 19-16 19-29V9c-5 0-12-1-19-5Z" stroke="currentColor" stroke-width="3" /><path d="m24 12-4 5 2 6v13l2 7 2-7V23l2-6-4-5Zm-8 9h16v5H16v-5Z" fill="currentColor" /></svg>;
}

export default function HomePage({ onStart }: { onStart: () => void }) {
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const background = new URLSearchParams(window.location.search).get('fondo');
  return (
    <div className={`fearless-home welcome-screen${background === 'anterior' ? ' welcome-screen--original' : background === 'valle' ? ' welcome-screen--valley' : ''}`}>
      <header className="welcome-header">
        <div className="welcome-hero">
          <span className="logo-mark logo-large" aria-hidden="true"><img src="/home/Logo.png" alt="" /></span>
          <div className="welcome-brand welcome-windows-only">
            <span className="welcome-brand-name">Perso Builder</span>
            <span className="welcome-brand-caption">League of Legends</span>
          </div>
        </div>
        <nav className="welcome-top-nav welcome-windows-only" aria-label="Navegación de bienvenida">
          <button type="button" className="is-active">Inicio</button>
          <button type="button" onClick={() => setHowItWorksOpen(true)}>Cómo funciona</button>
          <span className="welcome-nav-divider" aria-hidden="true" />
          <a className="welcome-open-app" href="https://github.com/Ivimanhm/PersoBuilder/releases" target="_blank" rel="noopener noreferrer">Descargar app <Glyph name="arrow-right" /></a>
        </nav>
      </header>

      <div className="welcome-copy">
        <div className="welcome-introduction welcome-windows-only">
          <p className="welcome-eyebrow">ESTRATEGIA <b>·</b> EQUIPOS <b>·</b> DRAFT FEARLESS</p>
          <h1 className="welcome-desktop-heading">Tus equipos<br /><span>Mis reglas</span></h1>
          <p className="welcome-description">Crea equipos, prepara tus drafts Fearless, gestiona<br className="welcome-copy-break" /> la selección de campeones y lleva tu estrategia<br className="welcome-copy-break" /> al siguiente nivel.</p>
        </div>
        <div className="welcome-actions">
          <button className="gold-button welcome-button" type="button" onClick={onStart}>
            <span className="welcome-windows-only">Comenzar ahora</span>
            <span className="welcome-cta-arrow welcome-windows-only"><Glyph name="arrow-right" /></span>
          </button>
          <button className="welcome-watch welcome-windows-only" type="button" onClick={() => setHowItWorksOpen(true)}><Glyph name="play-circle" /> Ver cómo funciona</button>
        </div>
        <ul className="welcome-trust welcome-windows-only">
          <li><Glyph name="people-fill" /> Gratis</li>
          <li><Glyph name="lightning-fill" /> Sin registro</li>
          <li><Glyph name="reception-4" /> Hecho para jugadores de LoL</li>
        </ul>
      </div>

      <aside className="welcome-lineup welcome-windows-only" aria-labelledby="welcome-lineup-title">
        <FrameOrnaments />
        <div className="welcome-lineup-heading">
          <div>
            <div className="welcome-lineup-kicker"><Glyph name="shield-check" /><span>MIS NORMAS, EN UN MISMO EQUIPO.</span></div>
            <h2 id="welcome-lineup-title">La Grieta te espera.</h2>
          </div>
          <span className="welcome-fearless-badge"><Glyph name="crosshair" /> Modo Fearless</span>
        </div>
        <ul className="welcome-champions" aria-label="Ejemplo de composición de equipo">
          {exampleLineup.map(({ champion, role, label }) => (
            <li key={role}>
              <span className="role-icon" style={{ "--role-icon": `url('/home/roles/${role}.svg')` }} aria-hidden="true" />
              <img src={`/home/champions/${champion}.png`} alt="" width="120" height="120" loading="lazy" />
              <strong>{champion}</strong><span>{label}</span>
            </li>
          ))}
        </ul>
        <div className="welcome-lineup-footer">
          <p>Una infinidad de combinaciones. El mismo objetivo: la victoria.</p>
          <span className="welcome-lineup-dots" aria-hidden="true"><i /><i /><i /><i /></span>
        </div>
      </aside>

      <ul className="welcome-features welcome-windows-only" aria-label="Qué puedes hacer en Perso Builder">
        <li><button type="button"><FrameOrnaments /><span className="welcome-feature-icon"><TeamsIcon /></span><span className="welcome-feature-copy"><strong>Equipos a tu medida</strong><span>Crea y organiza tus equipos, guarda composiciones y prepárate para cualquier liga.</span></span><Glyph name="arrow-right" /></button></li>
        <li><button type="button"><FrameOrnaments /><span className="welcome-feature-icon"><ShieldIcon /></span><span className="welcome-feature-copy"><strong>Draft Fearless</strong><span>Planifica tus selecciones, evita repeticiones y domina el formato Fearless.</span></span><Glyph name="arrow-right" /></button></li>
        <li><button type="button"><FrameOrnaments /><span className="welcome-feature-icon"><DiceIcon /></span><span className="welcome-feature-copy"><strong>Ruleta de campeones</strong><span>Deja que la suerte decida y descubre nuevas combinaciones.</span></span><Glyph name="arrow-right" /></button></li>
      </ul>

      {howItWorksOpen && <HowItWorksDialog onClose={() => setHowItWorksOpen(false)} />}
    </div>
  );
}
