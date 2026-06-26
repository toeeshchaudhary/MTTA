'use client';
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { RIBBON, contentBounds, type Line } from '@/content/lines';
import type { Station, Pin } from '@/lib/content';
import type { TerrainFeature } from './terrain-kinds';
import Trains from './Trains';
import Terrain from './Terrain';
import Pins from './Pins';

const R = 11;
const RSEL = 16;
const INK = '#2b2b33';

function ShapeMarker({ shape, sel }: { shape: Station['shape']; sel: boolean }) {
  const r = sel ? RSEL : R;
  const stroke = INK;
  const sw = sel ? 4 : 3;
  if (shape === 'square') return <rect x={-r} y={-r} width={r * 2} height={r * 2} fill="#fff" stroke={stroke} strokeWidth={sw} />;
  if (shape === 'triangle') {
    const h = r * 1.9;
    return <polygon points={`0,${-h * 0.6} ${r * 1.1},${h * 0.5} ${-r * 1.1},${h * 0.5}`} fill="#fff" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />;
  }
  if (shape === 'semi') return <path d={`M ${-r},${r * 0.55} A ${r},${r} 0 0 1 ${r},${r * 0.55} Z`} fill="#fff" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />;
  return <circle r={r} fill="#fff" stroke={stroke} strokeWidth={sw} />;
}

// Interchange / joint stop — a white disc with a thick ink ring and a colour tick
// per line that meets here (London-style), so it reads as a transfer between threads.
function InterchangeMarker({ colors, sel }: { colors: string[]; sel: boolean }) {
  const r = (sel ? RSEL : R) + 5;
  const gap = 8.5, dotR = 4;
  const start = -((colors.length - 1) * gap) / 2;
  return (
    <g>
      <circle r={r} fill="#fff" stroke={INK} strokeWidth={sel ? 4 : 3} />
      {colors.map((c, i) => <circle key={i} cx={start + i * gap} cy={0} r={dotR} fill={c} />)}
    </g>
  );
}

type Props = {
  lines: Line[];
  stations: Station[];
  terrain: TerrainFeature[];
  pins?: Pin[];
  selectedId: string | null;
  activeLine: string | null; // hovered or focused thread
  started: boolean; // intro finished → run draw-on
  trains: boolean; // run the moving beads
  onHoverLine: (id: string | null) => void;
  onSelect: (id: string) => void;
  onOrigin?: () => void; // click the origin marker → About card
  featured?: string[]; // station ids that pulse as "start here"
  codeOf?: Record<string, string>; // station id → system code (e.g. 02·01)
};

