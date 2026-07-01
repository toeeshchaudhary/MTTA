'use client';
// In-editor "Publish" — commit + push the content so the live site redeploys.
// In the MTTA Studio desktop app it calls the native bridge (window.studio.publish,
// which shows a confirm + result dialog). In a plain browser it uses the dev-only
// /api/publish route with a confirm + inline status. Hidden entirely in production.
import { useEffect, useState } from 'react';

declare global {
  interface Window {
    studio?: { publish: () => Promise<unknown>; daily?: (photos: string[], note?: string) => Promise<unknown>; status?: () => Promise<unknown> };
  }
}

const isDev = process.env.NODE_ENV !== 'production';

export default function PublishButton() {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Only meaningful where authoring works (dev / the desktop app), never in prod.
  if (!isDev && !(mounted && typeof window !== 'undefined' && window.studio)) return null;

  const run = async () => {
    setBusy(true); setNote('');
    try {
      if (typeof window !== 'undefined' && window.studio?.publish) {
        await window.studio.publish();           // desktop app → native dialogs
        setNote('');
        return;
      }
      // browser: preview → confirm → publish
      const prev = await (await fetch('/api/publish')).json();
      if (prev.status === 'nothing') { setNote('nothing to publish'); return; }
      const files: string[] = prev.files ?? [];
      const list = files.slice(0, 14).join('\n') + (files.length > 14 ? `\n…and ${files.length - 14} more` : '');
      if (!confirm(`Publish ${files.length} change${files.length > 1 ? 's' : ''} to the live site?\n\n${list}`)) return;
      const res = await (await fetch('/api/publish', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).json();
      setNote(res.status === 'ok' ? `published ${res.commit ?? ''}` : `failed: ${(res.stderr || res.stage || 'error').toString().split('\n')[0]}`);
    } catch {
      setNote('publish error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button className="tbtn solid" disabled={busy} onClick={run} title="commit + push → Vercel redeploys" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {busy ? '⤴ publishing…' : note || '⤴ publish'}
    </button>
  );
}
