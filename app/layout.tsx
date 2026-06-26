import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://toeesh.network'),
  title: 'toeesh.network — a map of a person',
  description: 'Toeesh Chaudhary — a Delhi student-artist who builds games & software, rices linux desktops, and curates a visual world. A portfolio drawn as a transit map. Slowly living.',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'toeesh.network — a map of a person',
    description: 'A portfolio drawn as a transit map. Linux desktops, websites, and small obsessions.',
    url: 'https://toeesh.network',
    siteName: 'toeesh.network',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'toeesh.network — a map of a person',
    description: 'A portfolio drawn as a transit map.',
  },
};

export const viewport: Viewport = {
  themeColor: '#fcfcfb',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
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
