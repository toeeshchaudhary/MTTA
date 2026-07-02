'use client';
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RIBBON, roundedPath, contentBounds, tunnelRuns, runPts, ghost, type Line, type Pt } from '@/content/lines';
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

// evenly-spaced points along a polyline — used for the dotted buried-path trail
function dotsAlong(poly: Pt[], spacing: number, inset: number): Pt[] {
  const seg: number[] = []; let total = 0;
  for (let i = 0; i < poly.length - 1; i++) { const d = Math.hypot(poly[i + 1][0] - poly[i][0], poly[i + 1][1] - poly[i][1]); seg.push(d); total += d; }
  const at = (d: number): Pt => { let acc = 0; for (let i = 0; i < seg.length; i++) { if (acc + seg[i] >= d) { const t = (d - acc) / (seg[i] || 1); return [poly[i][0] + (poly[i + 1][0] - poly[i][0]) * t, poly[i][1] + (poly[i + 1][1] - poly[i][1]) * t]; } acc += seg[i]; } return poly[poly.length - 1]; };
  const out: Pt[] = [];
  for (let d = inset; d <= total - inset; d += spacing) out.push(at(d));
  return out;
}

// geometry for one underground run: the cap sits a little BEFORE the dive corner (on the
// straight approach) so the masked-out corner can't leave a notch; caps + buried trail follow.
function tunnelGeom(pts: Pt[], run: [number, number]) {
  const RET = RIBBON * 1.15;
  const sub = runPts(pts, run);
  const D = sub[0], S = sub[sub.length - 1];
  const A = run[0] - 1 >= 0 ? pts[run[0] - 1] : null;          // above-ground stop before the dive
  const B = run[1] + 2 < pts.length ? pts[run[1] + 2] : null;  // above-ground stop after the surface
  const toward = (P: Pt, Q: Pt): Pt => { const dx = Q[0] - P[0], dy = Q[1] - P[1], len = Math.hypot(dx, dy) || 1; return [P[0] + (dx / len) * RET, P[1] + (dy / len) * RET]; };
  const capDive = A ? toward(D, A) : D;
  const capSurf = B ? toward(S, B) : S;
  const maskPts: Pt[] = [...(A ? [capDive] : []), ...sub, ...(B ? [capSurf] : [])];
  return { maskPts, caps: [capDive, capSurf] as Pt[], trail: dotsAlong(maskPts, 20, 13) };
}

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

// Boarded-up stop — every thread it sat on has been abandoned. A hollow, drained
// ring with an "×" struck through it, so it reads as a shuttered station rather than
// an active stop. Ghost-grey, no white fill, no shadow — it recedes into the disused line.
function GhostMarker({ sel }: { sel: boolean }) {
  const r = (sel ? RSEL : R) + 1;
  const c = '#8f8f96';
  return (
    <g opacity={0.72}>
      <circle r={r + 4} fill="var(--canvas)" />
      <circle r={r} fill="var(--canvas)" stroke={c} strokeWidth={2.5} strokeDasharray="3 3" />
      <path d={`M ${-r * 0.5} ${-r * 0.5} L ${r * 0.5} ${r * 0.5} M ${r * 0.5} ${-r * 0.5} L ${-r * 0.5} ${r * 0.5}`} stroke={c} strokeWidth={2.5} strokeLinecap="round" />
    </g>
  );
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
  activeLines: string[]; // hovered or focused threads (an interchange lights all of its lines)
  zoomedIn?: boolean; // past the label-reveal zoom threshold → name every stop at rest
  started: boolean; // intro finished → run draw-on
  trains: boolean; // run the moving beads
  stationPulse?: boolean; // pulse a stop when a train dwells
  expressTrain?: boolean; // allow the rare express run
  crittersRun?: boolean; // allow the track rat
  onHoverLine: (ids: string[]) => void;
  onSelect: (id: string) => void;
  onOrigin?: () => void; // click the origin marker → About card
  origin?: [number, number]; // editable origin-marker position
  originLabel?: string; // editable pill text
  originCue?: string; // editable pill cue/button
  featured?: string[]; // station ids that pulse as "start here"
  codeOf?: Record<string, string>; // station id → system code (e.g. 02·01)
};

