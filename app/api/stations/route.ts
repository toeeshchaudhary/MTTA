// Local authoring API — reads/writes station markdown files.
// Dev-only by design: blocked in production so a deployed site stays read-only.
import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { getStations } from '@/lib/content';

const DIR = path.join(process.cwd(), 'content', 'stations');
const isDev = process.env.NODE_ENV !== 'production';

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 60) || 'untitled';

export async function GET() {
  return NextResponse.json({ stations: getStations() });
}

export async function POST(req: Request) {
  if (!isDev) return NextResponse.json({ error: 'read-only in production' }, { status: 403 });
  const b = await req.json();
  const id: string = b.id && String(b.id).trim() ? slugify(String(b.id)) : slugify(String(b.title || 'untitled'));
  const line = String(b.line || 'central');
  // joint stations carry every thread they sit on; keep the primary `line` first
  const lines = Array.from(new Set([line, ...(Array.isArray(b.lines) ? b.lines.map(String) : [])]));
  const data = {
    title: String(b.title || 'Untitled'),
    line,
    lines,
    date: b.date ? String(b.date) : '',
    shape: String(b.shape || 'circle'),
    x: Number(b.x ?? 700),
    y: Number(b.y ?? 400),
    media: Array.isArray(b.media) ? b.media : [],
  };
  const file = matter.stringify(`\n${String(b.body || '').trim()}\n`, data);
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(path.join(DIR, `${id}.md`), file, 'utf8');
  return NextResponse.json({ ok: true, id });
}

export async function DELETE(req: Request) {
  if (!isDev) return NextResponse.json({ error: 'read-only in production' }, { status: 403 });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'no id' }, { status: 400 });
  try { await fs.unlink(path.join(DIR, `${String(id).replace(/[^\w-]/g, '')}.md`)); } catch {}
  return NextResponse.json({ ok: true });
}
