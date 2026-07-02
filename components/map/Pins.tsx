// The tile layer — curated modules placed on the board, design-system style:
// aligned, hairline-framed, mono-labelled. They settle in after the routes draw.
'use client';
import { motion } from 'framer-motion';
import type { Pin } from '@/lib/content';

export default function Pins({ pins, started = true, startAt = 0, stagger = 0.12, dur = 0.45 }: { pins: Pin[]; started?: boolean; startAt?: number; stagger?: number; dur?: number }) {
  if (!pins?.length) return null;
  return (
    <g className="tiles" aria-hidden>
      {pins.map((p, i) => {
        const no = `T·${String(i + 1).padStart(2, '0')}`;
        return (
          <motion.g
            key={p.id}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: started ? 1 : 0, scale: started ? 1 : 0.9 }}
            transition={{ delay: started ? startAt + i * stagger : 0, duration: dur, ease: [0.22, 1, 0.36, 1] }}
          >
            <foreignObject x={p.x} y={p.y} width={p.w} height={p.h} style={{ overflow: 'visible' }}>
              <div className={`tile tile-${p.kind}${p.abandoned ? ' tile-abandoned' : ''}`} style={{ width: p.w, height: p.h }}>
                {p.kind === 'photo' ? (
                  <>
                    <div className="tile-frame">{p.src ? <img src={p.src} alt={p.caption || ''} draggable={false} /> : <span className="tile-ph" />}</div>
                    <div className="tile-meta">
                      <span className="tile-tag"><span className="tile-no">{no}</span>{p.abandoned ? 'disused' : (p.tag || 'photo')}</span>
                      {p.caption && <span className="tile-cap">{p.caption}</span>}
                    </div>
                  </>
                ) : (
                  <>
                    <span className="tile-tag"><span className="tile-no">{no}</span>{p.abandoned ? 'disused' : (p.tag || 'note')}</span>
                    <p>{p.text}</p>
                  </>
                )}
              </div>
            </foreignObject>
          </motion.g>
        );
      })}
    </g>
  );
}
