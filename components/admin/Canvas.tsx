'use client';
// The pan/zoom SVG editing surface: terrain, threads + re-route handles, track preview,
// stations, origin, pins, ghost — plus the contextual flybar and track bar. Extracted
// from the admin page; fed one props bundle so the page no longer holds ~160 lines of SVG.
import { TransformWrapper, TransformComponent, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { MAP_VIEWBOX, RIBBON, roundedPath, tunnelRuns, runPts, type Pt } from '@/content/lines';
import { TERRAIN_KINDS, KIND_BY_ID, kindOf, DEFAULT_ROUND, type TerrainKind, type TerrainFeature } from '@/components/map/terrain-kinds';
import { terrainPath, roundedPolyPath, offsetInward, bboxOf } from '@/components/map/terrain-shape';
import Bridges from '@/components/map/Bridges';
import { TOOLS, PALETTE, PIN_KINDS, FAR, INK } from '@/components/admin/lib/constants';
import { snap } from '@/components/admin/lib/geometry';
import InfiniteGrid from '@/components/admin/canvas/InfiniteGrid';
import Marker from '@/components/admin/canvas/Marker';
import type { St, Ln, Pin, Rect, Tool } from '@/components/admin/types';

type Dispatch<T> = React.Dispatch<React.SetStateAction<T>>;
export type CanvasProps = {
  tool: Tool; lines: Ln[]; stations: St[]; terrain: TerrainFeature[]; pins: Pin[]; origin: Pt; form: St | null;
  selSt: string | null; selLn: string | null; selTerr: string | null; selPin: string | null;
  draw: Rect | null; pinDraw: Rect | null; track: Pt[]; editId: string | null; nodeDrag: number | null;
  lnDrag: { id: string; i: number } | null; hover: string | null;
  paint: string; terrainKind: TerrainKind; pinKind: Pin['kind']; terrainRound: number; setTerrainRound: (v: number) => void;
  flyLabel: string; hasFly: boolean; msg: string;
  selLine: Ln | null; previewPts: Pt[]; editColor: string;
  setPaint: (v: string) => void; setTerrainKind: (v: TerrainKind) => void; setPinKind: (v: Pin['kind']) => void;
  setHover: (v: string | null) => void; setCursor: (v: Pt | null) => void;
  setDraw: Dispatch<Rect | null>; setPinDraw: Dispatch<Rect | null>;
  setSelTerr: (v: string | null) => void; setSelPin: (v: string | null) => void;
  setTerrDrag: (v: { id: string; mode: 'move' | 'resize'; corner?: number } | null) => void;
  setPinDrag: (v: { id: string; mode: 'move' | 'resize'; corner?: number; dx?: number; dy?: number } | null) => void;
  setTrack: Dispatch<Pt[]>; setNodeDrag: (v: number | null) => void;
  setLnDrag: (v: { id: string; i: number } | null) => void; setLines: Dispatch<Ln[]>; setOrigDrag: (v: boolean) => void;
  cursor: Pt | null; landDraft: Pt[]; landNode: { id: string; i: number } | null;
  setTerrain: Dispatch<TerrainFeature[]>; setLandNode: (v: { id: string; i: number } | null) => void;
  finishLand: () => void; cancelLand: () => void;
  svgRef: React.RefObject<SVGSVGElement | null>; tw: React.RefObject<ReactZoomPanPinchRef | null>;
  downPt: React.MutableRefObject<{ x: number; y: number } | null>;
  drawStart: React.MutableRefObject<Pt | null>; pinDrawStart: React.MutableRefObject<Pt | null>; origGrab: React.MutableRefObject<Pt>;
  toSvg: (cx: number, cy: number) => Pt; toSvgRaw: (cx: number, cy: number) => Pt;
  onCanvasTap: (cx: number, cy: number) => void; onLine: (l: Ln) => void; onStation: (s: St) => void;
  lnColor: (id: string) => string; lnShape: (id: string) => string;
  commitTerrain: (next: TerrainFeature[]) => void; commitPins: (next: Pin[]) => void;
  pushHistory: () => void; finishTrack: () => void; cancelTrack: () => void;
};

export default function Canvas(p: CanvasProps) {
  const {
    tool, lines, stations, terrain, pins, origin, form, selSt, selLn, selTerr, selPin, draw, pinDraw, track,
    editId, nodeDrag, lnDrag, hover, paint, terrainKind, pinKind, flyLabel, hasFly, msg, selLine, previewPts,
    editColor, setPaint, setTerrainKind, setPinKind, setHover, setCursor, setDraw, setPinDraw, setSelTerr,
    setSelPin, setTerrDrag, setPinDrag, setTrack, setNodeDrag, setLnDrag, setLines, setOrigDrag, svgRef, tw, downPt,
    drawStart, pinDrawStart, origGrab, toSvg, toSvgRaw, onCanvasTap, onLine, onStation, lnColor, lnShape,
    commitTerrain, commitPins, pushHistory, finishTrack, cancelTrack,
    cursor, landDraft, landNode, setTerrain, setLandNode, finishLand, cancelLand, terrainRound, setTerrainRound,
  } = p;
  // terrain is a focused mode: while it's active the rest of the map dims and goes pointer-inert,
  // so editing water never fights nearby stops/threads. Only the water layer stays live.
  const terr = tool === 'terrain';
  const lockStyle = terr ? ({ opacity: 0.3, pointerEvents: 'none' } as const) : undefined;
  return (
    <div className="adm-canvas">
      {hasFly && (
        <div className="adm-flybar">
          <span className="fly-h mono">{flyLabel}</span>
          {(tool === 'paint' || tool === 'track') && (
            <div className="rail-fly swatches">
              {PALETTE.map((c) => <button key={c} className={`sw ${paint === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setPaint(c)} aria-label={c} />)}
              <label className="cpick" title="custom colour"><input type="color" value={paint} onChange={(e) => setPaint(e.target.value)} /></label>
            </div>
          )}
          {tool === 'terrain' && <div className="rail-fly kinds">{TERRAIN_KINDS.map((k) => <button key={k.id} className={`kind ${terrainKind === k.id ? 'on' : ''}`} onClick={() => setTerrainKind(k.id)} title={k.label}><span className="k-sw" style={{ background: k.fill }} />{k.label}</button>)}<label className="terr-round mono" title="corner roundness for new water">corners<input type="range" min={0} max={80} value={terrainRound} onChange={(e) => setTerrainRound(Number(e.target.value))} /><span className="terr-round-v">{terrainRound}</span></label></div>}
          {tool === 'note' && <div className="rail-fly kinds">{PIN_KINDS.map((k) => <button key={k.id} className={`kind ${pinKind === k.id ? 'on' : ''}`} onClick={() => setPinKind(k.id)} title={k.label}><span className="k-ic">{k.id === 'photo' ? '▣' : '✎'}</span>{k.label}</button>)}</div>}
        </div>
      )}
      {(track.length > 0 || editId) && (
        <div className="adm-trackbar">
          <span className="mono">{editId && editId !== '__new' ? 're-routing' : 'laying track'} · {track.length} {track.length === 1 ? 'point' : 'points'}{track.length < 2 ? ' · tap the map' : ''}</span>
          <button className="tbtn solid" onClick={finishTrack}>✓ {editId && editId !== '__new' ? 're-route' : 'finish'}</button>
          <button className="tbtn" onClick={cancelTrack}>✗ cancel</button>
        </div>
      )}
      {tool === 'terrain' && landDraft.length > 0 && (
        <div className="adm-trackbar">
          <span className="mono">drawing {terrainKind} · {landDraft.length} {landDraft.length === 1 ? 'point' : 'points'}{landDraft.length < 3 ? ' · tap to drop anchors' : ' · snap onto the first point (or ⏎) to close · ⌫ undo'}</span>
          <button className="tbtn solid" onClick={finishLand}>✓ close</button>
          <button className="tbtn" onClick={cancelLand}>✗ cancel</button>
        </div>
      )}
      <div className="canvas-mode-card">
        <b>{TOOLS.find((t) => t.id === tool)?.label}</b>
        <span>{msg || TOOLS.find((t) => t.id === tool)!.hint}</span>
      </div>
      <div className="adm-stage">
        <TransformWrapper ref={tw} initialScale={0.7} minScale={0.3} maxScale={4} centerOnInit limitToBounds={false} doubleClick={{ disabled: true }} panning={{ allowLeftClickPan: tool !== 'terrain' && tool !== 'note', excluded: ['rt-drag'] }} wheel={{ step: 0.08 }}>
          <TransformComponent wrapperStyle={{ width: '100%', height: '100%', background: 'var(--canvas)' }} contentStyle={{ width: 1400, height: 940 }}>
            <svg ref={svgRef} viewBox={MAP_VIEWBOX} width={1400} height={940} className={`svg tool-${tool}`}
              onPointerDown={(e) => { downPt.current = { x: e.clientX, y: e.clientY }; const onHit = (e.target as Element).closest('[data-hit]'); if (tool === 'note' && !onHit) { const pt = toSvg(e.clientX, e.clientY); pinDrawStart.current = pt; setSelPin(null); setPinDraw({ x: pt[0], y: pt[1], w: 0, h: 0 }); } }}
              onPointerUp={(e) => { const d = downPt.current; downPt.current = null; if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6 && !(e.target as Element).closest('[data-hit]')) onCanvasTap(e.clientX, e.clientY); }}
              onPointerMove={(e) => { if (tool === 'track') setCursor(toSvg(e.clientX, e.clientY)); else if (tool === 'terrain') setCursor(toSvgRaw(e.clientX, e.clientY)); }}>
              <rect x={-FAR} y={-FAR} width={FAR * 2} height={FAR * 2} fill="var(--canvas)" />
              <InfiniteGrid svgRef={svgRef} />

              {/* terrain — flat cartographic shapes; pen-editable in the terrain tool */}
              <g>
                {terrain.map((f) => { const k = kindOf(f); const isSel = selTerr === f.id; const active = tool === 'terrain' || tool === 'bulldoze';
                  const d = terrainPath(f, k);
                  const hasPoly = !!(f.points && f.points.length >= 3);
                  const coast = hasPoly && Math.min(f.w, f.h) > 44 ? roundedPolyPath(offsetInward(f.points!, 8), Math.max(0, (f.round ?? DEFAULT_ROUND) - 8)) : null;
                  return (
                    <g key={f.id}>
                      <path data-hit={active ? '' : undefined} d={d} fill={k.fill} stroke={isSel ? INK : k.line} strokeWidth={isSel ? 2.5 : 1.5} strokeDasharray={isSel ? '7 6' : undefined} strokeLinejoin="round"
                        style={{ cursor: tool === 'terrain' ? 'move' : tool === 'bulldoze' ? 'not-allowed' : 'default' }}
                        onPointerDown={(e) => { if (!active) return; e.stopPropagation(); if (tool === 'bulldoze') { commitTerrain(terrain.filter((q) => q.id !== f.id)); if (selTerr === f.id) setSelTerr(null); } else { setSelTerr(f.id); setTerrDrag({ id: f.id, mode: 'move' }); } }} />
                      {coast && <path d={coast} fill="none" stroke={k.coast} strokeWidth={2.5} style={{ pointerEvents: 'none' }} />}
                      {f.label && <text x={f.x + f.w / 2} y={f.y + f.h / 2} textAnchor="middle" dominantBaseline="middle" className="terrain-label" fill="var(--terrain-label, rgba(20,20,20,0.34))" style={{ pointerEvents: 'none' }}>{f.label}</text>}
                      {/* vertex handles for a selected polygon (drag to reshape · dbl-click to remove · mid-dots insert) */}
                      {isSel && tool === 'terrain' && hasPoly && (() => { const pts = f.points!; return (<g>
                        {pts.map((pt, i) => (
                          <circle key={'tm' + i} className="rt-drag" data-hit cx={(pt[0] + pts[(i + 1) % pts.length][0]) / 2} cy={(pt[1] + pts[(i + 1) % pts.length][1]) / 2} r={5} fill="var(--canvas)" stroke={INK} strokeWidth={2} style={{ cursor: 'copy' }}
                            onPointerDown={(e) => { e.stopPropagation(); pushHistory(); const mid: Pt = [(pts[i][0] + pts[(i + 1) % pts.length][0]) / 2, (pts[i][1] + pts[(i + 1) % pts.length][1]) / 2]; const np = [...pts.slice(0, i + 1), mid, ...pts.slice(i + 1)]; setTerrain(terrain.map((q) => (q.id === f.id ? { ...q, points: np, ...bboxOf(np) } : q))); setLandNode({ id: f.id, i: i + 1 }); }} />
                        ))}
                        {pts.map((pt, i) => (
                          <circle key={'tn' + i} className="rt-drag" data-hit cx={pt[0]} cy={pt[1]} r={8} fill="var(--ed-face)" stroke={INK} strokeWidth={3} style={{ cursor: 'move' }}
                            onPointerDown={(e) => { e.stopPropagation(); pushHistory(); setLandNode({ id: f.id, i }); }}
                            onDoubleClick={(e) => { e.stopPropagation(); if (pts.length > 3) { pushHistory(); const np = pts.filter((_, k2) => k2 !== i); commitTerrain(terrain.map((q) => (q.id === f.id ? { ...q, points: np, ...bboxOf(np) } : q))); } }} />
                        ))}
                      </g>); })()}
                      {/* legacy rect corner handles (features with no polygon yet) */}
                      {isSel && tool === 'terrain' && !hasPoly && [[f.x, f.y], [f.x + f.w, f.y], [f.x + f.w, f.y + f.h], [f.x, f.y + f.h]].map((c, ci) => (
                        <rect key={ci} data-hit x={c[0] - 8} y={c[1] - 8} width={16} height={16} fill="var(--ed-face)" stroke={INK} strokeWidth={3} style={{ cursor: ci === 0 || ci === 2 ? 'nwse-resize' : 'nesw-resize' }}
                          onPointerDown={(e) => { e.stopPropagation(); setSelTerr(f.id); setTerrDrag({ id: f.id, mode: 'resize', corner: ci }); }} />
                      ))}
                    </g>
                  );
                })}
                {/* live pen draft — a real polygon pen: each tap drops an anchor joined by straight exterior
                    lines; the water body only forms once the loop closes (snap onto the first anchor / ⏎). */}
                {tool === 'terrain' && landDraft.length > 0 && (() => {
                  const k = KIND_BY_ID[terrainKind];
                  const first = landDraft[0];
                  const last = landDraft[landDraft.length - 1];
                  const canClose = landDraft.length >= 3;
                  const nearStart = !!(cursor && canClose && Math.hypot(cursor[0] - first[0], cursor[1] - first[1]) < 18);
                  const edges = 'M' + landDraft.map((pt) => `${pt[0]},${pt[1]}`).join(' L'); // straight exterior outline so far
                  return (<g style={{ pointerEvents: 'none' }}>
                    {/* faint preview of the finished body — only once the loop can close, with the chosen corner radius */}
                    {canClose && <path d={roundedPolyPath(landDraft, terrainRound)} fill={k.fill} fillOpacity={nearStart ? 0.5 : 0.16} stroke="none" />}
                    <path d={edges} fill="none" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
                    {/* the live edge from the last anchor to the cursor (the line you're about to commit) */}
                    {cursor && !nearStart && <line x1={last[0]} y1={last[1]} x2={cursor[0]} y2={cursor[1]} stroke={INK} strokeWidth={2} strokeDasharray="6 6" />}
                    {/* the closing edge back to the first anchor, once you can close */}
                    {canClose && nearStart && <line x1={last[0]} y1={last[1]} x2={first[0]} y2={first[1]} stroke={INK} strokeWidth={2} />}
                    {/* snap ring on the first anchor — the close target, brightens when the cursor is over it */}
                    {canClose && <circle cx={first[0]} cy={first[1]} r={nearStart ? 16 : 11} fill="none" stroke={k.line} strokeWidth={nearStart ? 2.5 : 1.5} strokeDasharray="3 4" opacity={nearStart ? 1 : 0.6} />}
                    {landDraft.map((pt, i) => (
                      <circle key={i} className="rt-drag" data-hit cx={pt[0]} cy={pt[1]} r={i === 0 ? 6 : 4.5} fill={i === 0 ? k.line : 'var(--canvas)'} stroke={INK} strokeWidth={2}
                        style={{ pointerEvents: 'auto', cursor: i === 0 && canClose ? 'pointer' : 'crosshair' }}
                        onPointerDown={(e) => { e.stopPropagation(); if (i === 0 && canClose) finishLand(); }} />
                    ))}
                  </g>);
                })()}
              </g>

              {/* bridge preview — auto-decks wherever a thread crosses water, same as the public map */}
              <Bridges lines={lines} terrain={terrain} />

              <g style={lockStyle}>
              {lines.map((l) => (editId && editId !== '__new' && editId === l.id ? null : (
                <g key={l.id} style={{ cursor: tool === 'select' || tool === 'paint' || tool === 'bulldoze' ? 'pointer' : 'crosshair' }}
                  onPointerDown={(e) => { if (tool === 'station' || tool === 'track') return; e.stopPropagation(); onLine(l); }} onPointerEnter={() => setHover('L' + l.id)} onPointerLeave={() => setHover(null)}>
                  {/* fat invisible hit area so thin threads are easy to click (paint/select/bulldoze) */}
                  <path d={l.d} fill="none" stroke="transparent" strokeWidth={28} strokeLinecap="round" strokeLinejoin="round" />
                  {selLn === l.id && <path d={l.d} fill="none" stroke="var(--canvas)" strokeWidth={RIBBON + 10} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} style={{ pointerEvents: 'none' }} />}
                  <path d={l.d} fill="none" stroke={l.color} strokeWidth={RIBBON} strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }}
                    opacity={(selLn && selLn !== l.id) || (hover && hover !== 'L' + l.id && tool === 'paint') ? 0.4 : 0.92} />
                  {selLn === l.id && l.pts && <text x={l.pts[0][0]} y={l.pts[0][1] - 34} className="map-tip" textAnchor="middle">{l.label}</text>}
                  {/* tunnel preview — white ticks mark the underground segments */}
                  {l.under?.length && l.pts ? tunnelRuns(l.under).map((run, ri) => (
                    <path key={'tun' + ri} d={roundedPath(runPts(l.pts as Pt[], run))} fill="none" stroke="var(--canvas)" strokeWidth={RIBBON * 0.7} strokeDasharray="3 8" strokeLinecap="round" style={{ pointerEvents: 'none' }} />
                  )) : null}
                </g>
              )))}
              </g>

              {/* live re-route handles for the selected thread (Mini-Metro style) */}
              {tool === 'select' && !editId && selLine && selLine.pts && selLine.pts.length >= 2 && (() => {
                const pts = selLine.pts as Pt[];
                return (
                  <g>
                    {lnDrag && lnDrag.id === selLine.id && pts[lnDrag.i] && (() => { const pt = pts[lnDrag.i]; return <g opacity={0.5}><line x1={pt[0]} y1={-FAR} x2={pt[0]} y2={FAR} stroke={selLine.color} strokeDasharray="6 8" /><line x1={-FAR} y1={pt[1]} x2={FAR} y2={pt[1]} stroke={selLine.color} strokeDasharray="6 8" /></g>; })()}
                    {pts.map((pt, i) => i < pts.length - 1 && (
                      <circle key={'lm' + i} className="rt-drag" data-hit cx={(pt[0] + pts[i + 1][0]) / 2} cy={(pt[1] + pts[i + 1][1]) / 2} r={7} fill="var(--canvas)" stroke={selLine.color} strokeWidth={2.5} style={{ cursor: 'copy' }}
                        onPointerDown={(e) => { e.stopPropagation(); pushHistory(); const mid: Pt = [snap((pts[i][0] + pts[i + 1][0]) / 2), snap((pts[i][1] + pts[i + 1][1]) / 2)]; const np = [...pts.slice(0, i + 1), mid, ...pts.slice(i + 1)]; setLines((arr) => arr.map((l) => (l.id === selLine.id ? { ...l, pts: np, d: roundedPath(np) } : l))); setLnDrag({ id: selLine.id, i: i + 1 }); }} />
                    ))}
                    {pts.map((pt, i) => (
                      <circle key={'ln' + i} className="rt-drag" data-hit cx={pt[0]} cy={pt[1]} r={11} fill="var(--ed-face)" stroke={selLine.color} strokeWidth={4} style={{ cursor: 'move' }}
                        onPointerDown={(e) => { e.stopPropagation(); pushHistory(); setLnDrag({ id: selLine.id, i }); }}
                        onDoubleClick={(e) => { e.stopPropagation(); if (pts.length > 2) { pushHistory(); const np = pts.filter((_, k) => k !== i); setLines((arr) => arr.map((l) => (l.id === selLine.id ? { ...l, pts: np, d: roundedPath(np) } : l))); } }} />
                    ))}
                  </g>
                );
              })()}

              {/* track preview + editable nodes + snap guides */}
              {(track.length > 0 || editId) && (
                <g>
                  <path d={roundedPath(previewPts)} fill="none" stroke={editColor} strokeWidth={RIBBON} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
                  {nodeDrag !== null && track[nodeDrag] && (() => { const pt = track[nodeDrag]; return <g opacity={0.5}><line x1={pt[0]} y1={-FAR} x2={pt[0]} y2={FAR} stroke="#e3000b" strokeDasharray="6 8" /><line x1={-FAR} y1={pt[1]} x2={FAR} y2={pt[1]} stroke="#e3000b" strokeDasharray="6 8" /></g>; })()}
                  {track.map((pt, i) => i < track.length - 1 && (<circle key={'m' + i} className="rt-drag" data-hit cx={(pt[0] + track[i + 1][0]) / 2} cy={(pt[1] + track[i + 1][1]) / 2} r={6} fill="var(--canvas)" stroke={INK} strokeWidth={2} style={{ cursor: 'copy' }} onPointerDown={(e) => { e.stopPropagation(); setTrack((t) => [...t.slice(0, i + 1), [snap((t[i][0] + t[i + 1][0]) / 2), snap((t[i][1] + t[i + 1][1]) / 2)] as Pt, ...t.slice(i + 1)]); }} />))}
                  {track.map((pt, i) => (<circle key={'n' + i} className="rt-drag" data-hit cx={pt[0]} cy={pt[1]} r={10} fill="var(--ed-face)" stroke={INK} strokeWidth={4} style={{ cursor: 'move' }} onPointerDown={(e) => { e.stopPropagation(); setNodeDrag(i); }} onDoubleClick={(e) => { e.stopPropagation(); setTrack((t) => (t.length > 2 ? t.filter((_, k) => k !== i) : t)); }} />))}
                </g>
              )}

              <g style={lockStyle}>
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
              </g>

              {/* origin — drag to reposition in the select tool */}
              <g className="rt-drag" data-hit transform={`translate(${origin[0]},${origin[1]})`} style={{ cursor: tool === 'select' ? 'grab' : 'default', ...(terr ? { opacity: 0.3, pointerEvents: 'none' as const } : {}) }}
                onPointerDown={(e) => { if (tool !== 'select') return; e.stopPropagation(); const [rx, ry] = toSvgRaw(e.clientX, e.clientY); origGrab.current = [rx - origin[0], ry - origin[1]]; setOrigDrag(true); }}>
                <circle r={40} fill="transparent" />
                <circle r={30} fill={INK} />
                <circle r={13} fill="var(--canvas)" />
                {tool === 'select' && <text y={-44} textAnchor="middle" className="map-tip">origin</text>}
              </g>

              {/* pins — notes & photos tacked on the board, editable in the note tool */}
              <g style={lockStyle}>
                {pins.map((pin, i) => {
                  const isSel = selPin === pin.id; const active = tool === 'note' || tool === 'bulldoze';
                  const no = `T·${String(i + 1).padStart(2, '0')}`;
                  return (
                    <g key={pin.id}>
                      <foreignObject x={pin.x} y={pin.y} width={pin.w} height={pin.h} style={{ overflow: 'visible', pointerEvents: 'none' }}>
                        <div className={`tile tile-${pin.kind}`} style={{ width: pin.w, height: pin.h }}>
                          {pin.kind === 'photo' ? (
                            <>
                              <div className="tile-frame">{pin.src ? <img src={pin.src} alt={pin.caption || ''} draggable={false} /> : <span className="tile-ph" />}</div>
                              <div className="tile-meta"><span className="tile-tag"><span className="tile-no">{no}</span>{pin.tag || 'photo'}</span>{pin.caption && <span className="tile-cap">{pin.caption}</span>}</div>
                            </>
                          ) : (
                            <>
                              <span className="tile-tag"><span className="tile-no">{no}</span>{pin.tag || 'note'}</span>
                              <p>{pin.text}</p>
                            </>
                          )}
                        </div>
                      </foreignObject>
                      <rect className="rt-drag" data-hit={active ? '' : undefined} x={pin.x} y={pin.y} width={pin.w} height={pin.h}
                        fill="transparent" stroke={isSel ? INK : 'transparent'} strokeWidth={isSel ? 3 : 0} strokeDasharray={isSel ? '7 6' : undefined}
                        style={{ cursor: tool === 'note' ? 'move' : tool === 'bulldoze' ? 'not-allowed' : 'default' }}
                        onPointerDown={(e) => { if (!active) return; e.stopPropagation(); if (tool === 'bulldoze') { commitPins(pins.filter((q) => q.id !== pin.id)); if (selPin === pin.id) setSelPin(null); } else { setSelPin(pin.id); const [rx, ry] = toSvgRaw(e.clientX, e.clientY); setPinDrag({ id: pin.id, mode: 'move', dx: rx - pin.x, dy: ry - pin.y }); } }} />
                      {isSel && tool === 'note' && [[pin.x, pin.y], [pin.x + pin.w, pin.y], [pin.x + pin.w, pin.y + pin.h], [pin.x, pin.y + pin.h]].map((c, ci) => (
                        <rect key={ci} className="rt-drag" data-hit x={c[0] - 10} y={c[1] - 10} width={20} height={20} fill="var(--ed-face)" stroke={INK} strokeWidth={3} style={{ cursor: ci === 0 || ci === 2 ? 'nwse-resize' : 'nesw-resize' }}
                          onPointerDown={(e) => { e.stopPropagation(); setSelPin(pin.id); setPinDrag({ id: pin.id, mode: 'resize', corner: ci }); }} />
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
      <div className="adm-hint mono">{msg || TOOLS.find((t) => t.id === tool)!.hint}</div>
    </div>
  );
}
