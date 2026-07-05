// Media library — lists and deletes files in public/media. Dev-only writes.
import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'public', 'media');
const isDev = process.env.NODE_ENV !== 'production';

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg']);
const AUDIO_EXTS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac']);
const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov', '.avi']);

function fileType(name: string): 'image' | 'audio' | 'video' | 'other' {
  const ext = path.extname(name).toLowerCase();
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (AUDIO_EXTS.has(ext)) return 'audio';
  if (VIDEO_EXTS.has(ext)) return 'video';
  return 'other';
}

export async function GET() {
  try {
    await fs.mkdir(DIR, { recursive: true });
    const names = await fs.readdir(DIR);
    const files = await Promise.all(
      names.map(async (name) => {
        const stat = await fs.stat(path.join(DIR, name)).catch(() => null);
        return { name, src: `/media/${name}`, type: fileType(name), size: stat?.size ?? 0 };
      })
    );
    return NextResponse.json({ files: files.sort((a, b) => a.name.localeCompare(b.name)) });
  } catch {
    return NextResponse.json({ files: [] });
  }
}

export async function DELETE(req: Request) {
  if (!isDev) return NextResponse.json({ error: 'read-only in production' }, { status: 403 });
  const { name } = await req.json();
  if (!name || typeof name !== 'string' || name.includes('/') || name.includes('..')) {
    return NextResponse.json({ error: 'invalid name' }, { status: 400 });
  }
  await fs.unlink(path.join(DIR, name)).catch(() => null);
  return NextResponse.json({ ok: true });
}
