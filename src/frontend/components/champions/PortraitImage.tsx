import { useState } from 'preact/hooks';

interface Props {
  name: string;
  src?: string;
  eager?: boolean;
}

/** Keeps a readable portrait in place while an image loads or if it fails. */
export default function PortraitImage({ name, src, eager = false }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const initials = name.split(/[ '\-]+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase();

  return <span class={'portrait-image' + (loaded ? ' portrait-image--loaded' : '')}>
    <span class="portrait-image-fallback" aria-hidden="true">{initials}</span>
    {src && !failed && <img src={src} alt="" loading={eager ? 'eager' : 'lazy'} decoding="async" onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />}
  </span>;
}
