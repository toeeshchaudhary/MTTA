import { ImageResponse } from 'next/og';
import { getLines, getStations } from '@/lib/content';

export const alt = 'A stop on toeesh.network';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export function generateStaticParams() {
  return getStations().map((s) => ({ id: s.id }));
}

// Per-stop share card: the thread's color as a band, the stop title big, wordmark.
export default async function StopOG({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = getStations().find((x) => x.id === id);
  const line = getLines().find((l) => l.id === s?.line);
  const color = line?.color || '#141414';
  const title = s?.title || 'toeesh.network';
  const thread = line?.label || 'the network';

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#fcfcfb', fontFamily: 'sans-serif', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 22, background: color }} />
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, padding: '0 80px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 30, letterSpacing: 4, textTransform: 'uppercase', color: '#5c5a52' }}>
            <div style={{ width: 34, height: 34, borderRadius: 34, background: color, border: '6px solid #fff', boxShadow: '0 0 0 3px #141414' }} />
            {thread}
          </div>
          <div style={{ display: 'flex', fontSize: 96, fontWeight: 800, letterSpacing: -3, color: '#141414', marginTop: 18, lineHeight: 1.05 }}>
            {title}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 80px 56px', fontSize: 30 }}>
          <div style={{ display: 'flex', fontWeight: 800, color: '#141414' }}>
            toeesh<span style={{ color: '#6b6b72' }}>.network</span>
          </div>
          <div style={{ display: 'flex', color: '#5c5a52', letterSpacing: 4, textTransform: 'uppercase', fontSize: 24 }}>a map of a person</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
