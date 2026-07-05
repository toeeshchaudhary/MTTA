'use client';
// Global error boundary — a service disruption. Client component (required by Next).
import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main style={wrap}>
      <div style={ticket}>
        <div style={band} />
        <div style={mono}>MTTA · SERVICE DISRUPTION</div>
        <h1 style={head}>signal lost on this line</h1>
        <p style={body}>Something went wrong loading the map. The train should be along shortly.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={reset} style={btn}>↻ try again</button>
          <a href="/" style={btn}>← the network</a>
        </div>
        {error?.digest && <div style={digest}>ref {error.digest}</div>}
      </div>
    </main>
  );
}

const wrap: React.CSSProperties = { minHeight: '100dvh', display: 'grid', placeItems: 'center', background: 'var(--bg)', color: 'var(--ink)', padding: 24 };
const ticket: React.CSSProperties = { position: 'relative', width: 'min(440px, 92vw)', background: 'var(--panel)', border: '3px solid var(--ink)', boxShadow: '8px 8px 0 var(--ink)', padding: '34px 28px 28px', overflow: 'hidden' };
const band: React.CSSProperties = { position: 'absolute', inset: '0 0 auto 0', height: 10, background: 'var(--line-c, #b56565)' };
const mono: React.CSSProperties = { fontFamily: 'var(--font-sans)', fontSize: '0.62rem', letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.7 };
const head: React.CSSProperties = { fontSize: '1.2rem', margin: '12px 0 10px' };
const body: React.CSSProperties = { fontSize: '0.9rem', lineHeight: 1.5, opacity: 0.85, margin: '0 0 22px' };
const btn: React.CSSProperties = { fontFamily: 'var(--font-sans)', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.08em', background: 'none', border: '2px solid var(--ink)', color: 'var(--ink)', padding: '8px 12px', textDecoration: 'none', cursor: 'pointer' };
const digest: React.CSSProperties = { fontFamily: 'var(--font-sans)', fontSize: '0.55rem', opacity: 0.5, marginTop: 16 };