export default function TransitMap({ lines, stations, terrain, pins = [], selectedId, activeLines, zoomedIn = false, started, trains, stationPulse = true, expressTrain = true, crittersRun = false, onHoverLine, onSelect, onOrigin, origin = [700, 96], originLabel = 'the origin — toeesh', originCue = 'about ↗', featured = [], codeOf = {} }: Props) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [coarse, setCoarse] = useState(false); // touch: no hover, so name key stops at rest + enlarge hit areas
  useEffect(() => { try { setCoarse(matchMedia('(pointer: coarse)').matches); } catch {} }, []);
  const dim = (lineId: string) => (activeLines.length > 0 && !activeLines.includes(lineId) ? 0.14 : 1);
  const [ox, oy] = origin;
  // abandoned threads: no train ever rides them, their ribbon ghosts + breaks up, and a
  // stop whose every thread is abandoned gets boarded up. (An interchange keeps its life
  // as long as one live thread still passes through it.)
  const deadSet = useMemo(() => new Set(lines.filter((l) => l.abandoned).map((l) => l.id)), [lines]);
  const stopIsDead = (s: Station) => { const ls = s.lines && s.lines.length ? s.lines : [s.line]; return ls.length > 0 && ls.every((id) => deadSet.has(id)); };

  // frame the map to whatever has been drawn — no fixed cut-off rectangle (origin included)
  const b = useMemo(() => contentBounds(lines, [...stations, { x: ox, y: oy }], terrain), [lines, stations, terrain, ox, oy]);
  // stable identity so <Trains> doesn't restart every render (e.g. when a station is selected)
  const trainLines = useMemo(() => lines.filter((l) => !l.abandoned).map((l) => ({ id: l.id, color: l.color, pts: l.pts, under: l.under })), [lines]);
  const GS = 50; // denser celestial dot grid
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
    return { id: l.id, i, color: l.color, text: l.text, dead: !!l.abandoned, closed: (l.closed || '').trim(), x: end[0] + (vx / len) * BULLET_OFF, y: end[1] + (vy / len) * BULLET_OFF };
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
              <path key={ri} d={roundedPath(tunnelGeom(l.pts as Pt[], run).maskPts)} fill="none" stroke="black" strokeWidth={RIBBON + 6} strokeLinecap="butt" strokeLinejoin="round" />
            ))}
          </mask>
        ) : null)}
      </defs>
      {/* celestial dot grid — a nod to toeesh's starfield boards */}
      <g opacity={0.7}>
        {vx.map((x) => hy.map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.4} fill="var(--canvas-grid)" />))}
      </g>

      {/* terrain — fades in after the notes, before the lines */}
      <Terrain features={terrain} started={started} startAt={TERR_T} stagger={TERR_STAGGER} dur={TERR_DUR} />
      {/* bridges — auto-placed where a route crosses water; drawn before the lines so the ribbon rides over the deck */}
      <Bridges lines={lines} terrain={terrain} started={started} startAt={terrEnd} dur={LINE_DUR} />

      {/* lines (draw on one after another, after terrain) — id'd so trains can ride them.
          tunnelled lines are masked so their underground runs read as gaps (water shows through) */}
      {lines.map((l, i) => {
        // abandoned: a drained, broken ribbon that just fades in (no draw-on — framer's
        // pathLength drives strokeDasharray internally and would fight our own dash).
        if (l.abandoned) {
          return (
            <motion.path
              key={l.id}
              id={`line-${l.id}`}
              d={l.d}
              fill="none"
              stroke={ghost(l.color)}
              strokeWidth={RIBBON - 4}
              strokeLinecap="butt"
              strokeLinejoin="round"
              strokeDasharray="15 13"
              mask={l.under?.length ? `url(#tun-${l.id})` : undefined}
              initial={{ opacity: 0 }}
              animate={{ opacity: started ? dim(l.id) * 0.5 : 0 }}
              transition={{ opacity: { duration: 0.6, delay: started ? lineStartAt(i) : 0 } }}
            />
          );
        }
        return (
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
        );
      })}

      {/* tunnels — the ribbon just ends with a clean rounded cap where it dips under, and a
          faint dotted trail marks the buried path until it re-emerges (no solid track) */}
      <g className="tunnels" aria-hidden>
        {lines.map((l) => {
          if (!l.under?.length || !l.pts) return null;
          const pts = l.pts as Pt[];
          return tunnelRuns(l.under).map((run, ri) => {
            const g = tunnelGeom(pts, run);
            return (
              <motion.g key={`${l.id}-${ri}`}
                initial={{ opacity: 0 }} animate={{ opacity: started ? dim(l.id) : 0 }}
                transition={{ delay: started ? lineEndAt(lineIndex[l.id] ?? 0) : 0, duration: 0.4 }}>
                {/* clean rounded ends, set back onto the straight approach so no corner notch shows */}
                {g.caps.map((c, ci) => <circle key={`c${ci}`} cx={c[0]} cy={c[1]} r={RIBBON / 2} fill={l.abandoned ? ghost(l.color) : l.color} />)}
                {/* the buried path, as a faint dot trail */}
                {g.trail.map((p, di) => <circle key={di} cx={p[0]} cy={p[1]} r={2.3} fill={l.abandoned ? ghost(l.color) : l.color} opacity={0.42} />)}
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
        const dead = stopIsDead(s); // every thread through here is abandoned → board it up
        const onLine = (l: string) => s.line === l || (s.lines?.includes(l) ?? false);
        // keep the name tablets OUT of the at-rest overview — solid pills sitting over the
        // ribbons hid the lines and looked messy. They reveal on hover/focus, when a single
        // thread is active, or once you zoom in past the threshold. featured stops still pulse
        // (a thin stroke-only ring, no fill) so the eye is guided without covering anything.
        const atRest = activeLines.length === 0 && !selectedId;
        // touch has no hover, so at rest name the wayfinding anchors (featured + interchanges) —
        // a curated few, never the full set (320px plates would overlap).
        const anchorOnTouch = coarse && atRest && (featured.includes(s.id) || (s.lines?.length ?? 0) >= 2);
        const show = sel || hoverId === s.id || (activeLines.length === 1 && onLine(activeLines[0])) || (zoomedIn && atRest) || anchorOnTouch;
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
              onMouseEnter={() => { setHoverId(s.id); onHoverLine(s.lines && s.lines.length ? s.lines : [s.line]); }}
              onMouseLeave={() => { setHoverId(null); onHoverLine([]); }}
              onFocus={() => { setHoverId(s.id); onHoverLine(s.lines && s.lines.length ? s.lines : [s.line]); }}
              onBlur={() => { setHoverId(null); onHoverLine([]); }}
              onClick={() => onSelect(s.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(s.id); } }}
            >
              {/* touch-only: an invisible 44px hit target so small dots are thumb-tappable */}
              {coarse && <circle r={22} fill="transparent" />}
              {(sel || (featured.includes(s.id) && !selectedId && !dead)) && (
                <motion.circle
                  r={RSEL + 8}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={4}
                  animate={{ scale: [1, 1.3, 1], opacity: [0.9, 0.15, 0.9] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
              {dead
                ? <GhostMarker sel={sel} />
                : s.lines && s.lines.length >= 2
                  ? <InterchangeMarker colors={s.colors} sel={sel} />
                  : <ShapeMarker shape={s.shape} sel={sel} />}
              <AnimatePresence>
                {show && (
                  <motion.foreignObject
                    key="label"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.16, ease: 'easeOut' }}
                    x={labelRight ? RSEL + 12 : -(320 + RSEL + 12)} y={-42} width={320} height={84}
                    // visual-only: a 320-wide tablet would otherwise overlap a neighbouring
                    // stop's marker and hijack its clicks (you'd open the wrong station).
                    style={{ overflow: 'visible', pointerEvents: 'none' }}>
                    <div className="plate-wrap" style={{ justifyContent: labelRight ? 'flex-start' : 'flex-end' }}>
                      <span className={`plate ${dead ? 'ghost' : ''}`}>{codeOf[s.id] && <span className="plate-code">{codeOf[s.id]}</span>}<span className="dot" style={{ background: dead ? '#8f8f96' : s.color }} /><span className="plate-title">{s.title}</span>{dead && <span className="plate-closed">closed</span>}</span>
                    </div>
                  </motion.foreignObject>
                )}
              </AnimatePresence>
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
            animate={{ scale: started ? 1 : 0, opacity: started ? dim(t.id) * (t.dead ? 0.6 : 1) : 0 }}
            transition={{ delay: started ? lineEndAt(t.i) : 0, type: 'spring', stiffness: 320, damping: 16 }}>
            <circle r={15} fill="var(--canvas)" stroke="var(--canvas)" strokeWidth={6} />
            {/* abandoned: a hollow, drained roundel instead of the solid numbered bullet */}
            {t.dead
              ? <circle r={14} fill="var(--canvas)" stroke={ghost(t.color)} strokeWidth={2.5} strokeDasharray="3 3" />
              : <circle r={14} fill={t.color} />}
            <text textAnchor="middle" dominantBaseline="central" fontSize={14} fontWeight={700} fill={t.dead ? '#8f8f96' : (t.text || '#fff')} style={{ fontFamily: 'var(--font-mono)' }}>{t.i + 1}</text>
            {/* the "closed" story tag — service history at the dead end */}
            {t.dead && t.closed && (
              <text y={30} textAnchor="middle" fontSize={11} fontWeight={600} fill="#8f8f96" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>✕ {t.closed}</text>
            )}
          </motion.g>
        </g>
      ))}
    </svg>
  );
}
