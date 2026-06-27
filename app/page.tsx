import { getLines, getStations, getTerrain, getPins, getSite } from '@/lib/content';
import Experience from '@/components/Experience';

export default function Home() {
  const lines = getLines();
  const stations = getStations();
  const terrain = getTerrain();
  const pins = getPins();
  const site = getSite();
  return <Experience lines={lines} stations={stations} terrain={terrain} pins={pins} origin={site.origin} originLabel={site.originLabel} originCue={site.originCue} about={site.about} play={site.play} />;
}
