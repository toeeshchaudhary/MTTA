import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SITE_URL } from '@/lib/site-url';

const OG = { url: '/opengraph-image', width: 1200, height: 630, alt: 'toeesh.network — a map of a person' };

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'toeesh.network — a map of a person',
    template: '%s — toeesh.network',
  },
  description: 'Toeesh Chaudhary — a Delhi student-artist who builds games & software, rices linux desktops, and curates a visual world. A portfolio drawn as a transit map. Slowly living.',
  applicationName: 'toeesh.network',
  authors: [{ name: 'Toeesh Chaudhary' }],
  creator: 'Toeesh Chaudhary',
  keywords: ['toeesh', 'Toeesh Chaudhary', 'portfolio', 'transit map', 'games', 'software', 'linux rice', 'creative developer'],
  alternates: { canonical: '/' },
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }, { url: '/icon', type: 'image/png', sizes: '512x512' }],
    apple: [{ url: '/apple-icon' }],
  },
  manifest: '/manifest.webmanifest',
  openGraph: {
    title: 'toeesh.network — a map of a person',
    description: 'A portfolio drawn as a transit map. Linux desktops, websites, and small obsessions.',
    url: SITE_URL,
    siteName: 'toeesh.network',
    type: 'website',
    images: [OG],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'toeesh.network — a map of a person',
    description: 'A portfolio drawn as a transit map.',
    images: [OG],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#2b2a2f' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* preload the variable display font so the wordmark + titles paint without a swap flash */}
        <link rel="preload" href="/fonts/RMNeueVF-Regular.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
        {/* set theme before paint to avoid a flash (default = whiteboard) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(()=>{try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
