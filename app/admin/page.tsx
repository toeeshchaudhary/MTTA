'use client';
import './admin.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TransformWrapper, TransformComponent, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { MAP_VIEWBOX, RIBBON, roundedPath, type Pt } from '@/content/lines';
import { TERRAIN_KINDS, KIND_BY_ID, type TerrainKind, type TerrainFeature } from '@/components/map/terrain-kinds';
import { bboxOf } from '@/components/map/terrain-shape';
import type { Media, St, Ln, Pin, AboutLink, SiteMeta, PlayMeta, Rect, Tool } from '@/components/admin/types';
import { TOOLS, PIN_KINDS, SHAPES, PALETTE, GRID, FAR, INK } from '@/components/admin/lib/constants';
import { snap, isLight, clone, clientToSvg, distToPolyline, projectOnLine, snapTrack, arcAt, sliceByArc } from '@/components/admin/lib/geometry';
import InfiniteGrid from '@/components/admin/canvas/InfiniteGrid';
import Marker from '@/components/admin/canvas/Marker';
import Inspector from '@/components/admin/Inspector';
import Canvas from '@/components/admin/Canvas';
import { onDrag } from '@/components/admin/hooks/usePointerDrag';
import { useAdminTheme } from '@/components/admin/hooks/useAdminTheme';

type Snap = { lines: Ln[]; stations: St[]; terrain: TerrainFeature[]; pins: Pin[]; site: SiteMeta; origin: Pt };

const PLAY_DEFAULT: PlayMeta = { critters: true, stationPulse: true, expressTrain: true, serviceQuips: true, sounds: false, nightOwl: true, quips: [] };
const normPlay = (p: Partial<PlayMeta> | undefined): PlayMeta => ({ ...PLAY_DEFAULT, ...(p || {}), quips: Array.isArray(p?.quips) ? p!.quips : [] });


