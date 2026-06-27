'use client';
// A little transit departures board — top-centre LED strip that cycles through the real
// stops, "next" style. Pure ambience; reinforces the metaphor. Click to jump to that stop.
import { useEffect, useMemo, useState } from 'react';
import type { Line } from '@/content/lines';
import type { Station } from '@/lib/content';

export default function DepartureBoard({ lines, stations, onPick }: { lines: Line[]; stations: Station[]; onPick?: (id: string) => void }) {
  const entries = useMemo(() => {
    const byId = Object.fromEntries(lines.map((l) => [l.id, l]));
    return stations.map((s) => ({ id: s.id, title: s.title, label: byId[s.line]?.label ?? s.line, color: byId[s.line]?.color ?? '#888' }));
  }, [lines, stations]);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (entries.length <= 1) return;
    const t = setInterval(() => setI((v) => (v + 1) % entries.length), 2800);
    return () => clearInterval(t);
  }, [entries.length]);
  if (!entries.length) return null;
  const e = entries[i % entries.length];
  const mins = ((i * 4 + 2) % 18) + 1;

  return (
    <button className="depboard" onClick={() => onPick?.(e.id)} title="jump to this stop" aria-label={`Next stop: ${e.title} on ${e.label}`}>
      <span className="dep-k">▸ next</span>
      <span className="dep-dot" style={{ background: e.color }} />
      <span className="dep-line" style={{ color: e.color }}>{e.label}</span>
      <span className="dep-dest" key={e.id}>{e.title}</span>
      <span className="dep-min">{mins} min</span>
      <style jsx>{`
        .depboard { position: fixed; top: 14px; left: 50%; transform: translateX(-50%); z-index: 14;
          display: flex; align-items: center; gap: 10px; background: #141414; color: #f4f1e9;
          border: 2px solid var(--ink); box-shadow: 4px 4px 0 var(--ink); padding: 7px 12px; cursor: pointer;
          font-family: var(--font-mono); font-size: 0.72rem; letter-spacing: 0.04em; max-width: 46vw; }
        .depboard:hover { transform: translateX(-50%) translate(-1px,-1px); box-shadow: 5px 5px 0 var(--ink); }
        .dep-k { color: #ffcf00; text-transform: uppercase; font-size: 0.58rem; letter-spacing: 0.12em; }
        .dep-dot { width: 10px; height: 10px; border-radius: 50%; flex: none; }
        .dep-line { text-transform: uppercase; font-weight: 700; letter-spacing: 0.06em; }
        .dep-dest { color: #f4f1e9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 26vw; animation: dep-flip 0.4s ease; }
        .dep-min { margin-left: auto; padding-left: 6px; color: #9a9aa0; font-variant-numeric: tabular-nums; }
        @keyframes dep-flip { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
        @media (max-width: 680px) { .depboard { display: none; } }
      `}</style>
    </button>
  );
}
