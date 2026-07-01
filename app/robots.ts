import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site-url';

// Allow crawling of the public map + stops; keep the local-only authoring editor
// out of the index (it's read-only in prod, but no reason to surface it).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api/'] },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
