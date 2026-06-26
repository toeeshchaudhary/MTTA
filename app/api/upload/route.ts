// Media upload — saves a file into public/media and returns its path. Dev-only.
import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'public', 'media');
const isDev = process.env.NODE_ENV !== 'production';

export async function POST(req: Request) {
  if (!isDev) return NextResponse.json({ error: 'read-only in production' }, { status: 403 });
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'no file' }, { status: 400 });
  const dot = file.name.lastIndexOf('.');
  const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : '';
  const base = (dot >= 0 ? file.name.slice(0, dot) : file.name).toLowerCase().replace(/[^\w-]+/g, '-').replace(/-+/g, '-').slice(0, 40) || 'file';
  const name = `${base}${ext}`;
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(path.join(DIR, name), Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ ok: true, src: `/media/${name}`, type: file.type });
}
