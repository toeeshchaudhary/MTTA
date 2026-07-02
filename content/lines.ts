// The themed "lines" of toeesh's mind. Each thread is now POINT-BASED: a list of
// waypoints (`pts`); the SVG path `d` is generated from them with rounded corners,
// so the admin can re-route a line by dragging its nodes.

export type Shape = 'circle' | 'square' | 'triangle' | 'semi';
export type Pt = [number, number];

export type Line = {
  id: string;
  label: string;
  color: string;
  text: string;
  shape: Shape;
  blurb: string;
  pts: Pt[]; // waypoints (source of truth)
  under?: number[]; // indices of segments that run underground (tunnels); segment i = pts[i]→pts[i+1]
  d?: string; // derived; filled by lineD()/getLines()
  abandoned?: boolean; // a disused thread — ghosted + dashed ribbon, no train, boarded-up stops
  closed?: string; // optional "service ended '24"-style tag shown at the dead end
};

// Desaturate a hex colour toward its own grey (luma) — used to "ghost" abandoned
// threads so they read as drained/disused without losing every trace of their hue.
export function ghost(hex: string, amt = 0.72): string {
  const h = (hex || '').replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return '#8a8a90';
  const l = 0.299 * r + 0.587 * g + 0.114 * b; // perceived brightness
  const to = (c: number) => Math.max(0, Math.min(255, Math.round(c + (l - c) * amt))).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

export const BASE_W = 1400;
export const BASE_H = 940;
export const BASE_VIEWBOX = `0 0 ${BASE_W} ${BASE_H}`;
export const MAP_VIEWBOX = BASE_VIEWBOX; // legacy alias — kept for existing imports
export const RIBBON = 13; // rail weight — thin, so parallel routes read as a clean diagram
export const CORNER_R = 22; // tighter, proportional corners

// Bounding box of everything drawn (line waypoints + stations + terrain), padded.
// Used to auto-fit the public map's viewBox so there's no fixed cut-off rectangle.
// Falls back to the seed BASE_VIEWBOX when there's nothing to frame.
type XY = { x: number; y: number };
type WH = XY & { w: number; h: number };
export function contentBounds(
  lines: { pts?: Pt[] }[] = [],
  stations: XY[] = [],
  terrain: WH[] = [],
  pad = 120,
): { x: number; y: number; w: number; h: number; viewBox: string } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const eat = (x: number, y: number) => { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; };
  for (const l of lines) for (const p of l.pts ?? []) eat(p[0], p[1]);
  // stations carry labels/tablets that bleed outward — inflate generously
  for (const s of stations) { eat(s.x - 60, s.y - 60); eat(s.x + 60, s.y + 60); }
  for (const t of terrain) { eat(t.x, t.y); eat(t.x + t.w, t.y + t.h); }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: BASE_W, h: BASE_H, viewBox: BASE_VIEWBOX };
  const x = Math.round(minX - pad), y = Math.round(minY - pad);
  const w = Math.max(BASE_W, Math.round(maxX + pad) - x), h = Math.max(BASE_H, Math.round(maxY + pad) - y);
  return { x, y, w, h, viewBox: `${x} ${y} ${w} ${h}` };
}

// Tunnels: contiguous runs of underground segment indices → [startSeg, endSeg] inclusive.
export function tunnelRuns(under?: number[]): [number, number][] {
  if (!under?.length) return [];
  const s = Array.from(new Set(under)).sort((a, b) => a - b);
  const runs: [number, number][] = []; let a = s[0], p = s[0];
  for (let i = 1; i < s.length; i++) { if (s[i] === p + 1) p = s[i]; else { runs.push([a, p]); a = p = s[i]; } }
  runs.push([a, p]); return runs;
}
// the waypoints a run covers: segments a..e use points[a .. e+1].
export const runPts = (pts: Pt[], run: [number, number]): Pt[] => pts.slice(run[0], run[1] + 2);

// Build a rounded-corner SVG path from waypoints (fillet each interior vertex
// with a quadratic curve, radius clamped to half the shorter adjacent segment).
export function roundedPath(pts: Pt[], r = CORNER_R): string {
  if (!pts.length) return '';
  if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`;
  if (pts.length === 2) return `M${pts[0][0]},${pts[0][1]} L${pts[1][0]},${pts[1][1]}`;
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i - 1], c = pts[i], n = pts[i + 1];
    const v1x = p[0] - c[0], v1y = p[1] - c[1];
    const v2x = n[0] - c[0], v2y = n[1] - c[1];
    const l1 = Math.hypot(v1x, v1y) || 1, l2 = Math.hypot(v2x, v2y) || 1;
    const r1 = Math.min(r, l1 / 2), r2 = Math.min(r, l2 / 2);
    const ax = c[0] + (v1x / l1) * r1, ay = c[1] + (v1y / l1) * r1;
    const bx = c[0] + (v2x / l2) * r2, by = c[1] + (v2y / l2) * r2;
    d += ` L${ax.toFixed(1)},${ay.toFixed(1)} Q${c[0]},${c[1]} ${bx.toFixed(1)},${by.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L${last[0]},${last[1]}`;
  return d;
}

export const lineD = (l: Line): string => (l.pts && l.pts.length >= 2 ? roundedPath(l.pts) : l.d || '');

// A single central trunk line — a vertical spine down the middle of the board.
// Build outward from here; add lines back and make joint stations where they cross.
const CENTRAL_PTS: Pt[] = [[700, 120], [700, 820]];

const SEED: Omit<Line, 'd'>[] = [
  { id: 'central', label: 'central', color: '#7c6aa6', text: '#fff', shape: 'circle', blurb: 'the spine', pts: CENTRAL_PTS },
];
export const LINES: Line[] = SEED.map((l) => ({ ...l, d: roundedPath(l.pts) }));

export const LINE_BY_ID: Record<string, Line> = Object.fromEntries(LINES.map((l) => [l.id, l]));
