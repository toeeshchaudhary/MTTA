'use client';
import { memo, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RIBBON, roundedPath, contentBounds, tunnelRuns, runPts, ghost, lineCodes, type Line, type Pt } from '@/content/lines';
import type { Station, Pin } from '@/lib/content';
import type { TerrainFeature } from './terrain-kinds';
import Trains from './Trains';
import Critters from './Critters';
import Terrain from './Terrain';
import Bridges from './Bridges';
import Pins from './Pins';

const R = 11;
const RSEL = 16;

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

// A stop, WMATA-rail-map style: a compact solid ink dot sitting ON the ribbon,
// ringed by the canvas colour so it separates cleanly from the line. The dot is
// ink-dark on the paper map and flips white on the night field (via --st-dot).
function ShapeMarker({ shape, sel }: { shape: Station['shape']; sel: boolean }) {
  const r = (sel ? RSEL : R) * 0.8;
  const fill = 'var(--st-dot, #141414)';
  const ring = 'var(--canvas)';
  const sw = 2.5;
  if (shape === 'square') return <rect x={-r} y={-r} width={r * 2} height={r * 2} fill={fill} stroke={ring} strokeWidth={sw} />;
  if (shape === 'triangle') {
    const h = r * 1.9;
    return <polygon points={`0,${-h * 0.6} ${r * 1.1},${h * 0.5} ${-r * 1.1},${h * 0.5}`} fill={fill} stroke={ring} strokeWidth={sw} strokeLinejoin="round" />;
  }
  if (shape === 'semi') return <path d={`M ${-r},${r * 0.55} A ${r},${r} 0 0 1 ${r},${r * 0.55} Z`} fill={fill} stroke={ring} strokeWidth={sw} strokeLinejoin="round" />;
  return <circle r={r} fill={fill} stroke={ring} strokeWidth={sw} />;
}

// Boarded-up stop — every thread it sat on has been abandoned. A hollow, drained
// ring with an "×" struck through it, so it reads as a shuttered station rather than
// an active stop. Ghost-grey, no white fill, no shadow — it recedes into the disused line.
function GhostMarker({ sel }: { sel: boolean }) {
  const r = (sel ? RSEL : R) + 1;
  const c = '#8f8f96';
  return (
    <g opacity={0.72} className="ghost-marker">
      <circle r={r + 4} fill="var(--canvas)" />
      <circle r={r} fill="var(--canvas)" stroke={c} strokeWidth={2.5} strokeDasharray="3 3" />
      <path d={`M ${-r * 0.5} ${-r * 0.5} L ${r * 0.5} ${r * 0.5} M ${r * 0.5} ${-r * 0.5} L ${-r * 0.5} ${r * 0.5}`} stroke={c} strokeWidth={2.5} strokeLinecap="round" />
    </g>
  );
}

