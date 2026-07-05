'use client';
// A station departures board — top-centre, amber-LED style. Shows the next few real stops
// with track numbers + a "DUE / N min" countdown, a live clock, and a split-flap flip when
// the board updates. Pure ambience that sells the metaphor; click any row to jump to it.
import { memo, useEffect, useMemo, useState } from 'react';
import type { Line } from '@/content/lines';
import type { Station } from '@/lib/content';

const ROWS = 3;
const ROTATE_MS = 3200;

export default memo(function DepartureBoard({ lines, stations, focusLine = null, quips = [], onPick }: { lines: Line[]; stations: Station[]; focusLine?: string | null; quips?: string[]; onPick?: (id: string) => void }) {
  const byId = useMemo(() => Object.fromEntries(lines.map((l) => [l.id, l])), [lines]);
  const onLine = (s: Station, id: string) => (s.lines && s.lines.length ? s.lines : [s.line]).includes(id);
  // abandoned threads run no trains → no departures. A stop shows under a LIVE line it
  // sits on; a stop whose every line is abandoned drops off the board entirely.
  const deadSet = useMemo(() => new Set(lines.filter((l) => l.abandoned).map((l) => l.id)), [lines]);
  const liveLineOf = (s: Station): string | null => {
    if (!deadSet.has(s.line)) return s.line;
    const ls = s.lines && s.lines.length ? s.lines : [s.line];
    return ls.find((id) => !deadSet.has(id)) ?? null;
  };
  const entries = useMemo(() => stations
    .map((s) => ({ s, live: liveLineOf(s) }))
    .filter(({ s, live }) => live !== null && (!focusLine || onLine(s, focusLine)))
    .map(({ s, live }) => {
      const l = byId[live as string];
      const trk = Math.max(1, lines.findIndex((x) => x.id === live) + 1);
      return { id: s.id, title: s.title, label: l?.label ?? s.line, color: l?.color ?? '#888', trk };
    }), [lines, stations, byId, focusLine, deadSet]);
  const focusColor = focusLine ? byId[focusLine]?.color : null;
  // focusing a closed line: the board flips to a service notice instead of departures
  const focusDead = !!focusLine && deadSet.has(focusLine);
  const focusClosed = (focusLine ? byId[focusLine]?.closed : '') || '';

  const [head, setHead] = useState(0);    // index of the top ("DUE") row in the rotation
  const [hhmm, setHhmm] = useState('');
  const [colon, setColon] = useState(true);   // clock colon blink
  const [open, setOpen] = useState(true);  // minimised / maximised (click the header)
  const [quip, setQuip] = useState<string | null>(null);  // occasional witty service message

  useEffect(() => {
    // stored pref wins; otherwise start minimised on touch so it doesn't crowd the top-left HUD
    try {
      const v = localStorage.getItem('depboard-open');
      if (v != null) setOpen(v === '1');
      else if (matchMedia('(pointer: coarse)').matches) setOpen(false);
    } catch {}
  }, []);
  const toggle = () => setOpen((o) => { const n = !o; try { localStorage.setItem('depboard-open', n ? '1' : '0'); } catch {} return n; });

  // rotate the visible window so the board feels live (trains "depart", next ones roll up)
  useEffect(() => {
    if (entries.length <= ROWS) return;
    const t = setInterval(() => setHead((v) => (v + 1) % entries.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [entries.length]);
  useEffect(() => { setHead(0); }, [focusLine]);   // restart the window when the filter changes

  // every so often, flash a witty "service message" in place of the top departure
  useEffect(() => {
    if (!quips.length) { setQuip(null); return; }
    let n = 0;
    const t = setInterval(() => {
      const q = quips[n % quips.length]; n += 1;
      setQuip(q);
      setTimeout(() => setQuip(null), 4200);
    }, 13000);
    return () => clearInterval(t);
  }, [quips]);

  // live clock with a blinking colon (steady under reduced-motion)
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setHhmm(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
      setColon((c) => !c);   // always blink (MOTION toggle pauses the whole board's animations)
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  if (!entries.length && !focusDead) return null;

  const rows = Array.from({ length: Math.min(ROWS, entries.length) }, (_, k) => {
    const e = entries[(head + k) % entries.length];
    const mins = k === 0 ? 'DUE' : `${k * 4 + (head % 3) + 1} min`;
    return { ...e, mins, due: k === 0 };
  });
  const headLabel = focusLine ? (byId[focusLine]?.label ?? 'departures') : 'departures';
  const [hh, mm] = hhmm.split(':');

  return (
    <div className={`depboard ${open ? '' : 'min'}`} role="group" aria-label="Departures board">
      <button className="dep-top" onClick={toggle} aria-expanded={open} aria-label={open ? 'Minimise departures board' : 'Expand departures board'}>
        <span className="dep-title" style={focusDead ? { color: '#b56565' } : focusColor ? { color: focusColor } : undefined}><i className="dep-led" style={focusDead ? { background: '#b56565', boxShadow: 'none' } : focusColor ? { background: focusColor, boxShadow: `0 0 6px ${focusColor}aa` } : undefined} />{focusLine ? headLabel : 'departures'}<span className="dep-chev">{open ? '▾' : '▸'}</span></span>
        {!open && <span className="dep-peek">{focusDead ? 'no service' : rows[0]?.title}</span>}
        <span className="dep-clock" aria-label={`Time ${hhmm}`}>
          <span>{hh}</span><span className={`dep-colon ${colon ? '' : 'off'}`}>:</span><span>{mm}</span>
          <span className="dep-live"><i />live</span>
        </span>
      </button>
      <div className="dep-rows">
        {focusDead && (
          <div className="dep-row quip closed" role="status">
            <span className="dep-quip-led" style={{ background: '#b56565' }} />
            <span className="dep-quip-text" style={{ color: '#b56565' }}>service ended{focusClosed ? ` · ${focusClosed}` : ''} — no trains run this line</span>
          </div>
        )}
        {quip && (
          <div className="dep-row quip" aria-live="polite">
            <span className="dep-quip-led" />
            <span className="dep-quip-text">{quip}</span>
          </div>
        )}
        {(quip ? rows.slice(0, Math.max(1, ROWS - 1)) : rows).map((r, k) => (
          <button key={`${r.id}-${k}`} className={`dep-row ${r.due ? 'due' : ''}`} onClick={() => onPick?.(r.id)} title={`jump to ${r.title}`} aria-label={`${r.title} on ${r.label}, ${r.mins}`}>
            <span className="dep-trk">{String(r.trk).padStart(2, '0')}</span>
            <span className="dep-dot" style={{ background: r.color }} />
            <span className="dep-line" style={{ color: r.color }}>{r.label}</span>
            <span className="dep-dest" key={r.id} style={{ animationDelay: `${k * 60}ms` }}>{r.title}</span>
            <span className={`dep-min ${r.due ? 'now' : ''}`}>{r.mins}</span>
          </button>
        ))}
      </div>
      <style jsx>{`
        .depboard { position: fixed; top: max(14px, env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); z-index: 14;
          width: min(430px, 62vw); background: #0e0e10; color: #f4f1e9;
          border: 1px solid var(--edge); box-shadow: 5px 5px 0 var(--shadow);
          font-family: var(--font-mono); overflow: hidden; }
        .dep-top { width: 100%; display: flex; align-items: center; justify-content: space-between;
          padding: 6px 11px; background: #161616; border: 0; border-bottom: 1px solid #2a2a2a;
          color: inherit; font: inherit; cursor: pointer; }
        .dep-top:hover { background: #1d1d1d; }
        .depboard.min .dep-top { border-bottom-color: transparent; }
        .dep-title { display: flex; align-items: center; gap: 7px; color: var(--hi);
          text-transform: uppercase; font-size: 0.6rem; letter-spacing: 0.22em; font-weight: 700; }
        .dep-chev { color: #6c6c72; font-size: 0.55rem; letter-spacing: 0; margin-left: 1px; }
        .dep-peek { color: #c9c6bd; font-size: 0.66rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          flex: 1; text-align: left; margin: 0 12px; }
        /* collapse the rows when minimised */
        .dep-rows { max-height: 220px; transition: max-height 0.32s cubic-bezier(0.2,0.7,0.2,1), opacity 0.2s ease; }
        .depboard.min .dep-rows { max-height: 0; opacity: 0; padding-top: 0; padding-bottom: 0; overflow: hidden; pointer-events: none; }
        .dep-led { width: 7px; height: 7px; background: var(--hi); box-shadow: 0 0 6px color-mix(in srgb, var(--hi) 67%, transparent); flex: none; }
        .dep-clock { display: flex; align-items: center; gap: 1px; color: var(--hi);
          font-size: 0.72rem; letter-spacing: 0.05em; font-variant-numeric: tabular-nums; }
        .dep-colon { transition: opacity 0.12s; }
        .dep-colon.off { opacity: 0.15; }
        .dep-live { display: inline-flex; align-items: center; gap: 4px; margin-left: 9px;
          color: #6fe08a; font-size: 0.52rem; letter-spacing: 0.14em; text-transform: uppercase; }
        .dep-live i { width: 6px; height: 6px; border-radius: 50%; background: #6fe08a; animation: dep-pulse 1.8s ease-in-out infinite; }
        .dep-rows { padding: 3px 0; overflow: hidden;
          background-image: repeating-linear-gradient(0deg, transparent 0, transparent 27px, rgba(255,255,255,0.025) 27px, rgba(255,255,255,0.025) 28px); }
        .dep-row { width: 100%; display: grid; grid-template-columns: 22px 11px 78px 1fr auto; align-items: center; gap: 8px;
          padding: 7px 11px; background: none; border: 0; border-left: 3px solid transparent;
          color: inherit; font: inherit; cursor: pointer; text-align: left; }
        .dep-row:hover { background: rgba(255,255,255,0.05); }
        .dep-row.due { border-left-color: var(--hi); background: color-mix(in srgb, var(--hi) 9%, transparent); }
        .dep-trk { color: #6c6c72; font-size: 0.6rem; letter-spacing: 0.05em; font-variant-numeric: tabular-nums; }
        .dep-dot { width: 11px; height: 11px; border-radius: 50%; flex: none; box-shadow: 0 0 0 2px #0e0e10, 0 0 5px rgba(0,0,0,0.6); }
        .dep-line { text-transform: uppercase; font-weight: 700; font-size: 0.64rem; letter-spacing: 0.05em;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dep-dest { color: #f4f1e9; font-size: 0.74rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          animation: dep-flip 0.42s cubic-bezier(0.2,0.7,0.2,1) both; }
        .dep-min { justify-self: end; color: #9a9aa0; font-size: 0.66rem; letter-spacing: 0.03em; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .dep-min.now { color: var(--hi); font-weight: 700; letter-spacing: 0.1em; }
        .dep-row.quip { grid-template-columns: 14px 1fr; cursor: default; border-left-color: var(--hi); background: color-mix(in srgb, var(--hi) 11%, transparent);
          animation: dep-flip 0.42s cubic-bezier(0.2,0.7,0.2,1) both; }
        .dep-quip-led { width: 8px; height: 8px; border-radius: 50%; background: var(--hi); box-shadow: 0 0 6px color-mix(in srgb, var(--hi) 67%, transparent);
          animation: dep-pulse 1.4s ease-in-out infinite; }
        .dep-quip-text { color: var(--hi); font-size: 0.7rem; letter-spacing: 0.06em; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        @keyframes dep-flip { 0% { opacity: 0; transform: translateY(-8px) scaleY(0.55); transform-origin: top; }
          60% { opacity: 1; } 100% { opacity: 1; transform: none; } }
        @keyframes dep-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
        /* phones: drop the board onto its own row below the top-left HUD + wordmark so it stops
           colliding with them (it was centred on the same top row). */
        @media (max-width: 700px) { .depboard { width: 86vw; top: max(52px, env(safe-area-inset-top)); } .dep-row { grid-template-columns: 16px 8px 1fr auto; gap: 6px; padding: 5px 8px; }
          .dep-line { display: none; } }
        /* touch has no hover — mirror the row/header highlight onto :active */
        @media (hover: none), (pointer: coarse) {
          .dep-top:active { background: #1d1d1d; }
          .dep-row:active { background: rgba(255,255,255,0.08); }
        }
        /* motion is controlled by the in-app MOTION toggle (.no-motion freezes all of this),
           not prefers-reduced-motion — which is 'reduce' on the owner's setup. */
      `}</style>
    </div>
  );
})
