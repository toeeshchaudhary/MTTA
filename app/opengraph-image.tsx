import { ImageResponse } from 'next/og';
import { getLines, getStations } from '@/lib/content';

export const alt = 'toeesh.network — a portfolio drawn as a transit map';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Home share card — sibling to the per-stop boarding pass, but a whole-network "system pass":
// all the line colours on the band + bullets, the wordmark as the destination, an aperture stub.
export default function OG() {
  const lines = getLines();
  const stops = getStations().length;
  const cols = lines.length ? lines.map((l) => l.color) : ['#e3000b', '#0d47a1', '#1f8a4c'];
  const code = `${String(lines.length).padStart(2, '0')} LINES · ${String(stops).padStart(2, '0')} STOPS`;

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#141414', padding: 56, fontFamily: 'sans-serif' }}>
        <div style={{ flex: 1, display: 'flex', background: '#fcfcfb', border: '4px solid #141414', boxShadow: '14px 14px 0 #000' }}>
          {/* main ticket */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {/* every line's colour, as one band */}
            <div style={{ display: 'flex', height: 22 }}>
              {cols.map((c, i) => <div key={i} style={{ flex: 1, background: c }} />)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '26px 46px 0' }}>
              <div style={{ display: 'flex', letterSpacing: 8, textTransform: 'uppercase', fontSize: 26, color: '#5c5a52' }}>system pass</div>
              <div style={{ display: 'flex', fontSize: 23, letterSpacing: 4, color: '#5c5a52', fontFamily: 'monospace' }}>{code}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, padding: '0 46px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 28, letterSpacing: 5, textTransform: 'uppercase', color: '#5c5a52' }}>
                {cols.map((c, i) => <div key={i} style={{ width: 26, height: 26, borderRadius: 26, background: c, border: '4px solid #fff', boxShadow: '0 0 0 3px #141414' }} />)}
                <span style={{ marginLeft: 6 }}>all lines</span>
              </div>
              <div style={{ display: 'flex', fontSize: 30, letterSpacing: 4, textTransform: 'uppercase', color: '#9a988f', marginTop: 26 }}>a wayfinding system</div>
              <div style={{ display: 'flex', alignItems: 'baseline', fontSize: 96, fontWeight: 800, letterSpacing: -4, color: '#141414', marginTop: 4 }}>
                toeesh<span style={{ color: '#9a9aa0' }}>.network</span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 46px 34px', fontSize: 26 }}>
              <div style={{ display: 'flex', color: '#5c5a52' }}>artist · gamedev · ricer · curator</div>
              <div style={{ display: 'flex', color: '#5c5a52', letterSpacing: 4, textTransform: 'uppercase', fontSize: 22 }}>slowly living</div>
            </div>
          </div>
          {/* torn stub — the network's origin aperture */}
          <div style={{ width: 224, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', borderLeft: '4px dashed #141414', background: '#141414', padding: '32px 0' }}>
            <div style={{ display: 'flex', color: '#fff', fontSize: 22, letterSpacing: 6, textTransform: 'uppercase' }}>admit one</div>
            <div style={{ display: 'flex', width: 118, height: 118, borderRadius: 118, border: '18px solid #fff' }} />
            <div style={{ display: 'flex', fontFamily: 'monospace', fontSize: 24, color: '#fff', letterSpacing: 4 }}>MTTA</div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
