import { ImageResponse } from 'next/og';

export const alt = 'toeesh.network — a portfolio drawn as a transit map';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// A subway-map flavoured share card: warm paper, four colored lines bending
// through a corner with station dots, and the wordmark.
export default function OG() {
  const lines = [
    { c: '#e3000b', y: 250 },
    { c: '#0d47a1', y: 300 },
    { c: '#ffcf00', y: 350 },
    { c: '#141414', y: 400 },
  ];
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#fcfcfb',
          padding: 64,
          fontFamily: 'sans-serif',
        }}
      >
        {/* the lines, drawn as bent ribbons via stacked bars */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex' }}>
          {lines.map((l, i) => (
            <div key={i} style={{ position: 'absolute', display: 'flex' }}>
              <div style={{ position: 'absolute', left: 820 + i * 26, top: 120, width: 26, height: l.y - 120 + 13, background: l.c, borderRadius: 13 }} />
              <div style={{ position: 'absolute', left: 820 + i * 26, top: l.y, width: 360 - i * 26, height: 26, background: l.c, borderRadius: 13 }} />
            </div>
          ))}
          {/* station dots on the trunk */}
          {[180, 300, 470].map((top, i) => (
            <div key={i} style={{ position: 'absolute', left: 820 - 9, top, width: 44, height: 44, borderRadius: 44, background: '#fff', border: '8px solid #141414' }} />
          ))}
        </div>

        <div style={{ display: 'flex' }}>
          <div style={{ fontSize: 30, letterSpacing: 6, textTransform: 'uppercase', color: '#5c5a52' }}>a map of a person</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', fontSize: 120, fontWeight: 800, letterSpacing: -4, color: '#141414' }}>
            toeesh<span style={{ color: '#6b6b72' }}>.network</span>
          </div>
          <div style={{ fontSize: 34, color: '#5c5a52', marginTop: 8 }}>
            artist · gamedev · ricer · curator · slowly living
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
