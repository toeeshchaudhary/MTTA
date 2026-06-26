'use client';
// Grid that only draws the lines currently on screen, recomputed on every pan/zoom
// from the SVG's live screen matrix — so it reads as infinite & stays locked to map
// coords. MUST render inside <TransformComponent> (needs .react-transform-wrapper + CTM).
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTransformEffect } from 'react-zoom-pan-pinch';
import { GRID } from '@/components/admin/lib/constants';

export default function InfiniteGrid({ svgRef }: { svgRef: React.RefObject<SVGSVGElement | null> }) {
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
