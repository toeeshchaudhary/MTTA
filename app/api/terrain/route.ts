// Editable map terrain — reads/writes content/terrain.json. Dev-only writes.
import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getTerrain } from '@/lib/content';
import { KIND_BY_ID } from '@/components/map/terrain-kinds';

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
    const kind = KIND_BY_ID[String(f.kind)] ? String(f.kind) : 'block';
    const out: Record<string, unknown> = {
      id: String(f.id || `t-${i}`),
      kind,
      x: num(f.x),
      y: num(f.y),
      w: Math.max(8, num(f.w, 80)),
      h: Math.max(8, num(f.h, 80)),
    };
    if (f.label != null && String(f.label).trim()) out.label = String(f.label).trim();
    return out;
  });
  await fs.writeFile(FILE, JSON.stringify(clean, null, 2) + '\n', 'utf8');
  return NextResponse.json({ ok: true, terrain: clean });
}
