import type { MetadataRoute } from 'next';

// Web app manifest — lets the site be "installed" to a home screen and gives
// Android/Chrome the name, colours, and icon. Icons resolve to app/icon.tsx.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'toeesh.network — a map of a person',
    short_name: 'toeesh',
    description: 'A portfolio drawn as a transit map. Slowly living.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f4f1e9',
    theme_color: '#ffffff',
    icons: [
      { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
