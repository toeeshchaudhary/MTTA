'use client';
import { memo, useEffect, useRef, useState } from 'react';
import { tunnelRuns, runPts, type Pt } from '@/content/lines';

// One train per line: it shuttles from one end of the line to the other, pausing at
// every station, then runs back — a small bit of life on each thread. JS rAF driven
// (no SMIL/offset-path questions); position via getPointAtLength on the line path.
// Extras (admin-toggleable): a pulse ring when a train dwells at a stop, and a rare
// express that blows down a random line without stopping.
type Stop = { id: string; x: number; y: number; line: string; lines?: string[] };

const SPEED = 130;   // map units / second between stops
const DWELL = 0.7;   // seconds paused at each station / terminus

export default memo(function Trains({ lines, stations = [], run, stationPulse = true, expressTrain = true, onBoard }: { lines: { id: string; color: string; pts?: Pt[]; under?: number[] }[]; stations?: Stop[]; run: boolean; stationPulse?: boolean; expressTrain?: boolean; onBoard?: (id: string) => void }) {
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

    // Pre-sample every line ONCE (getPointAtLength is ~50–100μs per call on Chrome
    // and would otherwise run 3× per line per frame → double-digit % CPU for nothing).
    // We store the (d, x, y) triples in parallel typed arrays + a per-sample tangent
    // angle, then interpolate them by binary search in the rAF tick — pure arithmetic.
    const data = cars.map((car) => {
      const id = car.dataset.line!;
      const path = document.getElementById(`line-${id}`) as unknown as SVGPathElement | null;
      let len = 0;
      try { len = path?.getTotalLength?.() ?? 0; } catch {}
      const N = Math.max(60, Math.min(600, Math.round(len / 4)));
      const size = path && len ? N + 1 : 0;
      const ds = new Float32Array(size);
      const xs = new Float32Array(size);
      const ys = new Float32Array(size);
      const tans = new Float32Array(size); // tangent angle in degrees, pre-baked
      if (path && len) {
        for (let i = 0; i <= N; i++) {
          const d = (len * i) / N; const p = path.getPointAtLength(d);
          ds[i] = d; xs[i] = p.x; ys[i] = p.y;
        }
        for (let i = 0; i <= N; i++) {
          const i0 = Math.max(0, i - 1), i1 = Math.min(N, i + 1);
          tans[i] = Math.atan2(ys[i1] - ys[i0], xs[i1] - xs[i0]) * 180 / Math.PI;
        }
      }
      // map each station (x,y) to its nearest sample's arc-length (O(N) per stop, once)
      const onLine = stations.filter((s) => (s.lines && s.lines.length ? s.lines : [s.line]).includes(id));
      const dists = new Set<number>();
      const stopsMap: { d: number; x: number; y: number }[] = [];
      for (const s of onLine) {
        let best = Infinity, bd = 0;
        for (let i = 0; i < size; i++) { const dd = (xs[i] - s.x) ** 2 + (ys[i] - s.y) ** 2; if (dd < best) { best = dd; bd = ds[i]; } }
        dists.add(Math.round(bd)); stopsMap.push({ d: Math.round(bd), x: s.x, y: s.y });
      }
      const stops = Array.from(new Set<number>([0, ...dists, len])).sort((a, b) => a - b);
      const seq = [...stops, ...[...stops].reverse().slice(1)];
      const kf: { t: number; d: number }[] = [{ t: 0, d: seq[0] }];
      let time = 0;
      for (let i = 1; i < seq.length; i++) {
        time += Math.abs(seq[i] - seq[i - 1]) / SPEED; kf.push({ t: time, d: seq[i] });
        time += DWELL; kf.push({ t: time, d: seq[i] });
      }
      const lineObj = lines.find((l) => l.id === id);
      const tunnels: [number, number][] = [];
      if (lineObj?.under?.length && lineObj.pts && size) {
        const nearestD = (pt: Pt) => { let best = Infinity, bd = 0; for (let i = 0; i < size; i++) { const dd = (xs[i] - pt[0]) ** 2 + (ys[i] - pt[1]) ** 2; if (dd < best) { best = dd; bd = ds[i]; } } return bd; };
        for (const r of tunnelRuns(lineObj.under)) { const sub = runPts(lineObj.pts, r); const a = nearestD(sub[0]), b = nearestD(sub[sub.length - 1]); tunnels.push([Math.min(a, b), Math.max(a, b)]); }
      }
      const color = lineObj?.color ?? '#888';
      return { id, car, len, kf, cycle: time, stopsMap, tunnels, color, ds, xs, ys, tans, size, lastDwell: null as number | null, lastOp: -1 };
    });

    // binary search + lerp: sample the cached track at a target arc-length.
    const lookup = (d: typeof data[number], dist: number) => {
      const size = d.size; if (!size) return null;
      const ds = d.ds; let lo = 0, hi = size - 1;
      while (lo < hi - 1) { const m = (lo + hi) >> 1; if (ds[m] <= dist) lo = m; else hi = m; }
      const span = ds[hi] - ds[lo]; const t = span > 0 ? (dist - ds[lo]) / span : 0;
      return { x: d.xs[lo] + (d.xs[hi] - d.xs[lo]) * t, y: d.ys[lo] + (d.ys[hi] - d.ys[lo]) * t, ang: d.tans[lo] };
    };

    let raf = 0, paused = false;
    const start = performance.now();
    let offsetT = 0; // accumulated seconds while visible
    let lastTs = start;
    const onVis = () => {
      if (document.hidden) { paused = true; cancelAnimationFrame(raf); }
      else if (paused) { paused = false; lastTs = performance.now(); raf = requestAnimationFrame(tick); }
    };
    document.addEventListener('visibilitychange', onVis);
    const tick = (now: number) => {
      offsetT += (now - lastTs) / 1000; lastTs = now;
      for (const d of data) {
        if (!d.len || d.cycle <= 0 || !d.size) continue;
        const tt = offsetT % d.cycle;
        let j = 0; while (j < d.kf.length - 1 && d.kf[j + 1].t <= tt) j++;
        const a = d.kf[j], b = d.kf[Math.min(j + 1, d.kf.length - 1)];
        const f = (b.t - a.t) > 0 ? Math.min(1, Math.max(0, (tt - a.t) / (b.t - a.t))) : 0;
        const dist = a.d + (b.d - a.d) * f;
        const pt = lookup(d, dist); if (!pt) continue;
        d.car.setAttribute('transform', `translate(${pt.x},${pt.y}) rotate(${pt.ang})`);
        const underground = d.tunnels.some(([ta, tb]) => dist >= ta && dist <= tb);
        const op = underground ? 0 : 1;
        if (op !== d.lastOp) { d.car.style.opacity = String(op); d.lastOp = op; } // avoid style writes every frame
        posRef.current[d.id] = { x: pt.x, y: pt.y };
        if (stationPulse) {
          const dwelling = a.d === b.d;
          if (dwelling) {
            const stop = d.stopsMap.find((s) => Math.abs(s.d - a.d) < 2);
            if (stop && d.lastDwell !== stop.d) { d.lastDwell = stop.d; ping(stop.x, stop.y, d.color); }
          } else { d.lastDwell = null; }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', onVis); };
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
      // sample the path ONCE for the whole run, then interpolate each frame
      const N = Math.max(60, Math.min(600, Math.round(len / 4)));
      const ds = new Float32Array(N + 1), xs = new Float32Array(N + 1), ys = new Float32Array(N + 1), tans = new Float32Array(N + 1);
      for (let i = 0; i <= N; i++) { const dd = (len * i) / N; const p = path.getPointAtLength(dd); ds[i] = dd; xs[i] = p.x; ys[i] = p.y; }
      for (let i = 0; i <= N; i++) { const i0 = Math.max(0, i - 1), i1 = Math.min(N, i + 1); tans[i] = Math.atan2(ys[i1] - ys[i0], xs[i1] - xs[i0]) * 180 / Math.PI; }
      const dir = Math.random() < 0.5 ? 1 : -1;
      const dur = len / 470;
      const start = performance.now();
      const step = (now: number) => {
        if (!alive) return;
        const f = Math.min(1, (now - start) / 1000 / dur);
        const d = dir > 0 ? len * f : len * (1 - f);
        let lo = 0, hi = N; while (lo < hi - 1) { const m = (lo + hi) >> 1; if (ds[m] <= d) lo = m; else hi = m; }
        const span = ds[hi] - ds[lo], t = span > 0 ? (d - ds[lo]) / span : 0;
        const px = xs[lo] + (xs[hi] - xs[lo]) * t, py = ys[lo] + (ys[hi] - ys[lo]) * t;
        let ang = tans[lo]; if (dir < 0) ang += 180;
        exp.setAttribute('transform', `translate(${px},${py}) rotate(${ang})`);
        exp.style.opacity = f < 0.07 ? String(f / 0.07) : f > 0.9 ? String((1 - f) / 0.1) : '1';
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
        <circle key={p.key} className="mta-ping" cx={p.x} cy={p.y} r={6} style={{ stroke: p.color }} />
      ))}
      {lines.map((l, i) => (
        // a little train car, centred on its track point; rotated to the tangent at runtime.
        // each line gets one of three rolling-stock designs so the network feels varied.
        <g key={l.id} className="train" data-line={l.id} style={{ opacity: 0, cursor: onBoard ? 'pointer' : 'default' }} onPointerDown={(e) => { e.stopPropagation(); board(l.id); }}>
          <Car color={l.color} variant={i % 8} />
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
})

// Eight rolling-stock variants (0–7). The car always points along +x (direction of travel);
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
  if (variant === 3) {
    // EMU double-deck — taller body (two decks of windows), wide nose, pantograph on roof
    return (
      <>
        <rect x={-20} y={-10} width={38} height={20} rx={3} fill="#fff" stroke={color} strokeWidth={2.8} />
        {/* deck divider */}
        <line x1={-20} y1={0} x2={18} y2={0} stroke={color} strokeWidth={1.2} />
        {/* upper deck windows */}
        <rect x={-15} y={-8} width={5} height={6} rx={1} fill={color} />
        <rect x={-7} y={-8} width={5} height={6} rx={1} fill={color} />
        <rect x={1} y={-8} width={5} height={6} rx={1} fill={color} />
        {/* lower deck windows */}
        <rect x={-15} y={2} width={5} height={6} rx={1} fill={color} />
        <rect x={-7} y={2} width={5} height={6} rx={1} fill={color} />
        <rect x={1} y={2} width={5} height={6} rx={1} fill={color} />
        {/* nose / headlight cluster */}
        <path d="M 10 -10 C 18 -10 20 -6 20 0 C 20 6 18 10 10 10" fill={color} />
        <circle cx={18} cy={-4} r={1.5} fill="#fff" />
        <circle cx={18} cy={4} r={1.5} fill="#fff" />
        {/* pantograph stub on roof */}
        <line x1={-8} y1={-10} x2={-5} y2={-13} stroke={color} strokeWidth={1.2} strokeLinecap="round" />
        <line x1={-5} y1={-13} x2={2} y2={-13} stroke={color} strokeWidth={1.2} strokeLinecap="round" />
        <line x1={2} y1={-13} x2={5} y2={-10} stroke={color} strokeWidth={1.2} strokeLinecap="round" />
      </>
    );
  }
  if (variant === 4) {
    // heritage steam — loco with a smokestack, cow-catcher, driving wheels, boiler dome
    return (
      <>
        {/* tender cab */}
        <rect x={-22} y={-6} width={14} height={12} rx={1.5} fill="#fff" stroke={color} strokeWidth={2.5} />
        <rect x={-22} y={-6} width={14} height={5} rx={1.5} fill={color} />
        <rect x={-20} y={-0.5} width={3.5} height={5.5} rx={0.8} fill={color} />
        <rect x={-15} y={-0.5} width={3.5} height={5.5} rx={0.8} fill={color} />
        {/* boiler cylinder */}
        <rect x={-7} y={-7} width={22} height={14} rx={6} fill="#fff" stroke={color} strokeWidth={2.5} />
        {/* boiler dome */}
        <ellipse cx={4} cy={-7} rx={4} ry={3.5} fill={color} />
        {/* smokestack */}
        <rect x={12} y={-12} width={4} height={6} rx={1} fill={color} />
        <rect x={11} y={-13} width={6} height={2.5} rx={1} fill={color} />
        {/* cow-catcher */}
        <path d="M 17 -5 L 21 -7 L 21 7 L 17 5" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
        <line x1={17} y1={-2} x2={21} y2={-3.5} stroke={color} strokeWidth={1.2} />
        <line x1={17} y1={2} x2={21} y2={3.5} stroke={color} strokeWidth={1.2} />
        {/* driving wheel */}
        <circle cx={6} cy={7} r={5} fill="none" stroke={color} strokeWidth={2} />
        <circle cx={6} cy={7} r={1.5} fill={color} />
        {/* small front wheel */}
        <circle cx={17} cy={7} r={3} fill="none" stroke={color} strokeWidth={1.8} />
        <circle cx={-14} cy={7} r={3} fill="none" stroke={color} strokeWidth={1.8} />
        {/* headlamp */}
        <circle cx={21} cy={0} r={2.5} fill={color} opacity={0.3} />
        <circle cx={21} cy={0} r={1.4} fill={color} />
      </>
    );
  }
  if (variant === 5) {
    // monorail pod — futuristic single-beam rider, bubble cab, thin body, gull-wing vents
    return (
      <>
        {/* main body — sleek elongated teardrop */}
        <path d="M -18 -6 L 10 -6 C 18 -6 20 -3 20 0 C 20 3 18 6 10 6 L -18 6 C -21 6 -22 3 -22 0 C -22 -3 -21 -6 -18 -6 Z" fill="#fff" stroke={color} strokeWidth={2.5} />
        {/* colour band along centre */}
        <rect x={-22} y={-1.5} width={42} height={3} fill={color} opacity={0.3} />
        {/* bubble windshield */}
        <path d="M 8 -5.5 C 16 -5 19 -2.5 19 0 C 19 2.5 16 5 8 5.5 Z" fill={color} opacity={0.55} />
        {/* two side windows */}
        <rect x={-4} y={-4} width={5} height={8} rx={2.5} fill={color} />
        <rect x={-13} y={-4} width={5} height={8} rx={2.5} fill={color} />
        {/* gull-wing vents on top */}
        <path d="M -6 -6 C -4 -10 2 -10 4 -6" fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
        {/* beam rail below */}
        <rect x={-22} y={7} width={42} height={2.5} rx={1.2} fill={color} opacity={0.4} />
        {/* headlight */}
        <circle cx={19} cy={0} r={1.8} fill={color} />
      </>
    );
  }
  if (variant === 6) {
    // heritage DMU (diesel multiple unit) — rounded ends so it reads the same both ways,
    // a painted cab stripe, four side windows, roof-mounted exhaust stack
    return (
      <>
        {/* body — rounded both ends (double-ended operation) */}
        <rect x={-19} y={-8} width={38} height={16} rx={8} fill="#fff" stroke={color} strokeWidth={2.5} />
        {/* cab stripe at the front end only — leans into direction of travel */}
        <path d="M 9 -8 C 17 -8 19 -4 19 0 C 19 4 17 8 9 8 L 9 -8 Z" fill={color} opacity={0.18} />
        {/* four windows */}
        <rect x={-13} y={-5} width={5} height={10} rx={1.8} fill={color} />
        <rect x={-5} y={-5} width={5} height={10} rx={1.8} fill={color} />
        <rect x={3} y={-5} width={5} height={10} rx={1.8} fill={color} />
        {/* headlights at both ends */}
        <circle cx={17} cy={-3.5} r={1.4} fill={color} />
        <circle cx={17} cy={3.5} r={1.4} fill={color} />
        {/* exhaust stack */}
        <rect x={4} y={-11} width={3} height={4} rx={1} fill={color} />
        <ellipse cx={5.5} cy={-12} rx={3} ry={1.5} fill={color} opacity={0.4} />
      </>
    );
  }
  if (variant === 7) {
    // open-sided streetcar — vintage New Orleans / Lisbon style: open bench seating visible
    // through open arches, trolley pole on roof, fender skirt
    return (
      <>
        {/* underframe */}
        <rect x={-18} y={2} width={36} height={7} rx={2} fill={color} opacity={0.15} />
        {/* side arches — open coach */}
        <path d="M -18 -8 L -18 6 Q -18 8 -16 8 L 14 8 Q 16 8 16 6 L 16 -8 Z" fill="#fff" stroke={color} strokeWidth={2.5} />
        {/* arch cutouts (open sides — three bays) */}
        <path d="M -13 -6 L -13 4 Q -13 6 -11 6 L -8 6 Q -6 6 -6 4 L -6 -6 Z" fill="#fff" stroke={color} strokeWidth={1.2} />
        <path d="M -4 -6 L -4 4 Q -4 6 -2 6 L 1 6 Q 3 6 3 4 L 3 -6 Z" fill="#fff" stroke={color} strokeWidth={1.2} />
        <path d="M 5 -6 L 5 4 Q 5 6 7 6 L 10 6 Q 12 6 12 4 L 12 -6 Z" fill="#fff" stroke={color} strokeWidth={1.2} />
        {/* clerestory roof strip */}
        <rect x={-18} y={-10} width={34} height={3} rx={1.5} fill={color} />
        {/* trolley pole up to the wire */}
        <line x1={0} y1={-10} x2={0} y2={-16} stroke={color} strokeWidth={1.4} strokeLinecap="round" />
        <line x1={-4} y1={-16} x2={4} y2={-16} stroke={color} strokeWidth={1.4} strokeLinecap="round" />
        {/* destination box on front */}
        <rect x={14} y={-8} width={4} height={6} rx={1} fill={color} opacity={0.8} />
        {/* fender / cowcatcher skirt */}
        <path d="M 16 4 L 20 2 L 20 5 L 16 6" fill={color} opacity={0.5} />
        {/* headlight */}
        <circle cx={18} cy={0} r={1.6} fill={color} />
      </>
    );
  }
  // variant 0 — capsule (default): rounded body, three windows, single headlight
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
