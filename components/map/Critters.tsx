'use client';
// A bit of life on the tracks: every so often a subway rat scurries along a random line,
// then darts off. ~12% of the time it's the legendary pizza rat. rAF-driven, gated by `run`
// (play.critters && motion on) and silenced under prefers-reduced-motion.
import { memo, useEffect, useRef, useState } from 'react';

export default memo(function Critters({ lines, run }: { lines: { id: string; color: string }[]; run: boolean }) {
  const gref = useRef<SVGGElement>(null);
  const raf = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyRef = useRef(0);
  const [crit, setCrit] = useState<{ key: number; pizza: boolean } | null>(null);

  useEffect(() => {
    // gated by `run` (play.critters + the in-app MOTION toggle) — deliberately NOT by
    // prefers-reduced-motion, which is 'reduce' on the owner's setup and would hide it.
    if (!run || !lines.length) return;
    let alive = true, first = true;

    // first rat shows up quickly so you actually catch one; then it's occasional
    const scheduleNext = () => {
      const delay = first ? 3000 + Math.random() * 2500 : 7000 + Math.random() * 11000;
      first = false;
      timer.current = setTimeout(spawn, delay);
    };
    const spawn = () => {
      if (!alive) return;
      const line = lines[Math.floor(Math.random() * lines.length)];
      const path = document.getElementById(`line-${line.id}`) as unknown as SVGPathElement | null;
      let len = 0; try { len = path?.getTotalLength?.() ?? 0; } catch {}
      if (!path || !len) { scheduleNext(); return; }
      // pre-sample the line once (see Trains.tsx for the why — getPointAtLength is expensive)
      const N = Math.max(60, Math.min(600, Math.round(len / 4)));
      const ds = new Float32Array(N + 1), xs = new Float32Array(N + 1), ys = new Float32Array(N + 1), tans = new Float32Array(N + 1);
      for (let i = 0; i <= N; i++) { const dd = (len * i) / N; const p = path.getPointAtLength(dd); ds[i] = dd; xs[i] = p.x; ys[i] = p.y; }
      for (let i = 0; i <= N; i++) { const i0 = Math.max(0, i - 1), i1 = Math.min(N, i + 1); tans[i] = Math.atan2(ys[i1] - ys[i0], xs[i1] - xs[i0]) * 180 / Math.PI; }
      const pizza = Math.random() < 0.25;
      const runLen = Math.min(len, 320 + Math.random() * 300);
      const dir = Math.random() < 0.5 ? 1 : -1;
      const from = Math.random() * len;
      const dur = runLen / 230;
      const key = ++keyRef.current;
      setCrit({ key, pizza });
      const start = performance.now();
      const tick = (now: number) => {
        if (!alive) return;
        const el = gref.current?.querySelector('g.rat') as SVGGElement | null;
        const t = (now - start) / 1000;
        const f = Math.min(1, t / dur);
        const d = Math.max(0, Math.min(len, from + dir * runLen * f));
        let lo = 0, hi = N; while (lo < hi - 1) { const m = (lo + hi) >> 1; if (ds[m] <= d) lo = m; else hi = m; }
        const span = ds[hi] - ds[lo], u = span > 0 ? (d - ds[lo]) / span : 0;
        const px = xs[lo] + (xs[hi] - xs[lo]) * u, py = ys[lo] + (ys[hi] - ys[lo]) * u;
        let ang = tans[lo]; if (dir < 0) ang += 180;
        const wig = Math.sin(t * 22) * 1.5;
        if (el) {
          el.setAttribute('transform', `translate(${px},${py + wig}) rotate(${ang})`);
          el.style.opacity = f < 0.08 ? String(f / 0.08) : f > 0.9 ? String((1 - f) / 0.1) : '1';
        }
        if (f < 1) raf.current = requestAnimationFrame(tick);
        else { setCrit(null); scheduleNext(); }
      };
      raf.current = requestAnimationFrame(tick);
    };
    scheduleNext();
    return () => { alive = false; if (timer.current) clearTimeout(timer.current); cancelAnimationFrame(raf.current); };
  }, [run, lines]);

  return (
    <g ref={gref} aria-hidden="true">
      {crit && (
        <g className="rat" key={crit.key} style={{ opacity: 0 }}>
          {/* inner scale so the runtime translate/rotate on .rat is preserved; faces +x */}
          <g transform="scale(1.45)">
            <path d="M -7 1 Q -16 0 -21 5" fill="none" stroke="#3c3c42" strokeWidth={1.6} strokeLinecap="round" />
            <ellipse cx={-1} cy={0} rx={9} ry={5} fill="#3c3c42" />
            <ellipse cx={-9} cy={2} rx={2.2} ry={1.6} fill="#2c2c31" />
            <circle cx={7} cy={-0.5} r={4} fill="#44444a" />
            <circle cx={6.5} cy={-3.6} r={1.9} fill="#54545a" />
            <circle cx={8.6} cy={-1.2} r={0.7} fill="#0e0e10" />
            <circle cx={10.6} cy={0.6} r={0.7} fill="#0e0e10" />
            {crit.pizza && (
              <g>
                <polygon points="8,-3 16,-9 13,0" fill="#e8b84b" stroke="#c98a2e" strokeWidth={0.8} />
                <polygon points="8,-3 13,0 9,0.5" fill="#d98c3a" />
                <circle cx={12} cy={-4} r={0.9} fill="#b5402e" />
                <circle cx={11} cy={-1.5} r={0.8} fill="#b5402e" />
              </g>
            )}
          </g>
        </g>
      )}
    </g>
  );
})