export default function TransitMap({ lines, stations, terrain, pins = [], selectedId, activeLine, started, trains, onHoverLine, onSelect, onOrigin, featured = [], codeOf = {} }: Props) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const dim = (lineId: string) => (activeLine && activeLine !== lineId ? 0.14 : 1);

  // frame the map to whatever has been drawn — no fixed cut-off rectangle
  const b = useMemo(() => contentBounds(lines, stations, terrain), [lines, stations, terrain]);
  const GS = 80;
  const vx: number[] = [], hy: number[] = [];
  for (let x = Math.floor(b.x / GS) * GS; x <= b.x + b.w; x += GS) vx.push(x);
  for (let y = Math.floor(b.y / GS) * GS; y <= b.y + b.h; y += GS) hy.push(y);

  return (
    <svg viewBox={b.viewBox} className="tmap" width={b.w} height={b.h} role="group" aria-label="The network — a map of toeesh">
      <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="var(--canvas)" />
      {/* celestial dot grid — a nod to toeesh's starfield boards */}
      <g opacity={0.75}>
        {vx.map((x) => hy.map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.6} fill="var(--canvas-grid)" />))}
      </g>

      <Terrain features={terrain} />

      {/* lines (draw on after intro) — id'd so trains can ride them */}
      {lines.map((l, i) => (
        <motion.path
          key={l.id}
          id={`line-${l.id}`}
          d={l.d}
          fill="none"
          stroke={l.color}
          strokeWidth={RIBBON}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: dim(l.id) }}
          animate={{ pathLength: started ? 1 : 0, opacity: dim(l.id) }}
          transition={{ pathLength: { duration: 1.4, delay: 0.12 * i, ease: [0.65, 0, 0.35, 1] }, opacity: { duration: 0.25 } }}
        />
      ))}

      {/* numbered route bullets at each terminus — like a real line diagram */}
      {lines.map((l, i) => {
        const pts = l.pts; if (!pts || !pts.length) return null;
        const [tx, ty] = pts[pts.length - 1];
        return (
          <g key={`bullet-${l.id}`} transform={`translate(${tx},${ty})`} style={{ opacity: dim(l.id) }}>
            <circle r={14} fill={l.color} />
            <text textAnchor="middle" dominantBaseline="central" fontSize={14} fontWeight={700} fill={l.text || '#fff'} style={{ fontFamily: 'var(--font-mono)' }}>{i + 1}</text>
          </g>
        );
      })}

      {/* trains — JS rAF beads riding the lines (white, high-contrast, always move) */}
      <Trains lines={lines.map((l) => ({ id: l.id, color: l.color }))} run={trains} />

      {/* the pinboard — your stuff, tacked onto the board */}
      <Pins pins={pins} />

      {/* origin — top of the central spine; click for the About card */}
      <g transform="translate(700,96)" role="button" tabIndex={0} aria-label="About toeesh" style={{ cursor: onOrigin ? 'pointer' : 'default' }}
        onClick={() => onOrigin?.()} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOrigin?.(); } }}>
        <circle r={40} fill="transparent" />
        <circle r={30} fill={INK} />
        <circle r={13} fill="var(--canvas)" />
      </g>
      <foreignObject x={736} y={68} width={340} height={44} style={{ overflow: 'visible' }}>
        <button className="plate big origin-plate" onClick={() => onOrigin?.()}><span className="dot" style={{ background: '#141414' }} />the origin — toeesh<span className="origin-cue">about ↗</span></button>
      </foreignObject>

      {/* stations */}
      {stations.map((s, i) => {
        const sel = s.id === selectedId;
        const isFeatured = featured.includes(s.id);
        const show = sel || hoverId === s.id || activeLine === s.line || (isFeatured && !activeLine && !selectedId); // reveal tablet (featured stay labelled at rest)
        const labelRight = s.x < 980;
        return (
          <g key={s.id} id={`st-${s.id}`} transform={`translate(${s.x},${s.y})`}>
            <motion.g
              style={{ cursor: 'pointer' }}
              tabIndex={0}
              role="button"
              aria-label={s.title}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: dim(s.line) }}
              transition={{ delay: started ? 0.5 + i * 0.04 : 0, type: 'spring', stiffness: 340, damping: 18 }}
              whileHover={{ scale: 1.18 }}
              whileTap={{ scale: 0.92 }}
              onMouseEnter={() => { setHoverId(s.id); onHoverLine(s.line); }}
              onMouseLeave={() => { setHoverId(null); onHoverLine(null); }}
              onFocus={() => { setHoverId(s.id); onHoverLine(s.line); }}
              onBlur={() => { setHoverId(null); onHoverLine(null); }}
              onClick={() => onSelect(s.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(s.id); } }}
            >
              {(sel || (featured.includes(s.id) && !selectedId)) && (
                <motion.circle
                  r={RSEL + 8}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={4}
                  animate={{ scale: [1, 1.3, 1], opacity: [0.9, 0.15, 0.9] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
              {s.lines && s.lines.length >= 2
                ? <InterchangeMarker colors={s.colors} sel={sel} />
                : <ShapeMarker shape={s.shape} sel={sel} />}
              {show && (
                <foreignObject x={labelRight ? RSEL + 12 : -(320 + RSEL + 12)} y={-26} width={320} height={52} style={{ overflow: 'visible' }}>
                  <div className="plate-wrap" style={{ justifyContent: labelRight ? 'flex-start' : 'flex-end' }}>
                    <span className="plate">{codeOf[s.id] && <span className="plate-code">{codeOf[s.id]}</span>}<span className="dot" style={{ background: s.color }} />{s.title}</span>
                  </div>
                </foreignObject>
              )}
            </motion.g>
          </g>
        );
      })}
    </svg>
  );
}
