// Custom 404 — a stop that isn't on the network. Server component, on-brand ticket.
import Link from 'next/link';

export default function NotFound() {
  return (
    <main style={wrap}>
      <div style={ticket}>
        <div style={band} />
        <div style={mono}>MTTA · SERVICE NOTICE</div>
        <div style={code}>404</div>
        <h1 style={head}>this stop isn’t on the map</h1>
        <p style={body}>
          The line you followed doesn’t stop here — the station may have been renamed, re-routed, or never built.
        </p>
        <Link href="/" style={btn}>← back to the network</Link>
      </div>
    </main>
  );
}

const wrap: React.CSSProperties = { minHeight: '100dvh', display: 'grid', placeItems: 'center', background: 'var(--bg)', color: 'var(--ink)', padding: 24 };
const ticket: React.CSSProperties = { position: 'relative', width: 'min(440px, 92vw)', background: 'var(--panel)', border: '3px solid var(--ink)', boxShadow: '8px 8px 0 var(--ink)', padding: '34px 28px 28px', overflow: 'hidden' };
const band: React.CSSProperties = { position: 'absolute', inset: '0 0 auto 0', height: 10, background: 'var(--line-c, #7c6aa6)' };
const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: '0.62rem', letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.7 };
const code: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: '3.2rem', fontWeight: 700, lineHeight: 1, margin: '10px 0 4px' };
const head: React.CSSProperties = { fontSize: '1.15rem', margin: '0 0 10px' };
const body: React.CSSProperties = { fontSize: '0.9rem', lineHeight: 1.5, opacity: 0.85, margin: '0 0 22px' };
const btn: React.CSSProperties = { display: 'inline-block', fontFamily: 'var(--font-mono)', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.08em', border: '2px solid var(--ink)', color: 'var(--ink)', padding: '8px 12px', textDecoration: 'none' };
