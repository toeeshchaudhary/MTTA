/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standard Next server (not static export) so the local authoring admin's
  // file-writing API routes work. Deploy on Node/Vercel (or just author locally).
  images: { unoptimized: true },
  poweredByHeader: false,
  compress: true,
  reactStrictMode: true,
  // Tree-shake the barrel exports of these libraries — pulls in only the icons/
  // helpers each import actually uses instead of the whole package. Framer-motion
  // in particular can shave ~40-60 KB off the initial bundle here.
  experimental: {
    optimizePackageImports: ['framer-motion', 'react-markdown', 'remark-gfm'],
  },
  // Allow phones/other devices on the LAN + the MTTA Studio desktop app to load dev
  // assets (JS, HMR, fonts). Next 15+ blocks cross-origin dev resources by default →
  // blank page / broken hydration over the network or via a numeric-IP host.
  allowedDevOrigins: ['192.168.1.6', '127.0.0.1', 'localhost'],
  // Baseline security headers on every response, plus a belt-and-suspenders
  // noindex on the editor + API (robots.ts already disallows them from crawling).
  async headers() {
    const secure = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
    ];
    // fingerprinted or otherwise-immutable static assets — cache aggressively at the edge.
    const immutable = [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }];
    return [
      { source: '/:path*', headers: secure },
      { source: '/admin', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
      { source: '/api/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] },
      { source: '/fonts/:path*', headers: immutable },
      { source: '/media/:path*', headers: immutable },
      { source: '/_next/static/:path*', headers: immutable },
    ];
  },
};

export default nextConfig;
