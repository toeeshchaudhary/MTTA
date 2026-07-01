// Publish pending content to the live site (commit + push → Vercel redeploys).
// Dev-only, like the other content-mutating routes — blocked in production. Lets the
// in-page Publish button work from a plain browser at /admin (the desktop app uses the
// native window.studio bridge instead). Shares lib/publish.ts with the CLI + desktop.
import { NextResponse } from 'next/server';
import { publish, gitStatus } from '@/lib/publish';

const isDev = process.env.NODE_ENV !== 'production';

// GET → dry preview: what would publishing commit right now?
export async function GET() {
  if (!isDev) return NextResponse.json({ error: 'read-only in production' }, { status: 403 });
  const { files } = await gitStatus(process.cwd());
  return NextResponse.json({ status: files.length ? 'ready' : 'nothing', files });
}

// POST → commit + push.
export async function POST(req: Request) {
  if (!isDev) return NextResponse.json({ error: 'read-only in production' }, { status: 403 });
  const body = await req.json().catch(() => ({} as { message?: string }));
  const today = new Date().toISOString().slice(0, 10);
  const res = await publish({ root: process.cwd(), message: body.message || `content: publish ${today}` });
  return NextResponse.json(res, { status: res.status === 'error' ? 500 : 200 });
}
