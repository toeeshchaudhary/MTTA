import type { Metadata } from 'next';

// The authoring editor is local-only (write routes are dev-gated) and read-only in
// production — no reason to index it. Keep it out of search + social.
export const metadata: Metadata = {
  title: 'studio',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
