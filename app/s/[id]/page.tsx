import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLines, getStations, getTerrain, getPins, getSite } from '@/lib/content';
import Experience from '@/components/Experience';

export function generateStaticParams() {
  return getStations().map((s) => ({ id: s.id }));
}

const excerpt = (body: string) =>
  body.replace(/[#*_`>[\]]/g, '').replace(/\(https?:[^)]*\)/g, '').replace(/\s+/g, ' ').trim().slice(0, 155) || 'A stop on the map of toeesh.';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const s = getStations().find((x) => x.id === id);
  if (!s) return { title: 'toeesh.network' };
  const title = `${s.title} — toeesh.network`;
  const description = excerpt(s.body);
  return {
    title,
    description,
    openGraph: { title, description, url: `/s/${id}`, type: 'article' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function StopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stations = getStations();
  if (!stations.find((s) => s.id === id)) notFound();
  const site = getSite();
  return <Experience lines={getLines()} stations={stations} terrain={getTerrain()} pins={getPins()} origin={site.origin} originLabel={site.originLabel} originCue={site.originCue} about={site.about} play={site.play} initialStop={id} />;
}
