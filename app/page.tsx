import { getLines, getStations, getTerrain, getPins } from '@/lib/content';
import Experience from '@/components/Experience';

export default function Home() {
  const lines = getLines();
  const stations = getStations();
  const terrain = getTerrain();
  const pins = getPins();
  return <Experience lines={lines} stations={stations} terrain={terrain} pins={pins} />;
}
