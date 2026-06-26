// Pure geometry helpers for the map editor — no React, no DOM state.
import type { Pt } from '@/content/lines';
import type { Rect } from '@/components/admin/types';
import { GRID } from './constants';

export const snap = (v: number) => Math.round(v / GRID) * GRID;

export const isLight = (hex: string) => {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
};

export const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

// client (screen) coords → SVG/map coords; snaps to the grid unless raw.
export function clientToSvg(svg: SVGSVGElement, cx: number, cy: number, doSnap = true): Pt {
  const p = svg.createSVGPoint();
  p.x = cx; p.y = cy;
  const r = p.matrixTransform(svg.getScreenCTM()!.inverse());
  return doSnap ? [snap(r.x), snap(r.y)] : [r.x, r.y];
}

// shortest distance from a point to a polyline (detects line overlaps for joint stops)
export function distToPolyline(x: number, y: number, pts: Pt[]): number {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy || 1;
    let t = ((x - ax) * dx + (y - ay) * dy) / len2; t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)));
  }
  return best;
}

// nearest point ON a polyline to (x,y) — locks stop placement onto a thread (snapped)
export function projectOnLine(pts: Pt[], x: number, y: number): Pt {
  let best = Infinity, bx = x, by = y;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [cx2, cy2] = pts[i + 1];
    const dx = cx2 - ax, dy = cy2 - ay, len2 = dx * dx + dy * dy || 1;
    let t = ((x - ax) * dx + (y - ay) * dy) / len2; t = Math.max(0, Math.min(1, t));
    const px = ax + t * dx, py = ay + t * dy, d = Math.hypot(x - px, y - py);
    if (d < best) { best = d; bx = px; by = py; }
  }
  return [snap(bx), snap(by)];
}

// track-laying axis lock: snap a new segment to horizontal / vertical / 45° off `last`
export function snapTrack(last: Pt | undefined, cur: Pt): Pt {
  if (!last) return cur;
  let dx = cur[0] - last[0], dy = cur[1] - last[1];
  const adx = Math.abs(dx), ady = Math.abs(dy);
  if (adx > ady * 2) dy = 0;
  else if (ady > adx * 2) dx = 0;
  else { const m = Math.min(adx, ady); dx = Math.sign(dx) * m; dy = Math.sign(dy) * m; }
  return [snap(last[0] + dx), snap(last[1] + dy)];
}

// when dragging a node, snap onto a neighbour's axis if within one grid step
export function neighborMagnet(pt: Pt, neighbors: (Pt | undefined)[], grid = GRID): Pt {
  let [x, y] = pt;
  for (const nb of neighbors) { if (!nb) continue; if (Math.abs(x - nb[0]) <= grid) x = nb[0]; if (Math.abs(y - nb[1]) <= grid) y = nb[1]; }
  return [x, y];
}

// resize a rect by dragging one corner (0=tl 1=tr 2=br 3=bl) to point `pt`
export function resizeRect(rect: Rect, corner: number, pt: Pt, min = GRID): Rect {
  const [x, y] = pt, x2 = rect.x + rect.w, y2 = rect.y + rect.h;
  let nx = rect.x, ny = rect.y, nx2 = x2, ny2 = y2;
  if (corner === 0) { nx = x; ny = y; } else if (corner === 1) { nx2 = x; ny = y; } else if (corner === 2) { nx2 = x; ny2 = y; } else { nx = x; ny2 = y; }
  return { x: Math.min(nx, nx2), y: Math.min(ny, ny2), w: Math.max(min, Math.abs(nx2 - nx)), h: Math.max(min, Math.abs(ny2 - ny)) };
}
