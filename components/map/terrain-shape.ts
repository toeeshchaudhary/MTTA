// Geometry for terrain shapes — turns a feature's polygon (or its bounding rect, for
// back-compat) into an SVG path. Natural kinds get a smooth closed coastline (Catmull-Rom
// → cubic Bézier); built kinds (block/yard) stay a crisp closed polygon. Plain module
// (no 'use client') — shared by the public map, the admin builder, and the API.
import type { Pt } from '@/content/lines';
import { DEFAULT_ROUND, type TerrainFeature, type TerrainKindDef } from './terrain-kinds';

export function bboxOf(points: Pt[]): { x: number; y: number; w: number; h: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of points) { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: Math.round(minX), y: Math.round(minY), w: Math.round(maxX - minX), h: Math.round(maxY - minY) };
}

export function centroidOf(points: Pt[]): Pt {
  let sx = 0, sy = 0;
  for (const [x, y] of points) { sx += x; sy += y; }
  const n = points.length || 1;
  return [sx / n, sy / n];
}

// Scale a polygon toward its centroid — an approximate inset.
export function insetPoints(points: Pt[], k = 0.94): Pt[] {
  const [cx, cy] = centroidOf(points);
  return points.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
}

// Constant-width inward offset (miter join) — gives the Mini-Metro "current line" that runs a
// fixed distance inside the bank regardless of the body's size. Winding-aware.
export function offsetInward(points: Pt[], d: number): Pt[] {
  const n = points.length;
  if (n < 3) return points;
  let area = 0;
  for (let i = 0; i < n; i++) { const [x1, y1] = points[i], [x2, y2] = points[(i + 1) % n]; area += x1 * y2 - x2 * y1; }
  const ccw = area > 0; // (SVG y-down, but the sign is self-consistent for picking "inward")
  const norm = (dx: number, dy: number): Pt => { const l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
  const inward = (e: Pt): Pt => (ccw ? [-e[1], e[0]] : [e[1], -e[0]]);
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n], cur = points[i], next = points[(i + 1) % n];
    const n1 = inward(norm(cur[0] - prev[0], cur[1] - prev[1]));
    const n2 = inward(norm(next[0] - cur[0], next[1] - cur[1]));
    let bx = n1[0] + n2[0], by = n1[1] + n2[1];
    const [ux, uy] = norm(bx, by);
    const cos = Math.max(0.35, ux * n1[0] + uy * n1[1]); // clamp miter so sharp corners don't spike
    out.push([cur[0] + ux * (d / cos), cur[1] + uy * (d / cos)]);
  }
  return out;
}

const f1 = (n: number) => Math.round(n * 10) / 10;

// Closed Catmull-Rom spline → cubic Bézier. Smooth, organic, passes through every point.
export function smoothClosedPath(points: Pt[]): string {
  const n = points.length;
  if (n < 3) return polyPath(points);
  const p = (i: number) => points[((i % n) + n) % n];
  let d = `M${f1(p(0)[0])},${f1(p(0)[1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = p(i - 1), p1 = p(i), p2 = p(i + 1), p3 = p(i + 2);
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${f1(c1x)},${f1(c1y)} ${f1(c2x)},${f1(c2y)} ${f1(p2[0])},${f1(p2[1])}`;
  }
  return d + 'Z';
}

// Crisp closed polygon (built kinds).
export function polyPath(points: Pt[]): string {
  if (!points.length) return '';
  return 'M' + points.map(([x, y]) => `${f1(x)},${f1(y)}`).join(' L') + 'Z';
}

// Rigid polygon with rounded corners: straight edges, each corner filleted by a quadratic curve.
// radius 0 → a sharp polygon; larger → rounder. The radius is clamped per-corner to half of the
// shorter adjacent edge, so the fillets never overrun the edge or self-overlap.
export function roundedPolyPath(points: Pt[], radius: number): string {
  const n = points.length;
  if (n < 3) return polyPath(points);
  if (radius <= 0.5) return polyPath(points);
  let d = '';
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n], p1 = points[i], p2 = points[(i + 1) % n];
    const ax = p0[0] - p1[0], ay = p0[1] - p1[1];
    const bx = p2[0] - p1[0], by = p2[1] - p1[1];
    const la = Math.hypot(ax, ay) || 1, lb = Math.hypot(bx, by) || 1;
    const r = Math.min(radius, la / 2, lb / 2);
    const c1: Pt = [p1[0] + (ax / la) * r, p1[1] + (ay / la) * r]; // back along the incoming edge
    const c2: Pt = [p1[0] + (bx / lb) * r, p1[1] + (by / lb) * r]; // forward along the outgoing edge
    d += i === 0 ? `M${f1(c1[0])},${f1(c1[1])}` : ` L${f1(c1[0])},${f1(c1[1])}`;
    d += ` Q${f1(p1[0])},${f1(p1[1])} ${f1(c2[0])},${f1(c2[1])}`;
  }
  return d + ' Z';
}

function roundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  return `M${x + rr},${y} H${x + w - rr} A${rr},${rr} 0 0 1 ${x + w},${y + rr} V${y + h - rr} A${rr},${rr} 0 0 1 ${x + w - rr},${y + h} H${x + rr} A${rr},${rr} 0 0 1 ${x},${y + h - rr} V${y + rr} A${rr},${rr} 0 0 1 ${x + rr},${y} Z`;
}

// Path for a bare point list, honouring the kind's smoothing (used for the admin draft preview).
export function pathForPoints(points: Pt[], kind: TerrainKindDef): string {
  if (points.length < 3) return points.length ? 'M' + points.map(([x, y]) => `${f1(x)},${f1(y)}`).join(' L') : '';
  return kind.smooth ? smoothClosedPath(points) : polyPath(points);
}

// The drawable outline for a feature: a rigid polygon with rounded corners (per-feature `round`).
// Falls back to its bounding rectangle when it has no polygon.
export function terrainPath(f: TerrainFeature, kind: TerrainKindDef): string {
  if (f.points && f.points.length >= 3) return roundedPolyPath(f.points, f.round ?? DEFAULT_ROUND);
  return roundedRectPath(f.x, f.y, f.w, f.h, kind.round);
}
