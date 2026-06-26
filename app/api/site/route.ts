// Site-level config — currently just the origin marker position. Dev-only writes.
import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getSite } from '@/lib/content';

const FILE = path.join(process.cwd(), 'content', 'site.json');
const isDev = process.env.NODE_ENV !== 'production';
const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : d);

export async function GET() {
  return NextResponse.json({ site: getSite() });
}

export async function POST(req: Request) {
  if (!isDev) return NextResponse.json({ error: 'read-only in production' }, { status: 403 });
  const body = await req.json();
  const o = body.origin;
  if (!Array.isArray(o) || o.length !== 2) return NextResponse.json({ error: 'origin [x,y] required' }, { status: 400 });
  const site = { origin: [num(o[0], 700), num(o[1], 96)] };
  await fs.writeFile(FILE, JSON.stringify(site, null, 2) + '\n', 'utf8');
  return NextResponse.json({ ok: true, site });
}