export default function Admin() {
  const [lines, setLines] = useState<Ln[]>([]);
  const [stations, setStations] = useState<St[]>([]);
  const [tool, setTool] = useState<Tool>('select');
  const [view, setView] = useState<'build' | 'dashboard'>('build');
  const [paint, setPaint] = useState('#e3000b');
  // single source of truth for selection — enforces mutual exclusion (only one thing
  // selected at a time). The old selSt/selLn/selTerr/selPin names are kept as derived
  // getters + setters so every call site is unchanged.
  const [selection, setSelection] = useState<{ type: 'station' | 'line' | 'terrain' | 'pin'; id: string } | null>(null);
  const selSt = selection?.type === 'station' ? selection.id : null;
  const selLn = selection?.type === 'line' ? selection.id : null;
  const selTerr = selection?.type === 'terrain' ? selection.id : null;
  const selPin = selection?.type === 'pin' ? selection.id : null;
  const setSelSt = (id: string | null) => setSelection(id == null ? null : { type: 'station', id });
  const setSelLn = (id: string | null) => setSelection(id == null ? null : { type: 'line', id });
  const setSelTerr = (id: string | null) => setSelection(id == null ? null : { type: 'terrain', id });
  const setSelPin = (id: string | null) => setSelection(id == null ? null : { type: 'pin', id });
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
  // terrain — freehand coastline pen: tap to drop polygon vertices, close to finish
  const [terrain, setTerrain] = useState<TerrainFeature[]>([]);
  const [terrainKind, setTerrainKind] = useState<TerrainKind>('water');
  const [draw, setDraw] = useState<Rect | null>(null); // legacy rect draw (unused by the pen; kept for prop shape)
  const [terrDrag, setTerrDrag] = useState<{ id: string; mode: 'move' | 'resize'; corner?: number } | null>(null);
  const [landDraft, setLandDraft] = useState<Pt[]>([]); // in-progress polygon
  const [landNode, setLandNode] = useState<{ id: string; i: number } | null>(null); // dragging a saved polygon's vertex
  const drawStart = useRef<Pt | null>(null);
  // pinboard (notes & photos tacked on the board)
  const [pins, setPins] = useState<Pin[]>([]);
  const [pinKind, setPinKind] = useState<Pin['kind']>('note');
  const [pinDraw, setPinDraw] = useState<Rect | null>(null);
  const [pinDrag, setPinDrag] = useState<{ id: string; mode: 'move' | 'resize'; corner?: number; dx?: number; dy?: number } | null>(null);
  const pinDrawStart = useRef<Pt | null>(null);
  // origin marker (movable) + editable pill / about content
  const [origin, setOrigin] = useState<Pt>([700, 96]);
  const [origDrag, setOrigDrag] = useState(false);
  const origGrab = useRef<Pt>([0, 0]);
  const [site, setSite] = useState<SiteMeta>({ originLabel: 'the origin — toeesh', originCue: 'about ↗', about: { name: '', role: '', blurb: '', links: [] }, play: PLAY_DEFAULT });
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
  const loadSite = useCallback(async () => { const r = await fetch('/api/site'); const j = await r.json(); const s = j.site; if (!s) return; if (Array.isArray(s.origin)) setOrigin(s.origin as Pt); setSite({ originLabel: s.originLabel ?? '', originCue: s.originCue ?? '', about: { name: s.about?.name ?? '', role: s.about?.role ?? '', blurb: s.about?.blurb ?? '', links: Array.isArray(s.about?.links) ? s.about.links : [] }, play: normPlay(s.play) }); }, []);
  useEffect(() => { loadLines(); loadStations(); loadTerrain(); loadPins(); loadSite(); }, [loadLines, loadStations, loadTerrain, loadPins, loadSite]);

  linesRef.current = lines;
  const lnColor = (id: string) => lines.find((l) => l.id === id)?.color ?? '#888';
  const lnShape = (id: string) => lines.find((l) => l.id === id)?.shape ?? 'circle';
  const toSvg = (cx: number, cy: number): Pt => clientToSvg(svgRef.current!, cx, cy, true);
  const toSvgRaw = (cx: number, cy: number): Pt => clientToSvg(svgRef.current!, cx, cy, false);

  // ---- history (covers every editable slice, not just lines+stations) ----
  const takeSnap = (): Snap => ({ lines: clone(lines), stations: clone(stations), terrain: clone(terrain), pins: clone(pins), site: clone(site), origin: clone(origin) });
  const pushHistory = () => { past.current.push(takeSnap()); if (past.current.length > 60) past.current.shift(); future.current = []; };
  const persistSnap = async (snap: Snap, prevStations: St[]) => {
    setSaving(true);
    await fetch('/api/lines', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lines: snap.lines }) });
    const removed = prevStations.filter((p) => p.id && !snap.stations.find((s) => s.id === p.id));
    for (const s of snap.stations.filter((s) => s.id)) await fetch('/api/stations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(s) });
    for (const r of removed) await fetch('/api/stations', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: r.id }) });
    await fetch('/api/terrain', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ terrain: snap.terrain }) });
    await fetch('/api/pins', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pins: snap.pins }) });
    await fetch('/api/site', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ origin: snap.origin, originLabel: snap.site.originLabel, originCue: snap.site.originCue, about: snap.site.about, play: snap.site.play }) });
    await loadLines(); await loadStations(); await loadTerrain(); await loadPins(); await loadSite(); setSaving(false);
  };
  const restore = (snap: Snap) => { setLines(snap.lines); setStations(snap.stations); setTerrain(snap.terrain); setPins(snap.pins); setSite(snap.site); setOrigin(snap.origin); };
  const undo = () => { if (!past.current.length) return; const cur = takeSnap(); future.current.push(cur); const snap = past.current.pop()!; restore(snap); persistSnap(snap, cur.stations); flash('undo'); };
  const redo = () => { if (!future.current.length) return; const cur = takeSnap(); past.current.push(cur); const snap = future.current.pop()!; restore(snap); persistSnap(snap, cur.stations); flash('redo'); };

  // ---- mutations ----
  const commitLines = useCallback(async (next: Ln[]) => { setSaving(true); setLines(next); await fetch('/api/lines', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lines: next }) }); await loadLines(); setSaving(false); }, [loadLines]);
  const saveStation = useCallback(async (s: St) => { setSaving(true); const r = await fetch('/api/stations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(s) }); const j = await r.json(); setSaving(false); if (r.ok) { await loadStations(); flash(`saved → ${j.id}.md`); return j.id as string; } flash(j.error || 'error'); return null; }, [loadStations]);
  const delStation = useCallback(async (id: string) => {
    // if the deleted stop is a line's terminus, shrink that line back to the next stop inward
    // (a line must still begin & end at a station); if nothing's left, the line is dropped.
    const s = stations.find((q) => q.id === id);
    if (s) {
      const isEnd = (pt: Pt) => Math.hypot(pt[0] - s.x, pt[1] - s.y) < 4;
      const drop = new Set<string>();
      let next = lines.slice(); let touched = false;
      for (const l of lines) {
        const pts = l.pts; if (!pts || pts.length < 2) continue;
        const atStart = isEnd(pts[0]), atEnd = isEnd(pts[pts.length - 1]);
        if (!atStart && !atEnd) continue; // not a terminus of this line → geometry unchanged
        touched = true;
        const others = stations.filter((q) => q.id && q.id !== id && (q.lines?.length ? q.lines : [q.line]).includes(l.id));
        if (!others.length) { drop.add(l.id); continue; }
        const arcs = others.map((q) => arcAt(pts, q.x, q.y));
        const np = atEnd ? sliceByArc(pts, 0, Math.max(...arcs)) : sliceByArc(pts, Math.min(...arcs), Infinity);
        if (Math.hypot(np[np.length - 1][0] - np[0][0], np[np.length - 1][1] - np[0][1]) < 8) drop.add(l.id); // collapsed → can't be a line
        else next = next.map((q) => (q.id === l.id ? { ...q, pts: np, d: roundedPath(np) } : q));
      }
      if (touched) { pushHistory(); next = next.filter((l) => !drop.has(l.id)); await commitLines(next); }
    }
    setSaving(true);
    await fetch('/api/stations', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) });
    await loadStations(); setSaving(false);
  }, [stations, lines, commitLines, loadStations]);
  const commitTerrain = useCallback(async (next: TerrainFeature[]) => { setSaving(true); setTerrain(next); await fetch('/api/terrain', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ terrain: next }) }); setSaving(false); }, []);
  const updTerr = (id: string, patch: Partial<TerrainFeature>) => setTerrain((arr) => arr.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const commitPins = useCallback(async (next: Pin[]) => { setSaving(true); setPins(next); await fetch('/api/pins', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pins: next }) }); setSaving(false); }, []);
  const updPin = (id: string, patch: Partial<Pin>) => setPins((arr) => arr.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const commitOrigin = useCallback(async (o: Pt) => { setSaving(true); setOrigin(o); await fetch('/api/site', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ origin: o }) }); setSaving(false); }, []);
  const commitSite = useCallback(async (next: SiteMeta) => { setSaving(true); setSite(next); await fetch('/api/site', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ originLabel: next.originLabel, originCue: next.originCue, about: next.about, play: next.play }) }); setSaving(false); }, []);
  const setSiteAbout = (patch: Partial<SiteMeta['about']>) => setSite((s) => ({ ...s, about: { ...s.about, ...patch } }));
  const setSitePlay = (patch: Partial<PlayMeta>) => setSite((s) => ({ ...s, play: { ...s.play, ...patch } }));
  const setSiteLink = (i: number, patch: Partial<AboutLink>) => setSite((s) => ({ ...s, about: { ...s.about, links: s.about.links.map((l, k) => (k === i ? { ...l, ...patch } : l)) } }));

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
    return onDrag(move, up);
  }, [drag, stations, saveStation]);

  // node drag (track edit) — grid + neighbour-axis magnet
  useEffect(() => {
    if (nodeDrag === null) return;
    const move = (e: PointerEvent) => { let [x, y] = toSvg(e.clientX, e.clientY); setTrack((t) => { for (const nb of [t[nodeDrag - 1], t[nodeDrag + 1]]) { if (!nb) continue; if (Math.abs(x - nb[0]) <= GRID) x = nb[0]; if (Math.abs(y - nb[1]) <= GRID) y = nb[1]; } return t.map((p, i) => (i === nodeDrag ? [x, y] : p)); }); };
    const up = () => setNodeDrag(null);
    return onDrag(move, up);
  }, [nodeDrag]);

  // terrain: drag a vertex of a saved polygon (Mini-Metro style, no grid lock — coastlines are organic)
  useEffect(() => {
    if (!landNode) return;
    const move = (e: PointerEvent) => {
      const [x, y] = toSvgRaw(e.clientX, e.clientY);
      setTerrain((arr) => arr.map((f) => {
        if (f.id !== landNode.id || !f.points) return f;
        const pts = f.points.slice(); pts[landNode.i] = [x, y];
        return { ...f, points: pts, ...bboxOf(pts) };
      }));
    };
    const up = () => { setTerrain((arr) => { commitTerrain(arr); return arr; }); setLandNode(null); };
    return onDrag(move, up);
  }, [landNode, commitTerrain]);

  // terrain: move a whole piece (centre it under the cursor — works for polygons + legacy rects) / resize a legacy rect
  useEffect(() => {
    if (!terrDrag) return;
    const move = (e: PointerEvent) => {
      const [x, y] = toSvg(e.clientX, e.clientY);
      setTerrain((arr) => arr.map((f) => {
        if (f.id !== terrDrag.id) return f;
        if (terrDrag.mode === 'move') {
          const dx = x - (f.x + Math.round(f.w / 2)), dy = y - (f.y + Math.round(f.h / 2));
          if (f.points) { const pts = f.points.map(([px, py]) => [px + dx, py + dy] as Pt); return { ...f, points: pts, ...bboxOf(pts) }; }
          return { ...f, x: x - Math.round(f.w / 2), y: y - Math.round(f.h / 2) };
        }
        const x2 = f.x + f.w, y2 = f.y + f.h; // resize (legacy rect only): corner 0=tl 1=tr 2=br 3=bl
        let nx = f.x, ny = f.y, nx2 = x2, ny2 = y2;
        if (terrDrag.corner === 0) { nx = x; ny = y; } else if (terrDrag.corner === 1) { nx2 = x; ny = y; } else if (terrDrag.corner === 2) { nx2 = x; ny2 = y; } else { nx = x; ny2 = y; }
        return { ...f, x: Math.min(nx, nx2), y: Math.min(ny, ny2), w: Math.max(GRID, Math.abs(nx2 - nx)), h: Math.max(GRID, Math.abs(ny2 - ny)) };
      }));
    };
    const up = () => { setTerrain((arr) => { commitTerrain(arr); return arr; }); setTerrDrag(null); };
    return onDrag(move, up);
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
    return onDrag(move, up);
  }, [pinDraw, pins, pinKind, commitPins]);

  // pins: move (grab-anchored, no center jump) / resize an existing one
  useEffect(() => {
    if (!pinDrag) return;
    const move = (e: PointerEvent) => {
      const [rx, ry] = toSvgRaw(e.clientX, e.clientY);
      setPins((arr) => arr.map((p) => {
        if (p.id !== pinDrag.id) return p;
        if (pinDrag.mode === 'move') return { ...p, x: snap(rx - (pinDrag.dx ?? 0)), y: snap(ry - (pinDrag.dy ?? 0)) };
        const x = snap(rx), y = snap(ry), x2 = p.x + p.w, y2 = p.y + p.h;
        let nx = p.x, ny = p.y, nx2 = x2, ny2 = y2;
        if (pinDrag.corner === 0) { nx = x; ny = y; } else if (pinDrag.corner === 1) { nx2 = x; ny = y; } else if (pinDrag.corner === 2) { nx2 = x; ny2 = y; } else { nx = x; ny2 = y; }
        return { ...p, x: Math.min(nx, nx2), y: Math.min(ny, ny2), w: Math.max(GRID, Math.abs(nx2 - nx)), h: Math.max(GRID, Math.abs(ny2 - ny)) };
      }));
    };
    const up = () => { setPins((arr) => { commitPins(arr); return arr; }); setPinDrag(null); };
    return onDrag(move, up);
  }, [pinDrag, commitPins]);

  // origin marker: drag to reposition (grab-anchored), persist on release. The origin is a
  // first-class terminus, so any line endpoint sitting on it is carried along as it moves.
  useEffect(() => {
    if (!origDrag) return;
    const old = origin; // captured when the drag begins
    const links: { id: string; i: number }[] = [];
    for (const l of lines) {
      const pts = l.pts; if (!pts || pts.length < 2) continue;
      if (Math.hypot(pts[0][0] - old[0], pts[0][1] - old[1]) < 2) links.push({ id: l.id, i: 0 });
      const last = pts.length - 1;
      if (Math.hypot(pts[last][0] - old[0], pts[last][1] - old[1]) < 2) links.push({ id: l.id, i: last });
    }
    const move = (e: PointerEvent) => {
      const [rx, ry] = toSvgRaw(e.clientX, e.clientY);
      const no: Pt = [snap(rx - origGrab.current[0]), snap(ry - origGrab.current[1])];
      setOrigin(no);
      if (links.length) setLines((arr) => arr.map((l) => {
        const mine = links.filter((k) => k.id === l.id); if (!mine.length || !l.pts) return l;
        const pts = l.pts.slice(); for (const k of mine) pts[k.i] = no;
        return { ...l, pts, d: roundedPath(pts) };
      }));
    };
    const up = () => { setOrigin((o) => { commitOrigin(o); return o; }); if (links.length) commitLines(linesRef.current); setOrigDrag(false); };
    return onDrag(move, up);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origDrag, commitOrigin, commitLines]);

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
    return onDrag(move, up);
  }, [lnDrag, commitLines]);

  const cancelTrack = () => { setTrack([]); setEditId(null); setNodeDrag(null); };
  // a line must begin & end at a station (or the origin) — anchor each end to the nearest one,
  // and if there's nothing close, drop a terminus stop right there.
  const SNAP = 46;
  const anchorEnd = (p: Pt): { p: Pt; bare: boolean; sid?: string } => {
    if (Math.hypot(p[0] - origin[0], p[1] - origin[1]) <= SNAP) return { p: [origin[0], origin[1]], bare: false }; // the origin itself
    let best: St | null = null, bd = SNAP;
    for (const s of stations) { if (!s.id) continue; const dd = Math.hypot(p[0] - s.x, p[1] - s.y); if (dd <= bd) { bd = dd; best = s; } }
    return best ? { p: [best.x, best.y], bare: false, sid: best.id } : { p, bare: true };
  };
  const finishTrack = async () => {
    if (track.length < 2) { cancelTrack(); return; }
    pushHistory();
    const a0 = anchorEnd(track[0]), aN = anchorEnd(track[track.length - 1]);
    const pts = track.slice(); pts[0] = a0.p; pts[pts.length - 1] = aN.p;
    const d = roundedPath(pts);
    const isEdit = !!(editId && editId !== '__new');
    const id = isEdit ? editId! : `thread-${Date.now().toString(36)}`;
    if (isEdit) await commitLines(lines.map((l) => (l.id === editId ? { ...l, pts, d } : l)));
    else await commitLines([...lines, { id, label: `thread ${lines.length + 1}`, color: paint, text: isLight(paint) ? '#111' : '#fff', shape: 'circle', blurb: 'a new thread', pts, d }]);
    // every end must be a station/origin: drop a stop on a bare end; on an existing stop
    // (incl. a grand interchange) add this line to it so it becomes a joint terminus.
    for (const [end, key] of [[a0, 'start'], [aN, 'end']] as const) {
      if (end.bare) { await saveStation({ id: `${id}-${key}`, title: 'new stop', line: id, lines: [id], date: '', shape: 'circle', x: end.p[0], y: end.p[1], media: [], body: '' }); }
      else if (end.sid) { const s = stations.find((q) => q.id === end.sid); if (s && !(s.lines?.length ? s.lines : [s.line]).includes(id)) await saveStation({ ...s, lines: Array.from(new Set([...(s.lines?.length ? s.lines : [s.line]), id])) }); }
    }
    setSelLn(id); setTrack([]); setEditId(null); setNodeDrag(null); setTool('select'); setSelSt(null);
    flash(isEdit ? 'thread re-routed' : 'thread laid');
  };

  const paintLine = (id: string) => { const l = lines.find((q) => q.id === id); if (!l) return; pushHistory(); commitLines(lines.map((q) => (q.id === id ? { ...q, color: paint, text: isLight(paint) ? '#111' : '#fff' } : q))); flash(`recoloured “${l.label || id}” → ${paint}`); };

  // terrain pen — close the in-progress polygon into a saved piece
  const cancelLand = () => setLandDraft([]);
  const finishLand = () => {
    if (landDraft.length < 3) { setLandDraft([]); return; }
    pushHistory();
    const id = `t-${Date.now().toString(36)}`;
    const feat: TerrainFeature = { id, kind: terrainKind, points: landDraft, ...bboxOf(landDraft) };
    commitTerrain([...terrain, feat]);
    setSelTerr(id); setLandDraft([]); flash(`${terrainKind} drawn`);
  };

  // canvas tap (place / lay track) — distinguished from a pan-drag
  const onCanvasTap = (cx: number, cy: number) => {
    const [x, y] = toSvg(cx, cy);
    if (tool === 'station') {
      if (selLn) {
        // locked to the selected thread: snap the stop onto that line, bind to it only
        const line = lines.find((l) => l.id === selLn);
        const pos: Pt = line?.pts && line.pts.length >= 2 ? projectOnLine(line.pts as Pt[], x, y) : [x, y];
        pushHistory(); editStation({ id: '', title: 'new stop', line: selLn, lines: [selLn], date: '', shape: lnShape(selLn), x: pos[0], y: pos[1], media: [], body: '' }); setTool('select'); flash(`new stop on ${line?.label || selLn} — fill it in & save`);
      } else {
        const onLn = hover && hover[0] === 'L' ? hover.slice(1) : null; const ln = onLn || lines[0]?.id || 'central'; const near = Array.from(new Set([ln, ...linesNear(x, y)])); pushHistory(); editStation({ id: '', title: 'new stop', line: ln, lines: near, date: '', shape: lnShape(ln), x, y, media: [], body: '' }); setTool('select'); flash(near.length > 1 ? `joint stop on ${near.length} threads — fill it in & save` : 'new stop — fill it in & save');
      }
    }
    else if (tool === 'track') { setTrack((t) => [...t, snapTrack(t[t.length - 1], [x, y])]); }
    else if (tool === 'terrain') {
      // pen: drop an (organic, unsnapped) vertex; clicking near the first point closes the shape
      const [rx, ry] = toSvgRaw(cx, cy);
      if (landDraft.length >= 3 && Math.hypot(rx - landDraft[0][0], ry - landDraft[0][1]) < 16) { finishLand(); return; }
      setSelTerr(null); setLandDraft((d) => [...d, [rx, ry]]);
    }
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
      if (e.key === 'Escape') { cancelTrack(); cancelLand(); setLandNode(null); closeForm(); setSelLn(null); setSelTerr(null); setSelPin(null); setDraw(null); setPinDraw(null); setPickStop(false); setLnDrag(null); setOrigDrag(false); drawStart.current = null; pinDrawStart.current = null; return; }
      const t = TOOLS.find((x) => x.key === e.key.toLowerCase());
      if (t) { setTool(t.id); if (t.id === 'track') { setEditId('__new'); setTrack([]); } else { cancelTrack(); } if (t.id !== 'terrain') cancelLand(); }
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

  // "ride the line" intro glide — same as the public map: on first load this session,
  // jump tight to the leftmost stop, glide across to the rightmost, then settle to full view
  const glided = useRef(false);
  useEffect(() => {
    if (glided.current || view !== 'build' || form || stations.length < 2) return;
    let done = false; try { done = sessionStorage.getItem('admin-glided') === '1'; } catch {}
    if (done) { glided.current = true; return; }
    glided.current = true;
    try { sessionStorage.setItem('admin-glided', '1'); } catch {}
    const byX = [...stations].filter((s) => s.id).sort((a, b) => a.x - b.x);
    if (byX.length < 2) { glided.current = false; return; }
    const first = byX[0], last = byX[byX.length - 1];
    const timers = [
      setTimeout(() => { try { tw.current?.zoomToElement('st-' + first.id, 1.4, 0); } catch {} }, 350),
      setTimeout(() => { try { tw.current?.zoomToElement('st-' + last.id, 0.9, 2400, 'easeOut'); } catch {} }, 800),
      setTimeout(() => { try { tw.current?.resetTransform(1200, 'easeOut'); } catch {} }, 3400),
    ];
    return () => timers.forEach(clearTimeout);
  }, [stations, view, form]);

  const { theme, toggle: toggleTheme } = useAdminTheme();
  const editColor = editId && editId !== '__new' ? (lines.find((l) => l.id === editId)?.color ?? paint) : paint;
  const previewPts = cursor && tool === 'track' && editId === '__new' ? [...track, snapTrack(track[track.length - 1], cursor)] : track;
  // NOTE: the flyout markup is inlined in the return below — styled-jsx only scopes JSX
  // written inside the return, so extracting it to a const left .rail-fly/.sw unstyled.
  const flyLabel = tool === 'terrain' ? 'land' : tool === 'note' ? 'pin kind' : (tool === 'paint' ? 'paint colour — pick one, then click a thread' : tool === 'track' ? 'thread colour' : '');
  const hasFly = tool === 'paint' || tool === 'track' || tool === 'terrain' || tool === 'note';

  return (
    <div className="adm">
      {/* top strip — brand · contextual track actions · history/zoom/theme/view */}
      <div className="adm-top">
        <b className="adm-brand">toeesh<span className="dimk"> · build</span></b>
        {(track.length > 0 || editId) && <button className="tbtn solid" onClick={finishTrack}>✓ {editId && editId !== '__new' ? 're-route' : 'finish'} ({track.length})</button>}
        {(track.length > 0 || editId) && <button className="tbtn" onClick={cancelTrack}>✗ cancel</button>}
        <div className="adm-top-r">
          <button className="tbtn" onClick={undo} title="undo (⌘Z)">↶</button>
          <button className="tbtn" onClick={redo} title="redo (⌘⇧Z)">↷</button>
          <span className={`save ${saving ? 'on' : ''}`}>{saving ? 'saving…' : 'saved'}</span>
          <span className="adm-div" />
          <button className="tbtn" onClick={() => tw.current?.zoomOut()} title="zoom out">−</button>
          <button className="tbtn" onClick={() => tw.current?.resetTransform()} title="reset view">⊙</button>
          <button className="tbtn" onClick={() => tw.current?.zoomIn()} title="zoom in">＋</button>
          <span className="adm-div" />
          <button className="tbtn" onClick={toggleTheme} title="toggle theme">{theme === 'dark' ? '◐ dark' : '◑ light'}</button>
          <button className={`tbtn ${view === 'dashboard' ? 'on' : ''}`} onClick={() => setView(view === 'build' ? 'dashboard' : 'build')}>{view === 'build' ? '≡ list' : '▦ map'}</button>
          <a className="tbtn" href="/">view →</a>
        </div>
      </div>

      <div className={`adm-main ${form ? 'writing' : ''}`}>
        {/* left tool rail */}
        <div className="adm-rail">
          <div className="addstop-wrap">
            <button className="rail-compose" title="add stop to a thread" onClick={() => setPickStop((v) => !v)}>＋</button>
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
          <div className="rail-div" />
          {TOOLS.map((t) => (
            <button key={t.id} className={`rail-tool ${tool === t.id ? 'on' : ''}`} title={`${t.label} (${t.key})`} onClick={() => { setTool(t.id); if (t.id === 'track') { setEditId('__new'); setTrack([]); setSelLn(null); setForm(null); } else cancelTrack(); if (t.id !== 'terrain') cancelLand(); }}>
              <span className="t-ic">{t.icon}</span><span className="t-lab">{t.label}</span><kbd>{t.key}</kbd>
            </button>
          ))}
        </div>

        {view === 'build' ? (
<Canvas
            tool={tool} lines={lines} stations={stations} terrain={terrain} pins={pins} origin={origin} form={form}
            selSt={selSt} selLn={selLn} selTerr={selTerr} selPin={selPin} draw={draw} pinDraw={pinDraw} track={track}
            editId={editId} nodeDrag={nodeDrag} lnDrag={lnDrag} hover={hover} paint={paint} terrainKind={terrainKind} pinKind={pinKind}
            flyLabel={flyLabel} hasFly={hasFly} msg={msg} selLine={selLine} previewPts={previewPts} editColor={editColor}
            setPaint={setPaint} setTerrainKind={setTerrainKind} setPinKind={setPinKind} setHover={setHover} setCursor={setCursor}
            setDraw={setDraw} setPinDraw={setPinDraw} setSelTerr={setSelTerr} setSelPin={setSelPin} setTerrDrag={setTerrDrag}
            setPinDrag={setPinDrag} setTrack={setTrack} setNodeDrag={setNodeDrag} setLnDrag={setLnDrag} setLines={setLines} setOrigDrag={setOrigDrag}
            cursor={cursor} landDraft={landDraft} landNode={landNode} setTerrain={setTerrain} setLandNode={setLandNode} finishLand={finishLand} cancelLand={cancelLand}
            svgRef={svgRef} tw={tw} downPt={downPt} drawStart={drawStart} pinDrawStart={pinDrawStart} origGrab={origGrab}
            toSvg={toSvg} toSvgRaw={toSvgRaw} onCanvasTap={onCanvasTap} onLine={onLine} onStation={onStation}
            lnColor={lnColor} lnShape={lnShape} commitTerrain={commitTerrain} commitPins={commitPins}
            pushHistory={pushHistory} finishTrack={finishTrack} cancelTrack={cancelTrack}
          />
        ) : (
          <div className="adm-list scroll">
            <table><thead><tr><th></th><th>title</th><th>thread</th><th>date</th><th></th></tr></thead>
              <tbody>{stations.map((s) => (<tr key={s.id}><td><span className="dot" style={{ background: lnColor(s.line) }} /></td><td><b>{s.title}</b></td><td className="mono">{s.line}</td><td className="mono">{s.date}</td><td className="rt"><button className="tbtn sm" onClick={() => { setView('build'); editStation(s); }}>edit</button> <button className="tbtn sm" onClick={() => { pushHistory(); s.id && delStation(s.id); }}>del</button></td></tr>))}</tbody>
            </table>
          </div>
        )}

        <Inspector
          form={form} setForm={setForm} lines={lines} stations={stations} pins={pins} terrain={terrain} site={site}
          selLn={selLn} setSelLn={setSelLn} selPinObj={selPinObj} selFeat={selFeat}
          preview={preview} setPreview={setPreview} idClash={idClash} stLines={stLines} bodyRef={bodyRef}
          lnColor={lnColor} upF={upF} setPrimaryLine={setPrimaryLine} toggleStLine={toggleStLine}
          setMedia={setMedia} upload={upload} uploadPin={uploadPin} wrapSel={wrapSel} prefixLine={prefixLine} linesNear={linesNear}
          pushHistory={pushHistory} commitLines={commitLines} saveStation={saveStation} delStation={delStation} closeForm={closeForm}
          pendingLine={pendingLine} setPendingLine={setPendingLine} setSelSt={setSelSt}
          commitPins={commitPins} updPin={updPin} setSelPin={setSelPin}
          commitTerrain={commitTerrain} updTerr={updTerr} setSelTerr={setSelTerr}
          addThread={addThread} moveThread={moveThread} upLine={upLine}
          setTool={setTool} setEditId={setEditId} setTrack={setTrack} flash={flash}
          setSite={setSite} commitSite={commitSite} setSiteAbout={setSiteAbout} setSiteLink={setSiteLink} setSitePlay={setSitePlay}
        />
      </div>

{/* styles live in ./admin.css */}
    </div>
  );
}

