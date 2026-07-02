import { ImageResponse } from 'next/og';
import { getLines, getStations } from '@/lib/content';
import { ghost } from '@/content/lines';

export const alt = 'A stop on toeesh.network';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export function generateStaticParams() {
  return getStations().map((s) => ({ id: s.id }));
}

// Per-stop share card, styled as a transit boarding pass: a ticket with a colour band,
// the stop as the "destination", and a torn stub with the thread + wordmark.
export default async function StopOG({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const all = getStations();
  const s = all.find((x) => x.id === id);
  const lines = getLines();
  const line = lines.find((l) => l.id === s?.line);
  const color = line?.color || '#141414';
  // an abandoned thread prints an expired/void ticket: ghosted band, aged paper, a
  // rotated "service ended" stamp, and stub text that reads NO SERVICE.
  const dead = !!line?.abandoned;
  const closed = (line?.closed || '').trim();
  const band = dead ? ghost(color) : color;   // colour band + stub, desaturated when dead
  const paper = dead ? '#eceae2' : '#fcfcfb'; // ticket stock, faintly yellowed when retired
  const titleInk = dead ? '#54545c' : '#141414';
  const title = s?.title || 'toeesh.network';
  // the destination title fits a wide range of lengths — from a short name to a full quote.
  // scale the type down (and ease off the tight tracking) as it grows so it always fits + wraps cleanly.
  const tlen = title.length;
  const titleSize = tlen <= 12 ? 96 : tlen <= 18 ? 80 : tlen <= 26 ? 64 : tlen <= 38 ? 50 : tlen <= 56 ? 40 : tlen <= 80 ? 32 : 26;
  const titleSpacing = titleSize >= 70 ? -3 : titleSize >= 50 ? -1 : 0;
  const thread = (line?.label || 'the network').toUpperCase();
  const lineNo = String(Math.max(1, lines.findIndex((l) => l.id === s?.line) + 1)).padStart(2, '0');
  const per = String(all.filter((x) => x.line === s?.line).findIndex((x) => x.id === id) + 1).padStart(2, '0');
  const code = `${lineNo}·${per}`;

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#141414', padding: 56, fontFamily: 'sans-serif' }}>
        <div style={{ flex: 1, display: 'flex', background: paper, border: '4px solid #141414', boxShadow: '14px 14px 0 #000' }}>
          {/* main ticket */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {/* colour band — ghosted grey on a retired ticket */}
            <div style={{ height: 22, background: band }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '26px 44px 0' }}>
              <div style={{ display: 'flex', letterSpacing: 8, textTransform: 'uppercase', fontSize: 26, color: dead ? '#b56565' : '#5c5a52' }}>{dead ? 'not valid for travel' : 'boarding pass'}</div>
              <div style={{ display: 'flex', fontSize: 24, letterSpacing: 4, color: '#5c5a52', fontFamily: 'monospace' }}>{code}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, padding: '0 44px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 28, letterSpacing: 5, textTransform: 'uppercase', color: '#5c5a52' }}>
                <div style={{ width: 30, height: 30, borderRadius: 30, background: band, border: '5px solid #fff', boxShadow: '0 0 0 3px #141414' }} />
                {thread} line
              </div>
              <div style={{ display: 'flex', fontSize: 30, letterSpacing: 4, textTransform: 'uppercase', color: '#9a988f', marginTop: 28 }}>{dead ? 'former destination' : 'destination'}</div>
              <div style={{ display: 'flex', fontSize: titleSize, fontWeight: 800, letterSpacing: titleSpacing, color: titleInk, marginTop: 8, lineHeight: 1.05, maxWidth: 880 }}>{title}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 44px 34px', fontSize: 28 }}>
              <div style={{ display: 'flex', fontWeight: 800, color: '#141414' }}>toeesh<span style={{ color: '#6b6b72' }}>.network</span></div>
              <div style={{ display: 'flex', color: '#5c5a52', letterSpacing: 4, textTransform: 'uppercase', fontSize: 22 }}>{dead ? (closed || 'service ended') : (s?.date || 'slowly living')}</div>
            </div>
            {/* rotated rubber stamp — struck across a decommissioned ticket */}
            {dead && (
              <div style={{ position: 'absolute', top: 292, left: 70, display: 'flex', transform: 'rotate(-13deg)', border: '7px solid rgba(178,24,44,0.5)', color: 'rgba(178,24,44,0.55)', borderRadius: 12, padding: '8px 26px', fontSize: 76, fontWeight: 800, letterSpacing: 6, textTransform: 'uppercase' }}>service ended</div>
            )}
          </div>
          {/* torn stub */}
          <div style={{ width: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', borderLeft: '4px dashed #141414', background: band, padding: '30px 0' }}>
            <div style={{ display: 'flex', color: '#fff', fontSize: 22, letterSpacing: 6, textTransform: 'uppercase' }}>{dead ? 'no service' : 'admit one'}</div>
            <div style={{ display: 'flex', fontSize: 120, fontWeight: 800, color: '#fff' }}>{dead ? '×' : lineNo}</div>
            <div style={{ display: 'flex', fontFamily: 'monospace', fontSize: 24, color: '#fff', letterSpacing: 3 }}>{code}</div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
