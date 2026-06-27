'use client';
// A station departures board — top-centre, amber-LED style. Shows the next few real stops
// with track numbers + a "DUE / N min" countdown, a live clock, and a split-flap flip when
// the board updates. Pure ambience that sells the metaphor; click any row to jump to it.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Line } from '@/content/lines';
import type { Station } from '@/lib/content';

const ROWS = 3;
const ROTATE_MS = 3200;

export default function DepartureBoard({ lines, stations, onPick }: { lines: Line[]; stations: Station[]; onPick?: (id: string) => void }) {
  const byId = useMemo(() => Object.fromEntries(lines.map((l) => [l.id, l])), [lines]);
  const entries = useMemo(() => stations.map((s) => {
    const l = byId[s.line];
    const trk = Math.max(1, lines.findIndex((x) => x.id === s.line) + 1);
    return { id: s.id, title: s.title, label: l?.label ?? s.line, color: l?.color ?? '#888', trk };
  }), [lines, stations, byId]);

  const [head, setHead] = useState(0);    // index of the top ("DUE") row in the rotation
  const [hhmm, setHhmm] = useState('');
  const [colon, setColon] = useState(true);
  const [open, setOpen] = useState(true);  // minimised / maximised (click the header)
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    try { const v = localStorage.getItem('depboard-open'); if (v != null) setOpen(v === '1'); } catch {}
  }, []);
  const toggle = () => setOpen((o) => { const n = !o; try { localStorage.setItem('depboard-open', n ? '1' : '0'); } catch {} return n; });

  // rotate the visible window so the board feels live (trains "depart", next ones roll up)
  useEffect(() => {
    if (entries.length <= ROWS) return;
    const t = setInterval(() => setHead((v) => (v + 1) % entries.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [entries.length]);

  // live clock with a blinking colon (steady under reduced-motion)
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setHhmm(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
      setColon((c) => (reduced.current ? true : !c));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  if (!entries.length) return null;

  const rows = Array.from({ length: Math.min(ROWS, entries.length) }, (_, k) => {
    const e = entries[(head + k) % entries.length];
    const mins = k === 0 ? 'DUE' : `${k * 4 + (head % 3) + 1} min`;
    return { ...e, mins, due: k === 0 };
  });
  const [hh, mm] = hhmm.split(':');

  return (
    <div className={`depboard ${open ? '' : 'min'}`} role="group" aria-label="Departures board">
      <button className="dep-top" onClick={toggle} aria-expanded={open} aria-label={open ? 'Minimise departures board' : 'Expand departures board'}>
        <span className="dep-title"><i className="dep-led" />departures<span className="dep-chev">{open ? '▾' : '▸'}</span></span>
        {!open && <span className="dep-peek">{rows[0]?.title}</span>}
        <span className="dep-clock" aria-label={`Time ${hhmm}`}>
          <span>{hh}</span><span className={`dep-colon ${colon ? '' : 'off'}`}>:</span><span>{mm}</span>
          <span className="dep-live"><i />live</span>
        </span>
      </button>
      <div className="dep-rows">
        {rows.map((r, k) => (
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
        .depboard { position: fixed; top: 14px; left: 50%; transform: translateX(-50%); z-index: 14;
          width: min(430px, 62vw); background: #0e0e10; color: #f4f1e9;
          border: 2px solid var(--ink); box-shadow: 5px 5px 0 var(--ink);
          font-family: var(--font-mono); overflow: hidden; }
        .dep-top { width: 100%; display: flex; align-items: center; justify-content: space-between;
          padding: 6px 11px; background: #161616; border: 0; border-bottom: 1px solid #2a2a2a;
          color: inherit; font: inherit; cursor: pointer; }
        .dep-top:hover { background: #1d1d1d; }
        .depboard.min .dep-top { border-bottom-color: transparent; }
        .dep-title { display: flex; align-items: center; gap: 7px; color: #ffcf00;
          text-transform: uppercase; font-size: 0.6rem; letter-spacing: 0.22em; font-weight: 700; }
        .dep-chev { color: #6c6c72; font-size: 0.55rem; letter-spacing: 0; margin-left: 1px; }
        .dep-peek { color: #c9c6bd; font-size: 0.66rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          flex: 1; text-align: left; margin: 0 12px; }
        /* collapse the rows when minimised */
        .dep-rows { max-height: 220px; transition: max-height 0.32s cubic-bezier(0.2,0.7,0.2,1), opacity 0.2s ease; }
        .depboard.min .dep-rows { max-height: 0; opacity: 0; padding-top: 0; padding-bottom: 0; overflow: hidden; pointer-events: none; }
        .dep-led { width: 7px; height: 7px; background: #ffcf00; box-shadow: 0 0 6px #ffcf00aa; flex: none; }
        .dep-clock { display: flex; align-items: center; gap: 1px; color: #ffcf00;
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
        .dep-row.due { border-left-color: #ffcf00; background: rgba(255,207,0,0.06); }
        .dep-trk { color: #6c6c72; font-size: 0.6rem; letter-spacing: 0.05em; font-variant-numeric: tabular-nums; }
        .dep-dot { width: 11px; height: 11px; border-radius: 50%; flex: none; box-shadow: 0 0 0 2px #0e0e10, 0 0 5px rgba(0,0,0,0.6); }
        .dep-line { text-transform: uppercase; font-weight: 700; font-size: 0.64rem; letter-spacing: 0.05em;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dep-dest { color: #f4f1e9; font-size: 0.74rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          animation: dep-flip 0.42s cubic-bezier(0.2,0.7,0.2,1) both; }
        .dep-min { justify-self: end; color: #9a9aa0; font-size: 0.66rem; letter-spacing: 0.03em; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .dep-min.now { color: #ffcf00; font-weight: 700; letter-spacing: 0.1em; }
        @keyframes dep-flip { 0% { opacity: 0; transform: translateY(-8px) scaleY(0.55); transform-origin: top; }
          60% { opacity: 1; } 100% { opacity: 1; transform: none; } }
        @keyframes dep-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
        @media (max-width: 680px) { .depboard { width: 86vw; } .dep-row { grid-template-columns: 18px 10px 1fr auto; }
          .dep-line { display: none; } }
        @media (prefers-reduced-motion: reduce) {
          .dep-dest { animation: none; } .dep-live i { animation: none; } .dep-colon { transition: none; }
          .dep-rows { transition: none; }
        }
      `}</style>
    </div>
  );
}
