// Auto-bridges — wherever a line's waypoint segment passes over a water feature
// (kind water/river, flagged `water` in terrain-kinds), we draw a little deck so the
// route visibly *crosses* the water instead of floating on top of it. Pure geometry:
// each segment is clipped to each water rect (Liang–Barsky); the inside portion gets a
// deck + side rails + planks, drawn under the line (the ribbon rides over the centre).
'use client';
import { memo } from 'react';
import { motion } from 'framer-motion';
import { RIBBON, type Pt } from '@/content/lines';
import { kindOf, type TerrainFeature } from './terrain-kinds';

type BLine = { id: string; color: string; pts?: Pt[]; under?: number[] };

type Seg = [number, number, number, number];

// Clip segment (x0,y0)->(x1,y1) to rect; returns the inside sub-segment or null.
function clipRect(x0: number, y0: number, x1: number, y1: number, xmin: number, ymin: number, xmax: number, ymax: number): Seg | null {
  let t0 = 0, t1 = 1;
  const dx = x1 - x0, dy = y1 - y0;
  const p = [-dx, dx, -dy, dy];
  const q = [x0 - xmin, xmax - x0, y0 - ymin, ymax - y0];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return null; continue; }
    const r = q[i] / p[i];
    if (p[i] < 0) { if (r > t1) return null; if (r > t0) t0 = r; }
    else { if (r < t0) return null; if (r < t1) t1 = r; }
  }
  if (t0 > t1) return null;
  return [x0 + t0 * dx, y0 + t0 * dy, x0 + t1 * dx, y0 + t1 * dy];
}

function pointInPoly(x: number, y: number, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// All inside sub-segments of (x0,y0)->(x1,y1) within a polygon (handles concave / multi-crossing).
function clipPoly(x0: number, y0: number, x1: number, y1: number, poly: Pt[]): Seg[] {
  const dx = x1 - x0, dy = y1 - y0;
  const ts = [0, 1];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j], [bx, by] = poly[i];
    const ex = bx - ax, ey = by - ay;
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((ax - x0) * ey - (ay - y0) * ex) / den;
    const u = ((ax - x0) * dy - (ay - y0) * dx) / den;
    if (t > 0 && t < 1 && u >= 0 && u <= 1) ts.push(t);
  }
  ts.sort((a, b) => a - b);
  const spans: Seg[] = [];
  for (let i = 0; i < ts.length - 1; i++) {
    const tm = (ts[i] + ts[i + 1]) / 2;
    if (pointInPoly(x0 + dx * tm, y0 + dy * tm, poly)) spans.push([x0 + dx * ts[i], y0 + dy * ts[i], x0 + dx * ts[i + 1], y0 + dy * ts[i + 1]]);
  }
  return spans;
}

type Span = { id: string; color: string; ax: number; ay: number; bx: number; by: number };

export default memo(function Bridges({ lines, terrain, started = true, startAt = 0, dur = 0.4 }: { lines: BLine[]; terrain: TerrainFeature[]; started?: boolean; startAt?: number; dur?: number }) {
  const water = terrain.filter((f) => kindOf(f).water);
  if (!water.length || !lines.length) return null;

  const spans: Span[] = [];
  for (const l of lines) {
    const pts: Pt[] = l.pts || [];
    for (let s = 0; s < pts.length - 1; s++) {
      if (l.under?.includes(s)) continue; // underground here → a tunnel, not a bridge
      const [x0, y0] = pts[s], [x1, y1] = pts[s + 1];
      for (const w of water) {
        // clip against the actual coastline polygon when present, else the bounding rect
        const segs = w.points && w.points.length >= 3
          ? clipPoly(x0, y0, x1, y1, w.points)
          : (() => { const c = clipRect(x0, y0, x1, y1, w.x, w.y, w.x + w.w, w.y + w.h); return c ? [c] : []; })();
        segs.forEach((c, si) => {
          if (Math.hypot(c[2] - c[0], c[3] - c[1]) < 10) return; // ignore a glancing touch
          spans.push({ id: `${l.id}-${w.id}-${s}-${si}`, color: l.color, ax: c[0], ay: c[1], bx: c[2], by: c[3] });
        });
      }
    }
  }
  if (!spans.length) return null;

  const HALF = RIBBON / 2 + 6; // deck half-width — the sleeper ends poke past the ribbon
  const EXT = 5;               // land the deck just onto each bank

  return (
    <g className="bridges" aria-hidden>
      {spans.map((sp) => {
        let { ax, ay, bx, by } = sp;
        const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
        const ux = dx / len, uy = dy / len;        // along the route
        const nx = -uy, ny = ux;                   // across the deck
        ax -= ux * EXT; ay -= uy * EXT; bx += ux * EXT; by += uy * EXT; // onto the banks
        const flen = len + EXT * 2;
        const n = Math.max(2, Math.round(flen / 17)); // a few bold sleepers, well spaced
        const tie = (t: number, w: number, col: string, over = 0) => {
          const px = ax + ux * flen * t, py = ay + uy * flen * t, h = HALF + over;
          return <line x1={px - nx * h} y1={py - ny * h} x2={px + nx * h} y2={py + ny * h} stroke={col} strokeWidth={w} strokeLinecap="round" />;
        };
        return (
          <motion.g key={sp.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: started ? 1 : 0 }}
            transition={{ delay: started ? startAt : 0, duration: dur, ease: 'easeOut' }}>
            {/* concrete deck band with a thin structural outline; the ribbon rides over its centre */}
            <line x1={ax} y1={ay} x2={bx} y2={by} stroke="var(--bridge-rail, rgba(43,80,106,0.55))" strokeWidth={(HALF + 1.5) * 2} strokeLinecap="round" />
            <line x1={ax} y1={ay} x2={bx} y2={by} stroke="var(--bridge-deck, #eef2f4)" strokeWidth={HALF * 2} strokeLinecap="round" />
            {/* cross-ties (sleepers) — the bridge read; ends poke past the ribbon on both sides */}
            {Array.from({ length: n + 1 }, (_, k) => <g key={k}>{tie(k / n, 2.4, 'var(--bridge-rail, rgba(43,80,106,0.55))')}</g>)}
            {/* heavy abutment caps where the deck meets each bank */}
            {tie(0, 4, 'var(--bridge-rail, rgba(43,80,106,0.55))', 1.5)}
            {tie(1, 4, 'var(--bridge-rail, rgba(43,80,106,0.55))', 1.5)}
          </motion.g>
        );
      })}
    </g>
  );
})
