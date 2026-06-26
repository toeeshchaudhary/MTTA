// Editable pinboard — reads/writes content/pins.json. Dev-only writes.
// Pins are the "stuff" tacked on the board: sticky notes & photos.
import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getPins } from '@/lib/content';

const FILE = path.join(process.cwd(), 'content', 'pins.json');
const isDev = process.env.NODE_ENV !== 'production';
const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : d);
const str = (v: unknown) => (v == null ? '' : String(v));

export async function GET() {
  return NextResponse.json({ pins: getPins() });
}

// POST: full replace of the pins array (admin sends the whole set)
export async function POST(req: Request) {
  if (!isDev) return NextResponse.json({ error: 'read-only in production' }, { status: 403 });
  const body = await req.json();
  const list = Array.isArray(body.pins) ? body.pins : null;
  if (!list) return NextResponse.json({ error: 'pins[] required' }, { status: 400 });
  const clean = list.map((p: Record<string, unknown>, i: number) => {
    const kind = String(p.kind) === 'photo' ? 'photo' : 'note';
    const out: Record<string, unknown> = {
      id: String(p.id || `p-${i}`),
      kind,
      x: num(p.x),
      y: num(p.y),
      w: Math.max(40, num(p.w, 210)),
      h: Math.max(40, num(p.h, 104)),
    };
    if (str(p.tag).trim()) out.tag = str(p.tag).trim();
    if (kind === 'note') {
      out.text = str(p.text);
    } else {
      if (str(p.src).trim()) out.src = str(p.src).trim();
      if (str(p.caption).trim()) out.caption = str(p.caption).trim();
    }
    return out;
  });
  await fs.writeFile(FILE, JSON.stringify(clean, null, 2) + '\n', 'utf8');
  return NextResponse.json({ ok: true, pins: clean });
}
