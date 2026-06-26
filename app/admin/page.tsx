'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TransformWrapper, TransformComponent, useTransformEffect, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MAP_VIEWBOX, RIBBON, roundedPath, type Pt } from '@/content/lines';
import { TERRAIN_KINDS, KIND_BY_ID, type TerrainKind, type TerrainFeature } from '@/components/map/terrain-kinds';

type Media = { type: 'audio' | 'image' | 'video'; src: string; caption?: string };
type St = { id: string; title: string; line: string; lines?: string[]; date?: string; shape: string; x: number; y: number; media: Media[]; body: string };
type Ln = { id: string; label: string; color: string; text: string; shape: string; blurb: string; d: string; pts?: Pt[] };
type Pin = { id: string; kind: 'note' | 'photo'; x: number; y: number; w: number; h: number; tag?: string; text?: string; src?: string; caption?: string };
type Snap = { lines: Ln[]; stations: St[] };

type Tool = 'select' | 'station' | 'track' | 'paint' | 'terrain' | 'note' | 'bulldoze';
const TOOLS: { id: Tool; key: string; icon: string; label: string; hint: string }[] = [
  { id: 'select', key: 'v', icon: '✥', label: 'select', hint: 'click a stop to edit/drag · click a thread then drag its dots to curve & re-route · drag empty space to pan' },
  { id: 'station', key: 's', icon: '◉', label: 'place stop', hint: 'tap the map to drop a new stop · stops sitting on more than one thread become joint stations' },
  { id: 'track', key: 't', icon: '╱', label: 'lay track', hint: 'tap to add track points · finish to make a thread' },
  { id: 'paint', key: 'p', icon: '▦', label: 'paint', hint: 'click a line or stop to recolour its thread' },
  { id: 'terrain', key: 'r', icon: '⛰', label: 'terrain', hint: 'pick land below · drag on the map to paint it · drag a piece to move, grab a corner to resize' },
  { id: 'note', key: 'n', icon: '✦', label: 'note', hint: 'pick note/photo below · drag (or tap) the map to pin it · drag to move, grab a corner to resize' },
  { id: 'bulldoze', key: 'x', icon: '✕', label: 'bulldoze', hint: 'click a stop, line, land or pin to delete it' },
];
const PIN_KINDS: { id: Pin['kind']; label: string }[] = [{ id: 'note', label: 'note' }, { id: 'photo', label: 'photo' }];
type Rect = { x: number; y: number; w: number; h: number };
const SHAPES = ['circle', 'square', 'triangle', 'semi'];
const PALETTE = ['#e3000b', '#0d47a1', '#ffcf00', '#1f8a4c', '#141414', '#ff6319', '#00add0', '#b933ad'];
const GRID = 20;
const FAR = 20000; // half-size of the "infinite" paper/hit surface
const snap = (v: number) => Math.round(v / GRID) * GRID;

// Grid that only draws the lines currently on screen, recomputed on every
// pan/zoom from the SVG's live screen matrix — so it reads as infinite & always
// stays locked to map coordinates. Must render inside <TransformWrapper>.
function InfiniteGrid({ svgRef }: { svgRef: React.RefObject<SVGSVGElement | null> }) {
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const raf = useRef(0);
  const recompute = useCallback(() => {
    const svg = svgRef.current; if (!svg) return;
    const ctm = svg.getScreenCTM(); if (!ctm) return;
    const wrap = (svg.closest('.react-transform-wrapper') as HTMLElement | null) ?? svg.parentElement;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    const inv = ctm.inverse();
    const pt = (cx: number, cy: number) => new DOMPoint(cx, cy).matrixTransform(inv);
    const cs = [pt(r.left, r.top), pt(r.right, r.top), pt(r.right, r.bottom), pt(r.left, r.bottom)];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of cs) { minX = Math.min(minX, c.x); minY = Math.min(minY, c.y); maxX = Math.max(maxX, c.x); maxY = Math.max(maxY, c.y); }
    const pad = GRID * 2;
    const x = Math.floor((minX - pad) / GRID) * GRID, y = Math.floor((minY - pad) / GRID) * GRID;
    setBox({ x, y, w: Math.ceil((maxX + pad) / GRID) * GRID - x, h: Math.ceil((maxY + pad) / GRID) * GRID - y });
  }, [svgRef]);
  useTransformEffect(() => { cancelAnimationFrame(raf.current); raf.current = requestAnimationFrame(recompute); });
  useEffect(() => { recompute(); return () => cancelAnimationFrame(raf.current); }, [recompute]);
  if (!box) return null;
  const { x, y, w, h } = box;
  const minors = w / GRID <= 280 && h / GRID <= 280; // hide the fine grid when zoomed far out
  const vmaj: number[] = [], hmaj: number[] = [], vmin: number[] = [], hmin: number[] = [];
  for (let gx = Math.ceil(x / 80) * 80; gx <= x + w; gx += 80) vmaj.push(gx);
  for (let gy = Math.ceil(y / 80) * 80; gy <= y + h; gy += 80) hmaj.push(gy);
  if (minors) {
    for (let gx = Math.ceil(x / GRID) * GRID; gx <= x + w; gx += GRID) if (gx % 80 !== 0) vmin.push(gx);
    for (let gy = Math.ceil(y / GRID) * GRID; gy <= y + h; gy += GRID) if (gy % 80 !== 0) hmin.push(gy);
  }
  return (
    <g opacity={0.7} style={{ pointerEvents: 'none' }}>
      {vmin.map((gx) => <line key={'vm' + gx} x1={gx} y1={y} x2={gx} y2={y + h} stroke="var(--canvas-grid)" strokeWidth={0.6} />)}
      {hmin.map((gy) => <line key={'hm' + gy} x1={x} y1={gy} x2={x + w} y2={gy} stroke="var(--canvas-grid)" strokeWidth={0.6} />)}
      {vmaj.map((gx) => <line key={'vM' + gx} x1={gx} y1={y} x2={gx} y2={y + h} stroke="var(--canvas-grid)" strokeWidth={1.4} />)}
      {hmaj.map((gy) => <line key={'hM' + gy} x1={x} y1={gy} x2={x + w} y2={gy} stroke="var(--canvas-grid)" strokeWidth={1.4} />)}
    </g>
  );
}
const isLight = (hex: string) => { const c = hex.replace('#', ''); const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16); return 0.299 * r + 0.587 * g + 0.114 * b > 150; };
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

const INK = '#2b2b33';
function Marker({ shape, color, r = 15, sel = false, colors }: { shape: string; color: string; r?: number; sel?: boolean; colors?: string[] }) {
  const sw = sel ? 6 : 5;
  // joint / interchange stop — white disc, ink ring, a colour tick per thread
  if (colors && colors.length >= 2) {
    const gap = 9, dotR = 5, start = -((colors.length - 1) * gap) / 2;
    return (<g><circle r={r + 5} fill="#fff" stroke={INK} strokeWidth={sw} />{colors.map((c, i) => <circle key={i} cx={start + i * gap} cy={0} r={dotR} fill={c} />)}</g>);
  }
  if (shape === 'square') return <rect x={-r} y={-r} width={r * 2} height={r * 2} fill="#fff" stroke={color} strokeWidth={sw} />;
  if (shape === 'triangle') { const h = r * 1.9; return <polygon points={`0,${-h * 0.6} ${r * 1.1},${h * 0.5} ${-r * 1.1},${h * 0.5}`} fill="#fff" stroke={color} strokeWidth={sw} strokeLinejoin="round" />; }
  if (shape === 'semi') return <path d={`M ${-r},${r * 0.55} A ${r},${r} 0 0 1 ${r},${r * 0.55} Z`} fill="#fff" stroke={color} strokeWidth={sw} strokeLinejoin="round" />;
  return <circle r={r} fill="#fff" stroke={color} strokeWidth={sw} />;
}

