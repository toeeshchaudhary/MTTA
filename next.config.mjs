/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standard Next server (not static export) so the local authoring admin's
  // file-writing API routes work. Deploy on Node/Vercel (or just author locally).
  images: { unoptimized: true },
  // Allow phones/other devices on the LAN + the MTTA Studio desktop app to load dev
  // assets (JS, HMR, fonts). Next 15+ blocks cross-origin dev resources by default →
  // blank page / broken hydration over the network or via a numeric-IP host.
  allowedDevOrigins: ['192.168.1.6', '127.0.0.1', 'localhost'],
};

export default nextConfig;
