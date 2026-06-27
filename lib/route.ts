// Tiny trip planner: a station graph (stops adjacent along each line, joints linking
// lines) + BFS for the fewest-stops route. Pure & client-safe (no node:fs).
import type { Line, Pt } from '@/content/lines';
import type { Station } from '@/lib/content';

// distance along a polyline to the foot of the perpendicular from (x,y) — to order
// a line's stops geographically rather than by array order (lines bend).
function arcPos(pts: Pt[] | undefined, x: number, y: number): number {
  if (!pts || pts.length < 2) return y;
  let cum = 0, best = Infinity, bestPos = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy || 1, len = Math.sqrt(len2);
    let t = ((x - ax) * dx + (y - ay) * dy) / len2; t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
    if (d < best) { best = d; bestPos = cum + t * len; }
    cum += len;
  }
  return bestPos;
}

const onLine = (s: Station, id: string) => (s.lines && s.lines.length ? s.lines : [s.line]).includes(id);

export type Trip = { stops: Station[]; lineSeq: string[]; changes: number; minutes: number };

export function planTrip(lines: Line[], stations: Station[], fromId: string, toId: string): Trip | null {
  if (!fromId || !toId || fromId === toId) return null;
  const byId = new Map(stations.map((s) => [s.id, s]));
  const adj = new Map<string, { to: string; line: string }[]>();
  const edge = (a: string, b: string, line: string) => { if (!adj.has(a)) adj.set(a, []); adj.get(a)!.push({ to: b, line }); };
  for (const l of lines) {
    const members = stations.filter((s) => onLine(s, l.id)).sort((a, b) => arcPos(l.pts, a.x, a.y) - arcPos(l.pts, b.x, b.y));
    for (let i = 0; i < members.length - 1; i++) { edge(members[i].id, members[i + 1].id, l.id); edge(members[i + 1].id, members[i].id, l.id); }
  }
  // BFS for the fewest-stops path
  const prev = new Map<string, string>(), prevLine = new Map<string, string>(), seen = new Set([fromId]);
  const q = [fromId];
  while (q.length) {
    const cur = q.shift()!;
    if (cur === toId) break;
    for (const e of adj.get(cur) || []) if (!seen.has(e.to)) { seen.add(e.to); prev.set(e.to, cur); prevLine.set(e.to, e.line); q.push(e.to); }
  }
  if (!seen.has(toId)) return null;
  const path: string[] = [], lineSeq: string[] = [];
  let n: string | undefined = toId;
  while (n !== undefined) { path.unshift(n); if (prevLine.has(n)) lineSeq.unshift(prevLine.get(n)!); n = prev.get(n); }
  let changes = 0;
  for (let i = 1; i < lineSeq.length; i++) if (lineSeq[i] !== lineSeq[i - 1]) changes++;
  const stops = path.map((id) => byId.get(id)!).filter(Boolean);
  const minutes = Math.max(1, (stops.length - 1) * 2 + changes * 4);
  return { stops, lineSeq, changes, minutes };
}
