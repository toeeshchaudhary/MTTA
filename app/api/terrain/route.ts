// Editable map terrain — reads/writes content/terrain.json. Dev-only writes.
import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getTerrain } from '@/lib/content';
import { bboxOf } from '@/components/map/terrain-shape';
import type { Pt } from '@/content/lines';

const FILE = path.join(process.cwd(), 'content', 'terrain.json');
const isDev = process.env.NODE_ENV !== 'production';
const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : d);

export async function GET() {
  return NextResponse.json({ terrain: getTerrain() });
}

// POST: full replace of the terrain array (admin sends the whole set)
export async function POST(req: Request) {
  if (!isDev) return NextResponse.json({ error: 'read-only in production' }, { status: 403 });
  const body = await req.json();
  const list = Array.isArray(body.terrain) ? body.terrain : null;
  if (!list) return NextResponse.json({ error: 'terrain[] required' }, { status: 400 });
  const clean = list.map((f: Record<string, unknown>, i: number) => {
    const kind = 'water'; // terrain is water-only now (Mini-Metro style)
    // sanitise the polygon (if any); the bbox is derived from it so it can never drift
    const pts: Pt[] = Array.isArray(f.points)
      ? (f.points as unknown[]).filter((p): p is [unknown, unknown] => Array.isArray(p) && p.length >= 2).map((p) => [num(p[0]), num(p[1])] as Pt)
      : [];
    const box = pts.length >= 3 ? bboxOf(pts) : { x: num(f.x), y: num(f.y), w: Math.max(8, num(f.w, 80)), h: Math.max(8, num(f.h, 80)) };
    const out: Record<string, unknown> = { id: String(f.id || `t-${i}`), kind, x: box.x, y: box.y, w: box.w, h: box.h };
    if (pts.length >= 3) out.points = pts;
    if (Number.isFinite(Number(f.round))) out.round = Math.max(0, Math.min(200, Math.round(Number(f.round))));
    if (f.label != null && String(f.label).trim()) out.label = String(f.label).trim();
    return out;
  });
  await fs.writeFile(FILE, JSON.stringify(clean, null, 2) + '\n', 'utf8');
  return NextResponse.json({ ok: true, terrain: clean });
}
