// Build-time content loader: station markdown + the (now editable) lines JSON.
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { LINES as SEED_LINES, lineD, type Line, type Shape } from '@/content/lines';
import type { TerrainFeature } from '@/components/map/terrain-kinds';

export type Media = { type: 'audio' | 'image' | 'video'; src: string; caption?: string };

export type Station = {
  id: string;
  title: string;
  line: string;          // primary thread — drives colour & default shape
  lines: string[];       // every thread this stop sits on (>=2 ⇒ interchange/joint)
  colors: string[];      // resolved colour per entry in `lines`
  color: string;         // primary colour (= colors[0])
  date?: string;
  shape: Shape;
  x: number;
  y: number;
  media: Media[];
  body: string;
};

const STATION_DIR = path.join(process.cwd(), 'content', 'stations');
const LINES_FILE = path.join(process.cwd(), 'content', 'lines.json');
const TERRAIN_FILE = path.join(process.cwd(), 'content', 'terrain.json');
const PINS_FILE = path.join(process.cwd(), 'content', 'pins.json');
const SITE_FILE = path.join(process.cwd(), 'content', 'site.json');

export type Site = { origin: [number, number] };
const DEFAULT_ORIGIN: [number, number] = [700, 96];

export function getSite(): Site {
  try {
    const raw = JSON.parse(fs.readFileSync(SITE_FILE, 'utf8'));
    if (Array.isArray(raw?.origin) && raw.origin.length === 2) return { origin: [Number(raw.origin[0]), Number(raw.origin[1])] };
  } catch {}
  return { origin: DEFAULT_ORIGIN };
}

// distance ALONG a polyline to the foot of the perpendicular from (x,y) — used to
// order stops by their position on the route rather than by raw y (lines bend now).
function arcPos(pts: [number, number][] | undefined, x: number, y: number): number {
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

export function getTerrain(): TerrainFeature[] {
  try {
    const raw = fs.readFileSync(TERRAIN_FILE, 'utf8');
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr as TerrainFeature[];
  } catch {}
  return [];
}

// Pinned "stuff" on the board — photos, notes, scraps. The moodboard layer.
export type Pin = {
  id: string;
  kind: 'note' | 'photo';
  x: number; y: number; w: number; h: number;
  tag?: string; // mono category label, design-system style
  text?: string;
  src?: string;
  caption?: string;
};

export function getPins(): Pin[] {
  try {
    const raw = fs.readFileSync(PINS_FILE, 'utf8');
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr as Pin[];
  } catch {}
  return [];
}

export function getLines(): Line[] {
  try {
    const raw = fs.readFileSync(LINES_FILE, 'utf8');
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.length) return (arr as Line[]).map((l) => ({ ...l, d: lineD(l) }));
  } catch {}
  return SEED_LINES;
}

export function getStations(): Station[] {
  const allLines = getLines();
  const colorOf = Object.fromEntries(allLines.map((l) => [l.id, l.color]));
  const ptsOf = Object.fromEntries(allLines.map((l) => [l.id, l.pts]));
  const files = fs.existsSync(STATION_DIR) ? fs.readdirSync(STATION_DIR).filter((f) => f.endsWith('.md')) : [];
  const stations = files.map((file) => {
    const raw = fs.readFileSync(path.join(STATION_DIR, file), 'utf8');
    const { data, content } = matter(raw);
    const line = String(data.line);
    // `lines` is the source of truth for joint stations; fall back to the single `line`.
    const rawLines = Array.isArray(data.lines) && data.lines.length ? data.lines.map(String) : [line];
    const lines = Array.from(new Set([line, ...rawLines])); // primary first, deduped
    const colors = lines.map((id) => colorOf[id] ?? '#888');
    return {
      id: file.replace(/\.md$/, ''),
      title: String(data.title ?? file),
      line,
      lines,
      colors,
      color: colors[0] ?? '#888',
      date: data.date ? String(data.date) : undefined,
      shape: (data.shape as Shape) ?? 'circle',
      x: Number(data.x ?? 0),
      y: Number(data.y ?? 0),
      media: (Array.isArray(data.media) ? data.media : []) as Media[],
      body: content.trim(),
    } satisfies Station;
  });
  return stations.sort((a, b) => a.line.localeCompare(b.line) || arcPos(ptsOf[a.line], a.x, a.y) - arcPos(ptsOf[b.line], b.x, b.y));
}
