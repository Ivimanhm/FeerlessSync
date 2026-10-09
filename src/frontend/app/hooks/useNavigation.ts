import { useEffect, useState } from 'preact/hooks';
import type { Page } from '../navigation';

const pageFromHash = (): Page => {
  if (window.location.hash === '#/historial') return 'Historial';
  if (window.location.hash === '#/campeones') return 'Campeones';
  return 'Inicio';
};

export function useNavigation() {
  const [page, setPage] = useState<Page>(pageFromHash);

  useEffect(() => {
    const handleHashChange = () => setPage(pageFromHash());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (nextPage: Page) => {
    window.location.hash = nextPage === 'Inicio' ? '/' : `/${nextPage.toLowerCase()}`;
    setPage(nextPage);
  };

  return { page, navigate };
}
