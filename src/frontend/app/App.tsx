import { useNavigation } from './hooks/useNavigation';
import HomePage from '../pages/Home/HomePage';
import SeriesDashboard from './SeriesDashboard';

export default function App() {
  const { page, navigate } = useNavigation();
  return page === 'Inicio' ? <HomePage onStart={() => navigate('Campeones')} /> : <SeriesDashboard page={page} navigate={navigate} />;
}
