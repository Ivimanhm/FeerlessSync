import './OrnamentalFrame.css';

export default function OrnamentalFrame() {
  return <span class="ornamental-frame" aria-hidden="true">
    {['top-left', 'top-right', 'bottom-right', 'bottom-left'].map(corner => (
      <svg key={corner} class={`ornamental-frame-${corner}`} viewBox="0 0 40 40" fill="none">
        <path d="M1 39V14L14 1h25M5 35V16L16 5h19" />
        <path d="M1 14h7l6-6V1M5 23l5-5V10h8l5-5" />
      </svg>
    ))}
  </span>;
}