// shortest distance from a point to a polyline (used to detect line overlaps for joint stops)
function distToPolyline(x: number, y: number, pts: Pt[]): number {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((x - ax) * dx + (y - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = ax + t * dx, py = ay + t * dy;
    best = Math.min(best, Math.hypot(x - px, y - py));
  }
  return best;
}

export default function Admin() {
  const [lines, setLines] = useState<Ln[]>([]);
  const [stations, setStations] = useState<St[]>([]);
  const [tool, setTool] = useState<Tool>('select');
  const [view, setView] = useState<'build' | 'dashboard'>('build');
  const [paint, setPaint] = useState('#e3000b');
  const [selSt, setSelSt] = useState<string | null>(null);
  const [selLn, setSelLn] = useState<string | null>(null);
  const [form, setForm] = useState<St | null>(null);
  const [track, setTrack] = useState<Pt[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [nodeDrag, setNodeDrag] = useState<number | null>(null);
  const [lnDrag, setLnDrag] = useState<{ id: string; i: number } | null>(null); // live re-route of a committed line
  const [cursor, setCursor] = useState<Pt | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  // write-first add-stop flow
  const [pickStop, setPickStop] = useState(false);
  const [pendingLine, setPendingLine] = useState<{ id: string; prevPts: Pt[] } | null>(null);
  // terrain (RCT-style land painting)
  const [terrain, setTerrain] = useState<TerrainFeature[]>([]);
  const [terrainKind, setTerrainKind] = useState<TerrainKind>('water');
  const [selTerr, setSelTerr] = useState<string | null>(null);
  const [draw, setDraw] = useState<Rect | null>(null);
  const [terrDrag, setTerrDrag] = useState<{ id: string; mode: 'move' | 'resize'; corner?: number } | null>(null);
  const drawStart = useRef<Pt | null>(null);
  // pinboard (notes & photos tacked on the board)
  const [pins, setPins] = useState<Pin[]>([]);
  const [pinKind, setPinKind] = useState<Pin['kind']>('note');
  const [selPin, setSelPin] = useState<string | null>(null);
  const [pinDraw, setPinDraw] = useState<Rect | null>(null);
  const [pinDrag, setPinDrag] = useState<{ id: string; mode: 'move' | 'resize'; corner?: number } | null>(null);
  const pinDrawStart = useRef<Pt | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const linesRef = useRef<Ln[]>([]);
  const tw = useRef<ReactZoomPanPinchRef>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const downPt = useRef<{ x: number; y: number } | null>(null);
  const past = useRef<Snap[]>([]);
  const future = useRef<Snap[]>([]);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2600); };
  const loadLines = useCallback(async () => { const r = await fetch('/api/lines'); setLines((await r.json()).lines || []); }, []);
  const loadStations = useCallback(async () => { const r = await fetch('/api/stations'); setStations((await r.json()).stations || []); }, []);
  const loadTerrain = useCallback(async () => { const r = await fetch('/api/terrain'); setTerrain((await r.json()).terrain || []); }, []);
  const loadPins = useCallback(async () => { const r = await fetch('/api/pins'); setPins((await r.json()).pins || []); }, []);
  useEffect(() => { loadLines(); loadStations(); loadTerrain(); loadPins(); }, [loadLines, loadStations, loadTerrain, loadPins]);

  linesRef.current = lines;
  const lnColor = (id: string) => lines.find((l) => l.id === id)?.color ?? '#888';
  const lnShape = (id: string) => lines.find((l) => l.id === id)?.shape ?? 'circle';
  const toSvg = (cx: number, cy: number): Pt => { const s = svgRef.current!; const p = s.createSVGPoint(); p.x = cx; p.y = cy; const r = p.matrixTransform(s.getScreenCTM()!.inverse()); return [snap(r.x), snap(r.y)]; };

  // ---- history ----
  const pushHistory = () => { past.current.push({ lines: clone(lines), stations: clone(stations) }); if (past.current.length > 60) past.current.shift(); future.current = []; };
  const persistSnap = async (snap: Snap, prevStations: St[]) => {
    setSaving(true);
    await fetch('/api/lines', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lines: snap.lines }) });
    const removed = prevStations.filter((p) => p.id && !snap.stations.find((s) => s.id === p.id));
    for (const s of snap.stations.filter((s) => s.id)) await fetch('/api/stations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(s) });
    for (const r of removed) await fetch('/api/stations', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: r.id }) });
    await loadLines(); await loadStations(); setSaving(false);
  };
  const undo = () => { if (!past.current.length) return; const cur = { lines: clone(lines), stations: clone(stations) }; future.current.push(cur); const snap = past.current.pop()!; setLines(snap.lines); setStations(snap.stations); persistSnap(snap, cur.stations); flash('undo'); };
  const redo = () => { if (!future.current.length) return; const cur = { lines: clone(lines), stations: clone(stations) }; past.current.push(cur); const snap = future.current.pop()!; setLines(snap.lines); setStations(snap.stations); persistSnap(snap, cur.stations); flash('redo'); };

  // ---- mutations ----
  const commitLines = useCallback(async (next: Ln[]) => { setSaving(true); setLines(next); await fetch('/api/lines', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lines: next }) }); await loadLines(); setSaving(false); }, [loadLines]);
  const saveStation = useCallback(async (s: St) => { setSaving(true); const r = await fetch('/api/stations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(s) }); const j = await r.json(); setSaving(false); if (r.ok) { await loadStations(); flash(`saved → ${j.id}.md`); return j.id as string; } flash(j.error || 'error'); return null; }, [loadStations]);
  const delStation = useCallback(async (id: string) => { setSaving(true); await fetch('/api/stations', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) }); await loadStations(); setSaving(false); }, [loadStations]);
  const commitTerrain = useCallback(async (next: TerrainFeature[]) => { setSaving(true); setTerrain(next); await fetch('/api/terrain', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ terrain: next }) }); setSaving(false); }, []);
  const updTerr = (id: string, patch: Partial<TerrainFeature>) => setTerrain((arr) => arr.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const commitPins = useCallback(async (next: Pin[]) => { setSaving(true); setPins(next); await fetch('/api/pins', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pins: next }) }); setSaving(false); }, []);
  const updPin = (id: string, patch: Partial<Pin>) => setPins((arr) => arr.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  // which threads pass within reach of a point — drives joint-station suggestions
  const linesNear = useCallback((x: number, y: number, thr = 26): string[] =>
    lines.filter((l) => (l.pts?.length ?? 0) >= 2 && distToPolyline(x, y, l.pts as Pt[]) <= thr).map((l) => l.id), [lines]);

  const editStation = (s: St) => { setSelLn(null); setSelTerr(null); setSelPin(null); setSelSt(s.id); setForm({ ...s, media: s.media || [], lines: s.lines && s.lines.length ? s.lines : [s.line] }); };

  // write-first: pick a thread → extend its line by one stop → open the editor focused.
  // The line extension is staged locally and only persisted when the stop is saved.
  const addStopToThread = (threadId: string) => {
    const line = lines.find((l) => l.id === threadId);
    if (!line) return;
    const pts = (line.pts as Pt[]) ?? [];
    const last = pts[pts.length - 1] ?? [700, 400];
    const prev = pts[pts.length - 2];
    let dx = 160, dy = 0;
    if (prev) { const vx = last[0] - prev[0], vy = last[1] - prev[1]; const len = Math.hypot(vx, vy) || 1; dx = (vx / len) * 160; dy = (vy / len) * 160; }
    const np: Pt = [snap(last[0] + dx), snap(last[1] + dy)];
    const nextPts = [...pts, np];
    setLines((prevLines) => prevLines.map((l) => (l.id === threadId ? { ...l, pts: nextPts, d: roundedPath(nextPts) } : l)));
    setPendingLine({ id: threadId, prevPts: pts });
    setPickStop(false);
    editStation({ id: '', title: '', line: threadId, date: '', shape: lnShape(threadId), x: np[0], y: np[1], media: [], body: '' });
    flash('new stop on ' + (line.label || threadId) + ' — start writing');
    requestAnimationFrame(() => bodyRef.current?.focus());
  };

  // close the form; if a staged (unsaved) stop extended a line, roll that extension back
  const closeForm = () => {
    if (pendingLine && !form?.id) {
      const { id, prevPts } = pendingLine;
      setLines((prevLines) => prevLines.map((l) => (l.id === id ? { ...l, pts: prevPts, d: roundedPath(prevPts) } : l)));
    }
    setPendingLine(null); setForm(null); setSelSt(null);
  };

  // station move (select tool)
  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => { const [x, y] = toSvg(e.clientX, e.clientY); setStations((arr) => arr.map((s) => (s.id === drag ? { ...s, x, y } : s))); setForm((f) => (f && f.id === drag ? { ...f, x, y } : f)); };
    const up = () => { const s = stations.find((q) => q.id === drag); if (s && s.id) saveStation(s); setDrag(null); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [drag, stations, saveStation]);

  // node drag (track edit) — grid + neighbour-axis magnet
  useEffect(() => {
    if (nodeDrag === null) return;
    const move = (e: PointerEvent) => { let [x, y] = toSvg(e.clientX, e.clientY); setTrack((t) => { for (const nb of [t[nodeDrag - 1], t[nodeDrag + 1]]) { if (!nb) continue; if (Math.abs(x - nb[0]) <= GRID) x = nb[0]; if (Math.abs(y - nb[1]) <= GRID) y = nb[1]; } return t.map((p, i) => (i === nodeDrag ? [x, y] : p)); }); };
    const up = () => setNodeDrag(null);
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [nodeDrag]);

  // terrain: paint a new piece by dragging on empty canvas
  useEffect(() => {
    if (!draw) return;
    const move = (e: PointerEvent) => { const s = drawStart.current; if (!s) return; const [x, y] = toSvg(e.clientX, e.clientY); setDraw({ x: Math.min(s[0], x), y: Math.min(s[1], y), w: Math.abs(x - s[0]), h: Math.abs(y - s[1]) }); };
    const up = () => { setDraw((d) => { if (d && d.w >= GRID && d.h >= GRID) { const id = `t-${Date.now().toString(36)}`; const feat: TerrainFeature = { id, kind: terrainKind, x: d.x, y: d.y, w: d.w, h: d.h }; commitTerrain([...terrain, feat]); setSelTerr(id); flash(`${terrainKind} placed`); } return null; }); drawStart.current = null; };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [draw, terrain, terrainKind, commitTerrain]);

  // terrain: move / resize an existing piece
  useEffect(() => {
    if (!terrDrag) return;
    const move = (e: PointerEvent) => {
      const [x, y] = toSvg(e.clientX, e.clientY);
      setTerrain((arr) => arr.map((f) => {
        if (f.id !== terrDrag.id) return f;
        if (terrDrag.mode === 'move') return { ...f, x: x - Math.round(f.w / 2), y: y - Math.round(f.h / 2) };
        const x2 = f.x + f.w, y2 = f.y + f.h; // resize: corner 0=tl 1=tr 2=br 3=bl
        let nx = f.x, ny = f.y, nx2 = x2, ny2 = y2;
        if (terrDrag.corner === 0) { nx = x; ny = y; } else if (terrDrag.corner === 1) { nx2 = x; ny = y; } else if (terrDrag.corner === 2) { nx2 = x; ny2 = y; } else { nx = x; ny2 = y; }
        return { ...f, x: Math.min(nx, nx2), y: Math.min(ny, ny2), w: Math.max(GRID, Math.abs(nx2 - nx)), h: Math.max(GRID, Math.abs(ny2 - ny)) };
      }));
    };
    const up = () => { setTerrain((arr) => { commitTerrain(arr); return arr; }); setTerrDrag(null); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [terrDrag, commitTerrain]);

  // pins: place a new note/photo by dragging (or tapping) on empty canvas
  useEffect(() => {
    if (!pinDraw) return;
    const move = (e: PointerEvent) => { const s = pinDrawStart.current; if (!s) return; const [x, y] = toSvg(e.clientX, e.clientY); setPinDraw({ x: Math.min(s[0], x), y: Math.min(s[1], y), w: Math.abs(x - s[0]), h: Math.abs(y - s[1]) }); };
    const up = () => {
      setPinDraw((d) => {
        if (d) {
          const big = d.w >= GRID && d.h >= GRID;
          const w = big ? d.w : 210, h = big ? d.h : pinKind === 'photo' ? 160 : 104;
          const id = `p-${Date.now().toString(36)}`;
          const pin: Pin = pinKind === 'photo' ? { id, kind: 'photo', x: d.x, y: d.y, w, h, tag: 'photo' } : { id, kind: 'note', x: d.x, y: d.y, w, h, tag: 'note', text: '' };
          commitPins([...pins, pin]); setSelPin(id); flash(`${pinKind} pinned`);
        }
        return null;
      });
      pinDrawStart.current = null;
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [pinDraw, pins, pinKind, commitPins]);

  // pins: move / resize an existing one
  useEffect(() => {
    if (!pinDrag) return;
    const move = (e: PointerEvent) => {
      const [x, y] = toSvg(e.clientX, e.clientY);
      setPins((arr) => arr.map((p) => {
        if (p.id !== pinDrag.id) return p;
        if (pinDrag.mode === 'move') return { ...p, x: x - Math.round(p.w / 2), y: y - Math.round(p.h / 2) };
        const x2 = p.x + p.w, y2 = p.y + p.h;
        let nx = p.x, ny = p.y, nx2 = x2, ny2 = y2;
        if (pinDrag.corner === 0) { nx = x; ny = y; } else if (pinDrag.corner === 1) { nx2 = x; ny = y; } else if (pinDrag.corner === 2) { nx2 = x; ny2 = y; } else { nx = x; ny2 = y; }
        return { ...p, x: Math.min(nx, nx2), y: Math.min(ny, ny2), w: Math.max(GRID, Math.abs(nx2 - nx)), h: Math.max(GRID, Math.abs(ny2 - ny)) };
      }));
    };
    const up = () => { setPins((arr) => { commitPins(arr); return arr; }); setPinDrag(null); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [pinDrag, commitPins]);

  // live re-route: drag a waypoint of an already-built line (Mini-Metro style) — no mode, no delete.
  useEffect(() => {
    if (!lnDrag) return;
    const move = (e: PointerEvent) => {
      let [x, y] = toSvg(e.clientX, e.clientY);
      setLines((arr) => arr.map((l) => {
        if (l.id !== lnDrag.id || !l.pts) return l;
        const pts = l.pts.slice();
        for (const nb of [pts[lnDrag.i - 1], pts[lnDrag.i + 1]]) { if (!nb) continue; if (Math.abs(x - nb[0]) <= GRID) x = nb[0]; if (Math.abs(y - nb[1]) <= GRID) y = nb[1]; }
        pts[lnDrag.i] = [x, y];
        return { ...l, pts, d: roundedPath(pts) };
      }));
    };
    const up = () => { commitLines(linesRef.current); setLnDrag(null); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [lnDrag, commitLines]);

  const snapTrack = (last: Pt | undefined, cur: Pt): Pt => { if (!last) return cur; let dx = cur[0] - last[0], dy = cur[1] - last[1]; const adx = Math.abs(dx), ady = Math.abs(dy); if (adx > ady * 2) dy = 0; else if (ady > adx * 2) dx = 0; else { const m = Math.min(adx, ady); dx = Math.sign(dx) * m; dy = Math.sign(dy) * m; } return [snap(last[0] + dx), snap(last[1] + dy)]; };
  const cancelTrack = () => { setTrack([]); setEditId(null); setNodeDrag(null); };
  const finishTrack = async () => {
    if (track.length < 2) { cancelTrack(); return; }
    pushHistory();
    const d = roundedPath(track);
    if (editId && editId !== '__new') { await commitLines(lines.map((l) => (l.id === editId ? { ...l, pts: track, d } : l))); setSelLn(editId); flash('thread re-routed'); }
    else { const id = `thread-${Date.now().toString(36)}`; await commitLines([...lines, { id, label: `thread ${lines.length + 1}`, color: paint, text: isLight(paint) ? '#111' : '#fff', shape: 'circle', blurb: 'a new thread', pts: track, d }]); setSelLn(id); flash('thread laid'); }
    setTrack([]); setEditId(null); setNodeDrag(null); setTool('select'); setSelSt(null);
  };

  const paintLine = (id: string) => { const l = lines.find((q) => q.id === id); if (!l) return; pushHistory(); commitLines(lines.map((q) => (q.id === id ? { ...q, color: paint, text: isLight(paint) ? '#111' : '#fff' } : q))); };

  // canvas tap (place / lay track) — distinguished from a pan-drag
  const onCanvasTap = (cx: number, cy: number) => {
    const [x, y] = toSvg(cx, cy);
    if (tool === 'station') { const onLn = hover && hover[0] === 'L' ? hover.slice(1) : null; const ln = onLn || lines[0]?.id || 'central'; const near = Array.from(new Set([ln, ...linesNear(x, y)])); pushHistory(); editStation({ id: '', title: 'new stop', line: ln, lines: near, date: '', shape: lnShape(ln), x, y, media: [], body: '' }); setTool('select'); flash(near.length > 1 ? `joint stop on ${near.length} threads — fill it in & save` : 'new stop — fill it in & save'); }
    else if (tool === 'track') { setTrack((t) => [...t, snapTrack(t[t.length - 1], [x, y])]); }
    else if (tool === 'select') { setSelLn(null); } // tap empty space → deselect the thread (hides its re-route handles)
  };

  const onLine = (l: Ln) => {
    if (tool === 'paint') paintLine(l.id);
    else if (tool === 'bulldoze') { if (confirm(`Delete thread "${l.label}"?`)) { pushHistory(); commitLines(lines.filter((q) => q.id !== l.id)); } }
    else { setSelSt(null); setForm(null); setSelLn(l.id); }
  };
  const onStation = (s: St) => {
    if (tool === 'paint') { paintLine(s.line); }
    else if (tool === 'bulldoze') { if (s.id && confirm(`Delete "${s.title}"?`)) { pushHistory(); delStation(s.id); if (form?.id === s.id) setForm(null); } }
    else if (tool === 'select') { editStation(s); setDrag(s.id); }
  };

  // ---- form helpers ----
  const upF = (patch: Partial<St>) => setForm((f) => (f ? { ...f, ...patch } : f));
  // joint-station membership: `line` is primary (colour/shape); `lines` is every thread it sits on
  const stLines = form ? (form.lines ?? [form.line]) : [];
  const toggleStLine = (id: string) => setForm((f) => {
    if (!f) return f;
    const cur = f.lines ?? [f.line];
    if (id === f.line && cur.includes(id)) return f; // can't drop the primary
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    return { ...f, lines: next.length ? next : [f.line] };
  });
  const setPrimaryLine = (id: string) => setForm((f) => (f ? { ...f, line: id, lines: Array.from(new Set([id, ...(f.lines ?? [f.line])])) } : f));
  const setMedia = (i: number, patch: Partial<Media>) => upF({ media: form!.media.map((m, k) => (k === i ? { ...m, ...patch } : m)) });
  const upload = async (file: File) => { const fd = new FormData(); fd.append('file', file); setSaving(true); const r = await fetch('/api/upload', { method: 'POST', body: fd }); const j = await r.json(); setSaving(false); if (r.ok) { const t = j.type?.startsWith('image') ? 'image' : j.type?.startsWith('video') ? 'video' : 'audio'; upF({ media: [...(form!.media), { type: t, src: j.src, caption: '' }] }); flash(`uploaded ${j.src}`); } else flash(j.error || 'upload failed'); };
  const uploadPin = async (id: string, file: File) => { const fd = new FormData(); fd.append('file', file); setSaving(true); const r = await fetch('/api/upload', { method: 'POST', body: fd }); const j = await r.json(); setSaving(false); if (r.ok) { commitPins(pins.map((p) => (p.id === id ? { ...p, src: j.src, kind: 'photo' } : p))); flash(`uploaded ${j.src}`); } else flash(j.error || 'upload failed'); };
  const wrapSel = (before: string, after = before) => { const ta = bodyRef.current; if (!ta || !form) return; const s = ta.selectionStart, e = ta.selectionEnd; const v = form.body; const sel = v.slice(s, e) || 'text'; upF({ body: v.slice(0, s) + before + sel + after + v.slice(e) }); setTimeout(() => { ta.focus(); ta.selectionStart = s + before.length; ta.selectionEnd = s + before.length + sel.length; }, 0); };
  const prefixLine = (p: string) => { const ta = bodyRef.current; if (!ta || !form) return; const s = ta.selectionStart; const v = form.body; const ls = v.lastIndexOf('\n', s - 1) + 1; upF({ body: v.slice(0, ls) + p + v.slice(ls) }); setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = s + p.length; }, 0); };

  const selFeat = terrain.find((f) => f.id === selTerr) || null;
  const selPinObj = pins.find((p) => p.id === selPin) || null;
  const selLine = lines.find((l) => l.id === selLn) || null;
  const upLine = (patch: Partial<Ln>) => { pushHistory(); commitLines(lines.map((l) => (l.id === selLn ? { ...l, ...patch } : l))); };
  const addThread = () => { pushHistory(); const id = `thread-${Date.now().toString(36)}`; commitLines([...lines, { id, label: 'new thread', color: paint, text: isLight(paint) ? '#111' : '#fff', shape: 'circle', blurb: '', pts: [[700, 300], [900, 300]], d: roundedPath([[700, 300], [900, 300]]) }]); setSelLn(id); flash('thread added — re-route it'); };
  const moveThread = (id: string, dir: -1 | 1) => { const i = lines.findIndex((l) => l.id === id); const j = i + dir; if (j < 0 || j >= lines.length) return; pushHistory(); const next = [...lines]; [next[i], next[j]] = [next[j], next[i]]; commitLines(next); };

  const idClash = !!form && !!(form.id || '').trim() && stations.some((s) => s.id === form.id && s.id !== selSt);

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && /INPUT|TEXTAREA|SELECT/.test(el.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      if (e.key === 'Escape') { cancelTrack(); closeForm(); setSelLn(null); setSelTerr(null); setSelPin(null); setDraw(null); setPinDraw(null); setPickStop(false); setLnDrag(null); drawStart.current = null; pinDrawStart.current = null; return; }
      const t = TOOLS.find((x) => x.key === e.key.toLowerCase());
      if (t) { setTool(t.id); if (t.id === 'track') { setEditId('__new'); setTrack([]); } else cancelTrack(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, stations]);

  // when a stop opens for editing, frame it in the (now shrunken) map pane — once per stop, not per keystroke
  const lastFocus = useRef<string | null>(null);
  useEffect(() => {
    const target = form ? (form.id ? 'st-' + form.id : 'st-editing') : null;
    if (!target) { lastFocus.current = null; return; }
    if (target === lastFocus.current) return;
    lastFocus.current = target;
    const t = setTimeout(() => { try { tw.current?.zoomToElement(target, 1, 480); } catch {} }, 120);
    return () => clearTimeout(t);
  }, [form]);

  const editColor = editId && editId !== '__new' ? (lines.find((l) => l.id === editId)?.color ?? paint) : paint;
  const previewPts = cursor && tool === 'track' && editId === '__new' ? [...track, snapTrack(track[track.length - 1], cursor)] : track;

  return (
    <div className="admin">
      <div className="topbar">
        <b className="brand">toeesh · build</b>
        <div className="addstop-wrap">
          <button className="addstop" onClick={() => setPickStop((v) => !v)}>＋ add stop</button>
          {pickStop && (
            <>
              <div className="picker-scrim" onClick={() => setPickStop(false)} />
              <div className="picker">
                <div className="picker-h mono">add a stop to which thread?</div>
                {lines.length === 0 && <div className="picker-empty mono">no threads yet — lay a track first</div>}
                {lines.map((l) => (
                  <button key={l.id} className="picker-row" onClick={() => addStopToThread(l.id)}>
                    <span className="dot" style={{ background: l.color }} /><b>{l.label}</b><span className="mono dimk">{l.blurb}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="tools">
          {TOOLS.map((t) => (
            <button key={t.id} className={`tool ${tool === t.id ? 'on' : ''}`} title={`${t.label} (${t.key})`} onClick={() => { setTool(t.id); if (t.id === 'track') { setEditId('__new'); setTrack([]); setSelLn(null); setForm(null); } else cancelTrack(); }}>
              <span className="t-ic">{t.icon}</span>{t.label}<kbd>{t.key}</kbd>
            </button>
          ))}
        </div>
        {tool === 'terrain'
          ? <div className="kinds">{TERRAIN_KINDS.map((k) => <button key={k.id} className={`kind ${terrainKind === k.id ? 'on' : ''}`} onClick={() => setTerrainKind(k.id)} title={k.label}><span className="k-sw" style={{ background: k.fill }} />{k.label}</button>)}</div>
          : tool === 'note'
          ? <div className="kinds">{PIN_KINDS.map((k) => <button key={k.id} className={`kind ${pinKind === k.id ? 'on' : ''}`} onClick={() => setPinKind(k.id)} title={k.label}><span className="k-ic">{k.id === 'photo' ? '▣' : '✎'}</span>{k.label}</button>)}</div>
          : <div className="swatches">{PALETTE.map((c) => <button key={c} className={`sw ${paint === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setPaint(c)} aria-label={c} />)}</div>}
        <div className="topright">
          {(track.length > 0 || editId) && <button className="tbtn solid" onClick={finishTrack}>✓ {editId && editId !== '__new' ? 're-route' : 'finish'} ({track.length})</button>}
          {(track.length > 0 || editId) && <button className="tbtn" onClick={cancelTrack}>✗</button>}
          <button className="tbtn" onClick={undo} title="undo (⌘Z)">↶</button>
          <button className="tbtn" onClick={redo} title="redo (⌘⇧Z)">↷</button>
          <span className={`save ${saving ? 'on' : ''}`}>{saving ? 'saving…' : 'saved'}</span>
          <button className="tbtn" onClick={() => tw.current?.zoomIn()}>+</button>
          <button className="tbtn" onClick={() => tw.current?.zoomOut()}>−</button>
          <button className="tbtn" onClick={() => tw.current?.resetTransform()}>⊙</button>
          <button className={`tbtn ${view === 'dashboard' ? 'on' : ''}`} onClick={() => setView(view === 'build' ? 'dashboard' : 'build')}>{view === 'build' ? 'list' : 'build'}</button>
          <a className="tbtn" href="/">view →</a>
        </div>
      </div>
      <div className="hint mono">{msg || TOOLS.find((t) => t.id === tool)!.hint}</div>

      <div className={`body ${form ? 'writing' : ''}`}>
        {view === 'build' ? (
          <div className="canvas">
            <TransformWrapper ref={tw} initialScale={0.7} minScale={0.3} maxScale={4} centerOnInit limitToBounds={false} doubleClick={{ disabled: true }} panning={{ allowLeftClickPan: tool !== 'terrain' && tool !== 'note', excluded: ['rt-drag'] }} wheel={{ step: 0.08 }}>
              <TransformComponent wrapperStyle={{ width: '100%', height: '100%', background: 'var(--canvas)' }} contentStyle={{ width: 1400, height: 940 }}>
                <svg ref={svgRef} viewBox={MAP_VIEWBOX} width={1400} height={940} className={`svg tool-${tool}`}
                  onPointerDown={(e) => { downPt.current = { x: e.clientX, y: e.clientY }; const onHit = (e.target as Element).closest('[data-hit]'); if (tool === 'terrain' && !onHit) { const p = toSvg(e.clientX, e.clientY); drawStart.current = p; setSelTerr(null); setDraw({ x: p[0], y: p[1], w: 0, h: 0 }); } else if (tool === 'note' && !onHit) { const p = toSvg(e.clientX, e.clientY); pinDrawStart.current = p; setSelPin(null); setPinDraw({ x: p[0], y: p[1], w: 0, h: 0 }); } }}
                  onPointerUp={(e) => { const d = downPt.current; downPt.current = null; if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6 && !(e.target as Element).closest('[data-hit]')) onCanvasTap(e.clientX, e.clientY); }}
                  onPointerMove={(e) => { if (tool === 'track') setCursor(toSvg(e.clientX, e.clientY)); }}>
                  <rect x={-FAR} y={-FAR} width={FAR * 2} height={FAR * 2} fill="var(--canvas)" />
                  <InfiniteGrid svgRef={svgRef} />

                  {/* terrain — editable in the terrain tool, static otherwise */}
                  <g>
                    {terrain.map((f) => { const k = KIND_BY_ID[f.kind] ?? KIND_BY_ID.block; const isSel = selTerr === f.id; const active = tool === 'terrain' || tool === 'bulldoze';
                      return (
                        <g key={f.id}>
                          <rect data-hit={active ? '' : undefined} x={f.x} y={f.y} width={f.w} height={f.h} rx={k.round} ry={k.round} fill={k.fill} stroke={isSel ? '#141414' : k.stroke} strokeWidth={isSel ? 3 : 2} strokeDasharray={isSel ? '7 6' : undefined}
                            style={{ cursor: tool === 'terrain' ? 'move' : tool === 'bulldoze' ? 'not-allowed' : 'default' }}
                            onPointerDown={(e) => { if (!active) return; e.stopPropagation(); if (tool === 'bulldoze') { commitTerrain(terrain.filter((q) => q.id !== f.id)); if (selTerr === f.id) setSelTerr(null); } else { setSelTerr(f.id); setTerrDrag({ id: f.id, mode: 'move' }); } }} />
                          {f.label && <text x={f.x + f.w / 2} y={f.y + f.h / 2} textAnchor="middle" dominantBaseline="middle" className="terrain-label" fill="rgba(20,20,20,0.30)" style={{ pointerEvents: 'none' }}>{f.label}</text>}
                          {isSel && tool === 'terrain' && [[f.x, f.y], [f.x + f.w, f.y], [f.x + f.w, f.y + f.h], [f.x, f.y + f.h]].map((c, ci) => (
                            <rect key={ci} data-hit x={c[0] - 8} y={c[1] - 8} width={16} height={16} fill="#fff" stroke="#141414" strokeWidth={3} style={{ cursor: ci === 0 || ci === 2 ? 'nwse-resize' : 'nesw-resize' }}
                              onPointerDown={(e) => { e.stopPropagation(); setSelTerr(f.id); setTerrDrag({ id: f.id, mode: 'resize', corner: ci }); }} />
                          ))}
                        </g>
                      );
                    })}
                    {draw && draw.w > 0 && draw.h > 0 && (() => { const k = KIND_BY_ID[terrainKind]; return <rect x={draw.x} y={draw.y} width={draw.w} height={draw.h} rx={k.round} ry={k.round} fill={k.fill} stroke="#141414" strokeWidth={3} strokeDasharray="8 6" opacity={0.8} style={{ pointerEvents: 'none' }} />; })()}
                  </g>

                  {lines.map((l) => (editId && editId !== '__new' && editId === l.id ? null : (
                    <path key={l.id} d={l.d} fill="none" stroke={l.color} strokeWidth={RIBBON} strokeLinecap="round" strokeLinejoin="round"
                      opacity={(selLn && selLn !== l.id) || (hover && hover !== 'L' + l.id && tool === 'paint') ? 0.4 : 0.92}
                      style={{ cursor: tool === 'select' || tool === 'paint' || tool === 'bulldoze' ? 'pointer' : 'crosshair' }}
                      onPointerDown={(e) => { if (tool === 'station' || tool === 'track') return; e.stopPropagation(); onLine(l); }} onPointerEnter={() => setHover('L' + l.id)} onPointerLeave={() => setHover(null)} />
                  )))}

                  {/* live re-route handles for the selected thread (Mini-Metro style) */}
                  {tool === 'select' && !editId && selLine && selLine.pts && selLine.pts.length >= 2 && (() => {
                    const pts = selLine.pts as Pt[];
                    return (
                      <g>
                        {lnDrag && lnDrag.id === selLine.id && pts[lnDrag.i] && (() => { const p = pts[lnDrag.i]; return <g opacity={0.5}><line x1={p[0]} y1={-FAR} x2={p[0]} y2={FAR} stroke={selLine.color} strokeDasharray="6 8" /><line x1={-FAR} y1={p[1]} x2={FAR} y2={p[1]} stroke={selLine.color} strokeDasharray="6 8" /></g>; })()}
                        {pts.map((p, i) => i < pts.length - 1 && (
                          <circle key={'lm' + i} className="rt-drag" data-hit cx={(p[0] + pts[i + 1][0]) / 2} cy={(p[1] + pts[i + 1][1]) / 2} r={7} fill="var(--canvas)" stroke={selLine.color} strokeWidth={2.5} style={{ cursor: 'copy' }}
                            onPointerDown={(e) => { e.stopPropagation(); pushHistory(); const mid: Pt = [snap((pts[i][0] + pts[i + 1][0]) / 2), snap((pts[i][1] + pts[i + 1][1]) / 2)]; const np = [...pts.slice(0, i + 1), mid, ...pts.slice(i + 1)]; setLines((arr) => arr.map((l) => (l.id === selLine.id ? { ...l, pts: np, d: roundedPath(np) } : l))); setLnDrag({ id: selLine.id, i: i + 1 }); }} />
                        ))}
                        {pts.map((p, i) => (
                          <circle key={'ln' + i} className="rt-drag" data-hit cx={p[0]} cy={p[1]} r={11} fill="#fff" stroke={selLine.color} strokeWidth={4} style={{ cursor: 'move' }}
                            onPointerDown={(e) => { e.stopPropagation(); pushHistory(); setLnDrag({ id: selLine.id, i }); }}
                            onDoubleClick={(e) => { e.stopPropagation(); if (pts.length > 2) { pushHistory(); const np = pts.filter((_, k) => k !== i); commitLines(lines.map((l) => (l.id === selLine.id ? { ...l, pts: np, d: roundedPath(np) } : l))); } }} />
                        ))}
                      </g>
                    );
                  })()}

                  {/* track preview + editable nodes + snap guides */}
                  {(track.length > 0 || editId) && (
                    <g>
                      <path d={roundedPath(previewPts)} fill="none" stroke={editColor} strokeWidth={RIBBON} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
                      {nodeDrag !== null && track[nodeDrag] && (() => { const p = track[nodeDrag]; return <g opacity={0.5}><line x1={p[0]} y1={-FAR} x2={p[0]} y2={FAR} stroke="#e3000b" strokeDasharray="6 8" /><line x1={-FAR} y1={p[1]} x2={FAR} y2={p[1]} stroke="#e3000b" strokeDasharray="6 8" /></g>; })()}
                      {track.map((p, i) => i < track.length - 1 && (<circle key={'m' + i} className="rt-drag" data-hit cx={(p[0] + track[i + 1][0]) / 2} cy={(p[1] + track[i + 1][1]) / 2} r={6} fill="var(--canvas)" stroke="#141414" strokeWidth={2} style={{ cursor: 'copy' }} onPointerDown={(e) => { e.stopPropagation(); setTrack((t) => [...t.slice(0, i + 1), [snap((t[i][0] + t[i + 1][0]) / 2), snap((t[i][1] + t[i + 1][1]) / 2)] as Pt, ...t.slice(i + 1)]); }} />))}
                      {track.map((p, i) => (<circle key={'n' + i} className="rt-drag" data-hit cx={p[0]} cy={p[1]} r={10} fill="#fff" stroke="#141414" strokeWidth={4} style={{ cursor: 'move' }} onPointerDown={(e) => { e.stopPropagation(); setNodeDrag(i); }} onDoubleClick={(e) => { e.stopPropagation(); setTrack((t) => (t.length > 2 ? t.filter((_, k) => k !== i) : t)); }} />))}
                    </g>
                  )}

                  {stations.map((s) => {
                    const ids = s.lines && s.lines.length ? s.lines : [s.line];
                    const cols = ids.map(lnColor);
                    return (
                    <g key={s.id || 'new'} className="rt-drag" id={s.id ? 'st-' + s.id : undefined} data-hit transform={`translate(${s.x},${s.y})`} style={{ cursor: tool === 'bulldoze' ? 'not-allowed' : tool === 'select' ? 'grab' : 'pointer' }}
                      onPointerDown={(e) => { e.stopPropagation(); onStation(s); }} onPointerEnter={() => setHover('S' + s.id)} onPointerLeave={() => setHover(null)}>
                      {(selSt === s.id || hover === 'S' + s.id) && <circle r={30} fill="none" stroke={lnColor(s.line)} strokeWidth={3} strokeDasharray={selSt === s.id ? '4 5' : '0'} opacity={selSt === s.id ? 1 : 0.5} />}
                      <Marker shape={s.shape || lnShape(s.line)} color={lnColor(s.line)} colors={cols.length >= 2 ? cols : undefined} sel={selSt === s.id} />
                      {hover === 'S' + s.id && <text y={-38} textAnchor="middle" className="map-tip">{s.title}</text>}
                    </g>
                    );
                  })}

                  {/* pins — notes & photos tacked on the board, editable in the note tool */}
                  <g>
                    {pins.map((p) => {
                      const isSel = selPin === p.id; const active = tool === 'note' || tool === 'bulldoze';
                      return (
                        <g key={p.id}>
                          <rect className="rt-drag" data-hit={active ? '' : undefined} x={p.x} y={p.y} width={p.w} height={p.h} rx={3} ry={3}
                            fill="var(--panel)" stroke={isSel ? INK : 'var(--line)'} strokeWidth={isSel ? 3 : 2} strokeDasharray={isSel ? '7 6' : undefined}
                            style={{ cursor: tool === 'note' ? 'move' : tool === 'bulldoze' ? 'not-allowed' : 'default' }}
                            onPointerDown={(e) => { if (!active) return; e.stopPropagation(); if (tool === 'bulldoze') { commitPins(pins.filter((q) => q.id !== p.id)); if (selPin === p.id) setSelPin(null); } else { setSelPin(p.id); setPinDrag({ id: p.id, mode: 'move' }); } }} />
                          {p.kind === 'photo' && p.src && <image href={p.src} x={p.x + 6} y={p.y + 6} width={Math.max(0, p.w - 12)} height={Math.max(0, p.h - 30)} preserveAspectRatio="xMidYMid slice" style={{ pointerEvents: 'none' }} />}
                          <text x={p.x + 8} y={p.y + 15} style={{ pointerEvents: 'none', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.08em', fontWeight: 700, fill: 'var(--ink-soft)' }}>{(p.tag || p.kind).toUpperCase()}</text>
                          {p.kind === 'note' && <foreignObject x={p.x + 6} y={p.y + 20} width={Math.max(0, p.w - 12)} height={Math.max(0, p.h - 26)} style={{ pointerEvents: 'none', overflow: 'hidden' }}><div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: 1.35, color: 'var(--ink)' }}>{p.text}</div></foreignObject>}
                          {p.kind === 'photo' && p.caption && <text x={p.x + 8} y={p.y + p.h - 8} style={{ pointerEvents: 'none', fontFamily: 'var(--font-sans)', fontSize: 11, fill: 'var(--ink)' }}>{p.caption}</text>}
                          {isSel && tool === 'note' && [[p.x, p.y], [p.x + p.w, p.y], [p.x + p.w, p.y + p.h], [p.x, p.y + p.h]].map((c, ci) => (
                            <rect key={ci} className="rt-drag" data-hit x={c[0] - 8} y={c[1] - 8} width={16} height={16} fill="#fff" stroke={INK} strokeWidth={3} style={{ cursor: ci === 0 || ci === 2 ? 'nwse-resize' : 'nesw-resize' }}
                              onPointerDown={(e) => { e.stopPropagation(); setSelPin(p.id); setPinDrag({ id: p.id, mode: 'resize', corner: ci }); }} />
                          ))}
                        </g>
                      );
                    })}
                    {pinDraw && pinDraw.w > 0 && pinDraw.h > 0 && <rect x={pinDraw.x} y={pinDraw.y} width={pinDraw.w} height={pinDraw.h} rx={3} fill="var(--panel)" stroke={INK} strokeWidth={3} strokeDasharray="8 6" opacity={0.8} style={{ pointerEvents: 'none' }} />}
                  </g>

                  {/* ghost marker for a staged (unsaved) stop so the camera can frame it */}
                  {form && !form.id && (
                    <g id="st-editing" transform={`translate(${form.x},${form.y})`} style={{ pointerEvents: 'none' }}>
                      <circle r={30} fill="none" stroke={lnColor(form.line)} strokeWidth={3} strokeDasharray="4 5" />
                      <Marker shape={form.shape || lnShape(form.line)} color={lnColor(form.line)} sel />
                    </g>
                  )}
                </svg>
              </TransformComponent>
            </TransformWrapper>
          </div>
        ) : (
          <div className="dash scroll">
            <table><thead><tr><th></th><th>title</th><th>thread</th><th>date</th><th></th></tr></thead>
              <tbody>{stations.map((s) => (<tr key={s.id}><td><span className="dot" style={{ background: lnColor(s.line) }} /></td><td><b>{s.title}</b></td><td className="mono">{s.line}</td><td className="mono">{s.date}</td><td className="rt"><button className="tbtn sm" onClick={() => { setView('build'); editStation(s); }}>edit</button> <button className="tbtn sm" onClick={() => { pushHistory(); s.id && delStation(s.id); }}>del</button></td></tr>))}</tbody>
            </table>
          </div>
        )}

        <aside className="panel scroll" onDragOver={(e) => { if (form) e.preventDefault(); }} onDrop={(e) => { if (form && e.dataTransfer.files[0]) { e.preventDefault(); upload(e.dataTransfer.files[0]); } }}>
          {form ? (
            <div className="studio" style={{ borderLeftColor: lnColor(form.line) }}>
              <div className="studio-head">
                <span className="acc" style={{ background: lnColor(form.line) }} />
                <input className="title-in" value={form.title} placeholder="untitled stop" onChange={(e) => upF({ title: e.target.value })} />
                <div className="ed-act">
                  <button className="tbtn sm solid" onClick={async () => { pushHistory(); if (pendingLine) { await commitLines(lines); setPendingLine(null); } const id = await saveStation(form); if (id) { setSelSt(id); setForm((f) => f ? { ...f, id } : f); } }}>save</button>
                  {form.id && <button className="tbtn sm" onClick={() => { pushHistory(); delStation(form.id); closeForm(); }}>delete</button>}
                  <button className="tbtn sm" onClick={closeForm}>✕</button>
                </div>
              </div>
              <div className="studio-meta">
                <label>primary thread<select value={form.line} onChange={(e) => setPrimaryLine(e.target.value)}>{lines.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select></label>
                <label>shape<select value={form.shape} onChange={(e) => upF({ shape: e.target.value })}>{SHAPES.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
                <label>date<input value={form.date} placeholder="2026-06" onChange={(e) => upF({ date: e.target.value })} /></label>
                <label>id {idClash && <span className="warn">⚠ in use</span>}<input value={form.id} placeholder="auto from title" onChange={(e) => upF({ id: e.target.value })} /></label>
              </div>
              {lines.length > 1 && (() => {
                const near = linesNear(form.x, form.y);
                return (
                  <div className="studio-lines">
                    <span className="sl-h mono">on threads{stLines.length > 1 && <span className="sl-badge">joint · {stLines.length}</span>}</span>
                    <div className="sl-chips">
                      {lines.map((l) => {
                        const on = stLines.includes(l.id), isPrimary = l.id === form.line, suggest = near.includes(l.id) && !on;
                        return (
                          <button key={l.id} type="button" className={`linechip ${on ? 'on' : ''} ${suggest ? 'suggest' : ''}`} style={{ borderColor: l.color }} onClick={() => toggleStLine(l.id)} title={isPrimary ? 'primary thread' : on ? 'on this thread — click to remove' : 'click to add this thread'}>
                            <span className="dot" style={{ background: l.color }} />{l.label}{isPrimary && <span className="sl-p">★</span>}{suggest && <span className="sl-cue">overlaps</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              <div className="studio-toolbar">
                <span className="md-tools">
                  <button onClick={() => wrapSel('**')} title="bold"><b>B</b></button>
                  <button onClick={() => wrapSel('*')} title="italic"><i>I</i></button>
                  <button onClick={() => prefixLine('## ')} title="heading">H</button>
                  <button onClick={() => prefixLine('- ')} title="list">•</button>
                  <button onClick={() => wrapSel('[', '](https://)')} title="link">↗</button>
                </span>
                <span className="md-tools right">
                  <label className="up" title="upload media">＋ media<input type="file" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} /></label>
                  <button className={preview ? 'on' : ''} onClick={() => setPreview(!preview)} title="toggle preview">{preview ? 'split' : 'preview'}</button>
                </span>
              </div>
              <div className={`studio-body ${preview ? 'split' : ''}`}>
                <textarea ref={bodyRef} className="bodyta" value={form.body} placeholder="start writing… markdown — **bold**, ## heading, - lists, [links](url)" onChange={(e) => upF({ body: e.target.value })} />
                {preview && <div className="md-prev prose"><ReactMarkdown remarkPlugins={[remarkGfm]}>{form.body || '*nothing yet*'}</ReactMarkdown></div>}
              </div>
              {form.media.length > 0 && (
                <div className="studio-media">
                  {form.media.map((m, i) => (
                    <div className="med-row" key={i}>
                      {m.type === 'image' ? <img className="thumb" src={m.src} alt="" /> : <span className="thumb ico">{m.type === 'audio' ? '♪' : '▷'}</span>}
                      <div className="med-f"><select value={m.type} onChange={(e) => setMedia(i, { type: e.target.value as Media['type'] })}><option>audio</option><option>image</option><option>video</option></select><input value={m.src} onChange={(e) => setMedia(i, { src: e.target.value })} placeholder="/media/…" /><input value={m.caption || ''} onChange={(e) => setMedia(i, { caption: e.target.value })} placeholder="caption" /></div>
                      <button className="tbtn sm" onClick={() => upF({ media: form.media.filter((_, k) => k !== i) })}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="studio-foot mono">drop a file anywhere to upload · {form.id ? `editing ${form.id}.md` : 'new stop — unsaved'}</div>
            </div>
          ) : selPinObj ? (
            <div className="ed">
              <div className="ed-h"><span className="mono">pin · {selPinObj.kind}</span><div className="ed-act"><button className="tbtn sm" onClick={() => { commitPins(pins.filter((q) => q.id !== selPinObj.id)); setSelPin(null); }}>delete</button><button className="tbtn sm" onClick={() => setSelPin(null)}>✕</button></div></div>
              <label>kind<select value={selPinObj.kind} onChange={(e) => commitPins(pins.map((p) => (p.id === selPinObj.id ? { ...p, kind: e.target.value as Pin['kind'] } : p)))}>{PIN_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select></label>
              <label>tag<input value={selPinObj.tag || ''} placeholder="e.g. ethos" onChange={(e) => updPin(selPinObj.id, { tag: e.target.value })} onBlur={() => commitPins(pins)} /></label>
              {selPinObj.kind === 'note' ? (
                <label>text<textarea className="bodyta" style={{ minHeight: 120 }} value={selPinObj.text || ''} placeholder="write the note…" onChange={(e) => updPin(selPinObj.id, { text: e.target.value })} onBlur={() => commitPins(pins)} /></label>
              ) : (
                <>
                  <label>image src<input value={selPinObj.src || ''} placeholder="/media/…" onChange={(e) => updPin(selPinObj.id, { src: e.target.value })} onBlur={() => commitPins(pins)} /></label>
                  <label className="tbtn sm" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>＋ upload image<input type="file" hidden onChange={(e) => e.target.files?.[0] && uploadPin(selPinObj.id, e.target.files[0])} /></label>
                  <label>caption<input value={selPinObj.caption || ''} onChange={(e) => updPin(selPinObj.id, { caption: e.target.value })} onBlur={() => commitPins(pins)} /></label>
                </>
              )}
              <div className="row2"><label>width<input type="number" value={selPinObj.w} onChange={(e) => updPin(selPinObj.id, { w: Math.max(GRID, Number(e.target.value) || GRID) })} onBlur={() => commitPins(pins)} /></label><label>height<input type="number" value={selPinObj.h} onChange={(e) => updPin(selPinObj.id, { h: Math.max(GRID, Number(e.target.value) || GRID) })} onBlur={() => commitPins(pins)} /></label></div>
              <p className="mono dimk foot">drag the pin to move · grab a corner to resize · {pins.length} pins</p>
            </div>
          ) : selFeat ? (
            <div className="ed">
              <div className="ed-h"><span className="mono">land · {selFeat.kind}</span><div className="ed-act"><button className="tbtn sm" onClick={() => { commitTerrain(terrain.filter((q) => q.id !== selFeat.id)); setSelTerr(null); }}>delete</button><button className="tbtn sm" onClick={() => setSelTerr(null)}>✕</button></div></div>
              <label>kind<select value={selFeat.kind} onChange={(e) => { const next = terrain.map((f) => (f.id === selFeat.id ? { ...f, kind: e.target.value as TerrainKind } : f)); commitTerrain(next); }}>{TERRAIN_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select></label>
              <label>label <span className="dimk" style={{ textTransform: 'none', letterSpacing: 0 }}>(optional)</span><input value={selFeat.label || ''} placeholder="e.g. the harbour" onChange={(e) => updTerr(selFeat.id, { label: e.target.value })} onBlur={() => commitTerrain(terrain)} /></label>
              <div className="row2"><label>width<input type="number" value={selFeat.w} onChange={(e) => updTerr(selFeat.id, { w: Math.max(GRID, Number(e.target.value) || GRID) })} onBlur={() => commitTerrain(terrain)} /></label><label>height<input type="number" value={selFeat.h} onChange={(e) => updTerr(selFeat.id, { h: Math.max(GRID, Number(e.target.value) || GRID) })} onBlur={() => commitTerrain(terrain)} /></label></div>
              <p className="mono dimk foot">drag the piece to move · grab a corner to resize · {terrain.length} pieces of land</p>
            </div>
          ) : (
            <div className="ed">
              <div className="ed-h"><span className="mono">threads</span><button className="tbtn sm solid" onClick={addThread}>＋ add</button></div>
              <ul className="thr">
                {lines.map((l, i) => (
                  <li key={l.id} className={selLn === l.id ? 'on' : ''}>
                    <div className="thr-row" onClick={() => setSelLn(selLn === l.id ? null : l.id)}>
                      <span className="dot" style={{ background: l.color }} /><b>{l.label}</b><span className="mono dimk">{l.blurb}</span>
                      <span className="thr-ord"><button onClick={(e) => { e.stopPropagation(); moveThread(l.id, -1); }} disabled={i === 0}>↑</button><button onClick={(e) => { e.stopPropagation(); moveThread(l.id, 1); }} disabled={i === lines.length - 1}>↓</button></span>
                    </div>
                    {selLn === l.id && (
                      <div className="thr-ed">
                        <label>name<input value={l.label} onChange={(e) => upLine({ label: e.target.value })} /></label>
                        <label>blurb<input value={l.blurb} onChange={(e) => upLine({ blurb: e.target.value })} /></label>
                        <div className="row2"><label>shape<select value={l.shape} onChange={(e) => upLine({ shape: e.target.value })}>{SHAPES.map((s) => <option key={s} value={s}>{s}</option>)}</select></label><label>bullet<select value={l.text} onChange={(e) => upLine({ text: e.target.value })}><option value="#fff">white</option><option value="#111">black</option></select></label></div>
                        <div className="swrow">{PALETTE.map((c) => <button key={c} className={`sw ${l.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => upLine({ color: c, text: isLight(c) ? '#111' : '#fff' })} />)}</div>
                        <div className="thr-act"><button className="tbtn sm solid" onClick={() => { setForm(null); setSelSt(null); setTool('track'); setEditId(l.id); setTrack((l.pts as Pt[]) ?? []); flash('drag nodes · ＋ to add · dbl-click to remove · finish'); }}>✎ re-route</button><button className="tbtn sm" onClick={() => { pushHistory(); commitLines(lines.filter((q) => q.id !== l.id)); setSelLn(null); }}>delete</button></div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mono dimk foot">{stations.length} stops · {lines.length} threads · dev-only writes</p>
            </div>
          )}
        </aside>
      </div>

      <style jsx>{`
        .admin { position: fixed; inset: 0; display: flex; flex-direction: column; background: var(--bg); color: var(--ink); }
        .topbar { display: flex; align-items: center; gap: 14px; padding: 9px 14px; border-bottom: 3px solid var(--ink); background: var(--panel); flex-wrap: wrap; }
        .brand { font-weight: 800; letter-spacing: -0.02em; }
        .addstop-wrap { position: relative; }
        .addstop { font-family: var(--font-mono); font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; background: var(--yellow); color: #111; border: 2px solid #111; padding: 8px 12px; cursor: pointer; box-shadow: 3px 3px 0 var(--ink); }
        .addstop:hover { transform: translate(-1px, -1px); box-shadow: 4px 4px 0 var(--ink); }
        .addstop:active { transform: translate(1px, 1px); box-shadow: 1px 1px 0 var(--ink); }
        .picker-scrim { position: fixed; inset: 0; z-index: 40; }
        .picker { position: absolute; top: calc(100% + 8px); left: 0; z-index: 41; width: 280px; background: var(--panel); border: 2px solid var(--ink); box-shadow: 6px 6px 0 var(--ink); padding: 6px; display: flex; flex-direction: column; gap: 2px; }
        .picker-h { color: var(--ink-soft); font-size: 0.55rem; letter-spacing: 0.08em; text-transform: uppercase; padding: 6px 8px 8px; }
        .picker-empty { color: var(--ink-soft); padding: 8px; font-size: 0.7rem; }
        .picker-row { display: flex; align-items: center; gap: 9px; background: none; border: 0; color: var(--ink); padding: 9px 8px; cursor: pointer; text-align: left; }
        .picker-row:hover { background: var(--yellow); color: #111; }
        .picker-row b { font-size: 0.95rem; }
        .picker-row .dimk { margin-left: auto; }
        .tools { display: flex; gap: 4px; }
        .tool { position: relative; display: flex; align-items: center; gap: 6px; font-family: var(--font-mono); font-size: 0.58rem; text-transform: uppercase; letter-spacing: 0.05em; background: none; border: 2px solid var(--line); color: var(--ink); padding: 6px 9px; cursor: pointer; }
        .tool .t-ic { font-size: 0.95rem; }
        .tool kbd { font-size: 0.5rem; border: 1px solid currentColor; border-radius: 2px; padding: 0 3px; opacity: 0.5; }
        .tool.on { background: var(--ink); color: var(--bg); border-color: var(--ink); }
        .swatches, .swrow { display: flex; gap: 4px; }
        .sw { width: 22px; height: 22px; border: 2px solid var(--ink); cursor: pointer; }
        .sw.on { outline: 3px solid var(--yellow); outline-offset: 1px; }
        .kinds { display: flex; gap: 4px; }
        .kind { display: flex; align-items: center; gap: 6px; font-family: var(--font-mono); font-size: 0.56rem; text-transform: uppercase; letter-spacing: 0.05em; background: none; border: 2px solid var(--line); color: var(--ink); padding: 5px 8px; cursor: pointer; }
        .kind.on { border-color: var(--ink); background: var(--panel); }
        .k-sw { width: 14px; height: 14px; border: 1.5px solid var(--ink); }
        .topright { margin-left: auto; display: flex; gap: 6px; align-items: center; }
        .tbtn { font-family: var(--font-mono); font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.05em; background: none; border: 2px solid var(--ink); color: var(--ink); padding: 6px 9px; cursor: pointer; text-decoration: none; }
        .tbtn.solid { background: var(--ink); color: var(--bg); }
        .tbtn.on { background: var(--yellow); color: #111; border-color: #111; }
        .tbtn.sm { padding: 4px 7px; font-size: 0.56rem; }
        .tbtn:hover { background: var(--yellow); color: #111; border-color: #111; }
        .save { font-family: var(--font-mono); font-size: 0.56rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-soft); }
        .save.on { color: var(--yellow); }
        .hint { padding: 6px 14px; color: var(--ink-soft); border-bottom: 1px solid var(--line); background: var(--panel); }
        .body { flex: 1; display: grid; grid-template-columns: 1fr 380px; min-height: 0; }
        .body.writing { grid-template-columns: minmax(360px, 44%) 1fr; }
        .canvas { position: relative; overflow: hidden; border-right: 3px solid var(--ink); }
        .svg { display: block; touch-action: none; overflow: visible; }
        .svg.tool-station, .svg.tool-track { cursor: crosshair; }
        :global(.map-tip) { font-family: var(--font-sans); font-weight: 800; font-size: 16px; fill: #141414; paint-order: stroke; stroke: var(--canvas); stroke-width: 4px; }
        .dash { padding: 12px; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; font-family: var(--font-mono); font-size: 0.56rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-soft); padding: 6px; border-bottom: 2px solid var(--line); }
        td { padding: 8px 6px; border-bottom: 1px solid var(--line); }
        td.rt { text-align: right; white-space: nowrap; }
        .dot { display: inline-block; width: 12px; height: 12px; border-radius: 50%; flex: none; }
        .panel { padding: 14px; }
        .ed { display: flex; flex-direction: column; gap: 10px; }
        .ed-h { display: flex; justify-content: space-between; align-items: center; }
        .ed-h .mono { color: var(--ink-soft); letter-spacing: 0.1em; }
        .ed-act { display: flex; gap: 6px; }
        label { display: flex; flex-direction: column; gap: 4px; font-family: var(--font-mono); font-size: 0.55rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-soft); }
        .warn { color: var(--red); text-transform: none; letter-spacing: 0; }
        input, select, textarea { font: inherit; font-size: 0.9rem; padding: 7px 9px; border: 2px solid var(--ink); background: var(--bg); color: var(--ink); text-transform: none; letter-spacing: 0; }
        .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .bodybar { display: flex; justify-content: space-between; align-items: center; }
        .bodybar .mono { color: var(--ink-soft); font-size: 0.55rem; letter-spacing: 0.06em; }
        .md-tools { display: flex; gap: 3px; }
        .md-tools button { width: 26px; height: 26px; border: 2px solid var(--line); background: none; color: var(--ink); cursor: pointer; font-size: 0.8rem; }
        .md-tools button:hover, .md-tools button.on { background: var(--yellow); color: #111; border-color: #111; }
        .bodyta { font-family: var(--font-mono); font-size: 0.85rem; line-height: 1.55; resize: vertical; min-height: 180px; }
        .md-prev { border: 2px dashed var(--line); padding: 10px 12px; min-height: 180px; font-size: 0.92rem; line-height: 1.55; }
        .md-prev :global(h2) { font-size: 1.2rem; margin: 0.6rem 0; }
        .md-prev :global(p) { margin: 0 0 0.7rem; }
        .med { border-top: 2px solid var(--line); padding-top: 10px; display: flex; flex-direction: column; gap: 7px; }
        .med-h { display: flex; justify-content: space-between; align-items: center; }
        .med-h .mono { color: var(--ink-soft); }
        .drop { border: 2px dashed var(--line); padding: 8px; text-align: center; color: var(--ink-soft); font-size: 0.55rem; letter-spacing: 0.08em; text-transform: uppercase; }
        .med-row { display: grid; grid-template-columns: 44px 1fr auto; gap: 6px; align-items: start; }
        .thumb { width: 44px; height: 44px; object-fit: cover; border: 2px solid var(--ink); display: grid; place-items: center; }
        .thumb.ico { font-size: 1.2rem; background: var(--panel); }
        .med-f { display: flex; flex-direction: column; gap: 4px; }
        .med-f input, .med-f select { padding: 5px 7px; font-size: 0.78rem; }
        /* ---- writing studio (split view) ---- */
        .body.writing .panel { padding: 0; overflow: hidden; display: flex; }
        .studio { flex: 1; min-height: 0; display: flex; flex-direction: column; background: var(--bg); border-left: 6px solid var(--ink); }
        .studio-head { display: flex; align-items: center; gap: 12px; padding: 16px 20px 12px; }
        .studio-head .acc { width: 12px; height: 30px; flex: none; }
        .title-in { flex: 1; font-family: var(--font-sans); font-size: 1.55rem; font-weight: 800; letter-spacing: -0.02em; border: 0; border-bottom: 2px solid transparent; background: none; padding: 4px 0; }
        .title-in:focus { outline: none; border-bottom-color: var(--ink); }
        .studio-meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 0 20px 14px; border-bottom: 2px solid var(--line); }
        .studio-lines { display: flex; flex-direction: column; gap: 8px; padding: 12px 20px; border-bottom: 2px solid var(--line); }
        .sl-h { display: flex; align-items: center; gap: 8px; color: var(--ink-soft); font-size: 0.55rem; letter-spacing: 0.08em; text-transform: uppercase; }
        .sl-badge { background: var(--ink); color: var(--bg); padding: 2px 6px; font-size: 0.5rem; letter-spacing: 0.06em; }
        .sl-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .linechip { display: inline-flex; align-items: center; gap: 6px; background: none; border: 2px solid var(--line); color: var(--ink); padding: 5px 9px; cursor: pointer; font-family: var(--font-mono); font-size: 0.62rem; }
        .linechip .dot { width: 11px; height: 11px; }
        .linechip.on { background: var(--ink); color: var(--bg); }
        .linechip.suggest { border-style: dashed; }
        .sl-p { color: var(--yellow); }
        .sl-cue { font-size: 0.5rem; letter-spacing: 0.06em; text-transform: uppercase; opacity: 0.7; }
        .k-ic { font-size: 0.95rem; }
        .studio-toolbar { display: flex; align-items: center; justify-content: space-between; padding: 8px 20px; border-bottom: 2px solid var(--line); background: var(--bg); }
        .md-tools.right { gap: 6px; }
        .md-tools .up { display: inline-flex; align-items: center; height: 26px; padding: 0 10px; border: 2px solid var(--line); cursor: pointer; font-family: var(--font-mono); font-size: 0.58rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink); }
        .md-tools .up:hover { background: var(--yellow); color: #111; border-color: #111; }
        .md-tools.right button { width: auto; padding: 0 10px; font-family: var(--font-mono); font-size: 0.58rem; text-transform: uppercase; letter-spacing: 0.05em; }
        .md-tools button.on { background: var(--ink); color: var(--bg); border-color: var(--ink); }
        .studio-body { flex: 1; min-height: 0; display: flex; }
        .studio-body .bodyta { flex: 1; min-height: 0; border: 0; resize: none; padding: 26px 30px; font-family: var(--font-sans); font-size: 1.08rem; line-height: 1.75; background: var(--bg); }
        .studio-body .bodyta:focus { outline: none; }
        .studio-body.split .bodyta { flex: 1 1 50%; border-right: 2px solid var(--line); font-family: var(--font-mono); font-size: 0.95rem; line-height: 1.65; }
        .studio-body .md-prev { flex: 1 1 50%; min-height: 0; overflow: auto; border: 0; padding: 26px 30px; font-size: 1.04rem; line-height: 1.7; }
        .studio-body .md-prev :global(h2) { font-size: 1.4rem; margin: 1.2rem 0 0.5rem; letter-spacing: -0.02em; }
        .studio-body .md-prev :global(p) { margin: 0 0 1rem; }
        .studio-body .md-prev :global(a) { color: var(--red); }
        .studio-media { display: flex; flex-direction: column; gap: 7px; padding: 12px 20px; border-top: 2px solid var(--line); max-height: 28vh; overflow: auto; }
        .studio-foot { padding: 9px 20px 14px; color: var(--ink-soft); font-size: 0.55rem; letter-spacing: 0.06em; text-transform: uppercase; border-top: 1px solid var(--line); }
        .dimk { color: var(--ink-soft); }
        .foot { margin-top: 6px; }
        .thr { list-style: none; margin: 6px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
        .thr-row { display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 6px; border: 2px solid transparent; }
        .thr li.on .thr-row { border-color: var(--ink); background: var(--panel); }
        .thr-row:hover { background: var(--panel); }
        .thr-row b { font-size: 0.95rem; }
        .thr-ord { margin-left: auto; display: flex; gap: 2px; }
        .thr-ord button { width: 20px; height: 20px; border: 1px solid var(--line); background: none; color: var(--ink); cursor: pointer; font-size: 0.6rem; }
        .thr-ord button:disabled { opacity: 0.25; }
        .thr-ed { display: flex; flex-direction: column; gap: 8px; padding: 8px; border: 2px solid var(--line); border-top: 0; }
        .thr-act { display: flex; gap: 6px; }
        @media (max-width: 860px) { .body, .body.writing { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
