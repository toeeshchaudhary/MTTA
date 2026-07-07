// Pure geometry helpers for the map editor — no React, no DOM state.
import type { Pt } from '@/content/lines';
import type { Ln, Rect, St } from '@/components/admin/types';
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

// arc-length position of (x,y) projected onto a polyline (used to order stops along a line)
export function arcAt(pts: Pt[], x: number, y: number): number {
  let best = Infinity, bestArc = 0, acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy || 1, seg = Math.hypot(dx, dy);
    let t = ((x - ax) * dx + (y - ay) * dy) / len2; t = Math.max(0, Math.min(1, t));
    const px = ax + t * dx, py = ay + t * dy, dd = (x - px) ** 2 + (y - py) ** 2;
    if (dd < best) { best = dd; bestArc = acc + seg * t; }
    acc += seg;
  }
  return bestArc;
}

// the sub-polyline between two arc-lengths (used to shrink a line back to a remaining stop)
export function sliceByArc(pts: Pt[], a0: number, a1: number): Pt[] {
  const cum: number[] = [0]; let total = 0;
  for (let i = 0; i < pts.length - 1; i++) { total += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); cum.push(total); }
  a0 = Math.max(0, Math.min(total, a0)); a1 = Math.max(0, Math.min(total, a1));
  if (a1 < a0) { const t = a0; a0 = a1; a1 = t; }
  const at = (d: number): Pt => {
    for (let i = 0; i < pts.length - 1; i++) { if (cum[i + 1] >= d) { const seg = cum[i + 1] - cum[i] || 1, t = (d - cum[i]) / seg; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t]; } }
    return pts[pts.length - 1];
  };
  const out: Pt[] = [at(a0)];
  for (let i = 0; i < pts.length; i++) if (cum[i] > a0 + 0.5 && cum[i] < a1 - 0.5) out.push(pts[i]);
  out.push(at(a1));
  return out;
}

// resize a rect by dragging one corner (0=tl 1=tr 2=br 3=bl) to point `pt`
export function resizeRect(rect: Rect, corner: number, pt: Pt, min = GRID): Rect {
  const [x, y] = pt, x2 = rect.x + rect.w, y2 = rect.y + rect.h;
  let nx = rect.x, ny = rect.y, nx2 = x2, ny2 = y2;
  if (corner === 0) { nx = x; ny = y; } else if (corner === 1) { nx2 = x; ny = y; } else if (corner === 2) { nx2 = x; ny2 = y; } else { nx = x; ny2 = y; }
  return { x: Math.min(nx, nx2), y: Math.min(ny, ny2), w: Math.max(min, Math.abs(nx2 - nx)), h: Math.max(min, Math.abs(ny2 - ny)) };
}

export type LineAnchor = { lineId: string; pointIndex: number };

// Find every route waypoint that is exactly anchored to a station's current
// position. This keeps station drags predictable: only explicit graph nodes move.
export function lineAnchorsForStation(lines: Ln[], station: St, epsilon = 4): LineAnchor[] {
  const out: LineAnchor[] = [];
  for (const line of lines) {
    const pts = line.pts ?? [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (Math.hypot(p[0] - station.x, p[1] - station.y) <= epsilon) {
        out.push({ lineId: line.id, pointIndex: i });
      }
    }
  }
  return out;
}

function stationRouteIds(station: St): Set<string> {
  const ids = station.lines && station.lines.length ? station.lines : [station.line];
  return new Set(ids.filter(Boolean));
}

function nearestSegment(pts: Pt[], x: number, y: number): { segmentIndex: number; dist: number } | null {
  let best: { segmentIndex: number; dist: number } | null = null;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy || 1;
    let t = ((x - ax) * dx + (y - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = ax + t * dx, py = ay + t * dy;
    const dist = Math.hypot(x - px, y - py);
    if (!best || dist < best.dist) best = { segmentIndex: i, dist };
  }
  return best;
}

function splitUnderSegment(under: number[] | undefined, segmentIndex: number): number[] | undefined {
  if (!under?.length) return under;
  const next = new Set<number>();
  for (const i of under) {
    if (i < segmentIndex) next.add(i);
    else if (i > segmentIndex) next.add(i + 1);
    else { next.add(i); next.add(i + 1); }
  }
  return Array.from(next).sort((a, b) => a - b);
}

// Mini-Metro-style station anchoring: if a station belongs to a line but is only
// sitting on a segment, promote it into an actual route waypoint before dragging.
export function attachStationToLineAnchors(
  lines: Ln[],
  station: St,
  epsilon = 4,
  segmentEpsilon = 30,
): { lines: Ln[]; anchors: LineAnchor[] } {
  const routeIds = stationRouteIds(station);
  const anchors: LineAnchor[] = [];
  let nextLines = lines;

  for (const line of lines) {
    if (!routeIds.has(line.id) || !line.pts || line.pts.length < 2) continue;

    const exact: LineAnchor[] = [];
    line.pts.forEach((p, i) => {
      if (Math.hypot(p[0] - station.x, p[1] - station.y) <= epsilon) {
        exact.push({ lineId: line.id, pointIndex: i });
      }
    });
    if (exact.length) {
      anchors.push(...exact);
      continue;
    }

    const hit = nearestSegment(line.pts, station.x, station.y);
    if (!hit || hit.dist > segmentEpsilon) continue;

    const pointIndex = hit.segmentIndex + 1;
    const pts = [
      ...line.pts.slice(0, pointIndex),
      [station.x, station.y] as Pt,
      ...line.pts.slice(pointIndex),
    ];
    const under = splitUnderSegment(line.under, hit.segmentIndex);
    nextLines = nextLines.map((l) => (l.id === line.id ? { ...l, pts, under } : l));
    anchors.push({ lineId: line.id, pointIndex });
  }

  return { lines: nextLines, anchors };
}
