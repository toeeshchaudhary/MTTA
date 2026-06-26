/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standard Next server (not static export) so the local authoring admin's
  // file-writing API routes work. Deploy on Node/Vercel (or just author locally).
  images: { unoptimized: true },
};

export default nextConfig;
