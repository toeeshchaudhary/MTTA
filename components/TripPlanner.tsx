'use client';
// A little journey planner: pick two stops, get the fewest-stops route (with the camera
// riding it) and a "N stops · ~M min · K changes" summary. Logic lives in lib/route.
import { useState } from 'react';
import type { Line } from '@/content/lines';
import type { Station } from '@/lib/content';

export type TripResult = { stops: Station[]; changes: number; minutes: number; error?: boolean } | null;

export default function TripPlanner({ lines, stations, result, onPlan, onClose }: {
  lines: Line[]; stations: Station[]; result: TripResult; onPlan: (from: string, to: string) => void; onClose: () => void;
}) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const lineLabel = (s: Station) => lines.find((l) => l.id === s.line)?.label ?? s.line;
  const opts = stations.map((s) => <option key={s.id} value={s.id}>{s.title} · {lineLabel(s)}</option>);
  return (
    <div className="trip-panel" role="dialog" aria-label="Plan a trip">
      <div className="trip-head"><span className="mono">🚉 plan a trip</span><button className="trip-x" onClick={onClose} aria-label="close">✕</button></div>
      <label className="trip-f mono">from
        <select value={from} onChange={(e) => setFrom(e.target.value)}><option value="">— pick a stop —</option>{opts}</select>
      </label>
      <label className="trip-f mono">to
        <select value={to} onChange={(e) => setTo(e.target.value)}><option value="">— pick a stop —</option>{opts}</select>
      </label>
      <button className="trip-go" disabled={!from || !to || from === to} onClick={() => onPlan(from, to)}>plan trip ▸</button>
      {result && (result.error
        ? <div className="trip-res err mono">no route between those stops</div>
        : <div className="trip-res mono"><b>{result.stops.length}</b> stops · ~<b>{result.minutes}</b> min · <b>{result.changes}</b> change{result.changes === 1 ? '' : 's'}</div>)}
    </div>
  );
}
