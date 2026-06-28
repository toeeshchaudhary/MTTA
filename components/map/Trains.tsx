'use client';
import { useEffect, useRef, useState } from 'react';
import { tunnelRuns, runPts, type Pt } from '@/content/lines';

// One train per line: it shuttles from one end of the line to the other, pausing at
// every station, then runs back — a small bit of life on each thread. JS rAF driven
// (no SMIL/offset-path questions); position via getPointAtLength on the line path.
// Extras (admin-toggleable): a pulse ring when a train dwells at a stop, and a rare
// express that blows down a random line without stopping.
type Stop = { id: string; x: number; y: number; line: string; lines?: string[] };

const SPEED = 130;   // map units / second between stops
const DWELL = 0.7;   // seconds paused at each station / terminus

export default function Trains({ lines, stations = [], run, stationPulse = true, expressTrain = true, onBoard }: { lines: { id: string; color: string; pts?: Pt[]; under?: number[] }[]; stations?: Stop[]; run: boolean; stationPulse?: boolean; expressTrain?: boolean; onBoard?: (id: string) => void }) {
  const gref = useRef<SVGGElement>(null);
  const posRef = useRef<Record<string, { x: number; y: number }>>({});
  const [pings, setPings] = useState<{ key: number; x: number; y: number; color: string }[]>([]);
  const pingKey = useRef(0);

  // click a moving train -> hop on at the station it's nearest to
  const board = (lineId: string) => {
    const pos = posRef.current[lineId]; if (!pos || !onBoard) return;
    const onLine = stations.filter((s) => (s.lines && s.lines.length ? s.lines : [s.line]).includes(lineId));
    let best = Infinity, id = '';
    for (const s of onLine) { const dd = (s.x - pos.x) ** 2 + (s.y - pos.y) ** 2; if (dd < best) { best = dd; id = s.id; } }
    if (id) onBoard(id);
  };

  const ping = (x: number, y: number, color: string) => {
    const key = ++pingKey.current;
    setPings((ps) => [...ps, { key, x, y, color }]);
    setTimeout(() => setPings((ps) => ps.filter((p) => p.key !== key)), 720);
  };

  useEffect(() => {
    if (!run) return;
    const g = gref.current;
    if (!g) return;
    const cars = Array.from(g.querySelectorAll<SVGGElement>('g.train:not(.express)'));

    const data = cars.map((car) => {
      const id = car.dataset.line!;
      const path = document.getElementById(`line-${id}`) as unknown as SVGPathElement | null;
      let len = 0;
      try { len = path?.getTotalLength?.() ?? 0; } catch {}
      // sample the path so we can map each station (x,y) to an arc-length along it
      const N = Math.max(60, Math.min(600, Math.round(len / 4)));
      const samples: { d: number; x: number; y: number }[] = [];
      if (path && len) for (let i = 0; i <= N; i++) { const d = (len * i) / N; const p = path.getPointAtLength(d); samples.push({ d, x: p.x, y: p.y }); }
      const onLine = stations.filter((s) => (s.lines && s.lines.length ? s.lines : [s.line]).includes(id));
      const dists = new Set<number>();
      const stopsMap: { d: number; x: number; y: number }[] = [];
      for (const s of onLine) {
        let best = Infinity, bd = 0; for (const sm of samples) { const dd = (sm.x - s.x) ** 2 + (sm.y - s.y) ** 2; if (dd < best) { best = dd; bd = sm.d; } }
        dists.add(Math.round(bd)); stopsMap.push({ d: Math.round(bd), x: s.x, y: s.y });
      }
      const stops = Array.from(new Set<number>([0, ...dists, len])).sort((a, b) => a - b);
      // forward through the stops, then back — dwelling at each. Keyframes of {t, dist}.
      const seq = [...stops, ...[...stops].reverse().slice(1)];
      const kf: { t: number; d: number }[] = [{ t: 0, d: seq[0] }];
      let time = 0;
      for (let i = 1; i < seq.length; i++) {
        time += Math.abs(seq[i] - seq[i - 1]) / SPEED; kf.push({ t: time, d: seq[i] });
        time += DWELL; kf.push({ t: time, d: seq[i] });
      }
      // underground arc-length ranges → the car vanishes (CSS-fades) while it's in a tunnel
      const lineObj = lines.find((l) => l.id === id);
      const tunnels: [number, number][] = [];
      if (lineObj?.under?.length && lineObj.pts && samples.length) {
        const nearestD = (pt: Pt) => { let best = Infinity, bd = 0; for (const sm of samples) { const dd = (sm.x - pt[0]) ** 2 + (sm.y - pt[1]) ** 2; if (dd < best) { best = dd; bd = sm.d; } } return bd; };
        for (const r of tunnelRuns(lineObj.under)) { const sub = runPts(lineObj.pts, r); const a = nearestD(sub[0]), b = nearestD(sub[sub.length - 1]); tunnels.push([Math.min(a, b), Math.max(a, b)]); }
      }
      const color = lines.find((l) => l.id === id)?.color ?? '#888';
      return { id, car, path, len, kf, cycle: time, stopsMap, tunnels, color, lastDwell: null as number | null };
    });

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      for (const d of data) {
        if (!d.path || !d.len || d.cycle <= 0) continue;
        const tt = t % d.cycle;
        let j = 0; while (j < d.kf.length - 1 && d.kf[j + 1].t <= tt) j++;
        const a = d.kf[j], b = d.kf[Math.min(j + 1, d.kf.length - 1)];
        const f = (b.t - a.t) > 0 ? Math.min(1, Math.max(0, (tt - a.t) / (b.t - a.t))) : 0;
        const dist = a.d + (b.d - a.d) * f;
        try {
          const p = d.path.getPointAtLength(dist);
          // tangent from two straddling points so the car aligns with the track
          const pa = d.path.getPointAtLength(Math.min(dist + 6, d.len));
          const pb = d.path.getPointAtLength(Math.max(dist - 6, 0));
          const angle = Math.atan2(pa.y - pb.y, pa.x - pb.x) * 180 / Math.PI;
          d.car.setAttribute('transform', `translate(${p.x},${p.y}) rotate(${angle})`);
          // disappear (CSS-fades via .train transition) while underground, reappear at the far portal
          const underground = d.tunnels.some(([a, b]) => dist >= a && dist <= b);
          d.car.style.opacity = underground ? '0' : '1';
          posRef.current[d.id] = { x: p.x, y: p.y };
          // dwell pulse: when sitting still (a.d === b.d) near a real station, ping it once
          if (stationPulse) {
            const dwelling = a.d === b.d;
            if (dwelling) {
              const stop = d.stopsMap.find((s) => Math.abs(s.d - a.d) < 2);
              if (stop && d.lastDwell !== stop.d) { d.lastDwell = stop.d; ping(stop.x, stop.y, d.color); }
            } else { d.lastDwell = null; }
          }
        } catch {}
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, lines, stations, stationPulse]);

  // rare express run on a random line — no stops, full speed.
  // gated by the MOTION toggle (via `run`), not prefers-reduced-motion (see Trains note).
  useEffect(() => {
    if (!run || !expressTrain || !lines.length) return;
    let alive = true, raf = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const exp = gref.current?.querySelector('g.train.express') as SVGGElement | null;
    const next = () => { timer = setTimeout(go, 22000 + Math.random() * 30000); };
    const go = () => {
      if (!alive || !exp) return;
      const line = lines[Math.floor(Math.random() * lines.length)];
      const path = document.getElementById(`line-${line.id}`) as unknown as SVGPathElement | null;
      let len = 0; try { len = path?.getTotalLength?.() ?? 0; } catch {}
      if (!path || !len) { next(); return; }
      const dir = Math.random() < 0.5 ? 1 : -1;
      const dur = len / 470;             // express: ~470 u/s
      const start = performance.now();
      const step = (now: number) => {
        if (!alive) return;
        const f = Math.min(1, (now - start) / 1000 / dur);
        const d = dir > 0 ? len * f : len * (1 - f);
        try {
          const p = path.getPointAtLength(d);
          const pa = path.getPointAtLength(Math.min(d + 6, len));
          const pb = path.getPointAtLength(Math.max(d - 6, 0));
          let ang = Math.atan2(pa.y - pb.y, pa.x - pb.x) * 180 / Math.PI; if (dir < 0) ang += 180;
          exp.setAttribute('transform', `translate(${p.x},${p.y}) rotate(${ang})`);
          exp.style.opacity = f < 0.07 ? String(f / 0.07) : f > 0.9 ? String((1 - f) / 0.1) : '1';
        } catch {}
        if (f < 1) raf = requestAnimationFrame(step);
        else { exp.style.opacity = '0'; next(); }
      };
      raf = requestAnimationFrame(step);
    };
    next();
    return () => { alive = false; if (timer) clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [run, expressTrain, lines]);

  if (!run) return null;

  return (
    <g ref={gref} aria-hidden="true">
      {pings.map((p) => (
        <circle key={p.key} className="mta-ping" cx={p.x} cy={p.y} r={4} style={{ stroke: p.color }} />
      ))}
      {lines.map((l, i) => (
        // a little train car, centred on its track point; rotated to the tangent at runtime.
        // each line gets one of three rolling-stock designs so the network feels varied.
        <g key={l.id} className="train" data-line={l.id} style={{ opacity: 0, cursor: onBoard ? 'pointer' : 'default' }} onPointerDown={(e) => { e.stopPropagation(); board(l.id); }}>
          <Car color={l.color} variant={i % 3} />
        </g>
      ))}
      {/* the rare express — longer, dark, pointed, with speed streaks + a route diamond,
          so it reads as a totally different beast from the white local cars */}
      <g className="train express" style={{ opacity: 0 }} aria-hidden="true">
        {/* motion streaks trailing behind (-x) */}
        <rect x={-46} y={-5.5} width={12} height={2} rx={1} fill="#fff" opacity={0.5} />
        <rect x={-50} y={-0.5} width={16} height={2} rx={1} fill="#ffcf00" opacity={0.5} />
        <rect x={-44} y={4.5} width={10} height={2} rx={1} fill="#fff" opacity={0.4} />
        {/* pointed bullet body */}
        <path d="M -24 -8 L 14 -8 C 20 -8 25 -4 25 0 C 25 4 20 8 14 8 L -24 8 Q -27 8 -27 5 L -27 -5 Q -27 -8 -24 -8 Z" fill="#191920" stroke="#ffcf00" strokeWidth={2.5} strokeLinejoin="round" />
        <rect x={-27} y={-1.2} width={52} height={2.4} fill="#ffcf00" opacity={0.32} />
        {/* dark windshield + side windows */}
        <path d="M 8 -5 L 15 -3.5 L 15 3.5 L 8 5 Z" fill="#0c0c10" />
        <rect x={-7} y={-4} width={5} height={8} rx={1.2} fill="#0c0c10" />
        <rect x={-16} y={-4} width={5} height={8} rx={1.2} fill="#0c0c10" />
        {/* express route diamond (NYC marker) */}
        <path d="M -19 -4.5 L -13 0 L -19 4.5 L -25 0 Z" fill="#ffcf00" stroke="#0c0c10" strokeWidth={1.1} strokeLinejoin="round" />
        {/* headlight + glow */}
        <circle cx={22} cy={0} r={5} fill="#fff" opacity={0.25} />
        <circle cx={21} cy={0} r={2.3} fill="#fff" />
      </g>
    </g>
  );
}

// Three rolling-stock variants. The car always points along +x (direction of travel);
// the parent <g> handles position + tangent rotation at runtime.
function Car({ color, variant }: { color: string; variant: number }) {
  if (variant === 1) {
    // bullet — sleek tapered nose, cheatline, windshield + side windows
    return (
      <>
        <path d="M -18 -7 L 9 -7 C 15 -7 19 -3.5 19 0 C 19 3.5 15 7 9 7 L -18 7 Q -21 7 -21 4 L -21 -4 Q -21 -7 -18 -7 Z" fill="#fff" stroke={color} strokeWidth={3} strokeLinejoin="round" />
        <rect x={-21} y={-1.3} width={40} height={2.6} fill={color} opacity={0.22} />
        <path d="M 5.5 -4 L 12.5 -3 L 12.5 3 L 5.5 4 Z" fill={color} />
        <rect x={-3.5} y={-4} width={6} height={8} rx={1.5} fill={color} />
        <rect x={-13} y={-4} width={6} height={8} rx={1.5} fill={color} />
        <circle cx={16.5} cy={0} r={1.6} fill={color} />
      </>
    );
  }
  if (variant === 2) {
    // tram — boxy, roof destination blind, four windows, twin headlights
    return (
      <>
        <rect x={-17} y={-9} width={34} height={18} rx={3.5} fill="#fff" stroke={color} strokeWidth={3} />
        <rect x={-12} y={-9} width={24} height={4} rx={1.5} fill={color} />
        <rect x={-11} y={-2.2} width={4.6} height={7} rx={1} fill={color} />
        <rect x={-4.6} y={-2.2} width={4.6} height={7} rx={1} fill={color} />
        <rect x={1.8} y={-2.2} width={4.6} height={7} rx={1} fill={color} />
        <rect x={8.2} y={-2.2} width={4.6} height={7} rx={1} fill={color} />
        <circle cx={15} cy={-4.2} r={1.4} fill={color} />
        <circle cx={15} cy={4.2} r={1.4} fill={color} />
      </>
    );
  }
  // capsule (default) — rounded body, three windows, single headlight
  return (
    <>
      <rect x={-17} y={-8.5} width={34} height={17} rx={7} fill="#fff" stroke={color} strokeWidth={3} />
      <rect x={-11.5} y={-4} width={5.5} height={8} rx={1.5} fill={color} />
      <rect x={-2.75} y={-4} width={5.5} height={8} rx={1.5} fill={color} />
      <rect x={6} y={-4} width={5.5} height={8} rx={1.5} fill={color} />
      <circle cx={14.5} cy={0} r={1.8} fill={color} />
    </>
  );
}
