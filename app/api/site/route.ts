// Site-level config — currently just the origin marker position. Dev-only writes.
import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getSite, type Site, type AboutLink } from '@/lib/content';

const FILE = path.join(process.cwd(), 'content', 'site.json');
const isDev = process.env.NODE_ENV !== 'production';
const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : d);

export async function GET() {
  return NextResponse.json({ site: getSite() });
}

// Merge partial updates onto the current site so e.g. dragging the origin doesn't
// wipe the pill text, and editing the About card doesn't move the origin.
export async function POST(req: Request) {
  if (!isDev) return NextResponse.json({ error: 'read-only in production' }, { status: 403 });
  const body = await req.json();
  const cur = getSite();
  const site: Site = {
    origin: Array.isArray(body.origin) && body.origin.length === 2 ? [num(body.origin[0], cur.origin[0]), num(body.origin[1], cur.origin[1])] : cur.origin,
    originLabel: typeof body.originLabel === 'string' ? body.originLabel : cur.originLabel,
    originCue: typeof body.originCue === 'string' ? body.originCue : cur.originCue,
    about: body.about && typeof body.about === 'object' ? {
      name: typeof body.about.name === 'string' ? body.about.name : cur.about.name,
      role: typeof body.about.role === 'string' ? body.about.role : cur.about.role,
      blurb: typeof body.about.blurb === 'string' ? body.about.blurb : cur.about.blurb,
      links: Array.isArray(body.about.links) ? body.about.links.filter((l: AboutLink) => l && typeof l.label === 'string').map((l: AboutLink) => ({ label: String(l.label), url: String(l.url || '') })) : cur.about.links,
    } : cur.about,
  };
  await fs.writeFile(FILE, JSON.stringify(site, null, 2) + '\n', 'utf8');
  return NextResponse.json({ ok: true, site });
}
