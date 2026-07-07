// Water bodies, Mini-Metro style: flat light-blue shapes with a lighter "current line"
// running a fixed distance inside the bank. Freely drawn in /admin (the pen tool), stored
// in content/terrain.json. On the public map they fade in after the notes, before the lines.
'use client';
import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { kindOf, DEFAULT_ROUND, type TerrainFeature } from './terrain-kinds';
import { terrainPath, roundedPolyPath, offsetInward } from './terrain-shape';

export default memo(function Terrain({ features, opacity = 1, started = true, startAt = 0, stagger = 0.08, dur = 0.4 }: { features: TerrainFeature[]; opacity?: number; started?: boolean; startAt?: number; stagger?: number; dur?: number }) {
  // Precompute one { d, current } pair per feature so re-renders (theme, opacity,
  // started flip) never rebuild the offsetInward → catmull-rom path — that's a
  // real few-ms hop when several water bodies are on the map.
  const paths = useMemo(() => features.map((f) => {
    const k = kindOf(f);
    return {
      d: terrainPath(f, k),
      current: k.coast && f.points && f.points.length >= 3 && Math.min(f.w, f.h) > 44
        ? roundedPolyPath(offsetInward(f.points, 8), Math.max(0, (f.round ?? DEFAULT_ROUND) - 8))
        : null,
      k,
    };
  }), [features]);
  if (!features?.length) return null;
  return (
    <g className="terrain" opacity={opacity} aria-hidden>
      {features.map((f, i) => {
        const { d, current, k } = paths[i];
        return (
          <motion.g key={f.id}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: started ? 1 : 0, scale: started ? 1 : 0.985 }}
            transition={{ delay: started ? startAt + i * stagger : 0, duration: dur, ease: [0.22, 1, 0.36, 1] }}>
            <path d={d} fill={k.fill} stroke={k.line} strokeWidth={1.5} strokeLinejoin="round" />
            {current && <path d={current} fill="none" stroke={k.coast} strokeWidth={2.5} strokeLinejoin="round" />}
            {f.label && (
              <text x={f.x + f.w / 2} y={f.y + f.h / 2} textAnchor="middle" dominantBaseline="middle" className="terrain-label" fill="var(--terrain-label, rgba(20,20,20,0.34))">
                {f.label}
              </text>
            )}
          </motion.g>
        );
      })}
    </g>
  );
})
