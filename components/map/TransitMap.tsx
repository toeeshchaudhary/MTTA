'use client';
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { RIBBON, roundedPath, contentBounds, tunnelRuns, runPts, type Line, type Pt } from '@/content/lines';
import type { Station, Pin } from '@/lib/content';
import type { TerrainFeature } from './terrain-kinds';
import Trains from './Trains';
import Critters from './Critters';
import Terrain from './Terrain';
import Bridges from './Bridges';
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

// Interchange / joint stop — where threads merge. A raised white hub wrapped by a
// segmented colour ring (one arc per line that meets here), so it reads instantly as
// a transfer between exactly those threads. The hub casts a soft shadow for depth.
function InterchangeMarker({ colors, sel }: { colors: string[]; sel: boolean }) {
  const base = sel ? RSEL : R;
  const ringR = base + 8;   // radius of the colour ring
  const hubR = base + 1;    // white hub inside it
  const n = Math.max(colors.length, 1);
  const seg = 360 / n;
  const gapDeg = n > 1 ? 18 : 0; // breathing room between arcs
  const toXY = (deg: number, rad: number) => { const a = ((deg - 90) * Math.PI) / 180; return [Math.cos(a) * rad, Math.sin(a) * rad]; };
  return (
    <g>
      {/* canvas halo so the crossing rails don't kiss the marker */}
      <circle r={ringR + 4} fill="var(--canvas)" />
      {/* colour ring — one arc segment per line meeting here */}
      {n === 1
        ? <circle r={ringR} fill="none" stroke={colors[0]} strokeWidth={5.5} />
        : colors.map((c, i) => {
            const a0 = i * seg + gapDeg / 2, a1 = (i + 1) * seg - gapDeg / 2;
            const [x0, y0] = toXY(a0, ringR), [x1, y1] = toXY(a1, ringR);
            const large = a1 - a0 > 180 ? 1 : 0;
            return <path key={i} d={`M ${x0} ${y0} A ${ringR} ${ringR} 0 ${large} 1 ${x1} ${y1}`} fill="none" stroke={c} strokeWidth={5.5} strokeLinecap="round" />;
          })}
      {/* raised white hub */}
      <g filter="url(#term-shadow)">
        <circle r={hubR} fill="#fff" stroke={INK} strokeWidth={sel ? 3 : 2.5} />
        <circle r={hubR * 0.42} fill={INK} />
      </g>
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
  stationPulse?: boolean; // pulse a stop when a train dwells
  expressTrain?: boolean; // allow the rare express run
  crittersRun?: boolean; // allow the track rat
  onHoverLine: (id: string | null) => void;
  onSelect: (id: string) => void;
  onOrigin?: () => void; // click the origin marker → About card
  origin?: [number, number]; // editable origin-marker position
  originLabel?: string; // editable pill text
  originCue?: string; // editable pill cue/button
  featured?: string[]; // station ids that pulse as "start here"
  codeOf?: Record<string, string>; // station id → system code (e.g. 02·01)
};

export default function TransitMap({ lines, stations, terrain, pins = [], selectedId, activeLine, started, trains, stationPulse = true, expressTrain = true, crittersRun = false, onHoverLine, onSelect, onOrigin, origin = [700, 96], originLabel = 'the origin — toeesh', originCue = 'about ↗', featured = [], codeOf = {} }: Props) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const dim = (lineId: string) => (activeLine && activeLine !== lineId ? 0.14 : 1);
  const [ox, oy] = origin;

  // frame the map to whatever has been drawn — no fixed cut-off rectangle (origin included)
  const b = useMemo(() => contentBounds(lines, [...stations, { x: ox, y: oy }], terrain), [lines, stations, terrain, ox, oy]);
  // stable identity so <Trains> doesn't restart every render (e.g. when a station is selected)
  const trainLines = useMemo(() => lines.map((l) => ({ id: l.id, color: l.color })), [lines]);
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
  const TERR_STAGGER = 0.1, TERR_DUR = 0.5; // water washes in gently rather than popping
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
      <defs>
        {/* soft shadow that lifts the terminus roundels off the canvas */}
        <filter id="term-shadow" x="-60%" y="-60%" width="220%" height="220%">
          <feDropShadow dx="0" dy="2.5" stdDeviation="3.5" floodColor="var(--terrain-shadow, rgba(20,20,20,0.22))" floodOpacity="1" />
        </filter>
        {/* one mask per tunnelled line — blacks out the underground runs so the solid ribbon
            disappears there (revealing the water beneath); the dotted overlay then shows the track */}
        {lines.map((l) => l.under?.length && l.pts ? (
          <mask key={l.id} id={`tun-${l.id}`} maskUnits="userSpaceOnUse">
            <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="white" />
            {tunnelRuns(l.under).map((run, ri) => (
              <path key={ri} d={roundedPath(runPts(l.pts as Pt[], run))} fill="none" stroke="black" strokeWidth={RIBBON + 10} strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </mask>
        ) : null)}
      </defs>
      {/* celestial dot grid — a nod to toeesh's starfield boards */}
      <g opacity={0.75}>
        {vx.map((x) => hy.map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.6} fill="var(--canvas-grid)" />))}
      </g>

      {/* terrain — fades in after the notes, before the lines */}
      <Terrain features={terrain} started={started} startAt={TERR_T} stagger={TERR_STAGGER} dur={TERR_DUR} />
      {/* bridges — auto-placed where a route crosses water; drawn before the lines so the ribbon rides over the deck */}
      <Bridges lines={lines} terrain={terrain} started={started} startAt={terrEnd} dur={LINE_DUR} />

      {/* lines (draw on one after another, after terrain) — id'd so trains can ride them.
          tunnelled lines are masked so their underground runs read as gaps (water shows through) */}
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
          mask={l.under?.length ? `url(#tun-${l.id})` : undefined}
          initial={{ pathLength: 0, opacity: dim(l.id) }}
          animate={{ pathLength: started ? 1 : 0, opacity: dim(l.id) }}
          transition={{ pathLength: { duration: LINE_DUR, delay: started ? lineStartAt(i) : 0, ease: [0.65, 0, 0.35, 1] }, opacity: { duration: 0.25 } }}
        />
      ))}

      {/* tunnels — the dotted underground track + portal mouths where each run dives / surfaces */}
      <g className="tunnels" aria-hidden>
        {lines.map((l) => {
          if (!l.under?.length || !l.pts) return null;
          const pts = l.pts as Pt[];
          return tunnelRuns(l.under).map((run, ri) => {
            const sub = runPts(pts, run);
            const ends: { p: Pt; q: Pt }[] = [{ p: sub[0], q: sub[1] }, { p: sub[sub.length - 1], q: sub[sub.length - 2] }];
            return (
              <motion.g key={`${l.id}-${ri}`} style={{ opacity: dim(l.id) }}
                initial={{ opacity: 0 }} animate={{ opacity: started ? dim(l.id) : 0 }}
                transition={{ delay: started ? lineEndAt(lineIndex[l.id] ?? 0) : 0, duration: 0.4 }}>
                <path d={roundedPath(sub)} fill="none" stroke={l.color} strokeWidth={RIBBON * 0.55} strokeDasharray="0.1 11" strokeLinecap="round" opacity={0.55} />
                {ends.map(({ p, q }, k) => {
                  const dx = p[0] - q[0], dy = p[1] - q[1], len = Math.hypot(dx, dy) || 1;
                  const nx = -dy / len, ny = dx / len, h = RIBBON / 2 + 4;
                  return <line key={k} x1={p[0] - nx * h} y1={p[1] - ny * h} x2={p[0] + nx * h} y2={p[1] + ny * h} stroke={l.color} strokeWidth={3.5} strokeLinecap="round" />;
                })}
              </motion.g>
            );
          });
        })}
      </g>

      {/* trains — JS rAF beads riding the lines (white, high-contrast, always move) */}
      <Trains lines={trainLines} stations={stations} run={trains} stationPulse={stationPulse} expressTrain={expressTrain} onBoard={onSelect} />
      <Critters lines={trainLines} run={crittersRun} />

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
      {/* pill animates via an SVG <g> wrapper — framer won't animate an HTML node inside foreignObject */}
      <motion.g
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: started ? 1 : 0, x: started ? 0 : -12 }}
        transition={{ delay: started ? ORIGIN_T + 0.24 : 0, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
        <foreignObject x={ox + 36} y={oy - 28} width={360} height={44} style={{ overflow: 'visible' }}>
          <button className="plate big origin-plate" onClick={() => onOrigin?.()}><span className="dot" style={{ background: '#141414' }} />{originLabel}{originCue && <span className="origin-cue">{originCue}</span>}</button>
        </foreignObject>
      </motion.g>

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
