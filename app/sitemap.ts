import type { MetadataRoute } from 'next';
import { getStations } from '@/lib/content';
import { SITE_URL } from '@/lib/site-url';

// The home map + one entry per stop page. Stops are the shareable/indexable surface.
export default function sitemap(): MetadataRoute.Sitemap {
  const stops = getStations().map((s) => ({
    url: `${SITE_URL}/s/${s.id}`,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));
  return [
    { url: SITE_URL, changeFrequency: 'weekly', priority: 1 },
    ...stops,
  ];
}
