'use client';
import { useEffect, useRef } from 'react';

// JS rAF-driven trains: white beads ride the line paths via getPointAtLength.
// Reliable everywhere (no SMIL/offset-path support questions) and high-contrast
// (white bead + line-colour ring) so they're clearly visible on the tracks.
export default function Trains({ lines, run }: { lines: { id: string; color: string }[]; run: boolean }) {
  const gref = useRef<SVGGElement>(null);

  useEffect(() => {
    if (!run) return;
    const g = gref.current;
    if (!g) return;
    const beads = Array.from(g.querySelectorAll<SVGCircleElement>('circle.train-bead'));
    const data = beads.map((b) => {
      const id = b.dataset.line!;
      const path = document.getElementById(`line-${id}`) as unknown as SVGPathElement | null;
      let len = 0;
      try { len = path?.getTotalLength?.() ?? 0; } catch {}
      return { b, path, len, speed: Number(b.dataset.speed), offset: Number(b.dataset.offset) };
    });

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      for (const d of data) {
        if (!d.path || !d.len) continue;
        const dist = (((t * d.speed) + d.offset * d.len) % d.len + d.len) % d.len;
        try {
          const p = d.path.getPointAtLength(dist);
          d.b.setAttribute('cx', String(p.x));
          d.b.setAttribute('cy', String(p.y));
          d.b.style.opacity = '1';
        } catch {}
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, lines]);

  if (!run) return null;

  return (
    <g ref={gref} aria-hidden="true">
      {lines.flatMap((l) =>
        [0, 0.34, 0.67].map((off, k) => (
          <circle
            key={`${l.id}-${k}`}
            className="train-bead"
            data-line={l.id}
            data-speed={150}
            data-offset={off}
            r={11}
            cx={-40}
            cy={-40}
            fill="#fff"
            stroke={l.color}
            strokeWidth={6}
            style={{ opacity: 0 }}
          />
        ))
      )}
    </g>
  );
}
