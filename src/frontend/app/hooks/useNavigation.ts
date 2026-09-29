import { useEffect, useState } from 'preact/hooks';
import type { Page } from '../navigation';

const pageFromHash = (): Page => window.location.hash === '#/historial' ? 'Historial' : 'Inicio';

export function useNavigation() {
  const [page, setPage] = useState<Page>(pageFromHash);

  useEffect(() => {
    const handleHashChange = () => setPage(pageFromHash());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (nextPage: Page) => {
    window.location.hash = nextPage === 'Historial' ? '/historial' : '/';
    setPage(nextPage);
  };

  return { page, navigate };
}