// Interchange / transfer — the WMATA-rail-map bullseye: a white disc with a bold
// ink ring and a thin inner ring (⊚). Flat, no shadow — the meeting ribbons
// themselves say which lines transfer here.
function InterchangeMarker({ sel }: { sel: boolean }) {
  const r = (sel ? RSEL : R) + 4;
  const ink = 'var(--st-dot, #141414)';
  return (
    <g>
      {/* canvas halo so the crossing rails don't kiss the marker */}
      <circle r={r + 4} fill="var(--canvas)" />
      <circle r={r} fill="#fff" stroke={ink} strokeWidth={3.5} />
      <circle r={r * 0.45} fill="none" stroke={ink} strokeWidth={2.2} />
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
  focusedLine?: string | null; // explicit legend focus — the only state that names a whole line
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

export default memo(function TransitMap({ lines, stations, terrain, pins = [], selectedId, activeLines, focusedLine = null, zoomedIn = false, started, trains, stationPulse = true, expressTrain = true, crittersRun = false, onHoverLine, onSelect, onOrigin, origin = [700, 96], originLabel = 'the origin — toeesh', originCue = 'about ↗', featured = [] }: Props) {
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
  // WMATA-style route letter codes for the terminus bullets (CE, MU, PR, …)
  const codes = useMemo(() => lineCodes(lines), [lines]);
  // station features (the Ⓟ-icon grammar): derived from existing content — M media
  // inside · ↗ links out · ★ start-here spotlight. No authoring needed.
  const featOf = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const s of stations) {
      const g: string[] = [];
      if (s.media?.length) g.push('M');
      if (/https?:\/\//.test(s.body || '')) g.push('↗');
      if (featured.includes(s.id)) g.push('★');
      if (g.length) out[s.id] = g;
    }
    return out;
  }, [stations, featured]);
  // celestial dot grid — memoised so hover re-renders reconcile one stable array
  // instead of rebuilding ~1000 circle elements every time
  const grid = useMemo(() => {
    const GS = 50, cells: React.ReactElement[] = [];
    for (let x = Math.floor(b.x / GS) * GS; x <= b.x + b.w; x += GS)
      for (let y = Math.floor(b.y / GS) * GS; y <= b.y + b.h; y += GS)
        cells.push(<circle key={`${x}-${y}`} cx={x} cy={y} r={1.4} fill="var(--canvas-grid)" />);
    return cells;
  }, [b]);
  // tunnel geometry per line — the mask paths, caps and dot trails are expensive
  // (dotsAlong walks the whole polyline); compute once per content change
  const tunnelGeoms = useMemo(() => lines
    .filter((l) => l.under?.length && l.pts)
    .map((l) => ({ id: l.id, color: l.abandoned ? ghost(l.color) : l.color, runs: tunnelRuns(l.under as number[]).map((run) => tunnelGeom(l.pts as Pt[], run)) })), [lines]);

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

  // once the cascade has fully played, every later animation (hover dims, scale pops)
  // must run with ZERO delay — reusing the intro delays made hovering feel seconds late.
  const [introDone, setIntroDone] = useState(false);
  useEffect(() => {
    if (!started) { setIntroDone(false); return; }
    const total = (lineEndAt(lines.length - 1) + 1.6) * 1000; // past the last stop's stagger
    const t = setTimeout(() => setIntroDone(true), total);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, lines.length]);
  const dly = (d: number) => (started && !introDone ? d : 0);

  // ---- terminus bullets: sit clearly BEYOND each line's last stop (past the
  // station marker, in open canvas so they never blend with the line), fanned out
  // when several lines end at (or overlap on) the same point so numbers don't stack ----
  const BULLET_OFF = 46;
  const termini = lines.map((l, i) => {
    const pts = l.pts; if (!pts || pts.length < 2) return null;
    const end = pts[pts.length - 1], prev = pts[pts.length - 2];
    const vx = end[0] - prev[0], vy = end[1] - prev[1], len = Math.hypot(vx, vy) || 1;
    return { id: l.id, i, color: l.color, text: l.text, dead: !!l.abandoned, closed: (l.closed || '').trim(), ex: end[0], ey: end[1], x: end[0] + (vx / len) * BULLET_OFF, y: end[1] + (vy / len) * BULLET_OFF };
  }).filter((t): t is NonNullable<typeof t> => t !== null);
  const groups: Record<string, typeof termini> = {};
  for (const t of termini) { const key = `${Math.round(t.x / 18)}:${Math.round(t.y / 18)}`; (groups[key] ||= []).push(t); }
  for (const g of Object.values(groups)) if (g.length > 1) g.forEach((t, k) => { t.x += (k - (g.length - 1) / 2) * 32; });

  // ---- segment orientation per station (drives label placement) -------------
  // `a` set → the line runs diagonally here, the label rotates to follow it
  // (true segment angle, normalised to (-90°, 90°] so text is never upside-down).
  // `horiz` set → the line runs flat here, so labels must sit above/below the
  // ribbon rather than centred on it.
  const segInfo = useMemo(() => {
    const byLine: Record<string, Pt[] | undefined> = Object.fromEntries(lines.map((l) => [l.id, l.pts as Pt[] | undefined]));
    const out: Record<string, { a?: number; horiz?: boolean }> = {};
    for (const s of stations) {
      const pts = byLine[s.line]; if (!pts || pts.length < 2) continue;
      let best = Infinity, ang = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
        const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((s.x - ax) * dx + (s.y - ay) * dy) / len2));
        const d = Math.hypot(s.x - (ax + t * dx), s.y - (ay + t * dy));
        if (d < best) { best = d; ang = (Math.atan2(dy, dx) * 180) / Math.PI; }
      }
      if (best > 30) continue; // not actually sitting on its line — leave flat
      let a = ((ang % 180) + 180) % 180; if (a > 90) a -= 180;
      const abs = Math.abs(a);
      // follow the segment's true angle — snapping to 45° would peel labels off the
      // gentler diagonals this network actually runs (~20-35°)
      if (abs > 15 && abs < 75) out[s.id] = { a: Math.round(a * 10) / 10 };
      else if (abs <= 15) out[s.id] = { horiz: true };
    }
    return out;
  }, [stations, lines]);

  // ---- label auto-placement -------------------------------------------------
  // Name plates are ~320×84. When they all reveal (zoom-in), pack them without
  // collisions: for each stop try side (right/left) × vertical slot (centre/above/
  // below), greedily picking the first that clears every already-placed plate AND
  // every station marker. Stops can now sit close and the labels dodge each other.
  const labelPos = useMemo(() => {
    // The foreignObject renders at 320×84, but the visible label is one ~34px text
    // band roughly as wide as the title — collide on THAT, not the render box, or
    // labels get shoved around (and overlap anyway) on dense stretches.
    const FOW = 320, FOH = 84, GAP = RSEL + 12, EH = 34;
    type Box = { x: number; y: number; w: number; h: number };
    const ovl = (a: Box, c: Box) => Math.max(0, Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x)) * Math.max(0, Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y));
    const estW = (s: Station) => Math.max(90, Math.min(300, 16 + s.title.length * 8 + (featOf[s.id]?.length ?? 0) * 16));
    const placed: Box[] = stations.map((s) => ({ x: s.x - 24, y: s.y - 24, w: 48, h: 48 })); // markers are obstacles
    const out: Record<string, { fx: number; fy: number; right: boolean; a?: number }> = {};
    // rotated labels first: they follow their line (fixed slot, no greedy search) but
    // their (tight) rotated bounds still block the flat labels placed after them
    for (const s of stations) {
      const a = segInfo[s.id]?.a;
      if (a === undefined) continue;
      const w = estW(s);
      out[s.id] = { fx: GAP, fy: -FOH / 2 - 10, right: true, a };
      const rad = (a * Math.PI) / 180, cos = Math.cos(rad), sin = Math.sin(rad);
      // the text band sits 10px above the line: local x GAP..GAP+w, y -27..7
      const corners: Pt[] = ([[GAP, -27], [GAP + w, -27], [GAP, 7], [GAP + w, 7]] as Pt[])
        .map(([px, py]) => [s.x + px * cos - py * sin, s.y + px * sin + py * cos] as Pt);
      const xs = corners.map((c) => c[0]), ys = corners.map((c) => c[1]);
      placed.push({ x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) });
    }
    // vertical slots as text-centre offsets from the dot. Stops on a horizontal
    // segment must lift their name OFF the ribbon (above/below first); everywhere
    // else the classic centred slot leads.
    const V_CENT = [0, -30, 30, -64, 64], V_HORIZ = [-30, 30, -64, 64, 0];
    for (const s of [...stations].sort((a2, b2) => a2.y - b2.y || a2.x - b2.x)) {
      if (out[s.id]) continue; // rotated — already placed
      const w = estW(s);
      const offs = segInfo[s.id]?.horiz ? V_HORIZ : V_CENT;
      const pref = s.x < 980;
      let pick = { right: pref, v: offs[0] }, bestA = Infinity;
      outer: for (const right of [pref, !pref]) {
        for (const v of offs) {
          const box: Box = { x: right ? s.x + GAP : s.x - GAP - w, y: s.y + v - EH / 2, w, h: EH };
          let area = 0;
          for (const p of placed) area += ovl(box, p);
          if (area === 0) { pick = { right, v }; bestA = 0; break outer; }
          if (area < bestA) { bestA = area; pick = { right, v }; } // degrade to least-overlap
        }
      }
      placed.push({ x: pick.right ? s.x + GAP : s.x - GAP - w, y: s.y + pick.v - EH / 2, w, h: EH });
      out[s.id] = { fx: pick.right ? GAP : -(FOW + GAP), fy: pick.v - FOH / 2, right: pick.right };
    }
    return out;
  }, [stations, segInfo, featOf]);

  return (
    <svg viewBox={b.viewBox} className="tmap" width={b.w} height={b.h} role="group" aria-label="The network — a map of toeesh">
      <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="var(--canvas)" />
      {/* invisible anchor at the home centre (origin + central + welcome) that the camera
          centres on when the map opens — structured like a station <g> so zoomToElement
          measures it. See focusHome() in Experience. */}
      <g id="home-anchor" transform="translate(600,340)" pointerEvents="none"><circle r={1} fill="transparent" /></g>
      <defs>
        {/* soft shadow that lifts the terminus roundels off the canvas */}
        <filter id="term-shadow" x="-60%" y="-60%" width="220%" height="220%">
          <feDropShadow dx="0" dy="2.5" stdDeviation="3.5" floodColor="var(--terrain-shadow, rgba(20,20,20,0.22))" floodOpacity="1" />
        </filter>
        {/* neon bloom — blurs the source (so it glows in the element's OWN colour) and
            layers the sharp graphic back on top. Applied only in night-owl mode via CSS. */}
        <filter id="neon" x="-40%" y="-40%" width="180%" height="180%" filterUnits="objectBoundingBox">
          <feGaussianBlur stdDeviation="3.2" result="b1" />
          <feGaussianBlur stdDeviation="7" result="b2" />
          <feMerge>
            <feMergeNode in="b2" />
            <feMergeNode in="b1" />
            <feMergeNode in="b1" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* one mask per tunnelled line — blacks out the underground runs so the solid ribbon
            disappears there (revealing the water beneath); the dotted overlay then shows the track */}
        {tunnelGeoms.map((tg) => (
          <mask key={tg.id} id={`tun-${tg.id}`} maskUnits="userSpaceOnUse">
            <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="white" />
            {tg.runs.map((g, ri) => (
              <path key={ri} d={roundedPath(g.maskPts)} fill="none" stroke="black" strokeWidth={RIBBON + 6} strokeLinecap="butt" strokeLinejoin="round" />
            ))}
          </mask>
        ))}
      </defs>
      {/* celestial dot grid — night registers only; the paper map is clean print */}
      <g className="dotgrid" opacity={0.7}>{grid}</g>

      {/* printed-map marginalia — north arrow + the honesty notes, in the padding band */}
      <g aria-hidden pointerEvents="none">
        <g transform={`translate(${b.x + 46},${b.y + 52})`} stroke="var(--terrain-label)" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M 0 18 L 0 -12 M -5 -4 L 0 -12 L 5 -4" />
          <text x={0} y={38} className="terrain-label" fill="var(--terrain-label)" stroke="none" textAnchor="middle">N</text>
        </g>
        <text x={b.x + 40} y={b.y + b.h - 44} className="terrain-label" fill="var(--terrain-label)">map is not to scale</text>
        <text x={b.x + 40} y={b.y + b.h - 22} className="terrain-label" fill="var(--terrain-label)">the network is accessible</text>
      </g>

      {/* terrain — fades in after the notes, before the lines */}
      <Terrain features={terrain} started={started} startAt={TERR_T} stagger={TERR_STAGGER} dur={TERR_DUR} />

      {/* the beltway — the gray highway loop framing the whole network (auto-generated
          from the content bounds; rides over the water, under every rail ribbon) */}
      <motion.g aria-hidden pointerEvents="none"
        initial={{ opacity: 0 }} animate={{ opacity: started ? 1 : 0 }}
        transition={{ delay: dly(TERR_T), duration: TERR_DUR }}>
        {(() => {
          // inset 22: the terminus bullets live ~59-89 units inside the padded bounds,
          // so the band (spans ~11-33 at this inset) clears them entirely
          const IN = 22, r = 170;
          const x = b.x + IN, y = b.y + IN, w = b.w - IN * 2, h = b.h - IN * 2;
          const ring = `M ${x + r} ${y} L ${x + w - r} ${y} A ${r} ${r} 0 0 1 ${x + w} ${y + r} L ${x + w} ${y + h - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} L ${x + r} ${y + h} A ${r} ${r} 0 0 1 ${x} ${y + h - r} L ${x} ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`;
          return (
            <>
              <path d={ring} fill="none" stroke="var(--road-casing)" strokeWidth={28} />
              <path d={ring} fill="none" stroke="var(--road)" strokeWidth={22} />
              <text x={b.x + b.w / 2} y={y + 5} textAnchor="middle" dominantBaseline="middle" className="terrain-label" fill="var(--road-label)">the beltway</text>
            </>
          );
        })()}
      </motion.g>
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
              transition={{ opacity: { duration: 0.6, delay: dly(lineStartAt(i)) } }}
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
          transition={{ pathLength: { duration: LINE_DUR, delay: dly(lineStartAt(i)), ease: [0.65, 0, 0.35, 1] }, opacity: { duration: 0.25 } }}
        />
        );
      })}

      {/* tunnels — the ribbon just ends with a clean rounded cap where it dips under, and a
          faint dotted trail marks the buried path until it re-emerges (no solid track) */}
      <g className="tunnels" aria-hidden>
        {tunnelGeoms.map((tg) => tg.runs.map((g, ri) => (
          <motion.g key={`${tg.id}-${ri}`}
            initial={{ opacity: 0 }} animate={{ opacity: started ? dim(tg.id) : 0 }}
            transition={{ delay: dly(lineEndAt(lineIndex[tg.id] ?? 0)), duration: 0.4 }}>
            {/* clean rounded ends, set back onto the straight approach so no corner notch shows */}
            {g.caps.map((c, ci) => <circle key={`c${ci}`} cx={c[0]} cy={c[1]} r={RIBBON / 2} fill={tg.color} />)}
            {/* the buried path, as a faint dot trail */}
            {g.trail.map((p, di) => <circle key={di} cx={p[0]} cy={p[1]} r={2.3} fill={tg.color} opacity={0.42} />)}
          </motion.g>
        )))}
      </g>

      {/* trains — JS rAF beads riding the lines (white, high-contrast, always move) */}
      <Trains lines={trainLines} stations={stations} run={trains} stationPulse={stationPulse} expressTrain={expressTrain} onBoard={onSelect} />
      <Critters lines={trainLines} run={crittersRun} />

      {/* the pinboard — settles in right after the origin */}
      <Pins pins={pins} started={started} startAt={NOTES_T} stagger={NOTE_STAGGER} dur={NOTE_DUR} />

      {/* origin — movable; opens with a ping + aperture on intro; click for About */}
      <g transform={`translate(${ox},${oy})`}>
        {/* expanding ping ring — the "opening" beat */}
        <motion.circle r={30} fill="none" stroke="var(--roundel, #2b2b33)" strokeWidth={3}
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
          <circle r={30} fill="var(--roundel, #2b2b33)" />
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
        // a plain hover names ONLY the hovered stop (the rest of its line still lights
        // via the dims); the line-wide reveal belongs to an explicit legend focus
        const show = sel || hoverId === s.id || (!!focusedLine && onLine(focusedLine)) || (zoomedIn && atRest) || anchorOnTouch;
        const pl = labelPos[s.id] ?? { fx: s.x < 980 ? RSEL + 12 : -(320 + RSEL + 12), fy: -42, right: s.x < 980 };
        return (
          <g key={s.id} id={`st-${s.id}`} transform={`translate(${s.x},${s.y})`}>
            <motion.g
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: started ? 1 : 0, opacity: started ? dim(s.line) : 0 }}
              transition={{ delay: dly(stDelay[s.id] ?? 0.5), type: 'spring', stiffness: 340, damping: 18 }}
            >
              {/* the interactive marker — hover/tap scale lives HERE so the name never
                  inflates, and the focus ring hugs the dot instead of boxing the label */}
              <motion.g
                style={{ cursor: 'pointer' }}
                tabIndex={0}
                role="button"
                aria-label={s.title}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.92 }}
                onMouseEnter={() => { setHoverId(s.id); onHoverLine(s.lines && s.lines.length ? s.lines : [s.line]); }}
                onMouseLeave={() => { setHoverId(null); onHoverLine([]); }}
                onFocus={() => { setHoverId(s.id); onHoverLine(s.lines && s.lines.length ? s.lines : [s.line]); }}
                onBlur={() => { setHoverId(null); onHoverLine([]); }}
                onClick={() => onSelect(s.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(s.id); } }}
              >
                {/* an invisible 44px hit disc — the Wyman dots are small, so without this
                    the hover target is ~8px and the cursor thrashes enter/leave at its edge
                    (labels strobe); it also keeps small dots thumb-tappable on touch */}
                <circle r={22} fill="transparent" />
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
                    ? <InterchangeMarker sel={sel} />
                    : <ShapeMarker shape={s.shape} sel={sel} />}
              </motion.g>
              <AnimatePresence>
                {show && (
                  <motion.foreignObject
                    key="label"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.16, ease: 'easeOut' }}
                    transform={pl.a ? `rotate(${pl.a})` : undefined}
                    x={pl.fx} y={pl.fy} width={320} height={84}
                    // visual-only: a 320-wide tablet would otherwise overlap a neighbouring
                    // stop's marker and hijack its clicks (you'd open the wrong station).
                    style={{ overflow: 'visible', pointerEvents: 'none' }}>
                    <div className="plate-wrap" style={{ justifyContent: pl.right ? 'flex-start' : 'flex-end' }}>
                      <span className={`plate ${dead ? 'ghost' : ''}`}><span className="dot" style={{ background: dead ? '#8f8f96' : s.color }} /><span className="plate-title">{s.title}</span>{featOf[s.id]?.map((g) => <i key={g} className={`feat-ic ${g === '★' ? 'feat-star' : ''}`}>{g}</i>)}{dead && <span className="plate-closed">closed</span>}</span>
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
      {termini.map((t) => t.dead ? (
        // abandoned dead-end: NO route roundel (the boarded × stop already marks the end).
        // just a single caption sitting cleanly below the last stop, so nothing overlaps.
        t.closed ? (
          <motion.text key={`closed-${t.id}`} x={t.ex} y={t.ey + 44} textAnchor="middle"
            initial={{ opacity: 0 }} animate={{ opacity: started ? dim(t.id) * 0.8 : 0 }}
            transition={{ delay: dly(lineEndAt(t.i)), duration: 0.4 }}
            fontSize={11} fontWeight={600} fill="#9a9aa2"
            style={{ fontFamily: 'var(--font-sans)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t.closed}</motion.text>
        ) : null
      ) : (
        <g key={`bullet-${t.id}`} transform={`translate(${t.x},${t.y})`}>
          <motion.g style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: started ? 1 : 0, opacity: started ? dim(t.id) : 0 }}
            transition={{ delay: dly(lineEndAt(t.i)), type: 'spring', stiffness: 320, damping: 16 }}>
            <circle r={15} fill="var(--canvas)" stroke="var(--canvas)" strokeWidth={6} />
            <circle r={14} fill={t.color} />
            <text textAnchor="middle" dominantBaseline="central" fontSize={11.5} fontWeight={700} letterSpacing="0.02em" fill={t.text || '#fff'} style={{ fontFamily: 'var(--font-sans)' }}>{codes[t.id]}</text>
          </motion.g>
        </g>
      ))}
    </svg>
  );
});
