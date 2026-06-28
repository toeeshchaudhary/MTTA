import { ImageResponse } from 'next/og';

export const alt = 'toeesh.network — a portfolio drawn as a transit map';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// The share card mirrors the live map: a bright dot-grid canvas, a Mini-Metro water
// body, the three real network colours (red / blue / green) bending through a corner
// with station roundels — and the wordmark.
const RED = '#e3000b', BLUE = '#0d47a1', GREEN = '#1f8a4c', INK = '#141414', MUTED = '#9a9aa0';
const RIB = 22;

export default function OG() {
  // three nested L-bends, like the corners on the real map
  const lines = [
    { c: RED, x: 786, bend: 250 },
    { c: BLUE, x: 822, bend: 312 },
    { c: GREEN, x: 858, bend: 374 },
  ];
  // a faint dot grid across the whole card
  const COLS = 24, ROWS = 13, CW = size.width / COLS, CH = size.height / ROWS;
  const dots = Array.from({ length: COLS * ROWS });
  // a little green tunnel trail dipping into the water
  const trail = [0, 1, 2, 3, 4].map((i) => ({ x: 924 + i * 26, y: 408 + i * 16 }));

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#ffffff', fontFamily: 'sans-serif', overflow: 'hidden' }}>
        {/* dot grid */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexWrap: 'wrap' }}>
          {dots.map((_, i) => (
            <div key={i} style={{ width: CW, height: CH, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 4, height: 4, borderRadius: 4, background: '#e9eaf2' }} />
            </div>
          ))}
        </div>

        {/* Mini-Metro water body, bleeding off the bottom-right */}
        <div style={{ position: 'absolute', right: -90, bottom: -150, width: 580, height: 470, borderRadius: 9999, background: '#cce3f1', border: `3px solid #a7d2e6` }} />

        {/* the lines — nested bent ribbons */}
        {lines.map((l, i) => (
          <div key={i} style={{ position: 'absolute', inset: 0, display: 'flex' }}>
            <div style={{ position: 'absolute', left: l.x, top: 120, width: RIB, height: l.bend - 120 + RIB, background: l.c, borderRadius: RIB }} />
            <div style={{ position: 'absolute', left: l.x, top: l.bend, width: 1170 - l.x, height: RIB, background: l.c, borderRadius: RIB }} />
          </div>
        ))}

        {/* green tunnel trail into the water */}
        {trail.map((p, i) => (
          <div key={i} style={{ position: 'absolute', left: p.x, top: p.y, width: 8, height: 8, borderRadius: 8, background: GREEN, opacity: 0.5 }} />
        ))}

        {/* interchange roundel + a couple of station roundels */}
        <div style={{ position: 'absolute', left: 786, top: 150, width: 56, height: 56, borderRadius: 56, background: '#fff', border: `6px solid ${INK}`, display: 'flex' }} />
        <div style={{ position: 'absolute', left: 1024, top: 240, width: 44, height: 44, borderRadius: 44, background: '#fff', border: `7px solid ${RED}`, display: 'flex' }} />
        <div style={{ position: 'absolute', left: 1080, top: 302, width: 44, height: 44, borderRadius: 44, background: '#fff', border: `7px solid ${BLUE}`, display: 'flex' }} />

        {/* wordmark block */}
        <div style={{ position: 'absolute', left: 72, top: 0, bottom: 0, width: 660, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', fontSize: 26, letterSpacing: 8, textTransform: 'uppercase', color: '#8a8a95', fontFamily: 'monospace' }}>a wayfinding system</div>
          <div style={{ display: 'flex', alignItems: 'baseline', fontSize: 104, fontWeight: 800, letterSpacing: -4, color: INK, marginTop: 14 }}>
            toeesh<span style={{ color: MUTED }}>.network</span>
          </div>
          <div style={{ display: 'flex', fontSize: 27, color: '#6f6f78', marginTop: 18 }}>artist · gamedev · ricer · slowly living</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
