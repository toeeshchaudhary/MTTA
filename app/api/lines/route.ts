// Editable threads (lines) — reads/writes content/lines.json. Dev-only writes.
import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getLines } from '@/lib/content';
import { roundedPath, type Pt } from '@/content/lines';

const FILE = path.join(process.cwd(), 'content', 'lines.json');
const isDev = process.env.NODE_ENV !== 'production';
const slug = (s: string) => s.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 40) || 'thread';

export async function GET() {
  return NextResponse.json({ lines: getLines() });
}

// POST: full replace of the lines array (admin sends the whole set)
export async function POST(req: Request) {
  if (!isDev) return NextResponse.json({ error: 'read-only in production' }, { status: 403 });
  const body = await req.json();
  const lines = Array.isArray(body.lines) ? body.lines : null;
  if (!lines) return NextResponse.json({ error: 'lines[] required' }, { status: 400 });
  const clean = lines.map((l: Record<string, unknown>) => {
    const pts = (Array.isArray(l.pts) ? l.pts : []) as Pt[];
    const under = Array.isArray(l.under)
      ? Array.from(new Set((l.under as unknown[]).map((n) => Math.round(Number(n))).filter((n) => Number.isInteger(n) && n >= 0 && n < pts.length - 1))).sort((a, b) => a - b)
      : [];
    return {
      id: slug(String(l.id || l.label || 'thread')),
      label: String(l.label || 'thread'),
      color: String(l.color || '#888'),
      text: String(l.text || '#fff'),
      shape: String(l.shape || 'circle'),
      blurb: String(l.blurb || ''),
      pts,
      ...(under.length ? { under } : {}),
      ...(l.abandoned ? { abandoned: true } : {}),
      ...(l.abandoned && String(l.closed || '').trim() ? { closed: String(l.closed).trim() } : {}),
      d: pts.length >= 2 ? roundedPath(pts) : String(l.d || ''),
    };
  });
  await fs.writeFile(FILE, JSON.stringify(clean, null, 2) + '\n', 'utf8');
  return NextResponse.json({ ok: true, lines: clean });
}
