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
  origin?: [number, number]; // editable origin-marker position
  featured?: string[]; // station ids that pulse as "start here"
  codeOf?: Record<string, string>; // station id → system code (e.g. 02·01)
};

export default function TransitMap({ lines, stations, terrain, pins = [], selectedId, activeLine, started, trains, onHoverLine, onSelect, onOrigin, origin = [700, 96], featured = [], codeOf = {} }: Props) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const dim = (lineId: string) => (activeLine && activeLine !== lineId ? 0.14 : 1);
  const [ox, oy] = origin;

  // frame the map to whatever has been drawn — no fixed cut-off rectangle (origin included)
  const b = useMemo(() => contentBounds(lines, [...stations, { x: ox, y: oy }], terrain), [lines, stations, terrain, ox, oy]);
  const GS = 80;
  const vx: number[] = [], hy: number[] = [];
  for (let x = Math.floor(b.x / GS) * GS; x <= b.x + b.w; x += GS) vx.push(x);
  for (let y = Math.floor(b.y / GS) * GS; y <= b.y + b.h; y += GS) hy.push(y);

  // ---- intro choreography: origin → notes → terrain → line 1 → line 2 → … ----
  // kept brisk — the whole cascade lands in well under ~2.5s so it never drags.
  const ORIGIN_T = 0.04, ORIGIN_DUR = 0.28;
  const NOTES_T = ORIGIN_T + ORIGIN_DUR + 0.05;
  const NOTE_STAGGER = 0.06, NOTE_DUR = 0.26;
  const notesEnd = pins.length ? NOTES_T + (pins.length - 1) * NOTE_STAGGER + NOTE_DUR : NOTES_T;
  const TERR_T = notesEnd + 0.05;
  const TERR_STAGGER = 0.04, TERR_DUR = 0.26;
  const terrEnd = terrain.length ? TERR_T + (terrain.length - 1) * TERR_STAGGER + TERR_DUR : TERR_T;
  const LINES_T = terrEnd + 0.06;
  const LINE_DUR = 0.5, LINE_GAP = 0.08;
  const lineStartAt = (i: number) => LINES_T + i * (LINE_DUR + LINE_GAP);
  const lineEndAt = (i: number) => lineStartAt(i) + LINE_DUR;
  const lineIndex: Record<string, number> = Object.fromEntries(lines.map((l, i) => [l.id, i]));
  // each stop appears just after its own line finishes drawing, staggered along the line
  const stDelay: Record<string, number> = {};
  const perLine: Record<string, number> = {};
  for (const s of stations) {
    const li = lineIndex[s.line] ?? 0;
    const k = (perLine[s.line] = (perLine[s.line] || 0) + 1) - 1;
    stDelay[s.id] = lineEndAt(li) + 0.02 + k * 0.04;
  }

  // ---- terminus bullets: sit clearly BEYOND each line's last stop (past the
  // station marker, in open canvas so they never blend with the line), fanned out
  // when several lines end at (or overlap on) the same point so numbers don't stack ----
  const BULLET_OFF = 46;
  const termini = lines.map((l, i) => {
    const pts = l.pts; if (!pts || pts.length < 2) return null;
    const end = pts[pts.length - 1], prev = pts[pts.length - 2];
    const vx = end[0] - prev[0], vy = end[1] - prev[1], len = Math.hypot(vx, vy) || 1;
    return { id: l.id, i, color: l.color, text: l.text, x: end[0] + (vx / len) * BULLET_OFF, y: end[1] + (vy / len) * BULLET_OFF };
  }).filter((t): t is NonNullable<typeof t> => t !== null);
  const groups: Record<string, typeof termini> = {};
  for (const t of termini) { const key = `${Math.round(t.x / 18)}:${Math.round(t.y / 18)}`; (groups[key] ||= []).push(t); }
  for (const g of Object.values(groups)) if (g.length > 1) g.forEach((t, k) => { t.x += (k - (g.length - 1) / 2) * 32; });

  return (
    <svg viewBox={b.viewBox} className="tmap" width={b.w} height={b.h} role="group" aria-label="The network — a map of toeesh">
      <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="var(--canvas)" />
      {/* celestial dot grid — a nod to toeesh's starfield boards */}
      <g opacity={0.75}>
        {vx.map((x) => hy.map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.6} fill="var(--canvas-grid)" />))}
      </g>

      {/* terrain — fades in after the notes, before the lines */}
      <Terrain features={terrain} started={started} startAt={TERR_T} stagger={TERR_STAGGER} dur={TERR_DUR} />

      {/* lines (draw on one after another, after terrain) — id'd so trains can ride them */}
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
          transition={{ pathLength: { duration: LINE_DUR, delay: started ? lineStartAt(i) : 0, ease: [0.65, 0, 0.35, 1] }, opacity: { duration: 0.25 } }}
        />
      ))}

      {/* trains — JS rAF beads riding the lines (white, high-contrast, always move) */}
      <Trains lines={lines.map((l) => ({ id: l.id, color: l.color }))} run={trains} />

      {/* the pinboard — settles in right after the origin */}
      <Pins pins={pins} started={started} startAt={NOTES_T} stagger={NOTE_STAGGER} dur={NOTE_DUR} />

      {/* origin — movable; opens with a ping + aperture on intro; click for About */}
      <g transform={`translate(${ox},${oy})`}>
        {/* expanding ping ring — the "opening" beat */}
        <motion.circle r={30} fill="none" stroke={INK} strokeWidth={3}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          initial={{ scale: 0.2, opacity: 0 }}
          animate={started ? { scale: [0.2, 2.2], opacity: [0.55, 0] } : { scale: 0.2, opacity: 0 }}
          transition={{ delay: ORIGIN_T + 0.05, duration: 0.7, ease: 'easeOut' }} />
        <motion.g role="button" tabIndex={0} aria-label="About toeesh" style={{ cursor: onOrigin ? 'pointer' : 'default', transformBox: 'fill-box', transformOrigin: 'center' }}
          onClick={() => onOrigin?.()} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOrigin?.(); } }}
          initial={{ scale: 0, opacity: 0, rotate: -90 }}
          animate={{ scale: started ? 1 : 0, opacity: started ? 1 : 0, rotate: started ? 0 : -90 }}
          transition={{ delay: started ? ORIGIN_T : 0, type: 'spring', stiffness: 360, damping: 14 }}>
          <circle r={40} fill="transparent" />
          <circle r={30} fill={INK} />
          {/* the aperture opens — inner hole expands from nothing */}
          <motion.circle r={13} fill="var(--canvas)"
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            initial={{ scale: 0 }} animate={{ scale: started ? 1 : 0 }} transition={{ delay: ORIGIN_T + 0.18, type: 'spring', stiffness: 420, damping: 16 }} />
        </motion.g>
      </g>
      <foreignObject x={ox + 36} y={oy - 28} width={340} height={44} style={{ overflow: 'visible' }}>
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
              animate={{ scale: started ? 1 : 0, opacity: started ? dim(s.line) : 0 }}
              transition={{ delay: started ? (stDelay[s.id] ?? 0.5) : 0, type: 'spring', stiffness: 340, damping: 18 }}
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

      {/* numbered route bullets — drawn last so terminal stops never cover them;
          sit just beyond each line's last stop, fanned out where lines overlap */}
      {termini.map((t) => (
        <g key={`bullet-${t.id}`} transform={`translate(${t.x},${t.y})`}>
          <motion.g style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: started ? 1 : 0, opacity: started ? dim(t.id) : 0 }}
            transition={{ delay: started ? lineEndAt(t.i) : 0, type: 'spring', stiffness: 320, damping: 16 }}>
            <circle r={15} fill="var(--canvas)" stroke="var(--canvas)" strokeWidth={6} />
            <circle r={14} fill={t.color} />
            <text textAnchor="middle" dominantBaseline="central" fontSize={14} fontWeight={700} fill={t.text || '#fff'} style={{ fontFamily: 'var(--font-mono)' }}>{t.i + 1}</text>
          </motion.g>
        </g>
      ))}
    </svg>
  );
}
