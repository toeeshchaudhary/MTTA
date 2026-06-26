// Renders the saved terrain features (water, parks, forest, sand, blocks)
// behind the transit lines. Authored in /admin, stored in content/terrain.json.
// On the public map it fades in after the notes, before the lines draw.
'use client';
import { motion } from 'framer-motion';
import { KIND_BY_ID, type TerrainFeature } from './terrain-kinds';

export default function Terrain({ features, opacity = 1, started = true, startAt = 0, stagger = 0.08, dur = 0.4 }: { features: TerrainFeature[]; opacity?: number; started?: boolean; startAt?: number; stagger?: number; dur?: number }) {
  if (!features?.length) return null;
  return (
    <g className="terrain" opacity={opacity} aria-hidden>
      {features.map((f, i) => {
        const k = KIND_BY_ID[f.kind] ?? KIND_BY_ID.block;
        return (
          <motion.g key={f.id}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: started ? 1 : 0, scale: started ? 1 : 0.96 }}
            transition={{ delay: started ? startAt + i * stagger : 0, duration: dur, ease: [0.22, 1, 0.36, 1] }}>
            <rect x={f.x} y={f.y} width={f.w} height={f.h} rx={k.round} ry={k.round} fill={k.fill} stroke={k.stroke} strokeWidth={2} />
            {f.label && (
              <text x={f.x + f.w / 2} y={f.y + f.h / 2} textAnchor="middle" dominantBaseline="middle" className="terrain-label" fill="rgba(20,20,20,0.30)">
                {f.label}
              </text>
            )}
          </motion.g>
        );
      })}
    </g>
  );
}
