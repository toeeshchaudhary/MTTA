'use client';
import { useEffect, useRef } from 'react';

// One train per line: it shuttles from one end of the line to the other, pausing at
// every station, then runs back — a small bit of life on each thread. JS rAF driven
// (no SMIL/offset-path questions); position via getPointAtLength on the line path.
type Stop = { x: number; y: number; line: string; lines?: string[] };

const SPEED = 130;   // map units / second between stops
const DWELL = 0.7;   // seconds paused at each station / terminus

export default function Trains({ lines, stations = [], run }: { lines: { id: string; color: string }[]; stations?: Stop[]; run: boolean }) {
  const gref = useRef<SVGGElement>(null);

  useEffect(() => {
    if (!run) return;
    const g = gref.current;
    if (!g) return;
    const cars = Array.from(g.querySelectorAll<SVGGElement>('g.train'));

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
      for (const s of onLine) { let best = Infinity, bd = 0; for (const sm of samples) { const dd = (sm.x - s.x) ** 2 + (sm.y - s.y) ** 2; if (dd < best) { best = dd; bd = sm.d; } } dists.add(Math.round(bd)); }
      const stops = Array.from(new Set<number>([0, ...dists, len])).sort((a, b) => a - b);
      // forward through the stops, then back — dwelling at each. Keyframes of {t, dist}.
      const seq = [...stops, ...[...stops].reverse().slice(1)];
      const kf: { t: number; d: number }[] = [{ t: 0, d: seq[0] }];
      let time = 0;
      for (let i = 1; i < seq.length; i++) {
        time += Math.abs(seq[i] - seq[i - 1]) / SPEED; kf.push({ t: time, d: seq[i] });
        time += DWELL; kf.push({ t: time, d: seq[i] });
      }
      return { car, path, len, kf, cycle: time };
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
          d.car.style.opacity = '1';
        } catch {}
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, lines, stations]);

  if (!run) return null;

  return (
    <g ref={gref} aria-hidden="true">
      {lines.map((l) => (
        // a little train car, centred on its track point; rotated to the tangent at runtime.
        // white body + line-colour border/windows so it reads as a vehicle ON its own line.
        <g key={l.id} className="train" data-line={l.id} style={{ opacity: 0 }}>
          <rect x={-17} y={-8.5} width={34} height={17} rx={7} fill="#fff" stroke={l.color} strokeWidth={3} />
          <rect x={-11.5} y={-4} width={5.5} height={8} rx={1.5} fill={l.color} />
          <rect x={-2.75} y={-4} width={5.5} height={8} rx={1.5} fill={l.color} />
          <rect x={6} y={-4} width={5.5} height={8} rx={1.5} fill={l.color} />
          <circle cx={14.5} cy={0} r={1.8} fill={l.color} />
        </g>
      ))}
    </g>
  );
}
