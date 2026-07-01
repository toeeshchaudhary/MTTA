// The canonical origin the site is served from. Auto-follows a Vercel-assigned
// production domain (incl. a future custom domain like toeesh.network) and falls
// back to the current vercel.app URL. Single source of truth for metadata, robots,
// sitemap, and OG image bases.
export const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : 'https://toeeshnetwork.vercel.app';
